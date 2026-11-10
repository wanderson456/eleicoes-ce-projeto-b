
import os
import unittest
from unittest.mock import patch

from scripts.database import database_url


class TestDatabaseUrl(unittest.TestCase):

    def call_database_url(self, environment):
        with patch.dict(os.environ, environment, clear=True):
            return database_url(load_env=lambda _: None)

    def test_raises_when_database_url_is_missing(self):
        with self.assertRaisesRegex(
            RuntimeError,
            "DATABASE_URL não foi configurada."
        ):
            self.call_database_url({})

    def test_uses_default_test_port(self):
        environment = {
            "DATABASE_URL": (
                "postgresql://user:password@db:5432/eleicoes_ce"
            )
        }

        result = self.call_database_url(environment)

        self.assertEqual(
            result,
            "postgresql://user:password@localhost:5433/eleicoes_ce"
        )

    def test_uses_custom_test_port(self):
        environment = {
            "DATABASE_URL": (
                "postgresql://user:password@db:5432/eleicoes_ce"
            ),
            "TEST_DATABASE_PORT": "5434",
        }

        result = self.call_database_url(environment)

        self.assertEqual(
            result,
            "postgresql://user:password@localhost:5434/eleicoes_ce"
        )

    def test_preserves_special_characters_in_credentials(self):
        environment = {
            "DATABASE_URL": (
                "postgresql://user%40empresa:"
                "senha%3A123%25@db:5432/eleicoes_ce"
            )
        }

        result = self.call_database_url(environment)

        self.assertEqual(
            result,
            "postgresql://user%40empresa:senha%3A123%25"
            "@localhost:5433/eleicoes_ce"
        )

    def test_preserves_query_and_fragment(self):
        environment = {
            "DATABASE_URL": (
                "postgresql://user:password@db:5432/eleicoes_ce"
                "?sslmode=require#config"
            )
        }

        result = self.call_database_url(environment)

        self.assertEqual(
            result,
            "postgresql://user:password@localhost:5433/eleicoes_ce"
            "?sslmode=require#config"
        )

    def test_rejects_invalid_scheme(self):
        environment = {
            "DATABASE_URL": "mysql://user:password@db:3306/eleicoes_ce"
        }

        with self.assertRaisesRegex(
            ValueError,
            "Esquema da DATABASE_URL inválido."
        ):
            self.call_database_url(environment)

    def test_rejects_missing_host(self):
        environment = {
            "DATABASE_URL": "postgresql:///eleicoes_ce"
        }

        with self.assertRaisesRegex(
            ValueError,
            "Host da DATABASE_URL não foi configurado."
        ):
            self.call_database_url(environment)


if __name__ == "__main__":
    unittest.main()
