import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createSectionController } from "../../../src/controllers/section-controller.js";
import {
  InvalidSectionSearchCriteriaError
} from "../../../src/services/section-service.js";
import type { SectionService } from "../../../src/services/section-service.js";

describe("SectionController", () => {
  const criteria = {
    municipalityCode: "2300200",
    page: 1,
    limit: 20
  };

  function createResponse() {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    return response as unknown as Response & typeof response;
  }

  function createRequest(
    params = { codigo: "2300200" },
    query: Record<string, unknown> = {}
  ) {
    return { params, query } as unknown as Request;
  }

  it("returns HTTP 200 for a valid search", async () => {
    const result = {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0
    };

    const findByMunicipality = vi.fn().mockResolvedValue(result);
    const controller = createSectionController({
      findByMunicipality
    } as unknown as SectionService);

    const response = createResponse();
    const next = vi.fn() as NextFunction;

    await controller(createRequest(), response, next);

    expect(findByMunicipality).toHaveBeenCalledWith(criteria);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(result);
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards pagination filters", async () => {
    const findByMunicipality = vi.fn().mockResolvedValue({});
    const controller = createSectionController({
      findByMunicipality
    } as unknown as SectionService);

    await controller(
      createRequest(undefined, {
        pagina: "2",
        limite: "10"
      }),
      createResponse(),
      vi.fn() as NextFunction
    );

    expect(findByMunicipality).toHaveBeenCalledWith({
      ...criteria,
      page: 2,
      limit: 10
    });
  });

  it("returns HTTP 400 for invalid service criteria", async () => {
    const findByMunicipality = vi.fn().mockRejectedValue(
      new InvalidSectionSearchCriteriaError("Critérios inválidos.")
    );

    const controller = createSectionController({
      findByMunicipality
    } as unknown as SectionService);

    const response = createResponse();

    await controller(
      createRequest(undefined, { pagina: "abc" }),
      response,
      vi.fn() as NextFunction
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "Parâmetros inválidos",
      message: "Critérios inválidos."
    });
  });

  it("forwards unexpected errors to Express", async () => {
    const error = new Error("Falha no banco");
    const findByMunicipality = vi.fn().mockRejectedValue(error);

    const controller = createSectionController({
      findByMunicipality
    } as unknown as SectionService);

    const next = vi.fn() as NextFunction;

    await controller(createRequest(), createResponse(), next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
