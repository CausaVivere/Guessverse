import { NextResponse, type NextRequest } from "next/server";
import { db } from "~/server/db";

// Simple shared-secret auth so only PartyKit can call this
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Verify the secret header
  const auth = req.headers.get("x-internal-secret");
  if (!INTERNAL_SECRET || auth !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const set = await db.animeGameset.findUnique({
    where: { id },
    include: {
      characters: {
        include: {
          voiceActors: true,
          anime: {
            include: {
              genres: true,
              explicitGenres: true,
              demographics: true,
              themes: true,
            },
          },
        },
      },
    },
  });

  if (!set) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  console.log(set.characters.map((c) => c.anime?.title));

  return NextResponse.json(set);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Verify the secret header
  const auth = req.headers.get("x-internal-secret");
  if (!INTERNAL_SECRET || auth !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const set = await db.animeGameset.update({
    where: { id },
    data: {
      plays: {
        increment: 1,
      },
    },
    select: { id: true },
  });

  if (!set) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(set);
}
