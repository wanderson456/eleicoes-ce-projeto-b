import argparse
import csv
import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent.parent

FILES = {
    "candidatos": {
        "filename": "consulta_cand_2022_CE.csv",
        "encoding": "cp1252",
        "delimiter": ";",
        "columns": [
            "ANO_ELEICAO", "NR_TURNO", "SQ_CANDIDATO",
            "NR_CANDIDATO", "NM_CANDIDATO", "NM_URNA_CANDIDATO",
            "CD_CARGO", "DS_CARGO", "NR_PARTIDO", "SG_PARTIDO",
            "NM_PARTIDO", "CD_SITUACAO_CANDIDATURA",
            "DS_SITUACAO_CANDIDATURA"
        ],
        "table": "stg_candidatos",
        "fields": [
            "ano_eleicao", "turno", "sq_candidato", "nr_candidato",
            "nm_candidato", "nm_urna_candidato", "cd_cargo",
            "ds_cargo", "nr_partido", "sg_partido", "nm_partido",
            "cd_situacao_candidatura", "ds_situacao_candidatura"
        ],
        "integers": {
            "ANO_ELEICAO", "NR_TURNO", "SQ_CANDIDATO",
            "CD_CARGO", "NR_PARTIDO", "CD_SITUACAO_CANDIDATURA"
        }
    },
    "locais": {
        "filename": "locais_votacao_ce_2022.csv",
        "encoding": "utf-8",
        "delimiter": ",",
        "columns": [
            "ano", "sigla_uf", "id_municipio",
            "zona", "secao", "latitude", "longitude"
        ],
        "table": "stg_locais_votacao",
        "fields": [
            "ano", "sigla_uf", "id_municipio_ibge",
            "zona", "secao", "latitude", "longitude"
        ],
        "integers": {"ano", "zona", "secao"},
        "decimals": {"latitude", "longitude"}
    },
    "votos": {
        "filename": "votos_ce_2022.csv",
        "encoding": "cp1252",
        "delimiter": ";",
        "columns": [
            "ANO_ELEICAO", "NR_TURNO", "CD_MUNICIPIO",
            "NM_MUNICIPIO", "NR_ZONA", "NR_SECAO",
            "CD_CARGO", "DS_CARGO", "NR_VOTAVEL", "NM_VOTAVEL",
            "QT_VOTOS", "SQ_CANDIDATO", "NR_LOCAL_VOTACAO",
            "NM_LOCAL_VOTACAO", "DS_LOCAL_VOTACAO_ENDERECO"
        ],
        "table": "stg_votos",
        "fields": [
            "ano_eleicao", "turno", "cd_municipio_tse",
            "nm_municipio", "zona", "secao", "cd_cargo",
            "ds_cargo", "nr_votavel", "nm_votavel", "qt_votos",
            "sq_candidato", "nr_local_votacao",
            "nm_local_votacao", "ds_local_votacao_endereco"
        ],
        "integers": {
            "ANO_ELEICAO", "NR_TURNO", "NR_ZONA", "NR_SECAO",
            "CD_CARGO", "QT_VOTOS", "SQ_CANDIDATO",
            "NR_LOCAL_VOTACAO"
        }
    }
}


INSERTS = {
    "candidatos": """
        INSERT INTO candidatos (
            ano_eleicao, turno, sq_candidato, nr_candidato,
            nm_candidato, nm_urna_candidato, cd_cargo, ds_cargo,
            nr_partido, sg_partido, nm_partido,
            cd_situacao_candidatura, ds_situacao_candidatura
        )
        SELECT
            ano_eleicao, turno, sq_candidato, nr_candidato,
            nm_candidato, nm_urna_candidato, cd_cargo, ds_cargo,
            nr_partido, sg_partido, nm_partido,
            cd_situacao_candidatura, ds_situacao_candidatura
        FROM stg_candidatos
        ON CONFLICT (ano_eleicao, turno, sq_candidato) DO NOTHING
    """,
    "locais": """
        INSERT INTO locais_votacao (
            ano, sigla_uf, id_municipio_ibge, zona,
            secao, latitude, longitude
        )
        SELECT
            ano, sigla_uf, id_municipio_ibge, zona,
            secao, latitude, longitude
        FROM stg_locais_votacao
        ON CONFLICT (ano, id_municipio_ibge, zona, secao) DO NOTHING
    """,
        "votos": """
        INSERT INTO votos (
            ano_eleicao, turno, cd_municipio_tse, nm_municipio,
            zona, secao, cd_cargo, ds_cargo, nr_votavel,
            nm_votavel, qt_votos, sq_candidato, tipo_voto,
            nr_local_votacao, nm_local_votacao,
            ds_local_votacao_endereco
        )
        SELECT
            ano_eleicao, turno, cd_municipio_tse, nm_municipio,
            zona, secao, cd_cargo, ds_cargo, nr_votavel,
            nm_votavel, qt_votos, sq_candidato,
            CASE
                WHEN sq_candidato = -3 THEN 'LEGENDA'
                WHEN nr_votavel = '95' THEN 'BRANCO'
                WHEN nr_votavel = '96' THEN 'NULO'
                WHEN sq_candidato > 0 THEN 'NOMINAL'
                ELSE NULL
            END,
            nr_local_votacao, nm_local_votacao,
            ds_local_votacao_endereco
        FROM stg_votos
        ON CONFLICT (
            ano_eleicao, turno, cd_municipio_tse, zona, secao,
            cd_cargo, nr_votavel, sq_candidato
        ) DO NOTHING
    """
}


def database_url() -> str:
    load_dotenv(ROOT / ".env")
    url = os.getenv("DATABASE_URL")

    if not url:
        raise RuntimeError("DATABASE_URL não foi configurada.")

    parsed = urlsplit(url)

    # O importador roda no Windows, fora da rede interna do Compose.
    return urlunsplit((
        parsed.scheme,
        f"{parsed.username}:{parsed.password}@localhost:5433",
        parsed.path,
        parsed.query,
        parsed.fragment
    ))


def convert_value(value, field, config):
    if value is None or value.strip() == "":
        return None

    if field in config.get("integers", set()):
        return int(value)

    if field in config.get("decimals", set()):
        return value

    return value


def import_file(connection, directory: Path, name: str) -> int:
    config = FILES[name]
    path = directory / config["filename"]

    if not path.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    count = 0
    table = config["table"]
    fields = config["fields"]
    columns = ", ".join(fields)

    with path.open(
        "r",
        encoding=config["encoding"],
        newline=""
    ) as source:
        reader = csv.DictReader(
            source,
            delimiter=config["delimiter"]
        )

        if reader.fieldnames is None:
            raise ValueError(f"CSV sem cabeçalho: {path}")

        missing = set(config["columns"]) - set(reader.fieldnames)
        if missing:
            raise ValueError(
                f"Colunas ausentes em {path.name}: {sorted(missing)}"
            )

        with connection.cursor() as cursor:
            cursor.execute(f"TRUNCATE TABLE {table}")

            with cursor.copy(
                f"COPY {table} ({columns}) FROM STDIN"
            ) as copy:
                for row in reader:
                    values = [
                        convert_value(
                            row[column],
                            column,
                            config
                        )
                        for column in config["columns"]
                    ]
                    copy.write_row(values)
                    count += 1

    return count


def main():
    parser = argparse.ArgumentParser(
        description="Importação dos dados eleitorais do Ceará."
    )
    parser.add_argument(
        "--mode",
        choices=["sample", "full"],
        default="sample"
    )
    args = parser.parse_args()

    directory = ROOT / "data" / (
        "ci" if args.mode == "sample" else "raw"
    )

    with psycopg.connect(database_url()) as connection:
        with connection.transaction():
            for name in ("candidatos", "locais", "votos"):
                count = import_file(connection, directory, name)
                print(f"{name}: {count} registros enviados para staging")

            for name in ("candidatos", "locais", "votos"):
                connection.execute(INSERTS[name])
                table = {
                    "candidatos": "candidatos",
                    "locais": "locais_votacao",
                    "votos": "votos"
                }[name]
                result = connection.execute(
                    f"SELECT COUNT(*) FROM {table}"
                ).fetchone()
                print(f"{table}: {result[0]} registros no banco")


if __name__ == "__main__":
    main()
