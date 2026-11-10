
import type { Pool } from "pg";
import type {
    CandidateRecord,
    CandidateRepository,
    CandidateSearchCriteria,
    PaginatedCandidates
} from "../domain/candidate-repository.js";

export class PostgresCandidateRepository
    implements CandidateRepository {
    constructor(private readonly database: Pool) {}

    async findAll(
        criteria: CandidateSearchCriteria
    ): Promise<PaginatedCandidates> {
        const conditions = [
            "c.ano_eleicao = $1",
            "c.turno = $2"
        ];

        const parameters: (string | number)[] = [
            criteria.year,
            criteria.round
        ];

        const addParameter = (value: string | number): string => {
            parameters.push(value);
            return `$${parameters.length}`;
        };

        if (criteria.officeCode !== undefined) {
            conditions.push(
                `c.cd_cargo = ${addParameter(criteria.officeCode)}`
            );
        }

        if (criteria.search) {
            const searchParameter = addParameter(
                `%${criteria.search.replace(/[\\%_]/g, "\\$&")}%`
            );

            conditions.push(
                `(c.nm_candidato ILIKE ${searchParameter} ESCAPE '\\' OR
                  c.nm_urna_candidato ILIKE ${searchParameter} ESCAPE '\\')`
            );
        }

        if (criteria.candidateNumber !== undefined) {
            conditions.push(
                `c.nr_candidato = ${addParameter(criteria.candidateNumber)}`
            );
        }

        const whereClause = conditions.join(" AND ");

        const countResult = await this.database.query<{ total: string }>(
            `
                SELECT COUNT(*) AS total
                FROM candidatos c
                WHERE ${whereClause}
            `,
            [...parameters]
        );

        const total = Number(countResult.rows[0]?.total ?? 0);

        const resultParameters = [
            ...parameters,
            criteria.limit,
            (criteria.page - 1) * criteria.limit
        ];

        const limitParameter = `$${parameters.length + 1}`;
        const offsetParameter = `$${parameters.length + 2}`;

        const result = await this.database.query<{
            id: string;
            candidate_number: string | null;
            candidate_name: string;
            ballot_name: string | null;
            office_code: number;
            office_name: string;
            party_number: number | null;
            party_abbreviation: string | null;
            party_name: string | null;
            total_votes: string;
        }>(
            `
                SELECT
                    c.id,
                    c.nr_candidato AS candidate_number,
                    c.nm_candidato AS candidate_name,
                    c.nm_urna_candidato AS ballot_name,
                    c.cd_cargo AS office_code,
                    c.ds_cargo AS office_name,
                    c.nr_partido AS party_number,
                    c.sg_partido AS party_abbreviation,
                    c.nm_partido AS party_name,
                    COALESCE(v.total_votes, 0) AS total_votes
                FROM candidatos c
                LEFT JOIN (
                    SELECT
                        ano_eleicao,
                        turno,
                        sq_candidato,
                        cd_cargo,
                        SUM(qt_votos)::bigint AS total_votes
                    FROM votos
                    WHERE tipo_voto = 'NOMINAL'
                    GROUP BY
                        ano_eleicao,
                        turno,
                        sq_candidato,
                        cd_cargo
                ) v
                    ON v.ano_eleicao = c.ano_eleicao
                    AND v.turno = c.turno
                    AND v.sq_candidato = c.sq_candidato
                    AND v.cd_cargo = c.cd_cargo
                WHERE ${whereClause}
                ORDER BY
                    total_votes DESC,
                    c.nm_urna_candidato NULLS LAST,
                    c.nm_candidato,
                    c.id
                LIMIT ${limitParameter}
                OFFSET ${offsetParameter}
            `,
            resultParameters
        );

        const items: CandidateRecord[] = result.rows.map((row) => {
            const id = Number(row.id);
            const totalVotes = Number(row.total_votes);

            if (
                !Number.isSafeInteger(id) ||
                !Number.isSafeInteger(totalVotes)
            ) {
                throw new Error(
                    "Identificador ou total de votos excede o limite seguro de inteiros."
                );
            }

            return {
                id,
                candidateNumber: row.candidate_number,
                candidateName: row.candidate_name,
                ballotName: row.ballot_name,
                officeCode: row.office_code,
                officeName: row.office_name,
                partyNumber: row.party_number,
                partyAbbreviation: row.party_abbreviation,
                partyName: row.party_name,
                totalVotes
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
