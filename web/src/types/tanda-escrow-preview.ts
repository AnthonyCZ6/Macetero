/** Vista previa del escrow single-release (API + modal del organizador). */
export type EscrowDeployPreview = {
  periodo: number;
  title: string;
  description: string;
  amount: number;
  platformFee: number;
  receiver: string;
  receiverDisplayName: string;
  milestones: Array<{ title: string; description: string }>;
  numParticipantes: number;
  montoAportacion: number;
  /** Si ya hay contrato en cadena para este periodo (solo lectura en modal). */
  contractId?: string | null;
  engagementId?: string | null;
};
