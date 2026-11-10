
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

const municipalityMappings = [
    {
        tse: "99997",
        ibge: "9999991",
        name: "MUNICIPIO TESTE A"
    },
    {
        tse: "99996",
        ibge: "9999992",
        name: "MUNICIPIO TESTE B"
    }
];

const ibgeMunicipalityCodes = municipalityMappings.map(
    (municipality) => municipality.ibge
);

beforeAll(async () => {

    // Remove dados geográficos de execuções anteriores.
    await pool.query(
        `DELETE FROM locais_votacao
         WHERE ano = 2022
         AND id_municipio_ibge = ANY($1::varchar[])`,
        [ibgeMunicipalityCodes]
    );

    await pool.query(
        `DELETE FROM municipios_tse_ibge
         WHERE cd_municipio_tse = ANY($1::varchar[])`,
        [municipalityMappings.map((municipality) => municipality.tse)]
    );

    // Cadastra correspondências TSE/IBGE temporárias.
    await pool.query(`
        INSERT INTO municipios_tse_ibge (
            cd_municipio_tse,
            nm_municipio_tse,
            cd_municipio_ibge,
            nm_municipio_ibge
        )
        VALUES
            ('99997', 'MUNICIPIO DE TESTE', '9999991', 'MUNICIPIO TESTE A'),
            ('99996', 'OUTRO MUNICIPIO', '9999992', 'MUNICIPIO TESTE B')
    `);

    // Cadastra locais de votação com coordenadas sintéticas.
    await pool.query(`
        INSERT INTO locais_votacao (
            ano, sigla_uf, id_municipio_ibge,
            zona, secao, latitude, longitude
        )
        VALUES
            (2022, 'CE', '9999991', 97, 97, -7.000000000, -40.000000000),
            (2022, 'CE', '9999991', 97, 98, -7.200000000, -40.200000000),
            (2022, 'CE', '9999992', 96, 96, -7.300000000, -40.300000000)
    `);
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
        // Remove os locais de votação temporários.
        await pool.query(
            `DELETE FROM locais_votacao
             WHERE ano = 2022
             AND id_municipio_ibge = ANY($1::varchar[])`,
            [ibgeMunicipalityCodes]
        );

        // Remove as correspondências TSE/IBGE temporárias.
        await pool.query(
            `DELETE FROM municipios_tse_ibge
             WHERE cd_municipio_tse = ANY($1::varchar[])`,
            [municipalityMappings.map((municipality) => municipality.tse)]
        );
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

    it("consulta a distribuição geográfica dos votos por município", async () => {
        const response = await request(app)
            .get("/candidatos/900000000004/mapa-geografico?ano=2022&turno=1")
            .expect(200);

        expect(response.body.sqCandidato).toBe(900000000004);
        expect(response.body.year).toBe(2022);
        expect(response.body.round).toBe(1);

        expect(response.body.municipalities).toHaveLength(2);

        expect(response.body.municipalities[0]).toMatchObject({
            ibgeCode: "9999991",
            municipality: "MUNICIPIO TESTE A",
            votes: 75,
            latitude: -7.1,
            longitude: -40.1
        });

        expect(response.body.municipalities[1]).toMatchObject({
            ibgeCode: "9999992",
            municipality: "MUNICIPIO TESTE B",
            votes: 25,
            latitude: -7.3,
            longitude: -40.3
        });

        expect(response.body.pagination).toMatchObject({
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1
        });

    });

    it("retorna lista vazia para candidato existente sem votos", async () => {
        const response = await request(app)
            .get("/candidatos/900000000006/mapa-geografico?ano=2022&turno=1")
            .expect(200);

        expect(response.body.sqCandidato).toBe(900000000006);
        expect(response.body.municipalities).toEqual([]);
        expect(response.body.pagination).toMatchObject({
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
        });
    });

    it("retorna HTTP 404 para candidato inexistente", async () => {
        const response = await request(app)
            .get("/candidatos/900000000099/mapa-geografico?ano=2022&turno=1")
            .expect(404);

        expect(response.body.error).toBe("Candidato não encontrado");
    });




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
