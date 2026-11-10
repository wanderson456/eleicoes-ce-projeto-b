import csv
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import import_municipality_mapping as importer


class TestDatabaseUrl(unittest.TestCase):

    @patch.object(importer, "load_dotenv")
    def test_raises_when_database_url_is_missing(self, mock_load_dotenv):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(
                RuntimeError,
                "DATABASE_URL não foi configurada."
            ):
                importer.database_url()

    @patch.object(importer, "load_dotenv")
    def test_uses_localhost_and_default_port(self, mock_load_dotenv):
        environment = {
            "DATABASE_URL": "postgresql://user:password@db:5432/eleicoes_ce"
        }

        with patch.dict(os.environ, environment, clear=True):
            result = importer.database_url()

        self.assertEqual(
            result,
            "postgresql://user:password@localhost:5433/eleicoes_ce"
        )


class TestLoadMunicipalities(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.csv_file = Path(self.temp_dir.name) / "ceara.csv"

        self.addCleanup(self.temp_dir.cleanup)

    def write_csv(self, rows, headers=None):
        if headers is None:
            headers = importer.COLUMNS

        with self.csv_file.open(
            "w",
            encoding="utf-8",
            newline=""
        ) as file:
            writer = csv.writer(file, delimiter=";")
            writer.writerow(headers)
            writer.writerows(rows)

    def valid_rows(self):
        return [
            ("01001", "Município A", "2300001", "Município A"),
            ("01002", "Município B", "2300002", "Município B"),
        ]

    def load_with_expected_count(self, expected_count=2):
        with (
            patch.object(importer, "CSV_FILE", self.csv_file),
            patch.object(
                importer,
                "EXPECTED_MUNICIPALITIES",
                expected_count
            )
        ):
            return importer.load_municipalities()

    def test_loads_valid_csv(self):
        rows = self.valid_rows()
        self.write_csv(rows)

        result = self.load_with_expected_count()

        self.assertEqual(result, rows)

    def test_preserves_leading_zeros_in_codes(self):
        self.write_csv(self.valid_rows())

        result = self.load_with_expected_count()

        self.assertEqual(result[0][0], "01001")
        self.assertEqual(result[0][2], "2300001")

    def test_raises_when_csv_file_is_missing(self):
        with (
            patch.object(importer, "CSV_FILE", self.csv_file),
            self.assertRaises(FileNotFoundError)
        ):
            importer.load_municipalities()

    def test_raises_when_csv_has_no_header(self):
        self.csv_file.write_text("", encoding="utf-8")

        with (
            patch.object(importer, "CSV_FILE", self.csv_file),
            self.assertRaisesRegex(ValueError, "não possui cabeçalho")
        ):
            importer.load_municipalities()

    def test_raises_when_required_columns_are_missing(self):
        self.write_csv(
            [("01001", "Município A")],
            headers=["CD_MUNICIPIO_TSE", "NM_MUNICIPIO_TSE"]
        )

        with (
            patch.object(importer, "CSV_FILE", self.csv_file),
            self.assertRaisesRegex(ValueError, "Colunas ausentes")
        ):
            importer.load_municipalities()

    def test_raises_when_field_is_empty(self):
        rows = [
            ("01001", "", "2300001", "Município A"),
            ("01002", "Município B", "2300002", "Município B"),
        ]
        self.write_csv(rows)

        with self.assertRaisesRegex(ValueError, "Campo vazio"):
            self.load_with_expected_count()

    def test_raises_when_tse_code_is_invalid(self):
        rows = self.valid_rows()
        rows[0] = ("123", "Município A", "2300001", "Município A")
        self.write_csv(rows)

        with self.assertRaisesRegex(ValueError, "Código TSE inválido"):
            self.load_with_expected_count()

    def test_raises_when_ibge_code_is_invalid(self):
        rows = self.valid_rows()
        rows[0] = ("01001", "Município A", "123", "Município A")
        self.write_csv(rows)

        with self.assertRaisesRegex(ValueError, "Código IBGE inválido"):
            self.load_with_expected_count()

    def test_raises_when_municipality_count_is_incorrect(self):
        self.write_csv(self.valid_rows())

        with self.assertRaisesRegex(ValueError, "Esperados 184 municípios"):
            self.load_with_expected_count(expected_count=184)

    def test_raises_when_tse_codes_are_duplicated(self):
        rows = self.valid_rows()
        rows[1] = ("01001", "Município B", "2300002", "Município B")
        self.write_csv(rows)

        with self.assertRaisesRegex(ValueError, "códigos TSE duplicados"):
            self.load_with_expected_count()

    def test_raises_when_ibge_codes_are_duplicated(self):
        rows = self.valid_rows()
        rows[1] = ("01002", "Município B", "2300001", "Município B")
        self.write_csv(rows)

        with self.assertRaisesRegex(ValueError, "códigos IBGE duplicados"):
            self.load_with_expected_count()



class TestImportMunicipalities(unittest.TestCase):

    def setUp(self):
        self.municipalities = [
            ("13030", "Acaraú", "2300200", "Acaraú"),
            ("13250", "Araripe", "2301307", "Araripe"),
        ]

    @patch.object(importer, "database_url", return_value="postgresql://teste")
    @patch.object(importer, "load_municipalities")
    @patch.object(importer.psycopg, "connect")
    def test_imports_municipalities_and_returns_count(
        self, mock_connect, mock_load, mock_database_url
    ):
        mock_load.return_value = self.municipalities

        connection = unittest.mock.MagicMock()
        connection.__enter__.return_value = connection

        cursor = unittest.mock.MagicMock()
        connection.cursor.return_value.__enter__.return_value = cursor
        mock_connect.return_value = connection

        result = importer.import_municipalities()

        self.assertEqual(result, 2)
        mock_database_url.assert_called_once()
        mock_connect.assert_called_once_with("postgresql://teste")
        mock_load.assert_called_once()
        cursor.executemany.assert_called_once()

        sql, parameters = cursor.executemany.call_args.args

        self.assertIn("INSERT INTO municipios_tse_ibge", sql)
        self.assertIn("ON CONFLICT (cd_municipio_tse)", sql)
        self.assertIn("DO UPDATE SET", sql)
        self.assertEqual(parameters, self.municipalities)

    @patch.object(importer, "database_url", return_value="postgresql://teste")
    @patch.object(importer, "load_municipalities")
    @patch.object(
        importer.psycopg,
        "connect",
        side_effect=RuntimeError("Falha simulada na conexão")
    )
    def test_propagates_database_connection_error(
        self, mock_connect, mock_load, mock_database_url
    ):
        mock_load.return_value = self.municipalities

        with self.assertRaisesRegex(
            RuntimeError,
            "Falha simulada na conexão"
        ):
            importer.import_municipalities()

        mock_connect.assert_called_once_with("postgresql://teste")

if __name__ == "__main__":
    unittest.main()
