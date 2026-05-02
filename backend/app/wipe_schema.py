"""
Drop and recreate the 'public' schema on the configured PostgreSQL DB.

Used as a one-shot from the deploy workflow when wipe_db=true (e.g. after
squashing the Alembic history). Safe only when there is no data to
preserve.
"""
import logging

from sqlalchemy import text

from app.core.db import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    logger.info("Dropping schema 'public' (CASCADE)...")
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.commit()
    logger.info("Schema 'public' is empty. Alembic will recreate it.")


if __name__ == "__main__":
    main()
