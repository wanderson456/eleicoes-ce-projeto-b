import { Router } from "express";
import type { Pool } from "pg";
import { PostgresMunicipalityRepository } from "../repositories/postgres-municipality-repository.js";
import { MunicipalityService } from "../services/municipality-service.js";
import { createMunicipalityController } from "../controllers/municipality-controller.js";

export function createMunicipalityRouter(database: Pool): Router {
  const router = Router();

  const repository = new PostgresMunicipalityRepository(database);
  const service = new MunicipalityService(repository);
  const controller = createMunicipalityController(service);

  router.get("/", controller);

  return router;
}
