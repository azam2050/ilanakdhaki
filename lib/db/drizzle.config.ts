import { defineConfig } from "drizzle-kit";
import path from "path";

const connectionString =
  process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_PUBLIC_URL (or DATABASE_URL), ensure the database is provisioned",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
