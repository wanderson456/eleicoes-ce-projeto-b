
import { describe, expect, it, vi } from "vitest";
import type { CandidateRepository } from "../../../src/domain/candidate-repository.js";
import {
    CandidateService,
    InvalidCandidateSearchCriteriaError
} from "../../../src/services/candidate-service.js";

describe("CandidateService", () => {
    const criteria = {
        year: 2022,
        round: 1,
        page: 1,
        limit: 20
    };

    const repositoryResult = {
        items: [
            {
                id: 643,
                candidateNumber: "12333",
                candidateName: "MARCOS MARCEL RODRIGUES SOBREIRA",
                ballotName: "MARCOS SOBREIRA",
                officeCode: 7,
                officeName: "DEPUTADO ESTADUAL",
                partyNumber: 12,
                partyAbbreviation: "PDT",
                partyName: "PARTIDO DEMOCRÁTICO TRABALHISTA",
                totalVotes: 72183
            }
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
    };

    function createService() {
        const findAll = vi.fn().mockResolvedValue(repositoryResult);

        const repository = {
            findAll
        } as unknown as CandidateRepository;

        return {
            service: new CandidateService(repository),
            findAll
        };
    }

    it("delegates a valid search to the repository", async () => {
        const { service, findAll } = createService();

        const result = await service.findAll(criteria);

        expect(result).toEqual(repositoryResult);
        expect(findAll).toHaveBeenCalledWith(criteria);
    });

    it.each([
        ["year below minimum", { year: 999 }],
        ["year above maximum", { year: 10000 }],
        ["fractional year", { year: 2022.5 }],
        ["round below minimum", { round: 0 }],
        ["round above maximum", { round: 3 }],
        ["fractional round", { round: 1.5 }],
        ["officeCode below minimum", { officeCode: 0 }],
        ["fractional officeCode", { officeCode: 6.5 }],
        ["search exceeding 200 characters", { search: "A".repeat(201) }],
        ["candidate number with letters", { candidateNumber: "123AB" }],
        ["candidate number exceeding 10 digits", { candidateNumber: "12345678901" }],
        ["empty candidate number", { candidateNumber: "" }],
        ["page below minimum", { page: 0 }],
        ["fractional page", { page: 1.5 }],
        ["limit below minimum", { limit: 0 }],
        ["limit above maximum", { limit: 101 }],
        ["fractional limit", { limit: 20.5 }]
    ])("rejects invalid criteria: %s", async (_field, override) => {
        const { service, findAll } = createService();

        await expect(
            service.findAll({ ...criteria, ...override })
        ).rejects.toBeInstanceOf(InvalidCandidateSearchCriteriaError);

        expect(findAll).not.toHaveBeenCalled();
    });

    it("accepts a valid officeCode", async () => {
        const { service, findAll } = createService();

        await service.findAll({
            ...criteria,
            officeCode: 7
        });

        expect(findAll).toHaveBeenCalledOnce();
    });

    it("accepts the maximum four-digit year", async () => {
        const { service, findAll } = createService();

        await service.findAll({
            ...criteria,
            year: 9999
        });

        expect(findAll).toHaveBeenCalledOnce();
    });

    it("accepts the minimum four-digit year", async () => {
        const { service, findAll } = createService();

        await service.findAll({
            ...criteria,
            year: 1000
        });

        expect(findAll).toHaveBeenCalledOnce();
    });

    it("accepts the second election round", async () => {
        const { service, findAll } = createService();

        await service.findAll({
            ...criteria,
            round: 2
        });

        expect(findAll).toHaveBeenCalledOnce();
    });

    it("accepts the maximum page size", async () => {
        const { service, findAll } = createService();

        await service.findAll({
            ...criteria,
            limit: 100
        });

        expect(findAll).toHaveBeenCalledOnce();
    });

    it("preserves candidate numbers with leading zeros", async () => {
        const { service, findAll } = createService();

        await service.findAll({
            ...criteria,
            candidateNumber: "00123"
        });

        expect(findAll).toHaveBeenCalledWith({
            ...criteria,
            candidateNumber: "00123"
        });
    });

    it("trims whitespace from search terms", async () => {
        const { service, findAll } = createService();

        await service.findAll({
            ...criteria,
            search: "  Marcos  "
        });

        expect(findAll).toHaveBeenCalledWith({
            ...criteria,
            search: "Marcos"
        });
    });

    it("does not add an empty search term to repository criteria", async () => {
        const { service, findAll } = createService();

        await service.findAll({
            ...criteria,
            search: "   "
        });

        expect(findAll).toHaveBeenCalledWith(criteria);
    });


    describe("findGeographicDistribution", () => {
        const geographicCriteria = {
            sqCandidato: 123456789,
            year: 2022,
            round: 1,
            page: 1,
            limit: 20
        };

        it("delegates a valid geographic search to the repository", async () => {
            const findGeographicDistribution = vi.fn().mockResolvedValue(null);

            const repository = {
                findAll: vi.fn(),
                findGeographicDistribution
            } as unknown as CandidateRepository;

            const service = new CandidateService(repository);

            const result = await service.findGeographicDistribution(
                geographicCriteria
            );

            expect(result).toBeNull();
            expect(findGeographicDistribution).toHaveBeenCalledWith(
                geographicCriteria
            );
            expect(findGeographicDistribution).toHaveBeenCalledOnce();
        });

        it.each([
            ["zero", 0],
            ["negative", -1],
            ["fractional", 123.5],
            ["unsafe integer", Number.MAX_SAFE_INTEGER + 1]
        ])(
            "rejects an invalid candidate identifier: %s",
            async (_case, sqCandidato) => {
                const findGeographicDistribution = vi.fn();

                const repository = {
                    findAll: vi.fn(),
                    findGeographicDistribution
                } as unknown as CandidateRepository;

                const service = new CandidateService(repository);

                await expect(
                    service.findGeographicDistribution({
                        ...geographicCriteria,
                        sqCandidato
                    })
                ).rejects.toBeInstanceOf(
                    InvalidCandidateSearchCriteriaError
                );

                expect(findGeographicDistribution).not.toHaveBeenCalled();
            }
        );
    });
});
