import { NextResponse } from "next/server";

/**
 * Error pensado para mostrarse al usuario tal cual (validaciones, permisos,
 * estados de negocio). Cualquier otro error se registra y se responde genérico.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Respuesta de error: el mensaje de AppError, o uno genérico en producción. */
export function errorResponse(context: string, e: unknown) {
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(`${context}:`, e);
  const detail =
    process.env.NODE_ENV !== "production" && e instanceof Error
      ? e.message
      : null;
  return NextResponse.json(
    { error: detail ?? "Error interno. Intenta de nuevo más tarde." },
    { status: 500 }
  );
}

/** true si el error de Prisma es una violación de restricción única (P2002). */
export function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}
