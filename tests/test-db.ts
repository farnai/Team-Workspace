import { PrismaClient } from "@prisma/client";

/**
 * Isolated Test Database Setup & Safety Guard
 * 
 * Enforces strict isolation: Tests MUST NEVER connect to the application database.
 */
export function extractDatabaseName(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    return url.pathname.replace(/^\//, "").split("?")[0].trim();
  } catch {
    const match = urlStr.match(/\/([^/?#]+)(\?|$)/);
    return match ? match[1].trim() : "";
  }
}

const DEFAULT_TEST_DB_URL =
  "postgresql://workspace_user:workspace_secret_password@localhost:5434/team_workspace_test_db?schema=public";

const testDbUrl = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DB_URL;
const targetDbName = extractDatabaseName(testDbUrl);

// Strict fail-closed verification by exact database identity
if (targetDbName === "team_workspace_db") {
  throw new Error(
    `CRITICAL DATA SAFETY FAILURE: Attempted to run tests against primary application database 'team_workspace_db'! Tests are forbidden from accessing this database.`
  );
}

if (!targetDbName.endsWith("_test_db") && !targetDbName.endsWith("_test")) {
  throw new Error(
    `CRITICAL DATA SAFETY FAILURE: Tests must point to a dedicated test database ending with '_test_db' or '_test'. Target database resolved to: '${targetDbName}' (URL: ${testDbUrl})`
  );
}

// Redirect all application Prisma calls during tests to the isolated test database
process.env.DATABASE_URL = testDbUrl;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

// Single shared test Prisma client
export const testPrisma = new PrismaClient({
  datasources: {
    db: { url: testDbUrl },
  },
  log: ["error"],
});

export const TEST_DATABASE_URL = testDbUrl;
