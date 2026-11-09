import type { Pool } from "pg";
import type {
  PaginatedResult,
  SectionRecord,
  SectionRepository,
  SectionSearchCriteria
} from "../domain/section-repository.js";

type SectionRow = {
  municipalityCode: string;
  zone: number;
  section: number;
  latitude: string | null;
  longitude: string | null;
};

export class PostgresSectionRepository implements SectionRepository {
  constructor(private readonly database: Pool) {}

  async findByMunicipality(
    criteria: SectionSearchCriteria
  ): Promise<PaginatedResult<SectionRecord>> {
    const parameters = [criteria.municipalityCode];

    const countResult = await this.database.query<{ total: number }>(
      `
        SELECT COUNT(*)::int AS total
        FROM locais_votacao
        WHERE id_municipio_ibge = $1
      `,
      parameters
    );

    const total = countResult.rows[0]?.total ?? 0;
    const offset = (criteria.page - 1) * criteria.limit;

    const result = await this.database.query<SectionRow>(
      `
        SELECT
          id_municipio_ibge AS "municipalityCode",
          zona AS zone,
          secao AS section,
          latitude,
          longitude
        FROM locais_votacao
        WHERE id_municipio_ibge = $1
        ORDER BY zona, secao
        LIMIT $2
        OFFSET $3
      `,
      [...parameters, criteria.limit, offset]
    );

    const items: SectionRecord[] = result.rows.map((row) => ({
      ...row,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude)
    }));

    return {
      items,
      total,
      page: criteria.page,
      limit: criteria.limit,
      totalPages: Math.ceil(total / criteria.limit)
    };
  }
}
