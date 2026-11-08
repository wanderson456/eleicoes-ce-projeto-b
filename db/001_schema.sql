CREATE TABLE IF NOT EXISTS candidatos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ano_eleicao SMALLINT NOT NULL,
    turno SMALLINT NOT NULL,
    sq_candidato BIGINT NOT NULL,
    nr_candidato VARCHAR(10),
    nm_candidato VARCHAR(200) NOT NULL,
    nm_urna_candidato VARCHAR(200),
    cd_cargo SMALLINT NOT NULL,
    ds_cargo VARCHAR(100) NOT NULL,
    nr_partido SMALLINT,
    sg_partido VARCHAR(20),
    nm_partido VARCHAR(150),
    cd_situacao_candidatura SMALLINT,
    ds_situacao_candidatura VARCHAR(100),
    CONSTRAINT uq_candidato_eleicao
        UNIQUE (ano_eleicao, turno, sq_candidato)
);

CREATE TABLE IF NOT EXISTS locais_votacao (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ano SMALLINT NOT NULL,
    sigla_uf CHAR(2) NOT NULL,
    id_municipio_ibge VARCHAR(7) NOT NULL,
    zona INTEGER NOT NULL,
    secao INTEGER NOT NULL,
    latitude NUMERIC(12, 9),
    longitude NUMERIC(12, 9),
    CONSTRAINT uq_local_votacao
        UNIQUE (ano, id_municipio_ibge, zona, secao)
);

CREATE TABLE IF NOT EXISTS votos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ano_eleicao SMALLINT NOT NULL,
    turno SMALLINT NOT NULL,
    cd_municipio_tse VARCHAR(5) NOT NULL,
    nm_municipio VARCHAR(120) NOT NULL,
    zona INTEGER NOT NULL,
    secao INTEGER NOT NULL,
    cd_cargo SMALLINT NOT NULL,
    ds_cargo VARCHAR(100) NOT NULL,
    nr_votavel VARCHAR(10) NOT NULL,
    nm_votavel VARCHAR(200),
    qt_votos INTEGER NOT NULL CHECK (qt_votos >= 0),
    sq_candidato BIGINT NOT NULL,
    nr_local_votacao INTEGER,
    nm_local_votacao VARCHAR(200),
    ds_local_votacao_endereco VARCHAR(250),
    CONSTRAINT uq_voto_secao
        UNIQUE (
            ano_eleicao,
            turno,
            cd_municipio_tse,
            zona,
            secao,
            cd_cargo,
            nr_votavel,
            sq_candidato
        )
);

CREATE TABLE IF NOT EXISTS stg_candidatos (
    ano_eleicao SMALLINT,
    turno SMALLINT,
    sq_candidato BIGINT,
    nr_candidato VARCHAR(10),
    nm_candidato VARCHAR(200),
    nm_urna_candidato VARCHAR(200),
    cd_cargo SMALLINT,
    ds_cargo VARCHAR(100),
    nr_partido SMALLINT,
    sg_partido VARCHAR(20),
    nm_partido VARCHAR(150),
    cd_situacao_candidatura SMALLINT,
    ds_situacao_candidatura VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS stg_locais_votacao (
    ano SMALLINT,
    sigla_uf CHAR(2),
    id_municipio_ibge VARCHAR(7),
    zona INTEGER,
    secao INTEGER,
    latitude NUMERIC(12, 9),
    longitude NUMERIC(12, 9)
);

CREATE TABLE IF NOT EXISTS stg_votos (
    ano_eleicao SMALLINT,
    turno SMALLINT,
    cd_municipio_tse VARCHAR(5),
    nm_municipio VARCHAR(120),
    zona INTEGER,
    secao INTEGER,
    cd_cargo SMALLINT,
    ds_cargo VARCHAR(100),
    nr_votavel VARCHAR(10),
    nm_votavel VARCHAR(200),
    qt_votos INTEGER,
    sq_candidato BIGINT,
    nr_local_votacao INTEGER,
    nm_local_votacao VARCHAR(200),
    ds_local_votacao_endereco VARCHAR(250)
);

CREATE INDEX IF NOT EXISTS idx_votos_secao
    ON votos (cd_municipio_tse, zona, secao);

CREATE INDEX IF NOT EXISTS idx_votos_candidato
    ON votos (sq_candidato);

CREATE INDEX IF NOT EXISTS idx_votos_cargo
    ON votos (cd_cargo);

CREATE INDEX IF NOT EXISTS idx_candidatos_nome
    ON candidatos (nm_urna_candidato);

CREATE INDEX IF NOT EXISTS idx_locais_municipio
    ON locais_votacao (id_municipio_ibge, zona, secao);
