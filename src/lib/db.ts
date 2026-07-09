import { PrismaClient } from '@prisma/client';

// 用於開發環境的 Prisma Client 單例模式，避免因 Next.js 熱重載而產生過多連線
const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const db = globalThis.prismaGlobal ?? prismaClientSingleton();

export default db;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = db;
