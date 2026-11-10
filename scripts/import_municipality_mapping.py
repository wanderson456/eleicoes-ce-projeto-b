import csv
from pathlib import Path

import psycopg
from dotenv import load_dotenv

if __package__:
    from .database import database_url as shared_database_url
else:
    from database import database_url as shared_database_url


ROOT = Path(__file__).resolve().parent.parent
CSV_FILE = (
    ROOT
    / "dados"
    / "correspondencia-tse-ibge"
    / "ceara.csv"
)

EXPECTED_MUNICIPALITIES = 184

COLUMNS = [
    "CD_MUNICIPIO_TSE",
    "NM_MUNICIPIO_TSE",
    "CD_MUNICIPIO_IBGE",
    "NM_MUNICIPIO_IBGE",
]


def database_url() -> str:
    return shared_database_url(
        ROOT / ".env",
        load_env=load_dotenv,
    )


def load_municipalities() -> list[tuple[str, str, str, str]]:
    if not CSV_FILE.is_file():
        raise FileNotFoundError(
            f"Arquivo não encontrado: {CSV_FILE}"
        )

    with CSV_FILE.open(
        encoding="utf-8-sig",
        newline="",
    ) as file:
        reader = csv.DictReader(file, delimiter=";")

        if reader.fieldnames is None:
            raise ValueError("O CSV não possui cabeçalho.")

        missing = set(COLUMNS) - set(reader.fieldnames)

        if missing:
            raise ValueError(
                f"Colunas ausentes no CSV: "
                f"{', '.join(sorted(missing))}"
            )

        municipalities = []

        for line_number, row in enumerate(reader, start=2):
            values = tuple(
                (row[column] or "").strip()
                for column in COLUMNS
            )

            if not all(values):
                raise ValueError(
                    f"Campo vazio na linha {line_number} do CSV."
                )

            tse_code, _, ibge_code, _ = values

            if len(tse_code) != 5 or not tse_code.isdigit():
                raise ValueError(
                    f"Código TSE inválido na linha {line_number}."
                )

            if len(ibge_code) != 7 or not ibge_code.isdigit():
                raise ValueError(
                    f"Código IBGE inválido na linha {line_number}."
                )

            municipalities.append(values)

    if len(municipalities) != EXPECTED_MUNICIPALITIES:
        raise ValueError(
            f"Esperados {EXPECTED_MUNICIPALITIES} municípios; "
            f"encontrados {len(municipalities)}."
        )

    tse_codes = [row[0] for row in municipalities]
    ibge_codes = [row[2] for row in municipalities]

    if len(set(tse_codes)) != len(tse_codes):
        raise ValueError(
            "Existem códigos TSE duplicados no CSV."
        )

    if len(set(ibge_codes)) != len(ibge_codes):
        raise ValueError(
            "Existem códigos IBGE duplicados no CSV."
        )

    return municipalities


def import_municipalities() -> int:
    municipalities = load_municipalities()

    with psycopg.connect(database_url()) as connection:
        with connection.transaction():
            with connection.cursor() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO municipios_tse_ibge (
                        cd_municipio_tse,
                        nm_municipio_tse,
                        cd_municipio_ibge,
                        nm_municipio_ibge
                    )
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (cd_municipio_tse)
                    DO UPDATE SET
                        nm_municipio_tse = EXCLUDED.nm_municipio_tse,
                        cd_municipio_ibge = EXCLUDED.cd_municipio_ibge,
                        nm_municipio_ibge = EXCLUDED.nm_municipio_ibge
                    """,
                    municipalities,
                )

    return len(municipalities)


def main() -> None:
    total = import_municipalities()
    print(f"Importação concluída: {total} municípios.")


if __name__ == "__main__":
    main()
