import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { VoteType } from "../domain/vote-classification.js";
import {
  InvalidVoteSearchCriteriaError
} from "../services/vote-service.js";
import type { VoteService } from "../services/vote-service.js";

function parseInteger(value: unknown, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number(value);
}

export function createVoteController(
  voteService: VoteService
): RequestHandler {
  return async (
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const voteType = request.query.tipo;

      if (voteType !== undefined && typeof voteType !== "string") {
        throw new InvalidVoteSearchCriteriaError(
          "O parâmetro tipo deve ser informado uma única vez."
        );
      }

      const result = await voteService.findBySection({
        municipalityCode: typeof request.params.codigo === "string" ? request.params.codigo : "",
        zone: Number(request.params.zona),
        section: Number(request.params.secao),
        year: parseInteger(request.query.ano, 0),
        round: parseInteger(request.query.turno, 0),
        ...(voteType === undefined ? {} : { voteType: voteType as VoteType }),
        page: parseInteger(request.query.pagina, 1),
        limit: parseInteger(request.query.limite, 20)
      });

      response.status(200).json(result);
    } catch (error) {
      if (error instanceof InvalidVoteSearchCriteriaError) {
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
