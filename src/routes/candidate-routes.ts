import { Router } from "express";
import type { Pool } from "pg";
import { PostgresCandidateRepository } from "../repositories/postgres-candidate-repository.js";
import { CandidateService } from "../services/candidate-service.js";
import { createCandidateController } from "../controllers/candidate-controller.js";

export function createCandidateRouter(database: Pool): Router {
  const router = Router();

  const repository = new PostgresCandidateRepository(database);
  const service = new CandidateService(repository);
  const controller = createCandidateController(service);

  router.get("/", controller);

  return router;
}