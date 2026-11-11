
import type { Pool } from "pg";
import type {
    CandidateRecord,
    CandidateRepository,
    CandidateSearchCriteria,
    PaginatedCandidates,
    CandidateGeographicDistribution,
    CandidateGeographicSearchCriteria,
    MunicipalityVoteDistribution
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
            sq_candidato: string;
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
                    c.sq_candidato,
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
                sqCandidato: row.sq_candidato,
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

    async findGeographicDistribution(
        criteria: CandidateGeographicSearchCriteria
    ): Promise<CandidateGeographicDistribution | null> {

        // Verifica a existência do candidato.
        const candidateResult = await this.database.query(
            `
                SELECT 1
                FROM candidatos
                WHERE sq_candidato = $1
                  AND ano_eleicao = $2
                  AND turno = $3
                LIMIT 1
            `,
            [
                criteria.sqCandidato,
                criteria.year,
                criteria.round
            ]
        );

        if (candidateResult.rows.length === 0) {
            return null;
        }

        // Conta os municípios que possuem votos mapeados.
        const countResult = await this.database.query<{
            total: string;
        }>(
            `
                WITH candidato AS (
                    SELECT
                        ano_eleicao,
                        turno,
                        sq_candidato,
                        cd_cargo
                    FROM candidatos
                    WHERE sq_candidato = $1
                      AND ano_eleicao = $2
                      AND turno = $3
                ),
                votos_municipio AS (
                    SELECT
                        v.cd_municipio_tse,
                        SUM(v.qt_votos)::bigint AS total_votes
                    FROM votos v
                    JOIN candidato c
                        ON c.ano_eleicao = v.ano_eleicao
                        AND c.turno = v.turno
                        AND c.sq_candidato = v.sq_candidato
                        AND c.cd_cargo = v.cd_cargo
                    WHERE v.tipo_voto = 'NOMINAL'
                    GROUP BY v.cd_municipio_tse
                )
                SELECT COUNT(*) AS total
                FROM votos_municipio vm
                JOIN municipios_tse_ibge m
                    ON m.cd_municipio_tse = vm.cd_municipio_tse
            `,
            [
                criteria.sqCandidato,
                criteria.year,
                criteria.round
            ]
        );

        const total = Number(countResult.rows[0]?.total ?? 0);

        if (!Number.isSafeInteger(total)) {
            throw new Error(
                "Total de municípios excede o limite seguro de inteiros."
            );
        }

        // Consulta votos e coordenadas representativas dos municípios.
        const result = await this.database.query<{
            ibge_code: string;
            municipality: string;
            total_votes: string;
            latitude: number | string | null;
            longitude: number | string | null;
        }>(
            `
                WITH candidato AS (
                    SELECT
                        ano_eleicao,
                        turno,
                        sq_candidato,
                        cd_cargo
                    FROM candidatos
                    WHERE sq_candidato = $1
                      AND ano_eleicao = $2
                      AND turno = $3
                ),
                votos_municipio AS (
                    SELECT
                        v.cd_municipio_tse,
                        SUM(v.qt_votos)::bigint AS total_votes
                    FROM votos v
                    JOIN candidato c
                        ON c.ano_eleicao = v.ano_eleicao
                        AND c.turno = v.turno
                        AND c.sq_candidato = v.sq_candidato
                        AND c.cd_cargo = v.cd_cargo
                    WHERE v.tipo_voto = 'NOMINAL'
                    GROUP BY v.cd_municipio_tse
                ),
                locais_unicos AS (
                    SELECT DISTINCT
                        ano,
                        id_municipio_ibge,
                        zona,
                        secao,
                        latitude,
                        longitude
                    FROM locais_votacao
                    WHERE ano = $2
                      AND latitude IS NOT NULL
                      AND longitude IS NOT NULL
                ),
                coordenadas_municipais AS (
                    SELECT
                        id_municipio_ibge,
                        AVG(latitude)::double precision AS latitude,
                        AVG(longitude)::double precision AS longitude
                    FROM locais_unicos
                    GROUP BY id_municipio_ibge
                )
                SELECT
                    m.cd_municipio_ibge AS ibge_code,
                    m.nm_municipio_ibge AS municipality,
                    vm.total_votes,
                    cm.latitude,
                    cm.longitude
                FROM votos_municipio vm
                JOIN municipios_tse_ibge m
                    ON m.cd_municipio_tse = vm.cd_municipio_tse
                LEFT JOIN coordenadas_municipais cm
                    ON cm.id_municipio_ibge = m.cd_municipio_ibge
                ORDER BY
                    vm.total_votes DESC,
                    m.nm_municipio_ibge ASC
                LIMIT $4
                OFFSET $5
            `,
            [
                criteria.sqCandidato,
                criteria.year,
                criteria.round,
                criteria.limit,
                (criteria.page - 1) * criteria.limit
            ]
        );

        // Converte e valida os resultados.
        const municipalities: MunicipalityVoteDistribution[] =
            result.rows.map((row) => {
                const votes = Number(row.total_votes);

                if (!Number.isSafeInteger(votes)) {
                    throw new Error(
                        "Total de votos excede o limite seguro de inteiros."
                    );
                }

                const latitude = row.latitude === null
                    ? null
                    : Number(row.latitude);

                const longitude = row.longitude === null
                    ? null
                    : Number(row.longitude);

                if (
                    (latitude !== null && !Number.isFinite(latitude)) ||
                    (longitude !== null && !Number.isFinite(longitude))
                ) {
                    throw new Error(
                        "Coordenadas geográficas inválidas."
                    );
                }

                return {
                    ibgeCode: row.ibge_code,
                    municipality: row.municipality,
                    votes,
                    latitude,
                    longitude
                };
            });

        return {
            sqCandidato: criteria.sqCandidato,
            year: criteria.year,
            round: criteria.round,
            municipalities,
            pagination: {
                page: criteria.page,
                limit: criteria.limit,
                total,
                totalPages: Math.ceil(total / criteria.limit)
            }
        };
    }
}
