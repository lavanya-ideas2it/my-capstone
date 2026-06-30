// Vitest globalSetup: provision the disposable test database once per run.
//   1. Create the test DB if it does not exist (connect to the maintenance DB).
//   2. Apply all Prisma migrations to it (`prisma migrate deploy`).
// SPEC §5: tests run against a SEPARATE database, never dev/prod.
import { execSync } from "node:child_process";
import { config } from "dotenv";
import { Client } from "pg";

export default async function setup() {
  config({ path: ".env.test", override: true });

  const dbUrl = new URL(process.env.DATABASE_URL!);
  const dbName = dbUrl.pathname.replace(/^\//, "");

  // Connect to the default maintenance database to (re)create the test DB.
  const adminUrl = new URL(dbUrl.toString());
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName]
  );
  if (rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
  }
  await client.end();

  // Apply migrations to the test DB (explicit env so Prisma can't pick up .env).
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl.toString() },
  });
}
