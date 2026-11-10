
import type {
  Request,
  Response,
  NextFunction,
  RequestHandler
} from "express";

import {
  InvalidResultSearchCriteriaError
} from "../services/result-service.js";

import type {
  ResultService
} from "../services/result-service.js";

function parseRequiredInteger(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number(value);
}

function parseOptionalInteger(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number(value);
}

export function createResultController(
  resultService: ResultService
): RequestHandler {
  return async (
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const officeCode = parseOptionalInteger(request.query.cargo);

      const result = await resultService.findByMunicipality({
        municipalityCode:
        typeof request.params.codigo === "string"
         ? request.params.codigo
         : "",
        year: parseRequiredInteger(request.query.ano),
        round: parseRequiredInteger(request.query.turno),
        ...(officeCode !== undefined && { officeCode })
        });

      if (result === null) {
        response.status(404).json({
          error: "Resultados não encontrados",
          message: "Não existem resultados para os parâmetros informados."
        });
        return;
      }

      response.status(200).json(result);
    } catch (error) {
      if (error instanceof InvalidResultSearchCriteriaError) {
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
