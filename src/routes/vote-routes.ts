import { Router } from "express";
import type { Pool } from "pg";
import { PostgresVoteRepository } from "../repositories/postgres-vote-repository.js";
import { VoteService } from "../services/vote-service.js";
import { createVoteController } from "../controllers/vote-controller.js";

export function createVoteRouter(database: Pool): Router {
  const router = Router();

  const repository = new PostgresVoteRepository(database);
  const service = new VoteService(repository);
  const controller = createVoteController(service);

  router.get(
    "/:codigo/secoes/:zona/:secao/votos",
    controller
  );

  return router;
}
