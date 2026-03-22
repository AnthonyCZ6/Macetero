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

/** GET /api/liga/leaderboard?userId= — ranking por puntos (puntualidad). */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");

    const top = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        score: true,
        streak: true,
      },
      orderBy: [{ score: "desc" }, { id: "asc" }],
      take: 50,
    });

    const entries = top.map((u, i) => ({
      userId: u.id,
      name: displayName(u.name),
      initials: initialsFromName(u.name),
      score: u.score,
      streak: u.streak,
      rank: i + 1,
    }));

    let me: {
      userId: string;
      name: string;
      initials: string;
      score: number;
      streak: number;
      rank: number;
      nextRank: number | null;
      nextRankScore: number | null;
      inLeaderboardList: boolean;
    } | null = null;

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, score: true, streak: true },
      });

      if (user) {
        const higher = await prisma.user.count({
          where: { score: { gt: user.score } },
        });
        const rank = higher + 1;

        const nextAbove = await prisma.user.findFirst({
          where: { score: { gt: user.score } },
          orderBy: [{ score: "asc" }, { id: "asc" }],
          select: { score: true },
        });

        const inLeaderboardList = top.some((u) => u.id === userId);

        me = {
          userId: user.id,
          name: displayName(user.name),
          initials: initialsFromName(user.name),
          score: user.score,
          streak: user.streak,
          rank,
          nextRank: rank > 1 ? rank - 1 : null,
          nextRankScore: nextAbove?.score ?? null,
          inLeaderboardList,
        };
      }
    }

    return NextResponse.json({ entries, me });
  } catch (e) {
    console.error("Leaderboard error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
