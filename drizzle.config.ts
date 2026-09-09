import { defineConfig } from "drizzle-kit";

// Node's native env file loading (22.6+) — no dotenv dependency needed.
process.loadEnvFile(".env");

export default defineConfig({
  out: "./server/db/migrations",
  schema: "./server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
