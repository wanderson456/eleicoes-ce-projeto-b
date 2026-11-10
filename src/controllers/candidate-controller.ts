import type { Request, Response, NextFunction } from "express";
import type { CandidateService } from "../services/candidate-service.js";
import {
  InvalidCandidateSearchCriteriaError
} from "../services/candidate-service.js";

export function createCandidateController(
  service: CandidateService
) {
  return async (
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await service.findAll({
        year: Number(request.query.ano),
        round: Number(request.query.turno),
        ...(request.query.cargo
          ? { officeCode: Number(request.query.cargo) }
          : {}),
        ...(typeof request.query.busca === "string"
          ? { search: request.query.busca }
          : {}),
        ...(typeof request.query.numero === "string"
          ? { candidateNumber: request.query.numero }
          : {}),
        page: request.query.pagina
          ? Number(request.query.pagina)
          : 1,
        limit: request.query.limite
          ? Number(request.query.limite)
          : 20
      });

      response.status(200).json(result);
    } catch (error) {
      if (error instanceof InvalidCandidateSearchCriteriaError) {
        response.status(400).json({
          error: "Parâmetros inválidos",
          message: error.message
        });
        return;
      }

      next(error);
    }
  };
}