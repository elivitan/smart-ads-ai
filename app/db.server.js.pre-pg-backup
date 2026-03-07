import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV !== "production") {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = new PrismaClient();
  }
}

const prisma = globalThis.prismaGlobal ?? new PrismaClient();

export default prisma;
