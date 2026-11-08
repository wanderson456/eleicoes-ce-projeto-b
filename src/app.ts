import express from "express";
import type { Pool } from "pg";
import { createVoteRouter } from "./routes/vote-routes.js";
import { errorHandler } from "./middlewares/error-handler.js";

export function createApp(database: Pool) {
  const app = express();

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok"
    });
  });

  app.use("/municipios", createVoteRouter(database));

  app.use(errorHandler);

  return app;
}
