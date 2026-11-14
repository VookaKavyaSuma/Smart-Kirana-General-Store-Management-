import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaClientGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaClientGlobal ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaClientGlobal = prisma;
}

let isDatabaseConnected = false;

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    isDatabaseConnected = true;
    console.log('[DATABASE] Successfully connected to PostgreSQL via Prisma.');
    return true;
  } catch (error: any) {
    isDatabaseConnected = false;
    console.warn('\n-------------------------------------------------------------');
    console.warn('[DATABASE WARNING] PostgreSQL is not reachable at DATABASE_URL.');
    console.warn(`Error: ${error.message?.split('\n')[0] || error}`);
    console.warn('Backend will use fallback in-memory store for Phase 1 verification.');
    console.warn('To connect to PostgreSQL, set DATABASE_URL in backend/.env and run:');
    console.warn('  npm run prisma:push');
    console.warn('-------------------------------------------------------------\n');
    return false;
  }
}

export function getDatabaseStatus(): boolean {
  return isDatabaseConnected;
}

