import { PrismaClient } from "@prisma/client";

function extractDatabaseName(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    return url.pathname.replace(/^\//, "").split("?")[0].trim();
  } catch {
    const match = urlStr.match(/\/([^/?#]+)(\?|$)/);
    return match ? match[1].trim() : "";
  }
}

// Fail-closed safety guard: If running in test mode, NEVER allow connection to the application database
if (process.env.NODE_ENV === "test") {
  const currentDbUrl = process.env.DATABASE_URL || "";
  const dbName = extractDatabaseName(currentDbUrl);

  if (dbName === "team_workspace_db") {
    throw new Error(
      `CRITICAL DATA SAFETY VIOLATION: Automated tests attempted to connect to application database 'team_workspace_db'!`
    );
  }

  if (!dbName.endsWith("_test") && !dbName.endsWith("_test_db")) {
    throw new Error(
      `CRITICAL DATA SAFETY VIOLATION: Automated tests are prohibited from connecting to non-test databases! Target database resolved to: '${dbName}' (DATABASE_URL=${currentDbUrl})`
    );
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
