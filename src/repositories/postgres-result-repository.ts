
import type { Pool } from "pg";
import type {
  CandidateResult,
  MunicipalityResult,
  OfficeResult,
  PartyResult,
  ResultRepository,
  ResultSearchCriteria
} from "../domain/result-repository.js";

type VoteType = "NOMINAL" | "LEGENDA" | "BRANCO" | "NULO";

type SummaryRow = {
  officeCode: number;
  officeName: string;
  municipalityName: string;
  voteType: VoteType;
  total: string;
};

type CandidateRow = {
  officeCode: number;
  officeName: string;
  candidateId: string;
  candidateNumber: string;
  candidateName: string;
  partyNumber: number | null;
  partyAbbreviation: string | null;
  partyName: string | null;
  votes: string;
};

type PartyRow = {
  officeCode: number;
  officeName: string;
  partyNumber: number;
  partyAbbreviation: string | null;
  partyName: string | null;
  nominalVotes: string;
  legendVotes: string;
};

function toSafeInteger(value: string): number {
  const number = Number(value);

  if (!Number.isSafeInteger(number)) {
    throw new Error("Valor numÃ©rico excede o limite seguro.");
  }

  return number;
}

function calculatePercentage(
  votes: number,
  validVotes: number
): number {
  if (validVotes === 0) {
    return 0;
  }

  return Number(((votes / validVotes) * 100).toFixed(2));
}

export class PostgresResultRepository implements ResultRepository {
  constructor(private readonly database: Pool) {}

  async findByMunicipality(
    criteria: ResultSearchCriteria
  ): Promise<MunicipalityResult | null> {
    const parameters = [
      criteria.municipalityCode,
      criteria.year,
      criteria.round
    ];

    const officeFilter = criteria.officeCode === undefined
      ? ""
      : "AND cd_cargo = $4";

    const queryParameters = criteria.officeCode === undefined
      ? parameters
      : [...parameters, criteria.officeCode];

    const summaryResult = await this.database.query<SummaryRow>(
      `
        SELECT
          cd_cargo AS "officeCode",
          ds_cargo AS "officeName",
          nm_municipio AS "municipalityName",
          tipo_voto AS "voteType",
          SUM(qt_votos)::text AS total
        FROM votos
        WHERE cd_municipio_tse = $1
          AND ano_eleicao = $2
          AND turno = $3
          ${officeFilter}
        GROUP BY
          cd_cargo,
          ds_cargo,
          nm_municipio,
          tipo_voto
        ORDER BY cd_cargo, tipo_voto
      `,
      queryParameters
    );

    if (summaryResult.rows.length === 0) {
      return null;
    }

    const candidateOfficeFilter = criteria.officeCode === undefined
      ? ""
      : "AND v.cd_cargo = $4";

    const candidateResult = await this.database.query<CandidateRow>(
      `
        SELECT
          v.cd_cargo AS "officeCode",
          v.ds_cargo AS "officeName",
          v.sq_candidato::text AS "candidateId",
          COALESCE(c.nr_candidato, v.nr_votavel) AS "candidateNumber",
          COALESCE(
            c.nm_urna_candidato,
            c.nm_candidato,
            v.nm_votavel
          ) AS "candidateName",
          c.nr_partido AS "partyNumber",
          c.sg_partido AS "partyAbbreviation",
          c.nm_partido AS "partyName",
          SUM(v.qt_votos)::text AS votes
        FROM votos v
        INNER JOIN candidatos c
          ON c.ano_eleicao = v.ano_eleicao
          AND c.turno = v.turno
          AND c.sq_candidato = v.sq_candidato
        WHERE v.cd_municipio_tse = $1
          AND v.ano_eleicao = $2
          AND v.turno = $3
          AND v.tipo_voto = 'NOMINAL'
          ${candidateOfficeFilter}
        GROUP BY
          v.cd_cargo,
          v.ds_cargo,
          v.sq_candidato,
          c.nr_candidato,
          c.nm_urna_candidato,
          c.nm_candidato,
          v.nr_votavel,
          v.nm_votavel,
          c.nr_partido,
          c.sg_partido,
          c.nm_partido
        ORDER BY v.cd_cargo, SUM(v.qt_votos) DESC
      `,
      queryParameters
    );

    const partyOfficeFilter = criteria.officeCode === undefined
      ? ""
      : "AND v.cd_cargo = $4";

    const partyResult = await this.database.query<PartyRow>(
      `
        WITH candidate_votes AS (
          SELECT
            v.cd_cargo AS office_code,
            v.ds_cargo AS office_name,
            c.nr_partido AS party_number,
            c.sg_partido AS party_abbreviation,
            c.nm_partido AS party_name,
            SUM(v.qt_votos)::bigint AS nominal_votes
          FROM votos v
          INNER JOIN candidatos c
            ON c.ano_eleicao = v.ano_eleicao
            AND c.turno = v.turno
            AND c.sq_candidato = v.sq_candidato
          WHERE v.cd_municipio_tse = $1
            AND v.ano_eleicao = $2
            AND v.turno = $3
            AND v.tipo_voto = 'NOMINAL'
            AND c.nr_partido IS NOT NULL
            ${partyOfficeFilter}
          GROUP BY
            v.cd_cargo,
            v.ds_cargo,
            c.nr_partido,
            c.sg_partido,
            c.nm_partido
        ),
        legend_votes AS (
          SELECT
            v.cd_cargo AS office_code,
            v.ds_cargo AS office_name,
            v.nr_votavel::integer AS party_number,
            v.nm_votavel AS party_name,
            SUM(v.qt_votos)::bigint AS legend_votes
          FROM votos v
          WHERE v.cd_municipio_tse = $1
            AND v.ano_eleicao = $2
            AND v.turno = $3
            AND v.tipo_voto = 'LEGENDA'
            ${partyOfficeFilter}
          GROUP BY
            v.cd_cargo,
            v.ds_cargo,
            v.nr_votavel,
            v.nm_votavel
        )
        SELECT
          COALESCE(c.office_code, l.office_code) AS "officeCode",
          COALESCE(c.office_name, l.office_name) AS "officeName",
          COALESCE(c.party_number, l.party_number) AS "partyNumber",
          c.party_abbreviation AS "partyAbbreviation",
          COALESCE(c.party_name, l.party_name) AS "partyName",
          COALESCE(c.nominal_votes, 0)::text AS "nominalVotes",
          COALESCE(l.legend_votes, 0)::text AS "legendVotes"
        FROM candidate_votes c
        FULL OUTER JOIN legend_votes l
          ON l.office_code = c.office_code
          AND l.party_number = c.party_number
        ORDER BY "officeCode", "partyNumber"
      `,
      queryParameters
    );

    const offices = new Map<number, OfficeResult>();

    for (const row of summaryResult.rows) {
      let office = offices.get(row.officeCode);

      if (!office) {
        office = {
          officeCode: row.officeCode,
          officeName: row.officeName,
          totalVotes: 0,
          validVotes: 0,
          nominalVotes: 0,
          legendVotes: 0,
          blankVotes: 0,
          nullVotes: 0,
          candidates: [],
          parties: []
        };

        offices.set(row.officeCode, office);
      }

      const total = toSafeInteger(row.total);

      switch (row.voteType) {
        case "NOMINAL":
          office.nominalVotes += total;
          break;
        case "LEGENDA":
          office.legendVotes += total;
          break;
        case "BRANCO":
          office.blankVotes += total;
          break;
        case "NULO":
          office.nullVotes += total;
          break;
      }
    }

    for (const office of offices.values()) {
      office.validVotes =
        office.nominalVotes + office.legendVotes;

      office.totalVotes =
        office.validVotes +
        office.blankVotes +
        office.nullVotes;
    }

    for (const row of candidateResult.rows) {
      const office = offices.get(row.officeCode);

      if (!office) {
        continue;
      }

      const votes = toSafeInteger(row.votes);
      const candidateId = toSafeInteger(row.candidateId);

      const candidate: CandidateResult = {
        candidateId,
        candidateNumber: row.candidateNumber,
        candidateName: row.candidateName,
        partyNumber: row.partyNumber,
        partyAbbreviation: row.partyAbbreviation,
        partyName: row.partyName,
        votes,
        percentage: calculatePercentage(votes, office.validVotes)
      };

      office.candidates.push(candidate);
    }

    for (const row of partyResult.rows) {
      const office = offices.get(row.officeCode);

      if (!office) {
        continue;
      }

      const nominalVotes = toSafeInteger(row.nominalVotes);
      const legendVotes = toSafeInteger(row.legendVotes);
      const totalVotes = nominalVotes + legendVotes;

      const party: PartyResult = {
        partyNumber: row.partyNumber,
        partyAbbreviation: row.partyAbbreviation,
        partyName: row.partyName,
        nominalVotes,
        legendVotes,
        totalVotes,
        percentage: calculatePercentage(
          totalVotes,
          office.validVotes
        )
      };

      office.parties.push(party);
    }


    const firstRow = summaryResult.rows[0];

    if (!firstRow) {
        return null;
    }

    return {
         municipalityCode: criteria.municipalityCode,
         municipalityName: firstRow.municipalityName,
          year: criteria.year,
         round: criteria.round,
         offices: Array.from(offices.values())
    };


  }
}
