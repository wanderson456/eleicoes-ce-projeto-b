
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

const candidateIds = [
    "900000000004",
    "900000000005",
    "900000000006"
];

beforeAll(async () => {
    await pool.query(
        `DELETE FROM votos WHERE sq_candidato = ANY($1::bigint[])`,
        [candidateIds]
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
            (2022, 1, 900000000004, '12347',
             'INTEGRACAO CANDIDATOS C', 'CANDIDATO C', 7,
             'Deputado Estadual', 20, 'XYZ', 'PARTIDO XYZ'),

            (2022, 1, 900000000005, '12348',
             'INTEGRACAO CANDIDATOS D', 'CANDIDATO D', 7,
             'Deputado Estadual', 20, 'XYZ', 'PARTIDO XYZ'),

            (2022, 1, 900000000006, '12349',
             'INTEGRACAO CANDIDATOS SEM VOTOS',
             'CANDIDATO SEM VOTOS', 7,
             'Deputado Estadual', 20, 'XYZ', 'PARTIDO XYZ')
    `);

    await pool.query(`
        INSERT INTO votos (
            ano_eleicao, turno, cd_municipio_tse, nm_municipio,
            zona, secao, cd_cargo, ds_cargo, nr_votavel,
            nm_votavel, qt_votos, sq_candidato, tipo_voto
        )
        VALUES
            (2022, 1, '99997', 'MUNICIPIO DE TESTE',
             97, 97, 7, 'Deputado Estadual', '12347',
             'CANDIDATO C', 75, 900000000004, 'NOMINAL'),

            (2022, 1, '99996', 'OUTRO MUNICIPIO',
             96, 96, 7, 'Deputado Estadual', '12347',
             'CANDIDATO C', 25, 900000000004, 'NOMINAL'),

            (2022, 1, '99997', 'MUNICIPIO DE TESTE',
             97, 97, 7, 'Deputado Estadual', '12348',
             'CANDIDATO D', 40, 900000000005, 'NOMINAL')
    `);
});

afterAll(async () => {
    try {
        await pool.query(
            `DELETE FROM votos WHERE sq_candidato = ANY($1::bigint[])`,
            [candidateIds]
        );

        await pool.query(
            `DELETE FROM candidatos WHERE sq_candidato = ANY($1::bigint[])`,
            [candidateIds]
        );
    } finally {
        await pool.end();
    }
});

describe("Integração: consulta de candidatos", () => {
    it("consulta candidatos pela API HTTP", async () => {
        const response = await request(app)
            .get("/candidatos?ano=2022&turno=1&cargo=7&busca=INTEGRACAO CANDIDATOS C")
            .expect(200);

        expect(response.body.items).toHaveLength(1);
        expect(response.body.total).toBeGreaterThanOrEqual(1);
        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(20);
    });

    it("retorna os candidatos ordenados pela quantidade de votos", async () => {
        const response = await request(app)
            .get("/candidatos?ano=2022&turno=1&cargo=7&busca=INTEGRACAO CANDIDATOS")
            .expect(200);

        expect(response.body.items[0].candidateNumber).toBe("12347");
        expect(response.body.items[0].totalVotes).toBe(100);

        expect(response.body.items[1].candidateNumber).toBe("12348");
        expect(response.body.items[1].totalVotes).toBe(40);
    });

    it("soma votos nominais de diferentes municípios", async () => {
        const response = await request(app)
            .get("/candidatos?ano=2022&turno=1&numero=12347")
            .expect(200);

        const candidate = response.body.items[0];

        expect(candidate.totalVotes).toBe(100);
    });

    it("retorna candidato cadastrado sem votos com total igual a zero", async () => {
        const response = await request(app)
            .get("/candidatos?ano=2022&turno=1&numero=12349")
            .expect(200);

        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].candidateNumber).toBe("12349");
        expect(response.body.items[0].totalVotes).toBe(0);
    });

    it("aplica paginação aos resultados", async () => {
        const response = await request(app)
            .get("/candidatos?ano=2022&turno=1&cargo=7&busca=INTEGRACAO CANDIDATOS&pagina=2&limite=1")
            .expect(200);

        expect(response.body.items).toHaveLength(1);
        expect(response.body.page).toBe(2);
        expect(response.body.limit).toBe(1);
        expect(response.body.total).toBeGreaterThanOrEqual(2);
    });

    it("retorna HTTP 400 para parâmetros inválidos", async () => {
        const response = await request(app)
            .get("/candidatos?ano=2022&turno=3")
            .expect(400);

        expect(response.body.error).toBe("Parâmetros inválidos");
    });
});
