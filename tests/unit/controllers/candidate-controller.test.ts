import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

import {
    createCandidateController,
    createCandidateGeographicController
} from "../../../src/controllers/candidate-controller.js";

import {
    InvalidCandidateSearchCriteriaError
} from "../../../src/services/candidate-service.js";

import type {
    CandidateService
} from "../../../src/services/candidate-service.js";

describe("CandidateController", () => {
    const criteria = {
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
        query: Record<string, unknown> = {
            ano: "2022",
            turno: "1"
        },
        params: Record<string, string> = {}
    ) {
        return { query, params } as unknown as Request;
    }

    it("returns HTTP 200 for a valid search", async () => {
        const result = {
            items: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0
        };

        const findAll = vi.fn().mockResolvedValue(result);

        const controller = createCandidateController({
            findAll
        } as unknown as CandidateService);

        const response = createResponse();
        const next = vi.fn() as NextFunction;

        await controller(createRequest(), response, next);

        expect(findAll).toHaveBeenCalledWith(criteria);
        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith(result);
        expect(next).not.toHaveBeenCalled();
    });

    it("forwards optional filters and pagination", async () => {
        const findAll = vi.fn().mockResolvedValue({});

        const controller = createCandidateController({
            findAll
        } as unknown as CandidateService);

        await controller(
            createRequest({
                ano: "2022",
                turno: "1",
                cargo: "7",
                busca: "Marcos",
                numero: "12333",
                pagina: "2",
                limite: "10"
            }),
            createResponse(),
            vi.fn() as NextFunction
        );

        expect(findAll).toHaveBeenCalledWith({
            year: 2022,
            round: 1,
            officeCode: 7,
            search: "Marcos",
            candidateNumber: "12333",
            page: 2,
            limit: 10
        });
    });

    it("returns HTTP 400 when required parameters are missing", async () => {
        const findAll = vi.fn().mockRejectedValue(
            new InvalidCandidateSearchCriteriaError(
                "O ano da eleição deve conter quatro dígitos."
            )
        );

        const controller = createCandidateController({
            findAll
        } as unknown as CandidateService);

        const response = createResponse();

        await controller(
            createRequest({ turno: "1" }),
            response,
            vi.fn() as NextFunction
        );

        expect(findAll).toHaveBeenCalledWith({
            year: Number.NaN,
            round: 1,
            page: 1,
            limit: 20
        });

        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
            error: "Parâmetros inválidos",
            message: "O ano da eleição deve conter quatro dígitos."
        });
    });

    it("returns HTTP 400 for invalid service criteria", async () => {
        const findAll = vi.fn().mockRejectedValue(
            new InvalidCandidateSearchCriteriaError(
                "O turno deve ser 1 ou 2."
            )
        );

        const controller = createCandidateController({
            findAll
        } as unknown as CandidateService);

        const response = createResponse();

        await controller(
            createRequest({
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

        const findAll = vi.fn().mockRejectedValue(error);

        const controller = createCandidateController({
            findAll
        } as unknown as CandidateService);

        const next = vi.fn() as NextFunction;

        await controller(createRequest(), createResponse(), next);

        expect(next).toHaveBeenCalledWith(error);
    });

    it("rejects repeated year query parameters", async () => {
        const findAll = vi.fn().mockRejectedValue(
            new InvalidCandidateSearchCriteriaError(
                "O ano da eleição deve conter quatro dígitos."
            )
        );

        const controller = createCandidateController({
            findAll
        } as unknown as CandidateService);

        const response = createResponse();

        await controller(
            createRequest({
                ano: ["2022", "2024"],
                turno: "1"
            }),
            response,
            vi.fn() as NextFunction
        );

        expect(findAll).toHaveBeenCalledWith({
            year: Number.NaN,
            round: 1,
            page: 1,
            limit: 20
        });

        expect(response.status).toHaveBeenCalledWith(400);
    });


    describe("CandidateGeographicController", () => {
        const geographicResult = {
            sqCandidato: 123456789,
            year: 2022,
            round: 1,
            municipalities: [
                {
                    ibgeCode: "2301307",
                    municipality: "ARARIPE",
                    votes: 4590,
                    latitude: -7.21,
                    longitude: -40.13
                }
            ],
            pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1
            }
        };

        it("returns HTTP 200 for a valid geographic search", async () => {
            const findGeographicDistribution = vi
                .fn()
                .mockResolvedValue(geographicResult);

            const controller = createCandidateGeographicController({
                findGeographicDistribution
            } as unknown as CandidateService);

            const response = createResponse();
            const next = vi.fn() as NextFunction;

            await controller(
                createRequest(
                    { ano: "2022", turno: "1" },
                    { sqCandidato: "123456789" }
                ),
                response,
                next
            );

            expect(findGeographicDistribution).toHaveBeenCalledWith({
                sqCandidato: 123456789,
                year: 2022,
                round: 1,
                page: 1,
                limit: 20
            });
            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith(geographicResult);
            expect(next).not.toHaveBeenCalled();
        });

        it("returns HTTP 404 when the candidate does not exist", async () => {
            const findGeographicDistribution = vi.fn().mockResolvedValue(null);

            const controller = createCandidateGeographicController({
                findGeographicDistribution
            } as unknown as CandidateService);

            const response = createResponse();

            await controller(
                createRequest(
                    { ano: "2022", turno: "1" },
                    { sqCandidato: "999999999" }
                ),
                response,
                vi.fn() as NextFunction
            );

            expect(response.status).toHaveBeenCalledWith(404);
            expect(response.json).toHaveBeenCalledWith({
                error: "Candidato não encontrado",
                message: "Não existe candidato com o identificador, ano e turno informados."
            });
        });

        it("returns HTTP 400 for invalid geographic criteria", async () => {
            const findGeographicDistribution = vi.fn().mockRejectedValue(
                new InvalidCandidateSearchCriteriaError(
                    "Turno deve ser 1 ou 2."
                )
            );

            const controller = createCandidateGeographicController({
                findGeographicDistribution
            } as unknown as CandidateService);

            const response = createResponse();

            await controller(
                createRequest(
                    { ano: "2022", turno: "3" },
                    { sqCandidato: "123456789" }
                ),
                response,
                vi.fn() as NextFunction
            );

            expect(response.status).toHaveBeenCalledWith(400);
            expect(response.json).toHaveBeenCalledWith({
                error: "Parâmetros inválidos",
                message: "Turno deve ser 1 ou 2."
            });
        });

        it("forwards unexpected geographic errors to Express", async () => {
            const error = new Error("Falha no banco");

            const findGeographicDistribution = vi.fn()
                .mockRejectedValue(error);

            const controller = createCandidateGeographicController({
                findGeographicDistribution
            } as unknown as CandidateService);

            const next = vi.fn() as NextFunction;

            await controller(
                createRequest(
                    { ano: "2022", turno: "1" },
                    { sqCandidato: "123456789" }
                ),
                createResponse(),
                next
            );

            expect(next).toHaveBeenCalledWith(error);
        });
    });

});