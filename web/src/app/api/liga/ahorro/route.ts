import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function displayName(name: string | null | undefined): string {
  if (name?.trim()) return name.trim();
  return "Participante";
}

/** GET /api/liga/ahorro?userId= — ranking por MXN depositados vía onramp (proxy de ahorro). */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");

    const sums = await prisma.order.groupBy({
      by: ["userId"],
      where: { type: "onramp" },
      _sum: { amount: true },
    });

    const sumByUser = new Map<string, number>();
    for (const row of sums) {
      sumByUser.set(row.userId, Number(row._sum.amount ?? 0));
    }

    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true },
    });

    const withTotals = allUsers.map((u) => ({
      userId: u.id,
      name: displayName(u.name),
      initials: initialsFromName(u.name),
      guardado: sumByUser.get(u.id) ?? 0,
    }));

    withTotals.sort((a, b) => {
      if (b.guardado !== a.guardado) return b.guardado - a.guardado;
      return a.userId.localeCompare(b.userId);
    });

    const ranked = withTotals.map((u, i) => ({ ...u, rank: i + 1 }));

    const entries = ranked
      .filter((u) => u.guardado > 0)
      .slice(0, 50)
      .map(({ userId: id, name, initials, guardado, rank }) => ({
        userId: id,
        name,
        initials,
        guardado,
        rank,
      }));

    let me: {
      userId: string;
      name: string;
      initials: string;
      guardado: number;
      rank: number;
      nextRank: number | null;
      nextGuardado: number | null;
      inLeaderboardList: boolean;
    } | null = null;

    if (userId) {
      const row = ranked.find((u) => u.userId === userId);
      if (row) {
        const idx = ranked.findIndex((u) => u.userId === userId);
        const above = idx > 0 ? ranked[idx - 1] : null;
        me = {
          userId: row.userId,
          name: row.name,
          initials: row.initials,
          guardado: row.guardado,
          rank: row.rank,
          nextRank: above ? above.rank : null,
          nextGuardado: above ? above.guardado : null,
          inLeaderboardList: entries.some((e) => e.userId === userId),
        };
      }
    }

    return NextResponse.json({ entries, me });
  } catch (e) {
    console.error("Ahorro leaderboard error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
