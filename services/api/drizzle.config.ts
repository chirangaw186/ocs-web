import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  schemaFilter: ["catalog", "inventory", "sales", "people", "production"],
  dbCredentials: { url: process.env.DATABASE_URL! },
});
