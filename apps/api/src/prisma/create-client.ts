// I-008 (ADR-0010): Prisma 7 wymaga adaptera sterownika. Jedna fabryka dla API, seeda i testow.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./client.js";

/** Schemat z parametru `?schema=` adresu bazy (domyslnie public); sterownik pg nie zna tego parametru. */
function splitSchema(url: string): { connectionString: string; schema: string | undefined } {
  try {
    const parsed = new URL(url);
    const schema = parsed.searchParams.get("schema") ?? undefined;
    parsed.searchParams.delete("schema");
    return { connectionString: parsed.toString(), schema };
  } catch {
    return { connectionString: url, schema: undefined };
  }
}

export function createPrismaAdapter(url: string): PrismaPg {
  const { connectionString, schema } = splitSchema(url);
  return new PrismaPg({ connectionString }, schema ? { schema } : undefined);
}

export function createPrismaClient(url: string): PrismaClient {
  return new PrismaClient({ adapter: createPrismaAdapter(url) });
}
