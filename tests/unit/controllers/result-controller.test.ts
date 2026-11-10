
import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

import { createResultController } from "../../../src/controllers/result-controller.js";

import {
    InvalidResultSearchCriteriaError
} from "../../../src/services/result-service.js";

import type {
    ResultService
} from "../../../src/services/result-service.js";

describe("ResultController", () => {
    const criteria = {
        municipalityCode: "13250",
        year: 2022,
        round: 1
    };

    function createResponse() {
        const response = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        return response as unknown as Response & typeof response;
    }

    function createRequest(
        params = { codigo: "13250" },
        query: Record<string, unknown> = {
            ano: "2022",
            turno: "1"
        }
    ) {
        return { params, query } as unknown as Request;
    }

    it("returns HTTP 200 for a valid search", async () => {
        const result = {
            municipalityCode: "13250",
            municipalityName: "ARARIPE",
            year: 2022,
            round: 1,
            offices: []
        };

        const findByMunicipality = vi.fn().mockResolvedValue(result);

        const controller = createResultController({
            findByMunicipality
        } as unknown as ResultService);

        const response = createResponse();
        const next = vi.fn() as NextFunction;

        await controller(createRequest(), response, next);

        expect(findByMunicipality).toHaveBeenCalledWith(criteria);
        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith(result);
        expect(next).not.toHaveBeenCalled();
    });

    it("forwards the optional officeCode filter", async () => {
        const findByMunicipality = vi.fn().mockResolvedValue({});

        const controller = createResultController({
            findByMunicipality
        } as unknown as ResultService);

        await controller(
            createRequest(undefined, {
                ano: "2022",
                turno: "1",
                cargo: "7"
            }),
            createResponse(),
            vi.fn() as NextFunction
        );

        expect(findByMunicipality).toHaveBeenCalledWith({
            ...criteria,
            officeCode: 7
        });
    });

    it("returns HTTP 400 when required parameters are missing", async () => {
        const findByMunicipality = vi.fn().mockRejectedValue(
            new InvalidResultSearchCriteriaError("O ano da eleição deve conter quatro dígitos.")
        );

        const controller = createResultController({
            findByMunicipality
        } as unknown as ResultService);

        const response = createResponse();

        await controller(
            createRequest(undefined, { turno: "1" }),
            response,
            vi.fn() as NextFunction
        );

        expect(findByMunicipality).toHaveBeenCalledWith({
            municipalityCode: "13250",
            year: Number.NaN,
            round: 1
        });

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            error: "Parâmetros inválidos",
            message: "O ano da eleição deve conter quatro dígitos."
        });
    });

    it("returns HTTP 404 when no results are found", async () => {
        const findByMunicipality = vi.fn().mockResolvedValue(null);

        const controller = createResultController({
            findByMunicipality
        } as unknown as ResultService);

        const response = createResponse();

        await controller(
            createRequest(),
            response,
            vi.fn() as NextFunction
        );

        expect(response.status).toHaveBeenCalledWith(404);
        expect(response.json).toHaveBeenCalledWith({
            error: "Resultados não encontrados",
            message: "Não existem resultados para os parâmetros informados."
        });
    });

    it("returns HTTP 400 for invalid service criteria", async () => {
        const findByMunicipality = vi.fn().mockRejectedValue(
            new InvalidResultSearchCriteriaError("O turno deve ser 1 ou 2.")
        );

        const controller = createResultController({
            findByMunicipality
        } as unknown as ResultService);

        const response = createResponse();

        await controller(
            createRequest(undefined, {
                ano: "2022",
                turno: "3"
            }),
            response,
            vi.fn() as NextFunction
        );

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            error: "Parâmetros inválidos",
            message: "O turno deve ser 1 ou 2."
        });
    });

    it("forwards unexpected errors to Express", async () => {
        const error = new Error("Falha no banco");

        const findByMunicipality = vi.fn().mockRejectedValue(error);

        const controller = createResultController({
            findByMunicipality
        } as unknown as ResultService);

        const next = vi.fn() as NextFunction;

        await controller(createRequest(), createResponse(), next);

        expect(next).toHaveBeenCalledWith(error);
    });


    it("rejects repeated year query parameters", async () => {
        const findByMunicipality = vi.fn().mockRejectedValue(
            new InvalidResultSearchCriteriaError(
                "O ano da eleição deve conter quatro dígitos."
            )
        );

        const controller = createResultController({
            findByMunicipality
        } as unknown as ResultService);

        const response = createResponse();

        await controller(
            createRequest(undefined, {
                ano: ["2022", "2024"],
                turno: "1"
            }),
            response,
            vi.fn() as NextFunction
        );

        expect(findByMunicipality).toHaveBeenCalledWith({
            municipalityCode: "13250",
            year: Number.NaN,
            round: 1
        });

        expect(response.status).toHaveBeenCalledWith(400);
    });

});
