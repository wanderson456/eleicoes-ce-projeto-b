
import argparse
import re
from pathlib import Path

import psycopg
from dotenv import load_dotenv

if __package__:
    from .database import database_url as shared_database_url
else:
    from database import database_url as shared_database_url


ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = ROOT / "db"

MIGRATION_PATTERN = re.compile(r"^(\d{3})_[a-z0-9_]+\.sql$")

BASELINE_VERSIONS = ("001", "002")

REQUIRED_TABLES = {
    "candidatos",
    "locais_votacao",
    "votos",
    "stg_candidatos",
    "stg_locais_votacao",
    "stg_votos",
}

REQUIRED_CONSTRAINTS = {
    "candidatos": {
        "candidatos_pkey",
        "uq_candidato_eleicao",
    },
    "locais_votacao": {
        "locais_votacao_pkey",
        "uq_local_votacao",
    },
    "votos": {
        "votos_pkey",
        "uq_voto_secao",
        "votos_qt_votos_check",
        "chk_votos_tipo_voto",
    },
}

REQUIRED_INDEXES = {
    "idx_votos_secao",
    "idx_votos_candidato",
    "idx_votos_cargo",
    "idx_candidatos_nome",
    "idx_locais_municipio",
}


def database_url() -> str:
    return shared_database_url(
        ROOT / ".env",
        load_env=load_dotenv,
    )


def ensure_migrations_table(connection) -> None:
    connection.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(3) PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


def validate_existing_schema(connection) -> None:
    tables = {
        row[0]
        for row in connection.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
        """).fetchall()
    }

    missing_tables = REQUIRED_TABLES - tables

    if missing_tables:
        raise RuntimeError(
            "Baseline não permitido. "
            f"Tabelas ausentes: {sorted(missing_tables)}"
        )

    vote_column = connection.execute("""
        SELECT data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'votos'
          AND column_name = 'tipo_voto'
    """).fetchone()

    if (
        vote_column is None
        or vote_column[0] != "character varying"
        or vote_column[1] != "NO"
    ):
        raise RuntimeError(
            "Baseline não permitido: coluna votos.tipo_voto "
            "ausente ou incompatível."
        )

    for table, expected in REQUIRED_CONSTRAINTS.items():
        constraints = {
            row[0]
            for row in connection.execute(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = %s::regclass
                """,
                (f"public.{table}",),
            ).fetchall()
        }

        missing = expected - constraints

        if missing:
            raise RuntimeError(
                "Baseline não permitido. "
                f"Restrições ausentes em {table}: {sorted(missing)}"
            )

    indexes = {
        row[0]
        for row in connection.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
        """).fetchall()
    }

    missing_indexes = REQUIRED_INDEXES - indexes

    if missing_indexes:
        raise RuntimeError(
            "Baseline não permitido. "
            f"Índices ausentes: {sorted(missing_indexes)}"
        )


def discover_migrations() -> list[tuple[str, str, Path]]:
    migrations = []

    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        match = MIGRATION_PATTERN.match(path.name)

        if match:
            migrations.append((match.group(1), path.name, path))

    versions = [migration[0] for migration in migrations]

    if len(versions) != len(set(versions)):
        raise RuntimeError(
            "Existem versões duplicadas de migrations."
        )

    return migrations


def register_baseline(connection, migrations) -> None:
    migrations_by_version = {
        version: (filename, path)
        for version, filename, path in migrations
    }

    for version in BASELINE_VERSIONS:
        if version not in migrations_by_version:
            raise RuntimeError(
                f"Arquivo da migration {version} não encontrado."
            )

    existing = {
        row[0]
        for row in connection.execute(
            "SELECT version FROM schema_migrations"
        ).fetchall()
    }

    if existing:
        raise RuntimeError(
            "Baseline interrompido: schema_migrations "
            "já possui registros."
        )

    validate_existing_schema(connection)

    for version in BASELINE_VERSIONS:
        filename, _ = migrations_by_version[version]

        connection.execute(
            """
            INSERT INTO schema_migrations (version, filename)
            VALUES (%s, %s)
            """,
            (version, filename),
        )

        print(f"Baseline registrado: {filename}")


def apply_pending_migrations(connection, migrations) -> None:
    applied = {
        row[0]
        for row in connection.execute(
            "SELECT version FROM schema_migrations"
        ).fetchall()
    }

    known_versions = {
        version
        for version, _, _ in migrations
    }

    unknown_versions = applied - known_versions

    if unknown_versions:
        raise RuntimeError(
            "Histórico contém versões sem arquivo SQL: "
            f"{sorted(unknown_versions)}"
        )

    for version, filename, path in migrations:
        if version in applied:
            print(f"Já aplicada: {filename}")
            continue

        sql = path.read_text(encoding="utf-8-sig")

        with connection.transaction():
            connection.execute(sql)

            connection.execute(
                """
                INSERT INTO schema_migrations (version, filename)
                VALUES (%s, %s)
                """,
                (version, filename),
            )

        print(f"Migration aplicada: {filename}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Gerenciador de migrations PostgreSQL."
    )

    parser.add_argument(
        "--baseline-existing",
        action="store_true",
        help=(
            "Registra as migrations 001 e 002 como existentes, "
            "sem executá-las."
        ),
    )

    args = parser.parse_args()

    migrations = discover_migrations()

    with psycopg.connect(
        database_url(),
        autocommit=True,
    ) as connection:

        with connection.transaction():
            ensure_migrations_table(connection)

        if args.baseline_existing:
            with connection.transaction():
                register_baseline(connection, migrations)

        apply_pending_migrations(connection, migrations)


if __name__ == "__main__":
    main()
