import type { EscrowDeployPreview } from "@/types/tanda-escrow-preview";
import { prisma } from "@/lib/prisma";
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

/** Milestone index string for Trustless Work (0-based, orden por numero_turno). */
export async function milestoneIndexForUser(
  tandaId: string,
  userId: string
): Promise<string> {
  const turnos = await prisma.turno.findMany({
    where: { tanda_id: tandaId },
    orderBy: { numero_turno: "asc" },
  });
  const idx = turnos.findIndex((t) => t.participante_id === userId);
  if (idx < 0) throw new Error("User is not a participant");
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
  if (!tanda) throw new Error("Tanda no encontrada");
  if (periodo < 1 || periodo > tanda.num_participantes) {
    throw new Error("Periodo no válido");
  }

  const turnoReceiver = await prisma.turno.findFirst({
    where: { tanda_id: tandaId, numero_turno: periodo },
    include: { participante: { include: { wallet: true } } },
  });
  if (!turnoReceiver?.participante.wallet?.stellar_public_key) {
    throw new Error(
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

  return {
    periodo,
    title: `Tanda ${tanda.nombre} — periodo ${periodo}`,
    description: `Escrow single-release: ${n} aportaciones, un desembolso al receptor del turno.`,
    amount: totalAmount,
    platformFee: 0,
    receiver: turnoReceiver.participante.wallet.stellar_public_key.trim(),
    receiverDisplayName:
      turnoReceiver.participante.name ||
      turnoReceiver.participante.phone ||
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
  if (!tanda) throw new Error("Tanda no encontrada");
  const isOrganizer = tanda.organizador_id === userId;
  const isParticipant = tanda.turnos.some((t) => t.participante_id === userId);
  if (!isOrganizer && !isParticipant) {
    throw new Error("Solo participantes de la tanda pueden ver este contrato");
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
  if (!tanda) throw new Error("Tanda no encontrada");
  if (tanda.organizador_id !== userId) {
    throw new Error("Solo el organizador puede desplegar el escrow");
  }
  if (!tanda.organizador.wallet?.stellar_public_key) {
    throw new Error(
      "Registra tu wallet Stellar en Perfil antes de desplegar el escrow"
    );
  }
  if (tanda.estado !== "activa") {
    throw new Error("La tanda debe estar activa");
  }

  const periodo = tanda.periodo_actual;
  const existing = await prisma.tandaEscrow.findUnique({
    where: {
      tanda_id_periodo: { tanda_id: tandaId, periodo },
    },
  });
  if (existing) {
    throw new Error("Ya existe un contrato escrow para este periodo");
  }

  return buildEscrowPreviewForPeriod(tandaId, periodo);
}

/** Tras desplegar y firmar con la wallet del organizador, registra el contrato en base de datos. */
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
  if (!tanda) throw new Error("Tanda no encontrada");
  if (tanda.organizador_id !== userId) {
    throw new Error("Solo el organizador puede registrar el escrow");
  }
  const pubkey = tanda.organizador.wallet?.stellar_public_key?.trim();
  if (!pubkey) throw new Error("Wallet del organizador no encontrada");

  const periodo = tanda.periodo_actual;
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
    throw new Error(
      "No se encontró el contrato en el indexador. Espera unos segundos y usa «Registrar contrato» de nuevo, o revisa la red."
    );
  }

  await prisma.tandaEscrow.create({
    data: {
      tanda_id: tandaId,
      periodo,
      contract_id: contractId,
      engagement_id: engagementId,
      estado: "deployed",
    },
  });

  return { contractId };
}

export async function ensureEscrowForCurrentPeriod(tandaId: string) {
  const tanda = await prisma.tanda.findUnique({
    where: { id: tandaId },
    include: { turnos: { orderBy: { numero_turno: "asc" } } },
  });
  if (!tanda || tanda.estado !== "activa") {
    throw new Error("Tanda not active");
  }

  const periodo = tanda.periodo_actual;
  const existing = await prisma.tandaEscrow.findUnique({
    where: {
      tanda_id_periodo: { tanda_id: tandaId, periodo },
    },
  });
  if (existing) return existing;

  const turnoReceiver = await prisma.turno.findFirst({
    where: { tanda_id: tandaId, numero_turno: periodo },
    include: { participante: { include: { wallet: true } } },
  });
  if (!turnoReceiver?.participante.wallet) {
    throw new Error("Receiver wallet not found for this period");
  }

  const n = tanda.num_participantes;
  const monto = Number(tanda.monto_aportacion);
  const totalAmount = n * monto;
  const engagementId = `tanda-${tandaId.slice(0, 8)}-p${periodo}-${Date.now()}`;

  const milestones = Array.from({ length: n }, (_, i) => ({
    title: `Aportación periodo ${periodo} — participante ${i + 1}`,
    description: `Fondo acumulado para el premio del periodo ${periodo}`,
  }));

  const { unsignedTransaction } = await deploySingleRelease({
    engagementId,
    title: `Tanda ${tanda.nombre} — periodo ${periodo}`,
    description: `Escrow single-release: ${n} aportaciones, un desembolso al receptor del turno.`,
    amount: totalAmount,
    platformFee: 0,
    receiver: turnoReceiver.participante.wallet.stellar_public_key,
    milestones,
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

  return prisma.tandaEscrow.create({
    data: {
      tanda_id: tandaId,
      periodo,
      contract_id: contractId,
      engagement_id: engagementId,
      estado: "deployed",
    },
  });
}

/** Fund + mark milestone + approve. No libera fondos. */
export async function submitEscrowContribution(params: {
  tandaId: string;
  userId: string;
  basePay: number;
  payerSecret: string;
}): Promise<{ fundHash: string; markHash: string; approveHash: string }> {
  const escrow = await ensureEscrowForCurrentPeriod(params.tandaId);
  const mIdx = await milestoneIndexForUser(params.tandaId, params.userId);

  const { unsignedTransaction: uFund } = await fundEscrow({
    contractId: escrow.contract_id,
    funderSecret: params.payerSecret,
    amount: String(params.basePay),
  });
  const fundResult = await signAndSubmit(uFund, params.payerSecret);

  const roles = getRoleAddresses();
  const spSecret = resolveSecretForPublicKey(roles.serviceProvider);
  const apprSecret = resolveSecretForPublicKey(roles.approver);

  const { unsignedTransaction: uMark } = await changeMilestoneStatus({
    contractId: escrow.contract_id,
    milestoneIndex: mIdx,
    newStatus: "Completed",
  });
  const markResult = await signAndSubmit(uMark, spSecret);

  const { unsignedTransaction: uAppr } = await approveMilestone({
    contractId: escrow.contract_id,
    milestoneIndex: mIdx,
  });
  const apprResult = await signAndSubmit(uAppr, apprSecret);

  return {
    fundHash: fundResult.hash,
    markHash: markResult.hash,
    approveHash: apprResult.hash,
  };
}

/** Libera el escrow al receptor del turno cuando todos los hitos están aprobados en cadena. */
export async function releaseEscrowForPeriod(tandaId: string) {
  const tanda = await prisma.tanda.findUniqueOrThrow({ where: { id: tandaId } });
  const escrow = await prisma.tandaEscrow.findUnique({
    where: {
      tanda_id_periodo: { tanda_id: tandaId, periodo: tanda.periodo_actual },
    },
  });
  if (!escrow) throw new Error("No TandaEscrow for current period");

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

  return result.hash;
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
