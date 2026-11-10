import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import migrate


class TestDatabaseUrl(unittest.TestCase):

    @patch.object(migrate, "load_dotenv")
    def test_raises_when_database_url_is_missing(self, mock_load_dotenv):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(
                RuntimeError,
                "DATABASE_URL não foi configurada."
            ):
                migrate.database_url()

        mock_load_dotenv.assert_called_once_with(migrate.ROOT / ".env")

    @patch.object(migrate, "load_dotenv")
    def test_replaces_host_and_port_with_local_test_database(
        self,
        mock_load_dotenv
    ):
        environment = {
            "DATABASE_URL": "postgresql://user:password@db:5432/eleicoes_ce",
            "TEST_DATABASE_PORT": "5433",
        }

        with patch.dict(os.environ, environment, clear=True):
            result = migrate.database_url()

        self.assertEqual(
            result,
            "postgresql://user:password@localhost:5433/eleicoes_ce"
        )

    @patch.object(migrate, "load_dotenv")
    def test_uses_default_test_port(self, mock_load_dotenv):
        environment = {
            "DATABASE_URL": "postgresql://user:password@db:5432/eleicoes_ce",
        }

        with patch.dict(os.environ, environment, clear=True):
            result = migrate.database_url()

        self.assertIn("@localhost:5433/", result)


class TestDiscoverMigrations(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.migrations_dir = Path(self.temp_dir.name)

        self.addCleanup(self.temp_dir.cleanup)

    def create_migration(self, filename):
        (self.migrations_dir / filename).touch()

    def test_discovers_migrations_in_version_order(self):
        self.create_migration("003_municipios_tse_ibge.sql")
        self.create_migration("001_schema.sql")
        self.create_migration("002_classificacao_votos.sql")

        with patch.object(
            migrate,
            "MIGRATIONS_DIR",
            self.migrations_dir
        ):
            result = migrate.discover_migrations()

        self.assertEqual(
            [migration[0] for migration in result],
            ["001", "002", "003"]
        )

        self.assertEqual(
            [migration[1] for migration in result],
            [
                "001_schema.sql",
                "002_classificacao_votos.sql",
                "003_municipios_tse_ibge.sql",
            ]
        )

    def test_ignores_invalid_sql_filenames(self):
        self.create_migration("001_schema.sql")
        self.create_migration("invalid.sql")
        self.create_migration("004-Migration.sql")
        self.create_migration("005_UPPERCASE.sql")
        self.create_migration("06_migration.sql")
        self.create_migration("007_migration.txt")

        with patch.object(
            migrate,
            "MIGRATIONS_DIR",
            self.migrations_dir
        ):
            result = migrate.discover_migrations()

        self.assertEqual(
            [migration[1] for migration in result],
            ["001_schema.sql"]
        )

    def test_raises_when_versions_are_duplicated(self):
        self.create_migration("003_municipios.sql")
        self.create_migration("003_outro_arquivo.sql")

        with patch.object(
            migrate,
            "MIGRATIONS_DIR",
            self.migrations_dir
        ):
            with self.assertRaisesRegex(
                RuntimeError,
                "Existem versões duplicadas de migrations."
            ):
                migrate.discover_migrations()


class TestRegisterBaseline(unittest.TestCase):

    def setUp(self):
        self.migrations = [
            ("001", "001_schema.sql", Path("001_schema.sql")),
            ("002", "002_classificacao_votos.sql", Path("002_classificacao_votos.sql")),
            ("003", "003_municipios_tse_ibge.sql", Path("003_municipios_tse_ibge.sql")),
        ]

    def test_raises_when_baseline_migration_is_missing(self):
        migrations = [
            ("001", "001_schema.sql", Path("001_schema.sql"))
        ]

        connection = unittest.mock.MagicMock()

        with self.assertRaisesRegex(
            RuntimeError,
            "Arquivo da migration 002 não encontrado."
        ):
            migrate.register_baseline(connection, migrations)

    def test_raises_when_migration_history_is_not_empty(self):
        connection = unittest.mock.MagicMock()
        connection.execute.return_value.fetchall.return_value = [("001",)]

        with self.assertRaisesRegex(
            RuntimeError,
            "schema_migrations já possui registros."
        ):
            migrate.register_baseline(connection, self.migrations)

    @patch.object(migrate, "validate_existing_schema")
    def test_registers_baseline_versions(self, mock_validate):
        connection = unittest.mock.MagicMock()
        connection.execute.return_value.fetchall.return_value = []

        with patch("builtins.print"):
            migrate.register_baseline(connection, self.migrations)

        mock_validate.assert_called_once_with(connection)

        inserts = [
            call.args[1]
            for call in connection.execute.call_args_list
            if call.args and "INSERT INTO schema_migrations" in call.args[0]
        ]

        self.assertEqual(
            inserts,
            [
                ("001", "001_schema.sql"),
                ("002", "002_classificacao_votos.sql"),
            ]
        )


class TestApplyPendingMigrations(unittest.TestCase):

    def test_raises_when_applied_version_has_no_sql_file(self):
        connection = unittest.mock.MagicMock()
        connection.execute.return_value.fetchall.return_value = [("004",)]

        with self.assertRaisesRegex(
            RuntimeError,
            "Histórico contém versões sem arquivo SQL"
        ):
            migrate.apply_pending_migrations(connection, [])

    def test_does_not_execute_already_applied_migration(self):
        connection = unittest.mock.MagicMock()
        connection.execute.return_value.fetchall.return_value = [("001",)]

        migrations = [
            ("001", "001_schema.sql", Path("001_schema.sql"))
        ]

        with patch("builtins.print"):
            migrate.apply_pending_migrations(connection, migrations)

        connection.execute.assert_called_once_with(
            "SELECT version FROM schema_migrations"
        )

    def test_executes_pending_migration_and_registers_version(self):
        connection = unittest.mock.MagicMock()

        def execute_side_effect(sql, params=None):
            if sql == "SELECT version FROM schema_migrations":
                return unittest.mock.MagicMock(fetchall=lambda: [])

            return unittest.mock.MagicMock()

        connection.execute.side_effect = execute_side_effect

        with tempfile.TemporaryDirectory() as temp_dir:
            migration_file = Path(temp_dir) / "003_test.sql"
            migration_file.write_text(
                "CREATE TABLE teste (id INTEGER);",
                encoding="utf-8"
            )

            migrations = [
                ("003", "003_test.sql", migration_file)
            ]

            with patch("builtins.print"):
                migrate.apply_pending_migrations(connection, migrations)

        calls = connection.execute.call_args_list

        self.assertTrue(
            any(
                call.args[0] == "CREATE TABLE teste (id INTEGER);"
                for call in calls
            )
        )

        self.assertTrue(
            any(
                "INSERT INTO schema_migrations" in call.args[0]
                and call.args[1] == ("003", "003_test.sql")
                for call in calls
            )
        )

    def test_does_not_register_migration_when_execution_fails(self):
        connection = unittest.mock.MagicMock()

        def execute_side_effect(sql, params=None):
            if sql == "SELECT version FROM schema_migrations":
                return unittest.mock.MagicMock(fetchall=lambda: [])

            if sql == "INVALID SQL":
                raise RuntimeError("Falha simulada na migration")

            return unittest.mock.MagicMock()

        connection.execute.side_effect = execute_side_effect

        with tempfile.TemporaryDirectory() as temp_dir:
            migration_file = Path(temp_dir) / "003_test.sql"
            migration_file.write_text(
                "INVALID SQL",
                encoding="utf-8"
            )

            migrations = [
                ("003", "003_test.sql", migration_file)
            ]

            with self.assertRaisesRegex(
                RuntimeError,
                "Falha simulada na migration"
            ):
                migrate.apply_pending_migrations(connection, migrations)

        inserts = [
            call for call in connection.execute.call_args_list
            if call.args and "INSERT INTO schema_migrations" in call.args[0]
        ]

        self.assertEqual(inserts, [])

class TestValidateExistingSchema(unittest.TestCase):

    def make_cursor(self, rows=None, row=None):
        cursor = unittest.mock.MagicMock()
        cursor.fetchall.return_value = rows or []
        cursor.fetchone.return_value = row
        return cursor

    def valid_schema_responses(self):
        tables = [(table,) for table in migrate.REQUIRED_TABLES]
        constraints = [
            (constraint,)
            for table_constraints in migrate.REQUIRED_CONSTRAINTS.values()
            for constraint in table_constraints
        ]
        indexes = [(index,) for index in migrate.REQUIRED_INDEXES]

        responses = [
            self.make_cursor(rows=tables),
            self.make_cursor(row=("character varying", "NO")),
        ]

        for table, expected in migrate.REQUIRED_CONSTRAINTS.items():
            responses.append(
                self.make_cursor(
                    rows=[(constraint,) for constraint in expected]
                )
            )

        responses.append(self.make_cursor(rows=indexes))

        return responses

    def test_accepts_valid_schema(self):
        connection = unittest.mock.MagicMock()
        connection.execute.side_effect = self.valid_schema_responses()

        migrate.validate_existing_schema(connection)

        self.assertEqual(connection.execute.call_count, 6)

    def test_rejects_missing_tables(self):
        connection = unittest.mock.MagicMock()
        connection.execute.return_value = self.make_cursor(rows=[])

        with self.assertRaisesRegex(
            RuntimeError,
            "Tabelas ausentes"
        ):
            migrate.validate_existing_schema(connection)

    def test_rejects_incompatible_vote_column(self):
        connection = unittest.mock.MagicMock()
        connection.execute.side_effect = [
            self.make_cursor(
                rows=[(table,) for table in migrate.REQUIRED_TABLES]
            ),
            self.make_cursor(row=("text", "YES")),
        ]

        with self.assertRaisesRegex(
            RuntimeError,
            "coluna votos.tipo_voto ausente ou incompatível"
        ):
            migrate.validate_existing_schema(connection)

    def test_rejects_missing_constraints(self):
        connection = unittest.mock.MagicMock()
        connection.execute.side_effect = [
            self.make_cursor(
                rows=[(table,) for table in migrate.REQUIRED_TABLES]
            ),
            self.make_cursor(row=("character varying", "NO")),
            self.make_cursor(rows=[]),
        ]

        with self.assertRaisesRegex(
            RuntimeError,
            "Restrições ausentes em candidatos"
        ):
            migrate.validate_existing_schema(connection)

    def test_rejects_missing_indexes(self):
        connection = unittest.mock.MagicMock()
        responses = self.valid_schema_responses()
        responses[-1] = self.make_cursor(rows=[])

        connection.execute.side_effect = responses

        with self.assertRaisesRegex(
            RuntimeError,
            "Índices ausentes"
        ):
            migrate.validate_existing_schema(connection)


if __name__ == "__main__":
    unittest.main()
