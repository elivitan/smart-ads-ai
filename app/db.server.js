// app/db.server.js
// PostgreSQL connection for multi-tenant production (30K+ shops)
import { PrismaClient } from "@prisma/client";

const LOG_LEVELS = process.env.NODE_ENV === "production"
  ? ["error", "warn"]
  : ["query", "error", "warn"];

function createPrismaClient() {
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

const prisma = globalThis.prismaGlobal ?? createPrismaClient();

export default prisma;
