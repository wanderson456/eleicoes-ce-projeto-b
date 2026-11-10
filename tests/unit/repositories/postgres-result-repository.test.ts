
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PostgresResultRepository } from "../../../src/repositories/postgres-result-repository.js";

describe("PostgresResultRepository", () => {
    function createRepository(query: ReturnType<typeof vi.fn>) {
        return new PostgresResultRepository(
            { query } as unknown as Pool
        );
    }

    const summaryRows = [
        {
            officeCode: 7,
            officeName: "Deputado Estadual",
            municipalityName: "ARARIPE",
            voteType: "NOMINAL",
            total: "11000"
        },
        {
            officeCode: 7,
            officeName: "Deputado Estadual",
            municipalityName: "ARARIPE",
            voteType: "LEGENDA",
            total: "1000"
        },
        {
            officeCode: 7,
            officeName: "Deputado Estadual",
            municipalityName: "ARARIPE",
            voteType: "BRANCO",
            total: "500"
        },
        {
            officeCode: 7,
            officeName: "Deputado Estadual",
            municipalityName: "ARARIPE",
            voteType: "NULO",
            total: "300"
        }
    ];

    const candidateRows = [
        {
            officeCode: 7,
            officeName: "Deputado Estadual",
            candidateId: "123456789",
            candidateNumber: "12345",
            candidateName: "CANDIDATO A",
            partyNumber: 10,
            partyAbbreviation: "ABC",
            partyName: "PARTIDO ABC",
            votes: "6000"
        },
        {
            officeCode: 7,
            officeName: "Deputado Estadual",
            candidateId: "987654321",
            candidateNumber: "12346",
            candidateName: "CANDIDATO B",
            partyNumber: 10,
            partyAbbreviation: "ABC",
            partyName: "PARTIDO ABC",
            votes: "5000"
        }
    ];

    const partyRows = [
        {
            officeCode: 7,
            officeName: "Deputado Estadual",
            partyNumber: 10,
            partyAbbreviation: "ABC",
            partyName: "PARTIDO ABC",
            nominalVotes: "11000",
            legendVotes: "1000"
        }
    ];

    it("returns municipality election results grouped by office", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: summaryRows })
            .mockResolvedValueOnce({ rows: candidateRows })
            .mockResolvedValueOnce({ rows: partyRows });

        const repository = createRepository(query);

        const result = await repository.findByMunicipality({
            municipalityCode: "13250",
            year: 2022,
            round: 1
        });

        expect(result).not.toBeNull();
        expect(result?.municipalityCode).toBe("13250");
        expect(result?.municipalityName).toBe("ARARIPE");
        expect(result?.year).toBe(2022);
        expect(result?.round).toBe(1);
        expect(result?.offices).toHaveLength(1);
        expect(result?.offices[0]?.officeCode).toBe(7);
    });

    it("calculates vote totals correctly", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: summaryRows })
            .mockResolvedValueOnce({ rows: candidateRows })
            .mockResolvedValueOnce({ rows: partyRows });

        const repository = createRepository(query);

        const result = await repository.findByMunicipality({
            municipalityCode: "13250",
            year: 2022,
            round: 1
        });

        const office = result?.offices[0];

        expect(office?.nominalVotes).toBe(11000);
        expect(office?.legendVotes).toBe(1000);
        expect(office?.validVotes).toBe(12000);
        expect(office?.blankVotes).toBe(500);
        expect(office?.nullVotes).toBe(300);
        expect(office?.totalVotes).toBe(12800);
    });

    it("calculates candidate and party percentages", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: summaryRows })
            .mockResolvedValueOnce({ rows: candidateRows })
            .mockResolvedValueOnce({ rows: partyRows });

        const repository = createRepository(query);

        const result = await repository.findByMunicipality({
            municipalityCode: "13250",
            year: 2022,
            round: 1
        });

        const office = result?.offices[0];

        expect(office?.candidates[0]?.percentage).toBe(50);
        expect(office?.candidates[1]?.percentage).toBe(41.67);
        expect(office?.parties[0]?.percentage).toBe(100);
    });

    it("includes legend votes in the party total", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: summaryRows })
            .mockResolvedValueOnce({ rows: candidateRows })
            .mockResolvedValueOnce({ rows: partyRows });

        const repository = createRepository(query);

        const result = await repository.findByMunicipality({
            municipalityCode: "13250",
            year: 2022,
            round: 1
        });

        const party = result?.offices[0]?.parties[0];

        expect(party?.nominalVotes).toBe(11000);
        expect(party?.legendVotes).toBe(1000);
        expect(party?.totalVotes).toBe(12000);
    });

    it("filters the query by officeCode when provided", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: summaryRows })
            .mockResolvedValueOnce({ rows: candidateRows })
            .mockResolvedValueOnce({ rows: partyRows });

        const repository = createRepository(query);

        await repository.findByMunicipality({
            municipalityCode: "13250",
            year: 2022,
            round: 1,
            officeCode: 7
        });

        expect(query).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining("AND cd_cargo = $4"),
            ["13250", 2022, 1, 7]
        );

        expect(query).toHaveBeenCalledTimes(3);
    });

    it("returns null when the municipality has no results", async () => {
        const query = vi.fn().mockResolvedValueOnce({ rows: [] });

        const repository = createRepository(query);

        const result = await repository.findByMunicipality({
            municipalityCode: "99999",
            year: 2022,
            round: 1
        });

        expect(result).toBeNull();
        expect(query).toHaveBeenCalledOnce();
    });

    it("returns zero percentage when there are no valid votes", async () => {
        const emptyVoteRows = [
            {
                ...summaryRows[2],
                total: "500"
            },
            {
                ...summaryRows[3],
                total: "300"
            }
        ];

        const query = vi.fn()
            .mockResolvedValueOnce({ rows: emptyVoteRows })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const repository = createRepository(query);

        const result = await repository.findByMunicipality({
            municipalityCode: "13250",
            year: 2022,
            round: 1
        });

        expect(result?.offices[0]?.validVotes).toBe(0);
        expect(result?.offices[0]?.totalVotes).toBe(800);
    });


    it("returns empty candidate and party lists when there are no valid votes", async () => {
        const emptyVoteRows = [
            {
                ...summaryRows[2],
                total: "500"
            },
            {
                ...summaryRows[3],
                total: "300"
            }
        ];

        const query = vi.fn()
            .mockResolvedValueOnce({ rows: emptyVoteRows })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const repository = createRepository(query);

        const result = await repository.findByMunicipality({
            municipalityCode: "13250",
            year: 2022,
            round: 1
        });

        const office = result?.offices[0];

        expect(office?.nominalVotes).toBe(0);
        expect(office?.legendVotes).toBe(0);
        expect(office?.validVotes).toBe(0);
        expect(office?.totalVotes).toBe(800);
        expect(office?.candidates).toEqual([]);
        expect(office?.parties).toEqual([]);
    });

});
