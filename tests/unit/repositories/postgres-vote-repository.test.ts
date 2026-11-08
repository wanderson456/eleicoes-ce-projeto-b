import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PostgresVoteRepository } from "../../../src/repositories/postgres-vote-repository.js";

describe("PostgresVoteRepository", () => {
  const voteRow = {
    year: 2022,
    round: 1,
    municipalityCode: "15750",
    municipalityName: "Município de teste",
    zone: 15,
    section: 221,
    officeCode: 5,
    officeName: "Senador",
    voteCode: "96",
    voteName: "VOTO NULO",
    quantity: 13,
    candidateId: "-1",
    voteType: "NULO" as const,
    pollingPlaceCode: 1090,
    pollingPlaceName: "Local de votação",
    pollingPlaceAddress: "Endereço de teste"
  };

  it("searches all vote types when no filter is provided", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 25 }] })
      .mockResolvedValueOnce({ rows: [voteRow] });

    const repository = new PostgresVoteRepository(
      { query } as unknown as Pool
    );

    const result = await repository.findBySection({
      municipalityCode: "15750",
      zone: 15,
      section: 221,
      page: 1,
      limit: 10
    });

    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.candidateId).toBe(-1);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("COUNT(*)"),
      ["15750", 15, 221, null]
    );
  });

  it("applies the requested vote type filter", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [voteRow] });

    const repository = new PostgresVoteRepository(
      { query } as unknown as Pool
    );

    const result = await repository.findBySection({
      municipalityCode: "15750",
      zone: 15,
      section: 221,
      voteType: "NULO",
      page: 1,
      limit: 20
    });

    expect(result.total).toBe(1);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("tipo_voto = $4"),
      ["15750", 15, 221, "NULO"]
    );
  });

  it("calculates the offset for the requested page", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 45 }] })
      .mockResolvedValueOnce({ rows: [voteRow] });

    const repository = new PostgresVoteRepository(
      { query } as unknown as Pool
    );

    const result = await repository.findBySection({
      municipalityCode: "15750",
      zone: 15,
      section: 221,
      page: 2,
      limit: 20
    });

    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(3);

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("OFFSET $6"),
      ["15750", 15, 221, null, 20, 20]
    );
  });

  it("rejects candidate identifiers outside the safe integer range", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ ...voteRow, candidateId: "9007199254740992" }]
      });

    const repository = new PostgresVoteRepository(
      { query } as unknown as Pool
    );

    await expect(
      repository.findBySection({
        municipalityCode: "15750",
        zone: 15,
        section: 221,
        page: 1,
        limit: 20
      })
    ).rejects.toThrow(
      "Identificador do candidato excede o limite seguro."
    );
  });
    it("returns an empty result when the count query has no rows", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const repository = new PostgresVoteRepository(
      { query } as unknown as Pool
    );

    const result = await repository.findBySection({
      municipalityCode: "99999",
      zone: 99,
      section: 999,
      page: 1,
      limit: 20
    });

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0
    });
  });
});
