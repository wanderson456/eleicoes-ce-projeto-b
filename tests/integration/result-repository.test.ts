
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { createApp } from "../../src/app.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("A variável DATABASE_URL não foi configurada.");
}

const connection = new URL(databaseUrl);
connection.hostname = "localhost";
connection.port = process.env.TEST_DATABASE_PORT ?? "5433";

const pool = new Pool({
  connectionString: connection.toString()
});

const app = createApp(pool);

const municipalityCode = "99998";
const candidateIds = ["900000000002", "900000000003"];

beforeAll(async () => {
  await pool.query(
    `DELETE FROM votos WHERE cd_municipio_tse = $1`,
    [municipalityCode]
  );

  await pool.query(
    `DELETE FROM candidatos WHERE sq_candidato = ANY($1::bigint[])`,
    [candidateIds]
  );

  await pool.query(`
    INSERT INTO candidatos (
      ano_eleicao, turno, sq_candidato, nr_candidato,
      nm_candidato, nm_urna_candidato, cd_cargo,
      ds_cargo, nr_partido, sg_partido, nm_partido
    )
    VALUES
      (2022, 1, 900000000002, '12345',
       'CANDIDATO TESTE A', 'CANDIDATO A', 7,
       'Deputado Estadual', 10, 'ABC', 'PARTIDO ABC'),

      (2022, 1, 900000000003, '12346',
       'CANDIDATO TESTE B', 'CANDIDATO B', 7,
       'Deputado Estadual', 10, 'ABC', 'PARTIDO ABC')
  `);

  await pool.query(`
    INSERT INTO votos (
      ano_eleicao, turno, cd_municipio_tse, nm_municipio,
      zona, secao, cd_cargo, ds_cargo, nr_votavel,
      nm_votavel, qt_votos, sq_candidato, tipo_voto
    )
    VALUES
      (2022, 1, '99998', 'MUNICIPIO DE TESTE',
       98, 98, 7, 'Deputado Estadual', '12345',
       'CANDIDATO A', 60, 900000000002, 'NOMINAL'),

      (2022, 1, '99998', 'MUNICIPIO DE TESTE',
       98, 98, 7, 'Deputado Estadual', '12346',
       'CANDIDATO B', 30, 900000000003, 'NOMINAL'),

      (2022, 1, '99998', 'MUNICIPIO DE TESTE',
       98, 98, 7, 'Deputado Estadual', '10',
       'PARTIDO ABC', 10, -3, 'LEGENDA'),

      (2022, 1, '99998', 'MUNICIPIO DE TESTE',
       98, 98, 7, 'Deputado Estadual', '95',
       'VOTO BRANCO', 5, -1, 'BRANCO'),

      (2022, 1, '99998', 'MUNICIPIO DE TESTE',
       98, 98, 7, 'Deputado Estadual', '96',
       'VOTO NULO', 5, -1, 'NULO')
  `);
});

afterAll(async () => {
  await pool.query(
    `DELETE FROM votos WHERE cd_municipio_tse = $1`,
    [municipalityCode]
  );

  await pool.query(
    `DELETE FROM candidatos WHERE sq_candidato = ANY($1::bigint[])`,
    [candidateIds]
  );

  await pool.end();
});

describe("Integração: resultados eleitorais por município", () => {
  it("consulta os resultados pela API HTTP", async () => {
    const response = await request(app)
      .get("/municipios/99998/resultados?ano=2022&turno=1")
      .expect(200);

    expect(response.body.municipalityCode).toBe("99998");
    expect(response.body.municipalityName).toBe("MUNICIPIO DE TESTE");
    expect(response.body.year).toBe(2022);
    expect(response.body.round).toBe(1);
    expect(response.body.offices).toHaveLength(1);
  });

  it("calcula corretamente os totais de votos", async () => {
    const response = await request(app)
      .get("/municipios/99998/resultados?ano=2022&turno=1")
      .expect(200);

    const office = response.body.offices[0];

    expect(office.nominalVotes).toBe(90);
    expect(office.legendVotes).toBe(10);
    expect(office.validVotes).toBe(100);
    expect(office.blankVotes).toBe(5);
    expect(office.nullVotes).toBe(5);
    expect(office.totalVotes).toBe(110);
  });

  it("retorna os candidatos com seus respectivos percentuais", async () => {
    const response = await request(app)
      .get("/municipios/99998/resultados?ano=2022&turno=1")
      .expect(200);

    const candidates = response.body.offices[0].candidates;

    expect(candidates).toHaveLength(2);
    expect(candidates[0].votes).toBe(60);
    expect(candidates[0].percentage).toBe(60);
    expect(candidates[1].votes).toBe(30);
    expect(candidates[1].percentage).toBe(30);
  });

  it("soma votos nominais e de legenda no resultado partidário", async () => {
    const response = await request(app)
      .get("/municipios/99998/resultados?ano=2022&turno=1")
      .expect(200);

    const parties = response.body.offices[0].parties;

    expect(parties).toHaveLength(1);
    expect(parties[0].partyNumber).toBe(10);
    expect(parties[0].nominalVotes).toBe(90);
    expect(parties[0].legendVotes).toBe(10);
    expect(parties[0].totalVotes).toBe(100);
    expect(parties[0].percentage).toBe(100);
  });

  it("filtra os resultados pelo código do cargo", async () => {
    const response = await request(app)
      .get("/municipios/99998/resultados?ano=2022&turno=1&cargo=7")
      .expect(200);

    expect(response.body.offices).toHaveLength(1);
    expect(response.body.offices[0].officeCode).toBe(7);
  });

  it("retorna HTTP 400 quando o ano não é informado", async () => {
    const response = await request(app)
      .get("/municipios/99998/resultados?turno=1")
      .expect(400);

    expect(response.body.error).toBe("Parâmetros inválidos");
  });

  it("retorna HTTP 404 quando não existem resultados", async () => {
    const response = await request(app)
      .get("/municipios/88888/resultados?ano=2022&turno=1")
      .expect(404);

    expect(response.body.error).toBe("Resultados não encontrados");
  });
});
