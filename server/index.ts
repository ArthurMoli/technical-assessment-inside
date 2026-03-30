import "dotenv/config";
import express from "express";
import { createRequestHandler } from "@remix-run/express";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { getDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { seedDatabase } from "./db/seed.js";
import { logger } from "./lib/logger.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  // Initialize database
  const db = getDatabase();
  runMigrations(db);
  seedDatabase(db);

  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // Request logging
  app.use(requestLogger);

  // API routes
  app.use("/api", apiRouter);

  // Remix handler for everything else
  const viteDevServer =
    process.env.NODE_ENV === "production"
      ? undefined
      : await import("vite").then((vite) =>
          vite.createServer({
            server: { middlewareMode: true },
          })
        );

  if (viteDevServer) {
    app.use(viteDevServer.middlewares);
  } else {
    app.use(express.static("build/client"));
  }

  const remixBuild = viteDevServer
    ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build") as any
    : await import("../build/server/index.js" as string);

  // Warm up Remix in dev so the first request doesn't hit a blank page
  if (viteDevServer) {
    await viteDevServer.ssrLoadModule("virtual:remix/server-build");
    logger.info("Remix dev build warmed up");
  }

  app.all("*", createRequestHandler({ build: remixBuild }));

  // Error handler (must be last)
  app.use(errorHandler);

  app.listen(PORT, "0.0.0.0", async () => {
    logger.info({ port: PORT }, `ArthurBank server running on port ${PORT}`);

    // Warm up client assets (CSS/JS) so the first real visit loads instantly
    if (viteDevServer) {
      try {
        await fetch(`http://localhost:${PORT}/login`);
        logger.info("Client assets warmed up");
      } catch { /* ignore */ }
    }
  });
}

main().catch((err) => {
  logger.fatal(err, "Failed to start server");
  process.exit(1);
});
