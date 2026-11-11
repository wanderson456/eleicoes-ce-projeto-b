
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PostgresMunicipalityRepository } from "../../../src/repositories/postgres-municipality-repository.js";

describe("PostgresMunicipalityRepository", () => {
  it("returns all municipalities from database", async () => {
    const rows = [
      {
        tseCode: "12345",
        tseName: "ARARIPE",
        ibgeCode: "2301307",
        ibgeName: "Araripe"
      },
      {
        tseCode: "12346",
        tseName: "ACARAÚ",
        ibgeCode: "2300200",
        ibgeName: "Acaraú"
      }
    ];

    const query = vi.fn().mockResolvedValue({ rows });
    const repository = new PostgresMunicipalityRepository({
      query
    } as unknown as Pool);

    const result = await repository.findAll();

    expect(result).toEqual(rows);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("executes the expected SQL query", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PostgresMunicipalityRepository({
      query
    } as unknown as Pool);

    await repository.findAll();

    const sql = query.mock.calls[0][0] as string;

    expect(sql).toContain("FROM municipios_tse_ibge");
    expect(sql).toContain('cd_municipio_tse AS "tseCode"');
    expect(sql).toContain('nm_municipio_tse AS "tseName"');
    expect(sql).toContain('cd_municipio_ibge AS "ibgeCode"');
    expect(sql).toContain('nm_municipio_ibge AS "ibgeName"');
    expect(sql).toContain("ORDER BY nm_municipio_ibge");
  });

  it("propagates database errors", async () => {
    const error = new Error("Falha na consulta PostgreSQL");
    const query = vi.fn().mockRejectedValue(error);

    const repository = new PostgresMunicipalityRepository({
      query
    } as unknown as Pool);

    await expect(repository.findAll()).rejects.toThrow(error);
  });
});
