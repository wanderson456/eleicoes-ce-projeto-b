import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresVoteRepository } from "../../src/repositories/postgres-vote-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("A variável DATABASE_URL não foi configurada.");
}

const connection = new URL(databaseUrl);
connection.hostname = "localhost";
connection.port = "5433";

const pool = new Pool({
  connectionString: connection.toString()
});

const repository = new PostgresVoteRepository(pool);

afterAll(async () => {
  await pool.end();
});

describe("Integração: consulta de votos por seção", () => {
  const section = {
    municipalityCode: "13005",
    zone: 30,
    section: 82
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
});
