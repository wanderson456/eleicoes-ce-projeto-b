
import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createMunicipalityController } from "../../../src/controllers/municipality-controller.js";
import type { MunicipalityService } from "../../../src/services/municipality-service.js";

describe("MunicipalityController", () => {
  function createResponse() {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    return response as unknown as Response & typeof response;
  }

  it("returns HTTP 200 with all municipalities", async () => {
    const items = [
      { code: "2301307", name: "Araripe" },
      { code: "2300200", name: "Acaraú" }
    ];

    const findAll = vi.fn().mockResolvedValue(items);
    const controller = createMunicipalityController({
      findAll
    } as unknown as MunicipalityService);

    const response = createResponse();
    const next = vi.fn() as NextFunction;

    await controller(
      {} as Request,
      response,
      next
    );

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      items,
      total: 2
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns an empty list when no municipalities are found", async () => {
    const findAll = vi.fn().mockResolvedValue([]);
    const controller = createMunicipalityController({
      findAll
    } as unknown as MunicipalityService);

    const response = createResponse();

    await controller(
      {} as Request,
      response,
      vi.fn() as NextFunction
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      items: [],
      total: 0
    });
  });

  it("forwards unexpected errors to Express", async () => {
    const error = new Error("Falha ao consultar municípios");
    const findAll = vi.fn().mockRejectedValue(error);

    const controller = createMunicipalityController({
      findAll
    } as unknown as MunicipalityService);

    const next = vi.fn() as NextFunction;

    await controller(
      {} as Request,
      createResponse(),
      next
    );

    expect(next).toHaveBeenCalledWith(error);
  });
});
