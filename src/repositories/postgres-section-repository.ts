
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
  latitude: number | string | null;
  longitude: number | string | null;
  votes: number | string;
};

export class PostgresSectionRepository implements SectionRepository {
  constructor(private readonly database: Pool) {}

  async findByMunicipality(
    criteria: SectionSearchCriteria
  ): Promise<PaginatedResult<SectionRecord>> {
    const parameters = [
      criteria.municipalityCode,
      criteria.year,
      criteria.round,
      criteria.sqCandidato
    ];

    const countResult = await this.database.query<{ total: number }>(
      `
        SELECT COUNT(*)::int AS total
        FROM (
          SELECT DISTINCT
            id_municipio_ibge,
            zona,
            secao
          FROM locais_votacao
          WHERE id_municipio_ibge = $1
            AND ano = $2
        ) secoes
      `,
      [criteria.municipalityCode, criteria.year]
    );

    const total = countResult.rows[0]?.total ?? 0;
    const offset = (criteria.page - 1) * criteria.limit;

    const result = await this.database.query<SectionRow>(
      `
        WITH secoes AS (
          SELECT
            id_municipio_ibge,
            ano,
            zona,
            secao,
            AVG(latitude)::double precision AS latitude,
            AVG(longitude)::double precision AS longitude
          FROM locais_votacao
          WHERE id_municipio_ibge = $1
            AND ano = $2
          GROUP BY
            id_municipio_ibge,
            ano,
            zona,
            secao
        ),
        votos_candidato AS (
          SELECT
            cd_municipio_tse,
            zona,
            secao,
            SUM(qt_votos)::bigint AS votes
          FROM votos
          WHERE ano_eleicao = $2
            AND turno = $3
            AND sq_candidato = $4
            AND tipo_voto = 'NOMINAL'
          GROUP BY
            cd_municipio_tse,
            zona,
            secao
        )
        SELECT
          s.id_municipio_ibge AS "municipalityCode",
          s.zona AS zone,
          s.secao AS section,
          s.latitude,
          s.longitude,
          COALESCE(vc.votes, 0)::bigint AS votes
        FROM secoes s
        LEFT JOIN municipios_tse_ibge m
          ON m.cd_municipio_ibge = s.id_municipio_ibge
        LEFT JOIN votos_candidato vc
          ON vc.cd_municipio_tse = m.cd_municipio_tse
          AND vc.zona = s.zona
          AND vc.secao = s.secao
        ORDER BY s.zona, s.secao
        LIMIT $5
        OFFSET $6
      `,
      [...parameters, criteria.limit, offset]
    );

    const items: SectionRecord[] = result.rows.map((row) => {
      const votes = Number(row.votes);

      if (!Number.isSafeInteger(votes)) {
        throw new Error(
          "Quantidade de votos excede o limite seguro de inteiros."
        );
      }

      return {
        municipalityCode: row.municipalityCode,
        zone: row.zone,
        section: row.section,
        latitude:
          row.latitude === null ? null : Number(row.latitude),
        longitude:
          row.longitude === null ? null : Number(row.longitude),
        votes
      };
    });

    return {
      items,
      total,
      page: criteria.page,
      limit: criteria.limit,
      totalPages: Math.ceil(total / criteria.limit)
    };
  }
}
