// app/db.server.ts
// PostgreSQL connection for multi-tenant production (30K+ shops)
import { PrismaClient } from "@prisma/client";

type LogLevel = "query" | "info" | "warn" | "error";

const LOG_LEVELS: LogLevel[] = process.env.NODE_ENV === "production"
  ? ["error", "warn"]
  : ["query", "error", "warn"];

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: LOG_LEVELS,
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

// Prevent multiple instances in development (hot reload)
if (process.env.NODE_ENV !== "production") {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = createPrismaClient();
  }
}

const prisma: PrismaClient = globalThis.prismaGlobal ?? createPrismaClient();

export default prisma;
