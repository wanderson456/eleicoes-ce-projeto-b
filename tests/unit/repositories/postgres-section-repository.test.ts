
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PostgresSectionRepository } from "../../../src/repositories/postgres-section-repository.js";

describe("PostgresSectionRepository", () => {
  const criteria = {
    municipalityCode: "2300200",
    sqCandidato: "60001633582",
    year: 2022,
    round: 1,
    page: 1,
    limit: 10
  };

  const sectionRow = {
    municipalityCode: "2300200",
    zone: 30,
    section: 165,
    latitude: "-3.745000000",
    longitude: "-38.520000000",
    votes: "237"
  };

  function createRepository(query: ReturnType<typeof vi.fn>) {
    return new PostgresSectionRepository(
      { query } as unknown as Pool
    );
  }

  it("searches sections by municipality and candidate", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 25 }] })
      .mockResolvedValueOnce({ rows: [sectionRow] });

    const repository = createRepository(query);

    const result = await repository.findByMunicipality(criteria);

    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.latitude).toBe(-3.745);
    expect(result.items[0]?.longitude).toBe(-38.52);
    expect(result.items[0]?.votes).toBe(237);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("COUNT(*)"),
      ["2300200", 2022]
    );

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("sq_candidato = $4"),
      ["2300200", 2022, 1, "60001633582", 10, 0]
    );
  });

  it("calculates the offset for the requested page", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 45 }] })
      .mockResolvedValueOnce({ rows: [sectionRow] });

    const repository = createRepository(query);

    const result = await repository.findByMunicipality({
      ...criteria,
      page: 2,
      limit: 20
    });

    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(3);

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("OFFSET $6"),
      ["2300200", 2022, 1, "60001633582", 20, 20]
    );
  });

  it("preserves null coordinates", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [{
          ...sectionRow,
          latitude: null,
          longitude: null
        }]
      });

    const repository = createRepository(query);

    const result = await repository.findByMunicipality(criteria);

    expect(result.items[0]?.latitude).toBeNull();
    expect(result.items[0]?.longitude).toBeNull();
    expect(result.items[0]?.votes).toBe(237);
  });

  it("preserves sections with zero votes", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [{
          ...sectionRow,
          votes: "0"
        }]
      });

    const repository = createRepository(query);

    const result = await repository.findByMunicipality(criteria);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.votes).toBe(0);
  });

  it("returns an empty result when the municipality has no sections", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const repository = createRepository(query);

    const result = await repository.findByMunicipality({
      ...criteria,
      municipalityCode: "9999999"
    });

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0
    });
  });
});
