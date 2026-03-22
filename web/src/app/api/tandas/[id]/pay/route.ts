import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { submitTransaction } from "@/lib/stellar";
import { POINTS_ON_TIME } from "@/lib/tanda";
import {
  payLateFeeNativeXlm,
  releaseEscrowForPeriod,
  submitEscrowContribution,
  trustlessWorkConfigured,
} from "@/lib/tanda-escrow";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tandaId } = await params;
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const tanda = await prisma.tanda.findUnique({ where: { id: tandaId } });
    if (!tanda || tanda.estado !== "activa") {
      return NextResponse.json({ error: "Tanda not active" }, { status: 400 });
    }

    const pago = await prisma.pago.findUnique({
      where: {
        tanda_id_pagador_id_periodo: {
          tanda_id: tandaId,
          pagador_id: userId,
          periodo: tanda.periodo_actual,
        },
      },
    });

    if (!pago) {
      return NextResponse.json({ error: "No payment found for this period" }, { status: 404 });
    }

    if (pago.estado === "pagado") {
      return NextResponse.json({ error: "Already paid for this period" }, { status: 409 });
    }

    const turnoRecipient = await prisma.turno.findUnique({
      where: {
        tanda_id_numero_turno: {
          tanda_id: tandaId,
          numero_turno: tanda.periodo_actual,
        },
      },
      include: { participante: { include: { wallet: true } } },
    });

    if (!turnoRecipient?.participante.wallet) {
      return NextResponse.json({ error: "Recipient wallet not found" }, { status: 500 });
    }

    const payer = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!payer?.wallet) {
      return NextResponse.json({ error: "Payer wallet not found" }, { status: 400 });
    }

    const totalToPay = Number(pago.monto_total);
    const basePay = Number(pago.monto_base);
    const lateFee = Number(pago.cargo_retraso);

    const unpaidBefore = await prisma.pago.count({
      where: {
        tanda_id: tandaId,
        periodo: tanda.periodo_actual,
        estado: { not: "pagado" },
      },
    });

    const payerSecret = decrypt(payer.wallet.encrypted_secret);
    const useEscrow = trustlessWorkConfigured();

    let primaryTxHash: string;
    let escrowMeta:
      | {
          fundHash: string;
          markHash: string;
          approveHash: string;
          releaseHash?: string;
        }
      | undefined;

    if (useEscrow) {
      const organizer = await prisma.user.findUnique({
        where: { id: tanda.organizador_id },
        include: { wallet: true },
      });
      if (lateFee > 0 && organizer?.wallet) {
        await payLateFeeNativeXlm({
          payerSecret,
          amount: lateFee,
          organizerPublicKey: organizer.wallet.stellar_public_key,
        });
      }

      const escrowHashes = await submitEscrowContribution({
        tandaId,
        userId,
        basePay,
        payerSecret,
      });
      primaryTxHash = escrowHashes.fundHash;
      escrowMeta = escrowHashes;

      if (unpaidBefore === 1) {
        const releaseHash = await releaseEscrowForPeriod(tandaId);
        escrowMeta = { ...escrowMeta, releaseHash };
      }
    } else {
      const { Keypair, TransactionBuilder, Operation, Asset, Networks } =
        await import("@stellar/stellar-sdk");
      const { getServer } = await import("@/lib/stellar");

      const server = getServer();
      const payerKeypair = Keypair.fromSecret(payerSecret);
      const networkPassphrase =
        process.env["STELLAR_NETWORK_PASSPHRASE"] || Networks.TESTNET;

      const sourceAccount = await server.getAccount(payer.wallet.stellar_public_key);

      const builder = new TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase,
      });

      builder.addOperation(
        Operation.payment({
          destination: turnoRecipient.participante.wallet.stellar_public_key,
          asset: Asset.native(),
          amount: basePay.toFixed(7),
        })
      );

      if (lateFee > 0) {
        const organizer = await prisma.user.findUnique({
          where: { id: tanda.organizador_id },
          include: { wallet: true },
        });
        if (organizer?.wallet) {
          builder.addOperation(
            Operation.payment({
              destination: organizer.wallet.stellar_public_key,
              asset: Asset.native(),
              amount: lateFee.toFixed(7),
            })
          );
        }
      }

      const tx = builder.setTimeout(30).build();
      tx.sign(payerKeypair);
      const signedXdr = tx.toXDR();

      const result = await submitTransaction(signedXdr);
      primaryTxHash = result.hash;
    }

    await prisma.pago.update({
      where: { id: pago.id },
      data: {
        estado: "pagado",
        fecha_pago: new Date(),
        stellar_tx_hash: primaryTxHash,
      },
    });

    if (pago.dias_retraso === 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          score: { increment: POINTS_ON_TIME },
          streak: { increment: 1 },
        },
      });
    }

    const unpaidCount = await prisma.pago.count({
      where: {
        tanda_id: tandaId,
        periodo: tanda.periodo_actual,
        estado: { not: "pagado" },
      },
    });

    let prizeDelivered = false;

    if (unpaidCount === 0) {
      await prisma.turno.update({
        where: { id: turnoRecipient.id },
        data: { estado_turno: "completado", premio_entregado: true },
      });

      const isLastPeriod = tanda.periodo_actual >= tanda.num_participantes;

      if (isLastPeriod) {
        await prisma.tanda.update({
          where: { id: tandaId },
          data: { estado: "completada" },
        });
      } else {
        await prisma.tanda.update({
          where: { id: tandaId },
          data: { periodo_actual: { increment: 1 } },
        });
      }

      prizeDelivered = true;
    }

    return NextResponse.json({
      success: true,
      mode: useEscrow ? "trustless_work_escrow" : "direct_xlm",
      txHash: primaryTxHash,
      escrow: escrowMeta,
      montoPagado: totalToPay,
      cargoRetraso: lateFee,
      prizeDelivered,
      allPaid: unpaidCount === 0,
    });
  } catch (e) {
    console.error("Pay tanda error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
