import { Router } from "express";
import type { Pool } from "pg";
import { PostgresSectionRepository } from "../repositories/postgres-section-repository.js";
import { SectionService } from "../services/section-service.js";
import { createSectionController } from "../controllers/section-controller.js";

export function createSectionRouter(database: Pool): Router {
  const router = Router();

  const repository = new PostgresSectionRepository(database);
  const service = new SectionService(repository);
  const controller = createSectionController(service);

  router.get("/:codigo/secoes", controller);

  return router;
}
