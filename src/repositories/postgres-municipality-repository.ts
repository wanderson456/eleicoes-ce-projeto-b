import type { Pool } from "pg";
import type {
  MunicipalityRecord,
  MunicipalityRepository
} from "../domain/municipality-repository.js";

export class PostgresMunicipalityRepository
  implements MunicipalityRepository {

  constructor(private readonly database: Pool) {}

  async findAll(): Promise<MunicipalityRecord[]> {
    const result = await this.database.query<MunicipalityRecord>(
      `
        SELECT
          cd_municipio_tse AS "tseCode",
          nm_municipio_tse AS "tseName",
          cd_municipio_ibge AS "ibgeCode",
          nm_municipio_ibge AS "ibgeName"
        FROM municipios_tse_ibge
        ORDER BY nm_municipio_ibge
      `
    );

    return result.rows;
  }
}
