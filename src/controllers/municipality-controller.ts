import type { Request, Response, NextFunction } from "express";
import type { MunicipalityService } from "../services/municipality-service.js";

export function createMunicipalityController(
  service: MunicipalityService
) {
  return async (
    _request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const items = await service.findAll();

      response.status(200).json({
        items,
        total: items.length
      });
    } catch (error) {
      next(error);
    }
  };
}
