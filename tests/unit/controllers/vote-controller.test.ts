import { describe, expect, it, vi } from "vitest";
import { createVoteController } from "../../../src/controllers/vote-controller.js";
import {
  InvalidVoteSearchCriteriaError
} from "../../../src/services/vote-service.js";
import type { VoteService } from "../../../src/services/vote-service.js";
import type { Request, Response, NextFunction } from "express";

describe("VoteController", () => {
  const criteria = {
    municipalityCode: "13005",
    zone: 30,
    section: 82,
    year: 2022,
    round: 1,
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
    params = {
      codigo: "13005",
      zona: "30",
      secao: "82"
    },
    query: Record<string, unknown> = {}
  ) {
    return {
      params,
      query
    } as unknown as Request;
  }

  it("returns HTTP 200 for a valid search", async () => {
    const result = {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0
    };

    const findBySection = vi.fn().mockResolvedValue(result);
    const service = { findBySection } as unknown as VoteService;
    const controller = createVoteController(service);
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    await controller(
      createRequest(undefined, {
        ano: "2022",
        turno: "1"
      }),
      response,
      next
    );

    expect(findBySection).toHaveBeenCalledWith(criteria);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(result);
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards the vote type and pagination filters", async () => {
    const findBySection = vi.fn().mockResolvedValue({});
    const controller = createVoteController({
      findBySection
    } as unknown as VoteService);

    await controller(
      createRequest(undefined, {
        ano: "2022",
        turno: "1",
        tipo: "NULO",
        pagina: "2",
        limite: "10"
      }),
      createResponse(),
      vi.fn() as NextFunction
    );

    expect(findBySection).toHaveBeenCalledWith({
      ...criteria,
      voteType: "NULO",
      page: 2,
      limit: 10
    });
  });




  it("rejects repeated vote type query parameters", async () => {
    const findBySection = vi.fn();
    const controller = createVoteController({
      findBySection
    } as unknown as VoteService);
    const response = createResponse();

    await controller(
      createRequest(undefined, { tipo: ["NULO", "BRANCO"] }),
      response,
      vi.fn() as NextFunction
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(findBySection).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 for invalid service criteria", async () => {
    const findBySection = vi.fn().mockRejectedValue(
      new InvalidVoteSearchCriteriaError("Critérios inválidos.")
    );

    const controller = createVoteController({
      findBySection
    } as unknown as VoteService);
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
    const findBySection = vi.fn().mockRejectedValue(error);
    const controller = createVoteController({
      findBySection
    } as unknown as VoteService);
    const next = vi.fn() as NextFunction;

    await controller(
      createRequest(),
      createResponse(),
      next
    );

    expect(next).toHaveBeenCalledWith(error);
  });
});
