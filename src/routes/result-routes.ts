
import { Router } from "express";
import type { Pool } from "pg";

import { PostgresResultRepository } from "../repositories/postgres-result-repository.js";
import { ResultService } from "../services/result-service.js";
import { createResultController } from "../controllers/result-controller.js";

export function createResultRouter(database: Pool): Router {
  const router = Router();

  const repository = new PostgresResultRepository(database);
  const service = new ResultService(repository);
  const controller = createResultController(service);

  router.get("/:codigo/resultados", controller);

  return router;
}
