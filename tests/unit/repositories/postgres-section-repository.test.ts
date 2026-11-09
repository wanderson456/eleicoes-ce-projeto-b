import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PostgresSectionRepository } from "../../../src/repositories/postgres-section-repository.js";

describe("PostgresSectionRepository", () => {
  const sectionRow = {
    municipalityCode: "2300200",
    zone: 30,
    section: 165,
    latitude: "-3.745000000",
    longitude: "-38.520000000"
  };

  function createRepository(query: ReturnType<typeof vi.fn>) {
    return new PostgresSectionRepository(
      { query } as unknown as Pool
    );
  }

  it("searches sections by municipality", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 25 }] })
      .mockResolvedValueOnce({ rows: [sectionRow] });

    const repository = createRepository(query);

    const result = await repository.findByMunicipality({
      municipalityCode: "2300200",
      page: 1,
      limit: 10
    });

    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.latitude).toBe(-3.745);
    expect(result.items[0]?.longitude).toBe(-38.52);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("COUNT(*)"),
      ["2300200"]
    );
  });

  it("calculates the offset for the requested page", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 45 }] })
      .mockResolvedValueOnce({ rows: [sectionRow] });

    const repository = createRepository(query);

    const result = await repository.findByMunicipality({
      municipalityCode: "2300200",
      page: 2,
      limit: 20
    });

    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(3);

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("OFFSET $3"),
      ["2300200", 20, 20]
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

    const result = await repository.findByMunicipality({
      municipalityCode: "2300200",
      page: 1,
      limit: 20
    });

    expect(result.items[0]?.latitude).toBeNull();
    expect(result.items[0]?.longitude).toBeNull();
  });

  it("returns an empty result when the municipality has no sections", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const repository = createRepository(query);

    const result = await repository.findByMunicipality({
      municipalityCode: "9999999",
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
