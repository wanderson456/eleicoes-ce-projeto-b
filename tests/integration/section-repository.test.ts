
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { PostgresSectionRepository } from "../../src/repositories/postgres-section-repository.js";
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

const repository = new PostgresSectionRepository(pool);
const app = createApp(pool);

const fixture = {
  year: 2022,
  municipalityCode: "9999998",
  municipalityTseCode: "77777",
  candidateId: "60001633582",
  round: 1,
  zone: 999,
  sectionWithLocal: 999,
  sectionWithoutLocal: 998
};
async function cleanFixture() {
  await pool.query(
    `DELETE FROM votos
     WHERE ano_eleicao = $1
       AND turno = $2
       AND cd_municipio_tse = $3
       AND zona = $4
       AND secao IN ($5, $6)
       AND sq_candidato = $7`,
    [
      fixture.year,
      fixture.round,
      fixture.municipalityTseCode,
      fixture.zone,
      fixture.sectionWithLocal,
      fixture.sectionWithoutLocal,
      fixture.candidateId
    ]
  );

  await pool.query(
    `DELETE FROM locais_votacao
     WHERE ano = $1
       AND id_municipio_ibge = $2
       AND zona = $3
       AND secao IN ($4, $5)`,
    [
      fixture.year,
      fixture.municipalityCode,
      fixture.zone,
      fixture.sectionWithLocal,
      fixture.sectionWithoutLocal
    ]
  );
    await pool.query(
    `DELETE FROM municipios_tse_ibge
     WHERE cd_municipio_tse = $1
       AND cd_municipio_ibge = $2`,
    [
      fixture.municipalityTseCode,
      fixture.municipalityCode
    ]
  );
}

beforeAll(async () => {
  await cleanFixture();
    await pool.query(
    `INSERT INTO municipios_tse_ibge (
      cd_municipio_tse,
      nm_municipio_tse,
      cd_municipio_ibge,
      nm_municipio_ibge
    )
    VALUES ($1, 'MUNICIPIO TESTE', $2, 'MUNICIPIO TESTE')`,
    [
      fixture.municipalityTseCode,
      fixture.municipalityCode
    ]
  );

  await pool.query(
    `INSERT INTO locais_votacao (
      ano,
      sigla_uf,
      id_municipio_ibge,
      zona,
      secao,
      latitude,
      longitude
    )
    VALUES
      ($1, 'CE', $2, $3, $4, -3.745, -38.520),
      ($1, 'CE', $2, $3, $5, -3.746, -38.521)`,
    [
      fixture.year,
      fixture.municipalityCode,
      fixture.zone,
      fixture.sectionWithLocal,
      fixture.sectionWithoutLocal
    ]
  );


  await pool.query(
    `INSERT INTO votos (
      ano_eleicao,
      turno,
      cd_municipio_tse,
      nm_municipio,
      zona,
      secao,
      cd_cargo,
      ds_cargo,
      nr_votavel,
      nm_votavel,
      qt_votos,
      sq_candidato,
      nr_local_votacao,
      nm_local_votacao,
      ds_local_votacao_endereco,
      tipo_voto
    )
    VALUES (
      $1, $2, $3, 'Araripe',
      $4, $5, 7, 'Deputado Estadual',
      '99999', 'CANDIDATO DE TESTE',
      7, $6, 9999,
      'LOCAL DE TESTE INTEGRACAO',
      'RUA DE TESTE, 100',
      'NOMINAL'
    )`,
    [
      fixture.year,
      fixture.round,
      fixture.municipalityTseCode,
      fixture.zone,
      fixture.sectionWithLocal,
      fixture.candidateId
    ]
  );

});

afterAll(async () => {
  try {
    await cleanFixture();
  } finally {
    await pool.end();
  }
});

describe("Integração: consulta de seções por município", () => {
  it("consulta seção com nome e endereço do local de votação", async () => {
    const result = await repository.findByMunicipality({
      municipalityCode: fixture.municipalityCode,
      sqCandidato: fixture.candidateId,
      year: fixture.year,
      round: fixture.round,
      page: 1,
      limit: 100
    });

    const section = result.items.find(
      (item) =>
        item.zone === fixture.zone &&
        item.section === fixture.sectionWithLocal
    );

    expect(section).toBeDefined();
    expect(section?.latitude).toBe(-3.745);
    expect(section?.longitude).toBe(-38.52);
    expect(section?.votes).toBe(7);

    expect(section?.pollingPlaceNumber).toBe(9999);
    expect(section?.pollingPlaceName).toBe(
      "LOCAL DE TESTE INTEGRACAO"
    );
    expect(section?.pollingPlaceAddress).toBe(
      "RUA DE TESTE, 100"
    );

    expect(result.total).toBeGreaterThan(0);
  });

  it("preserva seção sem identificação do local de votação", async () => {
    const result = await repository.findByMunicipality({
      municipalityCode: fixture.municipalityCode,
      sqCandidato: fixture.candidateId,
      year: fixture.year,
      round: fixture.round,
      page: 1,
      limit: 100
    });

    const section = result.items.find(
      (item) =>
        item.zone === fixture.zone &&
        item.section === fixture.sectionWithoutLocal
    );

    expect(section).toBeDefined();
    expect(section?.votes).toBe(0);
    expect(section?.pollingPlaceNumber).toBeNull();
    expect(section?.pollingPlaceName).toBeNull();
    expect(section?.pollingPlaceAddress).toBeNull();
  });

  it("aplica a paginação na consulta", async () => {
    const result = await repository.findByMunicipality({
      municipalityCode: fixture.municipalityCode,
      sqCandidato: fixture.candidateId,
      year: fixture.year,
      round: fixture.round,
      page: 2,
      limit: 10
    });

    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThanOrEqual(10);
  });

  it("retorna lista vazia para município inexistente", async () => {
    const result = await repository.findByMunicipality({
      municipalityCode: "9999997",
      sqCandidato: fixture.candidateId,
      year: fixture.year,
      round: fixture.round,
      page: 1,
      limit: 20
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it("consulta as seções pela API HTTP", async () => {
    const response = await request(app)
      .get(
        `/municipios/${fixture.municipalityCode}/secoes?ano=${fixture.year}&turno=${fixture.round}&sqCandidato=${fixture.candidateId}&pagina=1&limite=100`
      )
      .expect(200);

    const section = response.body.items.find(
      (item: { zone: number; section: number }) =>
        item.zone === fixture.zone &&
        item.section === fixture.sectionWithLocal
    );

    expect(section).toBeDefined();
    expect(section.votes).toBe(7);
    expect(section.pollingPlaceNumber).toBe(9999);
    expect(section.pollingPlaceName).toBe(
      "LOCAL DE TESTE INTEGRACAO"
    );
    expect(section.pollingPlaceAddress).toBe(
      "RUA DE TESTE, 100"
    );

    expect(response.body.total).toBeGreaterThan(0);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(100);
  });

  it("retorna HTTP 400 para código IBGE inválido", async () => {
    const response = await request(app)
      .get("/municipios/23002/secoes")
      .expect(400);

    expect(response.body.error).toBe("Parâmetros inválidos");
  });
});
