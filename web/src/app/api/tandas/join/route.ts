import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError, errorResponse, isUniqueViolation } from "@/lib/api-error";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";
import { bloqueoVigente } from "@/lib/tanda";
import { maxTandasForLevel, maxTandasExceededMessage } from "@/lib/tanda-limits";
import { activarTanda } from "@/lib/tanda-periodo";

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const { codigo } = await req.json();

    if (typeof codigo !== "string" || !codigo.trim()) {
      throw new AppError("El código de invitación es obligatorio");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.kyc_status !== "approved" && user.kyc_status !== "not_started") {
      // In sandbox we allow not_started; production would require approved
    }

    if (bloqueoVigente(user)) {
      throw new AppError("No puedes unirte a tandas mientras tu cuenta esté bloqueada", 403);
    }

    // Check max tandas by level
    const activeTandas = await prisma.turno.count({
      where: {
        participante_id: userId,
        estado_turno: { not: "expulsado" },
        tanda: { estado: { in: ["pendiente", "activa"] } },
      },
    });
    if (activeTandas >= maxTandasForLevel(user.level)) {
      throw new AppError(maxTandasExceededMessage(user.level));
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const tanda = await tx.tanda.findUnique({
          where: { codigo_invitacion: codigo.trim().toUpperCase() },
          include: { turnos: true },
        });

        if (!tanda) {
          throw new AppError("No existe una tanda con ese código", 404);
        }
        if (tanda.estado !== "pendiente") {
          throw new AppError("Esta tanda ya no acepta participantes");
        }
        if (tanda.turnos.some((t) => t.participante_id === userId)) {
          throw new AppError("Ya estás en esta tanda", 409);
        }
        if (tanda.turnos.length >= tanda.num_participantes) {
          throw new AppError("La tanda ya está llena");
        }

        const nextTurnNumber = tanda.turnos.length + 1;

        // Assign the next turn
        await tx.turno.create({
          data: {
            tanda_id: tanda.id,
            participante_id: userId,
            numero_turno: nextTurnNumber,
            monto_premio: Number(tanda.monto_aportacion) * tanda.num_participantes,
          },
        });

        const nowFull = nextTurnNumber === tanda.num_participantes;
        if (nowFull) {
          // Auto-activate the tanda and create all Pago records
          await activarTanda(tx, tanda.id);
        }

        return {
          tandaId: tanda.id,
          turnoAsignado: nextTurnNumber,
          totalParticipantes: tanda.num_participantes,
          estado: nowFull ? "activa" : "pendiente",
        };
      },
      { timeout: 20_000 }
    );

    return NextResponse.json(result);
  } catch (e) {
    // Dos personas tomando el mismo turno a la vez: la segunda debe reintentar.
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: "Alguien más se unió al mismo tiempo. Intenta de nuevo." },
        { status: 409 }
      );
    }
    return errorResponse("Join tanda", e);
  }
}
