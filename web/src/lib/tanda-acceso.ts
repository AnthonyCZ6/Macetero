import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/api-error";

/** Lanza 404/403 si la tanda no existe o el usuario no es organizador ni participante. */
export async function assertMiembroDeTanda(
  tandaId: string,
  userId: string
): Promise<void> {
  const tanda = await prisma.tanda.findUnique({
    where: { id: tandaId },
    select: {
      organizador_id: true,
      turnos: { where: { participante_id: userId }, select: { id: true } },
    },
  });
  if (!tanda) throw new AppError("Tanda no encontrada", 404);
  if (tanda.organizador_id !== userId && tanda.turnos.length === 0) {
    throw new AppError("Solo los participantes pueden ver esta tanda", 403);
  }
}
