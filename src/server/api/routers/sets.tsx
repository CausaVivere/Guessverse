import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "~/env";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { cacheAnime, cacheAnimeCharacters } from "../utils/jikan";

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
  getAnimeSets: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.animeGameset.findMany({
        where: {
          OR: [
            {
              name: {
                contains: input.search,
                mode: "insensitive",
              },
            },
            {
              characters: {
                some: {
                  name: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              animes: {
                some: {
                  titleJapanese: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              animes: {
                some: {
                  titleEnglish: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        },
      });
      return data;
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
