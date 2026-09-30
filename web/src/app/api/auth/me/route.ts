import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { isPlaceholderPhone } from "@/lib/phone-placeholder";
import {
  clearSessionCookie,
  getSessionUserId,
  unauthorizedResponse,
} from "@/lib/session";

/** GET — usuario de la sesión actual (401 si no hay sesión válida). */
export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!user) {
      const res = unauthorizedResponse();
      clearSessionCookie(res);
      return res;
    }
    return NextResponse.json({
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: isPlaceholderPhone(user.phone) ? null : user.phone,
    });
  } catch (e) {
    return errorResponse("Auth me", e);
  }
}
