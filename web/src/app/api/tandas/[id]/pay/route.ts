import { NextRequest, NextResponse } from "next/server";
import {
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { prisma } from "@/lib/prisma";
import { AppError, errorResponse } from "@/lib/api-error";
import { decrypt } from "@/lib/crypto";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";
import { getServer, submitTransaction } from "@/lib/stellar";
import {
  PAGO_ESTADOS_ABIERTOS,
  POINTS_ON_TIME,
  estadoPagoPorRetraso,
} from "@/lib/tanda";
import { isTandaPayVisualOnly } from "@/lib/tanda-pay-visual";
import {
  payLateFeeNativeXlm,
  submitEscrowContribution,
  trustlessWorkConfigured,
} from "@/lib/tanda-escrow";
import { cerrarPeriodoSiCompleto, type CierrePeriodo } from "@/lib/tanda-periodo";

/** Con escrow el pago encadena varias transacciones en Stellar. */
export const maxDuration = 300;

/** Un pago en `procesando` más viejo que esto se considera abandonado y se puede reintentar. */
const PROCESANDO_STALE_MS = 10 * 60 * 1000;

type Movimiento = {
  txHash: string | null;
  escrow?: { fundHash: string; markHash: string; approveHash: string };
};

async function pagoDirectoXlm(params: {
  payerSecret: string;
  payerPublicKey: string;
  receptorPublicKey: string;
  organizadorPublicKey: string | null;
  basePay: number;
  lateFee: number;
}): Promise<string | null> {
  const destinos: Array<{ destination: string; amount: number }> = [];
  if (params.receptorPublicKey !== params.payerPublicKey) {
    destinos.push({ destination: params.receptorPublicKey, amount: params.basePay });
  }
  if (
    params.lateFee > 0 &&
    params.organizadorPublicKey &&
    params.organizadorPublicKey !== params.payerPublicKey
  ) {
    destinos.push({ destination: params.organizadorPublicKey, amount: params.lateFee });
  }
  // El receptor que aporta a su propio turno no mueve fondos.
  if (destinos.length === 0) return null;

  const server = getServer();
  const networkPassphrase =
    process.env["STELLAR_NETWORK_PASSPHRASE"] || Networks.TESTNET;
  const builder = new TransactionBuilder(
    await server.getAccount(params.payerPublicKey),
    { fee: "100", networkPassphrase }
  );
  for (const d of destinos) {
    builder.addOperation(
      Operation.payment({
        destination: d.destination,
        asset: Asset.native(),
        amount: d.amount.toFixed(7),
      })
    );
  }
  const tx = builder.setTimeout(30).build();
  tx.sign(Keypair.fromSecret(params.payerSecret));
  const result = await submitTransaction(tx.toXDR());
  return result.hash;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const { id: tandaId } = await params;

    const tanda = await prisma.tanda.findUnique({ where: { id: tandaId } });
    if (!tanda || tanda.estado !== "activa") {
      throw new AppError("La tanda no está activa", 409);
    }
    const periodo = tanda.periodo_actual;

    const pagoInicial = await prisma.pago.findUnique({
      where: {
        tanda_id_pagador_id_periodo: {
          tanda_id: tandaId,
          pagador_id: userId,
          periodo,
        },
      },
    });
    if (!pagoInicial) {
      throw new AppError("No tienes una aportación pendiente en este periodo", 404);
    }
    if (pagoInicial.estado === "pagado") {
      throw new AppError("Ya pagaste este periodo", 409);
    }
    if (pagoInicial.estado === "cancelado") {
      throw new AppError("Tu aportación de este periodo fue cancelada", 409);
    }

    const turnoReceptor = await prisma.turno.findUnique({
      where: {
        tanda_id_numero_turno: { tanda_id: tandaId, numero_turno: periodo },
      },
      include: { participante: { include: { wallet: true } } },
    });
    if (!turnoReceptor) {
      throw new Error(`La tanda ${tandaId} no tiene turno para el periodo ${periodo}`);
    }

    // Reclamo atómico: evita cobrar dos veces con doble clic o pestañas duplicadas.
    // `fecha_pago` guarda cuándo empezó el procesamiento mientras el estado es `procesando`.
    const ahora = new Date();
    const reclamo = await prisma.pago.updateMany({
      where: {
        id: pagoInicial.id,
        OR: [
          { estado: { in: PAGO_ESTADOS_ABIERTOS } },
          {
            estado: "procesando",
            fecha_pago: { lt: new Date(ahora.getTime() - PROCESANDO_STALE_MS) },
          },
        ],
      },
      data: { estado: "procesando", fecha_pago: ahora },
    });
    if (reclamo.count === 0) {
      throw new AppError("Tu pago ya se está procesando", 409);
    }

    // Releer después del reclamo: el cron pudo actualizar cargo o días de retraso.
    const pago = await prisma.pago.findUniqueOrThrow({ where: { id: pagoInicial.id } });
    const basePay = Number(pago.monto_base);
    const lateFee = Number(pago.cargo_retraso);
    const visualOnly = isTandaPayVisualOnly();
    const useEscrow = !visualOnly && trustlessWorkConfigured();

    let movimiento: Movimiento;
    try {
      if (visualOnly) {
        movimiento = { txHash: null };
      } else {
        const payer = await prisma.user.findUnique({
          where: { id: userId },
          include: { wallet: true },
        });
        if (!payer?.wallet) throw new AppError("No tienes wallet registrada");
        const receptorWallet = turnoReceptor.participante.wallet;
        if (!receptorWallet) {
          throw new AppError("El receptor de este periodo no tiene wallet registrada");
        }
        const organizer = await prisma.user.findUnique({
          where: { id: tanda.organizador_id },
          include: { wallet: true },
        });
        const organizadorPublicKey = organizer?.wallet?.stellar_public_key ?? null;
        const payerSecret = decrypt(payer.wallet.encrypted_secret);
        const payerPublicKey = payer.wallet.stellar_public_key;

        if (useEscrow) {
          if (
            lateFee > 0 &&
            organizadorPublicKey &&
            organizadorPublicKey !== payerPublicKey
          ) {
            await payLateFeeNativeXlm({
              payerSecret,
              amount: lateFee,
              organizerPublicKey: organizadorPublicKey,
            });
          }
          const escrow = await submitEscrowContribution({
            tandaId,
            userId,
            basePay,
            payerSecret,
          });
          movimiento = { txHash: escrow.fundHash, escrow };
        } else {
          movimiento = {
            txHash: await pagoDirectoXlm({
              payerSecret,
              payerPublicKey,
              receptorPublicKey: receptorWallet.stellar_public_key,
              organizadorPublicKey,
              basePay,
              lateFee,
            }),
          };
        }
      }
    } catch (e) {
      await prisma.pago.updateMany({
        where: { id: pago.id, estado: "procesando" },
        data: { estado: estadoPagoPorRetraso(pago.dias_retraso), fecha_pago: null },
      });
      throw e;
    }

    await prisma.$transaction(async (tx) => {
      await tx.pago.update({
        where: { id: pago.id },
        data: {
          estado: "pagado",
          fecha_pago: new Date(),
          stellar_tx_hash: movimiento.txHash,
        },
      });
      if (pago.dias_retraso === 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            score: { increment: POINTS_ON_TIME },
            streak: { increment: 1 },
          },
        });
      }
    });

    // El pago ya quedó registrado; si el cierre falla, el cron lo reintenta.
    let cierre: CierrePeriodo = { cerrado: false };
    let avisoCierre: string | undefined;
    try {
      cierre = await cerrarPeriodoSiCompleto(tandaId, periodo);
    } catch (e) {
      console.error(`Cerrar periodo ${periodo} de ${tandaId}:`, e);
      avisoCierre =
        "Tu pago quedó registrado. La entrega del premio se reintentará automáticamente.";
    }

    const pendientes = await prisma.pago.count({
      where: { tanda_id: tandaId, periodo, estado: { notIn: ["pagado", "cancelado"] } },
    });

    return NextResponse.json({
      success: true,
      mode: visualOnly ? "visual_demo" : useEscrow ? "trustless_work_escrow" : "direct_xlm",
      txHash: movimiento.txHash,
      escrow: movimiento.escrow
        ? { ...movimiento.escrow, releaseHash: cierre.releaseHash }
        : undefined,
      montoPagado: Number(pago.monto_total),
      cargoRetraso: lateFee,
      prizeDelivered: cierre.cerrado,
      allPaid: pendientes === 0,
      aviso: avisoCierre,
    });
  } catch (e) {
    return errorResponse("Pay tanda", e);
  }
}
