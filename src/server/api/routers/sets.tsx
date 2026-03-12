import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "~/env";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import type { AnimeCharacter } from "../../../../generated/prisma/client";

const tokens = {
  igdb: null,
} as {
  igdb: IGDBtoken | null;
};

export const setRouter = createTRPCRouter({
  getGames: protectedProcedure
    .input(z.object({ search: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const token = await getToken("igdb");
      if (!token) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Failed to get IGDB token",
        });
      }
      const response = await fetch(`https://api.igdb.com/v4/games`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-ID": env.IGDB_CLIENT,
        },
        body: `search "${input.search}"; fields name, cover.url,
       genres.name, first_release_date, summary, platforms.name, involved_companies.company.name; limit 10;`,
      });

      if (!response.ok) {
        console.error("Failed to fetch games from IGDB:", response, token);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to fetch games",
        });
      }

      const games = await response.json();
      return games;
    }),
  getGameCharacters: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const token = await getToken("igdb");
      if (!token) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Failed to get IGDB token",
        });
      }
      const response = await fetch(`https://api.igdb.com/v4/characters`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-ID": env.IGDB_CLIENT,
        },
        body: `fields name, mug_shot.url, description, character_gender, character_species; 
              where games = (${input.gameId}); 
              limit 50;`,
      });

      if (!response.ok) {
        console.error("Failed to fetch characters from IGDB:", response, token);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to fetch characters",
        });
      }

      const characters = await response.json();
      return characters;
    }),
  getAnimes: protectedProcedure
    .input(z.object({ search: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const response = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(input.search)}&limit=10`,
      );

      if (!response.ok) {
        console.error("Failed to fetch animes from Jikan:", response);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to fetch animes",
        });
      }

      const animes = await response.json();
      return animes;
    }),
  getAnimeCharacters: protectedProcedure
    .input(z.object({ animeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const characters = await ctx.db.animeCharacter.findMany({
        where: { animeId: parseInt(input.animeId) },
      });

      if (characters.length > 0) return characters;

      // else cache
      const anime = await cacheAnime(input.animeId);
      return await cacheAnimeCharacters(anime.id);
    }),
  createAnimeSet: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(45),
        animeIds: z.array(z.number()).min(1),
        characterIds: z.array(z.number()).min(24),
        mostCommonAnimeId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const img = await ctx.db.anime.findFirst({
        where: { id: input.mostCommonAnimeId },
        select: { image: true },
      });

      const set = await ctx.db.animeGameset.create({
        data: {
          name: input.name,
          img: img?.image,
          creatorId: ctx.auth.userId!,
          creatorName:
            ctx.auth.user.fullName ?? ctx.auth.user.username ?? "unknown",
          animes: { connect: input.animeIds.map((id) => ({ id })) },
          characters: { connect: input.characterIds.map((id) => ({ id })) },
        },
      });

      if (!set) {
        throw new TRPCError({
          message: "Error creating anime set.",
          code: "BAD_REQUEST",
        });
      }

      return set;
    }),
});

const getToken = (api: "igdb" | "tmdb" | "jikan") => {
  return api === "igdb" ? getTokenIGDB() : null;
};

const getTokenIGDB = async () => {
  if (tokens.igdb && tokens.igdb.expiresAt > new Date())
    return tokens.igdb.access_token;
  else if (tokens.igdb && tokens.igdb.expiresAt <= new Date()) {
    tokens.igdb = null;
    return await generateIGDBtoken();
  }

  const existing = await db.apiTokens.findUnique({ where: { id: "igdb" } });
  if (existing) {
    const now = new Date();
    if (existing.expiresAt > now) {
      tokens.igdb = {
        access_token: existing.token,
        expiresAt: existing.expiresAt,
      };
      return existing.token;
    } else return await generateIGDBtoken();
  } else return await generateIGDBtoken();
};

const generateIGDBtoken = async () => {
  try {
    console.log("Generating new IGDB token...");
    const req = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${env.IGDB_CLIENT}&client_secret=${env.IGDB_SECRET}&grant_type=client_credentials`,
      { method: "POST" },
    );

    const token = (await req.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    console.log("Generated IGDB token:", token.access_token);

    const update = await db.apiTokens.upsert({
      where: { id: "igdb" },
      update: {
        token: token.access_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
      },
      create: {
        id: "igdb",
        token: token.access_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
      },
    });

    tokens.igdb = {
      access_token: update.token,
      expiresAt: update.expiresAt,
    };

    return update.token;
  } catch (err) {
    throw new TRPCError({
      message: "Failed to generate IGDB API Token :" + err,
      code: "BAD_REQUEST",
    });
  }
};

export type IGDBtoken = {
  access_token: string;
  expiresAt: Date;
};

async function cacheAnime(animeId: string) {
  const animeRes = await fetch(`https://api.jikan.moe/v4/anime/${animeId}`, {
    method: "GET",
  });

  if (!animeRes.ok) {
    console.error("Failed to fetch characters from Jikan:", animeRes);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Failed to fetch characters",
    });
  }

  const animeObject = await animeRes.json();
  const anime = animeObject.data as AnimeObject;

  if (!anime)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Failed to fetch anime, might not exist",
    });

  try {
    const animeData = formatAnime(anime);
    const connectEntities = (entities: JikanEntity[]) =>
      entities.map((e) => ({ id: e.mal_id }));

    // Pre-create all JikanEntities so the upsert can just connect to them
    const allEntities = [
      ...anime.studios,
      ...anime.genres,
      ...anime.explicit_genres,
      ...anime.themes,
      ...anime.demographics,
    ];

    if (allEntities.length > 0) {
      await db.jikanEntity.createMany({
        data: allEntities.map((e) => ({
          id: e.mal_id,
          name: e.name,
          type: e.type,
          url: e.url,
        })),
        skipDuplicates: true,
      });
    }

    const data = await db.anime.upsert({
      where: { id: anime.mal_id },
      update: {
        ...animeData,
        studios: { set: connectEntities(anime.studios) },
        genres: { set: connectEntities(anime.genres) },
        explicitGenres: { set: connectEntities(anime.explicit_genres) },
        themes: { set: connectEntities(anime.themes) },
        demographics: { set: connectEntities(anime.demographics) },
      },
      create: {
        id: anime.mal_id,
        ...animeData,
        studios: { connect: connectEntities(anime.studios) },
        genres: { connect: connectEntities(anime.genres) },
        explicitGenres: { connect: connectEntities(anime.explicit_genres) },
        themes: { connect: connectEntities(anime.themes) },
        demographics: { connect: connectEntities(anime.demographics) },
      },
      include: {
        studios: true,
        genres: true,
        explicitGenres: true,
        themes: true,
        demographics: true,
      },
    });
    return data;
  } catch (err) {
    console.error("Failed to cache anime:", err);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to cache anime",
    });
  }
}

async function cacheAnimeCharacters(animeId: number) {
  const response = await fetch(
    `https://api.jikan.moe/v4/anime/${animeId}/characters`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    console.error("Failed to fetch characters from Jikan:", response);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Failed to fetch characters",
    });
  }

  try {
    const characters = (await response.json()).data as CharacterObject[];

    await db.$transaction([
      db.animeCharacter.createMany({
        data: characters.map((char) => ({
          id: char.character.mal_id,
          animeId: animeId,
          name: char.character.name,
          url: char.character.url,
          image: char.character.images.jpg.image_url,
          role: char.role,
          favorites: char.favorites,
        })),
        skipDuplicates: true,
      }),

      db.voiceActor.createMany({
        data: characters.flatMap((char) =>
          char.voice_actors.map((va) => ({
            id: va.person.mal_id,
            url: va.person.url,
            image: va.person.images.jpg.image_url,
            name: va.person.name,
            language: va.language,
          })),
        ),
        skipDuplicates: true,
      }),
    ]);

    // Link voice actors to characters via a single raw INSERT into the join table
    const pairs = characters.flatMap((char) =>
      char.voice_actors.map((va) => [char.character.mal_id, va.person.mal_id]),
    );

    if (pairs.length > 0) {
      const values = pairs
        .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
        .join(", ");
      await db.$executeRawUnsafe(
        `INSERT INTO "_AnimeCharacterToVoiceActor" ("A", "B") VALUES ${values} ON CONFLICT DO NOTHING`,
        ...pairs.flat(),
      );
    }

    const data = await db.animeCharacter.findMany({
      where: { animeId },
    });

    return data;
  } catch (err) {
    console.error("Failed to cache anime characters:", err);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to cache anime characters",
    });
  }
}

function formatAnime(anime: AnimeObject) {
  return {
    url: anime.url,
    image: anime.images?.jpg?.image_url,
    smallImage: anime.images?.jpg?.small_image_url,
    largeImage: anime.images?.jpg?.large_image_url,
    title: anime.title,
    titleEnglish: anime.title_english,
    titleJapanese: anime.title_japanese,
    titleSynonyms: anime.title_synonyms,
    type: anime.type,
    source: anime.source,
    episodes: anime.episodes,
    status: anime.status,
    airing: anime.airing,
    airedFrom: anime.aired?.from ? new Date(anime.aired.from) : null,
    airedTo: anime.aired?.to ? new Date(anime.aired.to) : null,
    airedString: anime.aired?.string,
    rating: anime.rating,
    score: anime.score,
    season: anime.season,
    year: anime.year,
  };
}

export type AnimeObject = {
  mal_id: number;
  url: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  trailer: {
    youtube_id: string | null;
    url: string | null;
    embed_url: string | null;
    images: {
      image_url: string | null;
      small_image_url: string | null;
      medium_image_url: string | null;
      large_image_url: string | null;
      maximum_image_url: string | null;
    } | null;
  };
  approved: boolean;
  titles: {
    type: string;
    title: string;
  }[];
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  title_synonyms: string[];
  type: string | null;
  source: string | null;
  episodes: number | null;
  status: string | null;
  airing: boolean;
  aired: {
    from: string | null;
    to: string | null;
    prop: {
      from: { day: number | null; month: number | null; year: number | null };
      to: { day: number | null; month: number | null; year: number | null };
    };
    string: string | null;
  };
  duration: string | null;
  rating: string | null;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  favorites: number | null;
  synopsis: string | null;
  background: string | null;
  season: string | null;
  year: number | null;
  broadcast: {
    day: string | null;
    time: string | null;
    timezone: string | null;
    string: string | null;
  };
  producers: JikanEntity[];
  licensors: JikanEntity[];
  studios: JikanEntity[];
  genres: JikanEntity[];
  explicit_genres: JikanEntity[];
  themes: JikanEntity[];
  demographics: JikanEntity[];
};

export type JikanEntity = {
  mal_id: number;
  type: string;
  name: string;
  url: string;
};

export type CharacterObject = {
  character: {
    mal_id: number;
    url: string;
    images: {
      jpg: {
        image_url: string;
      };
      webp: {
        image_url: string;
        small_image_url: string;
      };
    };
    name: string;
  };
  role: string;
  favorites: number;
  voice_actors: {
    person: {
      mal_id: number;
      url: string;
      images: {
        jpg: {
          image_url: string;
        };
      };
      name: string;
    };
    language: string;
  }[];
};
