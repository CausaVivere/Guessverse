import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "~/env";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";

const tokens = {
  igdb: null,
} as {
  igdb: IGDBtoken | null;
};

export const setRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.post.create({
        data: {
          name: input.name,
        },
      });
    }),

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
        body: `search "${input.search}"; fields *; limit 10;`,
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
