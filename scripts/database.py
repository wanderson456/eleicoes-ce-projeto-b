
import os
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent.parent


def database_url(env_file: Path = ROOT / ".env", load_env=load_dotenv) -> str:
    load_env(env_file)

    url = os.getenv("DATABASE_URL")

    if not url:
        raise RuntimeError("DATABASE_URL não foi configurada.")

    parsed = urlsplit(url)

    if parsed.scheme not in ("postgresql", "postgres"):
        raise ValueError("Esquema da DATABASE_URL inválido.")

    if not parsed.hostname:
        raise ValueError("Host da DATABASE_URL não foi configurado.")

    port = os.getenv("TEST_DATABASE_PORT", "5433")

    username = parsed.username
    password = parsed.password

    auth = ""

    if username is not None:
        auth = quote(unquote(username), safe="")

        if password is not None:
            auth += ":" + quote(unquote(password), safe="")

        auth += "@"

    return urlunsplit((
        parsed.scheme,
        f"{auth}localhost:{port}",
        parsed.path,
        parsed.query,
        parsed.fragment,
    ))
