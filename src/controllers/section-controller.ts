import type { Request, Response, NextFunction, RequestHandler } from "express";
import {
  InvalidSectionSearchCriteriaError
} from "../services/section-service.js";
import type { SectionService } from "../services/section-service.js";

function parseInteger(value: unknown, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number(value);
}

export function createSectionController(
  sectionService: SectionService
): RequestHandler {
  return async (
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await sectionService.findByMunicipality({
        municipalityCode:
          typeof request.params.codigo === "string"
            ? request.params.codigo
            : "",
        year: parseInteger(request.query.ano, 0),
        page: parseInteger(request.query.pagina, 1),
        limit: parseInteger(request.query.limite, 20)
      });

      response.status(200).json(result);
    } catch (error) {
      if (error instanceof InvalidSectionSearchCriteriaError) {
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
