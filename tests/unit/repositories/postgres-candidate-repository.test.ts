
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PostgresCandidateRepository } from "../../../src/repositories/postgres-candidate-repository.js";

describe("PostgresCandidateRepository", () => {
    function createRepository(query: ReturnType<typeof vi.fn>) {
        return new PostgresCandidateRepository(
            { query } as unknown as Pool
        );
    }

    const criteria = {
        year: 2022,
        round: 1,
        page: 1,
        limit: 20
    };

    const candidateRows = [
        {
            id: "643",
            candidate_number: "12333",
            candidate_name: "MARCOS MARCEL RODRIGUES SOBREIRA",
            ballot_name: "MARCOS SOBREIRA",
            office_code: 7,
            office_name: "DEPUTADO ESTADUAL",
            party_number: 12,
            party_abbreviation: "PDT",
            party_name: "PARTIDO DEMOCRÁTICO TRABALHISTA",
            total_votes: "72183"
        }
    ];

    it("returns candidates with their vote totals", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: candidateRows });

        const repository = createRepository(query);

        const result = await repository.findAll(criteria);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toEqual({
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
        });
    });

    it("returns pagination metadata correctly", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "45" }] })
            .mockResolvedValueOnce({ rows: candidateRows });

        const repository = createRepository(query);

        const result = await repository.findAll({
            ...criteria,
            page: 2,
            limit: 20
        });

        expect(result.total).toBe(45);
        expect(result.page).toBe(2);
        expect(result.limit).toBe(20);
        expect(result.totalPages).toBe(3);
    });

    it("filters by officeCode when provided", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: candidateRows });

        const repository = createRepository(query);

        await repository.findAll({
            ...criteria,
            officeCode: 7
        });

        expect(query).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining("c.cd_cargo = $3"),
            [2022, 1, 7]
        );
    });

    it("searches candidate names and ballot names", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: candidateRows });

        const repository = createRepository(query);

        await repository.findAll({
            ...criteria,
            search: "Marcos"
        });

        expect(query.mock.calls[0]?.[0]).toContain(
            "c.nm_candidato ILIKE $3"
        );

        expect(query.mock.calls[0]?.[0]).toContain(
            "c.nm_urna_candidato ILIKE $3"
        );

        expect(query.mock.calls[0]?.[1]).toEqual([
            2022, 1, "%Marcos%"
        ]);
    });

    it("filters by candidate number preserving leading zeros", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: candidateRows });

        const repository = createRepository(query);

        await repository.findAll({
            ...criteria,
            candidateNumber: "00123"
        });

        expect(query).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining("c.nr_candidato = $3"),
            [2022, 1, "00123"]
        );
    });

    it("escapes wildcard characters in search terms", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

        const repository = createRepository(query);

        await repository.findAll({
            ...criteria,
            search: "Mar%_cos"
        });

        expect(query).toHaveBeenNthCalledWith(
            1,
            expect.any(String),
            [2022, 1, "%Mar\\%\\_cos%"]
        );
    });

    it("uses only nominal votes in the aggregation", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: candidateRows });

        const repository = createRepository(query);

        await repository.findAll(criteria);

        expect(query.mock.calls[1]?.[0]).toContain(
            "WHERE tipo_voto = 'NOMINAL'"
        );
        expect(query.mock.calls[1]?.[0]).toContain("SUM(qt_votos)");
    });

    it("keeps candidates without votes using LEFT JOIN", async () => {
        const candidateWithoutVotes = [{
            ...candidateRows[0],
            total_votes: "0"
        }];

        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: candidateWithoutVotes });

        const repository = createRepository(query);

        const result = await repository.findAll(criteria);

        expect(query.mock.calls[1]?.[0]).toContain("LEFT JOIN");
        expect(query.mock.calls[1]?.[0]).toContain(
            "COALESCE(v.total_votes, 0)"
        );
        expect(result.items[0]?.totalVotes).toBe(0);
    });

    it("orders candidates by votes in descending order", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: candidateRows });

        const repository = createRepository(query);

        await repository.findAll(criteria);

        expect(query.mock.calls[1]?.[0]).toContain(
            "ORDER BY"
        );
        expect(query.mock.calls[1]?.[0]).toContain(
            "total_votes DESC"
        );
    });

    it("applies limit and offset correctly", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "45" }] })
            .mockResolvedValueOnce({ rows: candidateRows });

        const repository = createRepository(query);

        await repository.findAll({
            ...criteria,
            page: 3,
            limit: 10
        });

        expect(query).toHaveBeenNthCalledWith(
            2,
            expect.any(String),
            [2022, 1, 10, 20]
        );
    });

    it("returns an empty list when no candidates match", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

        const repository = createRepository(query);

        const result = await repository.findAll(criteria);

        expect(result.items).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.totalPages).toBe(0);
    });

    it("does not query candidate data when count is zero", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

        const repository = createRepository(query);

        await repository.findAll(criteria);

        expect(query).toHaveBeenCalledTimes(2);
    });

    it("rejects identifiers exceeding the safe integer limit", async () => {
        const invalidRows = [{
            ...candidateRows[0],
            id: "9007199254740992"
        }];

        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: invalidRows });

        const repository = createRepository(query);

        await expect(
            repository.findAll(criteria)
        ).rejects.toThrow(
            "Identificador ou total de votos excede o limite seguro de inteiros."
        );
    });

    it("rejects vote totals exceeding the safe integer limit", async () => {
        const invalidRows = [{
            ...candidateRows[0],
            total_votes: "9007199254740992"
        }];

        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: invalidRows });

        const repository = createRepository(query);

        await expect(
            repository.findAll(criteria)
        ).rejects.toThrow(
            "Identificador ou total de votos excede o limite seguro de inteiros."
        );
    });

    it("returns null party fields when they are absent", async () => {
        const rows = [{
            ...candidateRows[0],
            party_number: null,
            party_abbreviation: null,
            party_name: null,
            ballot_name: null
        }];

        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows });

        const repository = createRepository(query);

        const result = await repository.findAll(criteria);

        expect(result.items[0]?.partyNumber).toBeNull();
        expect(result.items[0]?.partyAbbreviation).toBeNull();
        expect(result.items[0]?.partyName).toBeNull();
        expect(result.items[0]?.ballotName).toBeNull();
    });


    describe("findGeographicDistribution", () => {
        it("returns candidate votes grouped by municipality with coordinates", async () => {
            const query = vi.fn()
                .mockResolvedValueOnce({
                    rows: [{ "?column?": 1 }]
                })
                .mockResolvedValueOnce({
                    rows: [{ total: "1" }]
                })
                .mockResolvedValueOnce({
                    rows: [{
                        ibge_code: "2301307",
                        municipality: "ARARIPE",
                        total_votes: "4590",
                        latitude: -7.21,
                        longitude: -40.13
                    }]
                });

            const repository = createRepository(query);

            const result = await repository.findGeographicDistribution({
                sqCandidato: 123456789,
                year: 2022,
                round: 1,
                page: 1,
                limit: 20
            });

            expect(result).toEqual({
                sqCandidato: 123456789,
                year: 2022,
                round: 1,
                municipalities: [{
                    ibgeCode: "2301307",
                    municipality: "ARARIPE",
                    votes: 4590,
                    latitude: -7.21,
                    longitude: -40.13
                }],
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    totalPages: 1
                }
            });

            expect(query).toHaveBeenCalledTimes(3);

            expect(query.mock.calls[2]?.[1]).toEqual([
                123456789,
                2022,
                1,
                20,
                0
            ]);
        });
    });


it("returns null when the candidate does not exist", async () => {
    const query = vi.fn().mockResolvedValueOnce({
        rows: []
    });

    const repository = createRepository(query);

    const result = await repository.findGeographicDistribution({
        sqCandidato: 999999999,
        year: 2022,
        round: 1,
        page: 1,
        limit: 20
    });

    expect(result).toBeNull();
    expect(query).toHaveBeenCalledOnce();
});


});
