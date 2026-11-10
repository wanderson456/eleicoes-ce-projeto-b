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
  municipalityCode: "9999999",
  zone: 999,
  section: 999
};

beforeAll(async () => {
  await pool.query(
    `DELETE FROM locais_votacao
     WHERE ano = $1
       AND id_municipio_ibge = $2
       AND zona = $3
       AND secao = $4`,
    [
      fixture.year,
      fixture.municipalityCode,
      fixture.zone,
      fixture.section
    ]
  );

  await pool.query(
    `INSERT INTO locais_votacao (
      ano, sigla_uf, id_municipio_ibge,
      zona, secao, latitude, longitude
    )
    VALUES ($1, 'CE', $2, $3, $4, -3.745, -38.520)`,
    [
      fixture.year,
      fixture.municipalityCode,
      fixture.zone,
      fixture.section
    ]
  );

  const fixtureCheck = await pool.query(
    `SELECT id_municipio_ibge, zona, secao
   FROM locais_votacao
   WHERE id_municipio_ibge = $1
     AND zona = $2
     AND secao = $3`,
    [fixture.municipalityCode, fixture.zone, fixture.section]
  );

  console.log("Registro de teste inserido:", fixtureCheck.rows);
});

afterAll(async () => {
  try {
    await pool.query(
      `DELETE FROM locais_votacao
       WHERE ano = $1
         AND id_municipio_ibge = $2
         AND zona = $3
         AND secao = $4`,
      [
        fixture.year,
        fixture.municipalityCode,
        fixture.zone,
        fixture.section
      ]
    );
  } finally {
    await pool.end();
  }
});

describe("Integração: consulta de seções por município", () => {
  it("consulta as seções do município no PostgreSQL", async () => {
    const result = await repository.findByMunicipality({
      municipalityCode: fixture.municipalityCode,
      year: fixture.year,
      page: 1,
      limit: 100
    });



    const section = result.items.find(
      (item) =>
        item.zone === fixture.zone &&
        item.section === fixture.section
    );

    expect(section).toBeDefined();
    expect(section?.latitude).toBe(-3.745);
    expect(section?.longitude).toBe(-38.52);
    expect(result.total).toBeGreaterThan(0);
  });

  it("aplica a paginação na consulta", async () => {
    const result = await repository.findByMunicipality({
      municipalityCode: fixture.municipalityCode,
      year: fixture.year,
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
      municipalityCode: "9999998",
      year: fixture.year,
      page: 1,
      limit: 20
    });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it("consulta as seções pela API HTTP", async () => {
    const response = await request(app)
      .get("/municipios/9999999/secoes?ano=2022&pagina=1&limite=100")
      .expect(200);

    const section = response.body.items.find(
      (item: { zone: number; section: number }) =>
        item.zone === fixture.zone &&
        item.section === fixture.section
    );

    expect(section).toBeDefined();
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
