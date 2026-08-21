import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.development.local", quiet: true });

const connectionString = process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  throw new Error("POSTGRES_URL_NON_POOLING is required to run migrations.");
}

const client = postgres(connectionString, { max: 1, prepare: false });
const database = drizzle(client);

async function main() {
  try {
    await migrate(database, { migrationsFolder: "drizzle" });
    console.log("Phase 3 database migrations completed.");
  } finally {
    await client.end();
  }
}

void main();
