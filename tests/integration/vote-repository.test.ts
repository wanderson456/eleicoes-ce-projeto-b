import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresVoteRepository } from "../../src/repositories/postgres-vote-repository.js";
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

const repository = new PostgresVoteRepository(pool);
const app = createApp(pool);

beforeAll(async () => {
  await pool.query(
    `DELETE FROM votos
     WHERE cd_municipio_tse = '99999'
       AND zona = 99
       AND secao = 99`
  );

  await pool.query(`
    INSERT INTO votos (
      ano_eleicao, turno, cd_municipio_tse, nm_municipio,
      zona, secao, cd_cargo, ds_cargo, nr_votavel,
      nm_votavel, qt_votos, sq_candidato, tipo_voto,
      nr_local_votacao, nm_local_votacao,
      ds_local_votacao_endereco
    )
    VALUES
      (2022, 1, '99999', 'MUNICIPIO DE TESTE',
       99, 99, 1, 'Presidente', '12345',
       'CANDIDATO TESTE', 10, 900000000001, 'NOMINAL',
       NULL, NULL, NULL),

      (2022, 1, '99999', 'MUNICIPIO DE TESTE',
       99, 99, 1, 'Presidente', '12',
       'PARTIDO TESTE', 5, -3, 'LEGENDA',
       NULL, NULL, NULL),

      (2022, 1, '99999', 'MUNICIPIO DE TESTE',
       99, 99, 1, 'Presidente', '95',
       'VOTO BRANCO', 2, -1, 'BRANCO',
       NULL, NULL, NULL),

      (2022, 1, '99999', 'MUNICIPIO DE TESTE',
       99, 99, 1, 'Presidente', '96',
       'VOTO NULO', 3, -1, 'NULO',
       NULL, NULL, NULL)
  `);
});

afterAll(async () => {
  await pool.query(
    `DELETE FROM votos
     WHERE cd_municipio_tse = '99999'
       AND zona = 99
       AND secao = 99`
  );

  await pool.end();
});

describe("Integração: consulta de votos por seção", () => {
  const section = {
    municipalityCode: "99999",
    zone: 99,
    section: 99,
    year: 2022,
    round: 1
  };

  it("consulta os quatro tipos de voto existentes na seção", async () => {
    const result = await repository.findBySection({
      ...section,
      page: 1,
      limit: 1000
    });

    const voteTypes = new Set(
      result.items.map((item) => item.voteType)
    );

    expect(result.total).toBeGreaterThan(0);
    expect(voteTypes).toEqual(
      new Set(["BRANCO", "LEGENDA", "NOMINAL", "NULO"])
    );
  });

  it("filtra os votos nulos sem retornar outras classificações", async () => {
    const result = await repository.findBySection({
      ...section,
      voteType: "NULO",
      page: 1,
      limit: 100
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
    expect(
      result.items.every((item) => item.voteType === "NULO")
    ).toBe(true);
  });
  it("consulta votos pela API HTTP", async () => {
    const response = await request(app)
      .get("/municipios/99999/secoes/99/99/votos?ano=2022&turno=1")
      .expect(200);

    expect(response.body.total).toBeGreaterThan(0);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(20);
  });

  it("filtra votos nulos pela API HTTP", async () => {
    const response = await request(app)
      .get("/municipios/99999/secoes/99/99/votos?ano=2022&turno=1&tipo=NULO")
      .expect(200);

    expect(response.body.total).toBeGreaterThan(0);
    expect(
      response.body.items.every(
        (item: { voteType: string }) => item.voteType === "NULO"
      )
    ).toBe(true);
  });

  it("retorna 400 para código de município inválido", async () => {
    const response = await request(app)
      .get("/municipios/abc/secoes/99/99/votos?ano=2022&turno=1")
      .expect(400);

    expect(response.body.error).toBe("Parâmetros inválidos");
  });
});
