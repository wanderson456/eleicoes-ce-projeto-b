import type { Pool } from "pg";
import type {
  PaginatedResult,
  VoteRecord,
  VoteRepository,
  VoteSearchCriteria
} from "../domain/vote-repository.js";

type VoteRow = Omit<VoteRecord, "candidateId"> & {
  year: number;
  round: number;
  municipalityCode: string;
  municipalityName: string;
  zone: number;
  section: number;
  officeCode: number;
  officeName: string;
  voteCode: string;
  voteName: string;
  quantity: number;
  candidateId: string;
  voteType: VoteRecord["voteType"];
  pollingPlaceCode: number;
  pollingPlaceName: string;
  pollingPlaceAddress: string;
}

export class PostgresVoteRepository implements VoteRepository {
  constructor(private readonly database: Pool) {}

  async findBySection(
    criteria: VoteSearchCriteria
  ): Promise<PaginatedResult<VoteRecord>> {
    const parameters = [
      criteria.municipalityCode,
      criteria.zone,
      criteria.section,
      criteria.voteType ?? null
    ];

    const whereClause = `
      WHERE cd_municipio_tse = $1
        AND zona = $2
        AND secao = $3
        AND ($4::varchar IS NULL OR tipo_voto = $4)
    `;

    const countResult = await this.database.query<{ total: number }>(
      `
        SELECT COUNT(*)::int AS total
        FROM votos
        ${whereClause}
      `,
      parameters
    );

    const total = countResult.rows[0]?.total ?? 0;
    const offset = (criteria.page - 1) * criteria.limit;

    const result = await this.database.query<VoteRow>(
      `
        SELECT
          ano_eleicao AS year,
          turno AS round,
          cd_municipio_tse AS "municipalityCode",
          nm_municipio AS "municipalityName",
          zona AS zone,
          secao AS section,
          cd_cargo AS "officeCode",
          ds_cargo AS "officeName",
          nr_votavel AS "voteCode",
          nm_votavel AS "voteName",
          qt_votos AS quantity,
          sq_candidato AS "candidateId",
          tipo_voto AS "voteType",
          nr_local_votacao AS "pollingPlaceCode",
          nm_local_votacao AS "pollingPlaceName",
          ds_local_votacao_endereco AS "pollingPlaceAddress"
        FROM votos
        ${whereClause}
        ORDER BY cd_cargo, nr_votavel, sq_candidato
        LIMIT $5
        OFFSET $6
      `,
      [...parameters, criteria.limit, offset]
    );
const items: VoteRecord[] = result.rows.map((row) => {
  const candidateId = Number(row.candidateId);

  if (!Number.isSafeInteger(candidateId)) {
    throw new Error("Identificador do candidato excede o limite seguro.");
  }

  return { ...row, candidateId };
});

return {
  items,
  total,
  page: criteria.page,
  limit: criteria.limit,
  totalPages: Math.ceil(total / criteria.limit)
};
}}
