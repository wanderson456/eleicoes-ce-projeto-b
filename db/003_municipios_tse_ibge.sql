CREATE TABLE IF NOT EXISTS municipios_tse_ibge (
    cd_municipio_tse VARCHAR(5) PRIMARY KEY,
    nm_municipio_tse TEXT NOT NULL,
    cd_municipio_ibge VARCHAR(7) NOT NULL UNIQUE,
    nm_municipio_ibge TEXT NOT NULL
);
