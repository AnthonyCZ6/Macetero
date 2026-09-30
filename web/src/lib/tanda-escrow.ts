import type { EscrowDeployPreview } from "@/types/tanda-escrow-preview";
import { prisma } from "@/lib/prisma";
import { AppError, isUniqueViolation } from "@/lib/api-error";
import { decrypt } from "@/lib/crypto";
import { isPlaceholderPhone } from "@/lib/phone-placeholder";
import {
  approveMilestone,
  changeMilestoneStatus,
  deploySingleRelease,
  findContractIdByEngagement,
  fundEscrow,
  getOperatorKeypair,
  getRoleAddresses,
  releaseFunds,
  resolveSecretForPublicKey,
  signAndSubmit,
  syncIndexerFromTx,
  submitTwSignedXdr,
  trustlessWorkConfigured,
} from "@/lib/trustless-work";
import {
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
} from "@stellar/stellar-sdk";
import { getServer } from "@/lib/stellar";

/** Contratos creados con SIMULATE_ESCROW_ON_CREATE (no existen en cadena). */
export function isSimulatedContract(contractId: string): boolean {
  return contractId.startsWith("SIM_");
}

/**
 * Milestone index string for Trustless Work (0-based). Se ordena por fecha de
 * inscripción (inmutable) y no por `numero_turno`, que cambia al posponer turnos:
 * así cada participante conserva su milestone durante todo el escrow.
 */
export async function milestoneIndexForUser(
  tandaId: string,
  userId: string
): Promise<string> {
  const turnos = await prisma.turno.findMany({
    where: { tanda_id: tandaId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { participante_id: true },
  });
  const idx = turnos.findIndex((t) => t.participante_id === userId);
  if (idx < 0) throw new AppError("No participas en esta tanda", 403);
  return String(idx);
}

export type { EscrowDeployPreview };

/** Mismos términos que se despliegan / que quedaron en cadena para un periodo. */
export async function buildEscrowPreviewForPeriod(
  tandaId: string,
  periodo: number
): Promise<EscrowDeployPreview> {
  const tanda = await prisma.tanda.findUnique({
    where: { id: tandaId },
  });
  if (!tanda) throw new AppError("Tanda no encontrada", 404);
  if (periodo < 1 || periodo > tanda.num_participantes) {
    throw new AppError("Periodo no válido");
  }

  const turnoReceiver = await prisma.turno.findFirst({
    where: { tanda_id: tandaId, numero_turno: periodo },
    include: { participante: { include: { wallet: true } } },
  });
  if (!turnoReceiver?.participante.wallet?.stellar_public_key) {
    throw new AppError(
      "El receptor de este periodo no tiene wallet Stellar registrada"
    );
  }

  const n = tanda.num_participantes;
  const monto = Number(tanda.monto_aportacion);
  const totalAmount = n * monto;
  const milestones = Array.from({ length: n }, (_, i) => ({
    title: `Aportación periodo ${periodo} — participante ${i + 1}`,
    description: `Fondo acumulado para el premio del periodo ${periodo}`,
  }));

  const row = await prisma.tandaEscrow.findUnique({
    where: {
      tanda_id_periodo: { tanda_id: tandaId, periodo },
    },
  });

  const receiverPhone = turnoReceiver.participante.phone;
  return {
    periodo,
    title: `Tanda ${tanda.nombre} — periodo ${periodo}`,
    description: `Escrow single-release: ${n} aportaciones, un desembolso al receptor del turno.`,
    amount: totalAmount,
    platformFee: 0,
    receiver: turnoReceiver.participante.wallet.stellar_public_key.trim(),
    receiverDisplayName:
      turnoReceiver.participante.name ||
      (isPlaceholderPhone(receiverPhone) ? null : receiverPhone) ||
      "Participante",
    milestones,
    numParticipantes: n,
    montoAportacion: monto,
    contractId: row?.contract_id ?? null,
    engagementId: row?.engagement_id ?? null,
  };
}

/** Lectura del contrato (modal) para participantes u organizador una vez desplegado o para consultar términos. */
export async function getEscrowContractViewForMember(
  tandaId: string,
  userId: string,
  periodo: number
): Promise<EscrowDeployPreview> {
  const tanda = await prisma.tanda.findUnique({
    where: { id: tandaId },
    include: { turnos: { select: { participante_id: true } } },
  });
  if (!tanda) throw new AppError("Tanda no encontrada", 404);
  const isOrganizer = tanda.organizador_id === userId;
  const isParticipant = tanda.turnos.some((t) => t.participante_id === userId);
  if (!isOrganizer && !isParticipant) {
    throw new AppError("Solo participantes de la tanda pueden ver este contrato", 403);
  }
  return buildEscrowPreviewForPeriod(tandaId, periodo);
}

/** Vista previa para el organizador (modal) antes de firmar el despliegue en cadena. */
export async function getEscrowDeployPreviewForOrganizer(
  tandaId: string,
  userId: string
): Promise<EscrowDeployPreview> {
  const tanda = await prisma.tanda.findUnique({
    where: { id: tandaId },
    include: {
      organizador: { include: { wallet: true } },
    },
  });
  if (!tanda) throw new AppError("Tanda no encontrada", 404);
  if (tanda.organizador_id !== userId) {
    throw new AppError("Solo el organizador puede desplegar el escrow", 403);
  }
  if (!tanda.organizador.wallet?.stellar_public_key) {
    throw new AppError(
      "Registra tu wallet Stellar en Perfil antes de desplegar el escrow"
    );
  }
  if (tanda.estado !== "activa") {
    throw new AppError("La tanda debe estar activa", 409);
  }

  const periodo = tanda.periodo_actual;
  const existing = await prisma.tandaEscrow.findUnique({
    where: {
      tanda_id_periodo: { tanda_id: tandaId, periodo },
    },
  });
  if (existing) {
    throw new AppError("Ya existe un contrato escrow para este periodo", 409);
  }

  return buildEscrowPreviewForPeriod(tandaId, periodo);
}

/** Guarda el contrato del periodo; si otro proceso ya lo registró, devuelve ese. */
async function saveTandaEscrow(data: {
  tanda_id: string;
  periodo: number;
  contract_id: string;
  engagement_id: string;
}) {
  try {
    return await prisma.tandaEscrow.create({
      data: { ...data, estado: "deployed" },
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const existing = await prisma.tandaEscrow.findUnique({
      where: {
        tanda_id_periodo: { tanda_id: data.tanda_id, periodo: data.periodo },
      },
    });
    if (!existing) throw e;
    return existing;
  }
}

export type OrganizerDeployResult =
  | { status: "deployed"; contractId: string; txHash: string }
  | { status: "pending_index"; engagementId: string; txHash: string };

/**
 * Despliega el escrow del periodo actual firmando con la wallet del organizador.
 * El payload se arma aquí con los datos de la tanda: el cliente solo confirma.
 */
export async function deployOrganizerEscrow(
  tandaId: string,
  userId: string
): Promise<OrganizerDeployResult> {
  const preview = await getEscrowDeployPreviewForOrganizer(tandaId, userId);
  const organizer = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { wallet: true },
  });
  const wallet = organizer.wallet!;
  const signerPublicKey = wallet.stellar_public_key.trim();

  const engagementId = `tanda-${tandaId.slice(0, 8)}-p${preview.periodo}-${Date.now()}`;
  const { unsignedTransaction } = await deploySingleRelease({
    engagementId,
    title: preview.title,
    description: preview.description,
    amount: preview.amount,
    platformFee: preview.platformFee,
    receiver: preview.receiver,
    milestones: preview.milestones,
    signer: signerPublicKey,
  });

  const { hash } = await signAndSubmit(
    unsignedTransaction,
    decrypt(wallet.encrypted_secret)
  );
  await syncIndexerFromTx(hash);

  const contractId = await findContractIdByEngagement(
    engagementId,
    signerPublicKey
  );
  if (!contractId) {
    return { status: "pending_index", engagementId, txHash: hash };
  }

  const row = await saveTandaEscrow({
    tanda_id: tandaId,
    periodo: preview.periodo,
    contract_id: contractId,
    engagement_id: engagementId,
  });
  return { status: "deployed", contractId: row.contract_id, txHash: hash };
}

/**
 * Registra un contrato ya desplegado por el organizador cuando el indexador
 * tardó en verlo. Solo busca escrows firmados por la wallet del organizador,
 * que únicamente el servidor puede firmar.
 */
export async function finalizeOrganizerEscrowDeploy(
  tandaId: string,
  userId: string,
  engagementId: string,
  options?: { txHash?: string }
): Promise<{ contractId: string }> {
  const tanda = await prisma.tanda.findUnique({
    where: { id: tandaId },
    include: { organizador: { include: { wallet: true } } },
  });
  if (!tanda) throw new AppError("Tanda no encontrada", 404);
  if (tanda.organizador_id !== userId) {
    throw new AppError("Solo el organizador puede registrar el escrow", 403);
  }
  const pubkey = tanda.organizador.wallet?.stellar_public_key?.trim();
  if (!pubkey) throw new AppError("Wallet del organizador no encontrada");

  const periodo = tanda.periodo_actual;
  if (!engagementId.startsWith(`tanda-${tandaId.slice(0, 8)}-p${periodo}-`)) {
    throw new AppError("El contrato no corresponde al periodo actual de la tanda");
  }

  const existing = await prisma.tandaEscrow.findUnique({
    where: {
      tanda_id_periodo: { tanda_id: tandaId, periodo },
    },
  });
  if (existing) {
    return { contractId: existing.contract_id };
  }

  if (options?.txHash) {
    await syncIndexerFromTx(options.txHash);
  }

  const contractId =
    (await findContractIdByEngagement(engagementId, pubkey)) ?? "";
  if (!contractId) {
    throw new AppError(
      "No se encontró el contrato en el indexador. Espera unos segundos y vuelve a intentar el registro.",
      409
    );
  }

  const row = await saveTandaEscrow({
    tanda_id: tandaId,
    periodo,
    contract_id: contractId,
    engagement_id: engagementId,
  });
  return { contractId: row.contract_id };
}

/** Escrow del periodo actual; si no existe, lo despliega el operador del servidor. */
export async function ensureEscrowForCurrentPeriod(tandaId: string) {
  const tanda = await prisma.tanda.findUnique({ where: { id: tandaId } });
  if (!tanda || tanda.estado !== "activa") {
    throw new AppError("La tanda no está activa", 409);
  }

  const periodo = tanda.periodo_actual;
  const existing = await prisma.tandaEscrow.findUnique({
    where: {
      tanda_id_periodo: { tanda_id: tandaId, periodo },
    },
  });
  if (existing) return existing;

  const preview = await buildEscrowPreviewForPeriod(tandaId, periodo);
  const engagementId = `tanda-${tandaId.slice(0, 8)}-p${periodo}-${Date.now()}`;

  const { unsignedTransaction } = await deploySingleRelease({
    engagementId,
    title: preview.title,
    description: preview.description,
    amount: preview.amount,
    platformFee: preview.platformFee,
    receiver: preview.receiver,
    milestones: preview.milestones,
  });

  const op = getOperatorKeypair();
  const result = await signAndSubmit(unsignedTransaction, op.secret());
  await syncIndexerFromTx(result.hash);

  const contractId =
    (await findContractIdByEngagement(engagementId, op.publicKey())) ?? "";

  if (!contractId) {
    throw new Error(
      "Escrow desplegado pero no se pudo leer contractId del indexer. Reintenta o revisa TRUSTLESS_WORK_API_KEY / indexer."
    );
  }

  return saveTandaEscrow({
    tanda_id: tandaId,
    periodo,
    contract_id: contractId,
    engagement_id: engagementId,
  });
}

/** Marca y aprueba un milestone (roles serviceProvider y approver del servidor). */
async function completeAndApproveMilestone(
  contractId: string,
  milestoneIndex: string
): Promise<{ markHash: string; approveHash: string }> {
  const roles = getRoleAddresses();
  const spSecret = resolveSecretForPublicKey(roles.serviceProvider);
  const apprSecret = resolveSecretForPublicKey(roles.approver);

  const { unsignedTransaction: uMark } = await changeMilestoneStatus({
    contractId,
    milestoneIndex,
    newStatus: "Completed",
  });
  const markResult = await signAndSubmit(uMark, spSecret);

  const { unsignedTransaction: uAppr } = await approveMilestone({
    contractId,
    milestoneIndex,
  });
  const apprResult = await signAndSubmit(uAppr, apprSecret);

  return { markHash: markResult.hash, approveHash: apprResult.hash };
}

/** Fund + mark milestone + approve. No libera fondos. */
export async function submitEscrowContribution(params: {
  tandaId: string;
  userId: string;
  basePay: number;
  payerSecret: string;
}): Promise<{ fundHash: string; markHash: string; approveHash: string }> {
  const escrow = await ensureEscrowForCurrentPeriod(params.tandaId);
  if (isSimulatedContract(escrow.contract_id)) {
    throw new AppError(
      "El escrow de este periodo es simulado (SIMULATE_ESCROW_ON_CREATE). Activa TANDA_PAY_VISUAL_ONLY para pagar sin red.",
      409
    );
  }
  const mIdx = await milestoneIndexForUser(params.tandaId, params.userId);

  const { unsignedTransaction: uFund } = await fundEscrow({
    contractId: escrow.contract_id,
    funderSecret: params.payerSecret,
    amount: String(params.basePay),
  });
  const fundResult = await signAndSubmit(uFund, params.payerSecret);

  const { markHash, approveHash } = await completeAndApproveMilestone(
    escrow.contract_id,
    mIdx
  );

  return {
    fundHash: fundResult.hash,
    markHash,
    approveHash,
  };
}

const RELEASE_STALE_MS = 10 * 60 * 1000;

export type ReleaseResult =
  | { status: "released"; hash: string }
  /** No hay contrato real que liberar (sin escrow, simulado o ya liberado). */
  | { status: "none" }
  /** Otro proceso está liberando este escrow en este momento. */
  | { status: "busy" };

/**
 * Libera el escrow de un periodo al receptor del turno. Primero "reclama" la
 * fila (deployed → releasing) para que solo un proceso ejecute la liberación;
 * los milestones de aportaciones canceladas se aprueban sin fondos antes de liberar.
 */
export async function releaseEscrowForPeriod(
  tandaId: string,
  periodo: number
): Promise<ReleaseResult> {
  const escrow = await prisma.tandaEscrow.findUnique({
    where: {
      tanda_id_periodo: { tanda_id: tandaId, periodo },
    },
  });
  if (
    !escrow ||
    escrow.estado === "released" ||
    isSimulatedContract(escrow.contract_id)
  ) {
    return { status: "none" };
  }
  if (!trustlessWorkConfigured()) {
    throw new Error(
      `El periodo ${periodo} tiene un escrow en cadena pero Trustless Work no está configurado para liberarlo`
    );
  }

  const claim = await prisma.tandaEscrow.updateMany({
    where: {
      id: escrow.id,
      OR: [
        { estado: "deployed" },
        {
          estado: "releasing",
          updatedAt: { lt: new Date(Date.now() - RELEASE_STALE_MS) },
        },
      ],
    },
    data: { estado: "releasing" },
  });
  if (claim.count === 0) return { status: "busy" };

  try {
    const cancelados = await prisma.pago.findMany({
      where: { tanda_id: tandaId, periodo, estado: "cancelado" },
      select: { pagador_id: true },
    });
    for (const { pagador_id } of cancelados) {
      try {
        const idx = await milestoneIndexForUser(tandaId, pagador_id);
        await completeAndApproveMilestone(escrow.contract_id, idx);
      } catch (e) {
        // Si ya estaba aprobado (reintento), la liberación sigue adelante.
        console.warn(`Aprobar milestone de pago cancelado (${pagador_id}):`, e);
      }
    }

    const { unsignedTransaction } = await releaseFunds({
      contractId: escrow.contract_id,
    });
    const roles = getRoleAddresses();
    const relSecret = resolveSecretForPublicKey(roles.releaseSigner);
    const result = await signAndSubmit(unsignedTransaction, relSecret);

    await prisma.tandaEscrow.update({
      where: { id: escrow.id },
      data: { estado: "released" },
    });
    return { status: "released", hash: result.hash };
  } catch (e) {
    await prisma.tandaEscrow.update({
      where: { id: escrow.id },
      data: { estado: "deployed" },
    });
    throw e;
  }
}

export async function payLateFeeNativeXlm(params: {
  payerSecret: string;
  amount: number;
  organizerPublicKey: string;
}): Promise<string> {
  const server = getServer();
  const kp = Keypair.fromSecret(params.payerSecret);
  const networkPassphrase =
    process.env["STELLAR_NETWORK_PASSPHRASE"] || Networks.TESTNET;
  const sourceAccount = await server.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: params.organizerPublicKey,
        asset: Asset.native(),
        amount: params.amount.toFixed(7),
      })
    )
    .setTimeout(30)
    .build();
  tx.sign(kp);
  const out = await submitTwSignedXdr(tx.toXDR());
  return out.hash;
}

export { trustlessWorkConfigured };
