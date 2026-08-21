import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.development.local", quiet: true });

const databaseUrl = process.env.POSTGRES_URL_NON_POOLING;
if (!databaseUrl) {
  throw new Error("POSTGRES_URL_NON_POOLING is required for Drizzle operations.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
