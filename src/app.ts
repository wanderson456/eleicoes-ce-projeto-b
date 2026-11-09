import express from "express";
import type { Pool } from "pg";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import { createVoteRouter } from "./routes/vote-routes.js";
import { errorHandler } from "./middlewares/error-handler.js";
import {
  metricsHandler,
  recordHttpMetric
} from "./observability/metrics.js";

export function createApp(database: Pool) {
  const app = express();

  app.use(pinoHttp({
    logger,
    autoLogging: true,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie"
      ],
      censor: "[REDACTED]"
    }
  }));

  app.use((request, response, next) => {
    const start = process.hrtime.bigint();

    response.on("finish", () => {
      if (request.path === "/metrics") {
        return;
      }

      const durationMs =
        Number(process.hrtime.bigint() - start) / 1_000_000;

      const route = request.route?.path
        ? `${request.baseUrl}${request.route.path}`
        : request.path;

      recordHttpMetric({
        method: request.method,
        route,
        status: response.statusCode,
        durationMs
      });
    });

    next();
  });

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok"
    });
  });

  app.get("/metrics", metricsHandler);

  app.use("/municipios", createVoteRouter(database));

  app.use(errorHandler);

  return app;
}