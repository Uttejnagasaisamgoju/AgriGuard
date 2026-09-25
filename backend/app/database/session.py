import logging
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from app.core.config import settings

logger = logging.getLogger(__name__)

CANONICAL_DB_FILE = Path(r"c:\sih3\backend\agriguard.db").resolve()
CANONICAL_SQLITE_URL = f"sqlite:///{CANONICAL_DB_FILE.as_posix()}"

db_url = settings.DATABASE_URL
if not db_url or "sqlite" in db_url.lower():
    db_url = CANONICAL_SQLITE_URL

if "sqlite" in db_url:
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False, "timeout": 15},
        poolclass=QueuePool,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_pre_ping=True,
        echo=False,
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=15000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

else:
    try:
        engine = create_engine(
            db_url,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_pre_ping=True,
            echo=False,
        )
        with engine.connect() as conn:
            pass
    except Exception as e:
        logger.warning(f"Database connection to {db_url} failed ({e}). Falling back to canonical SQLite.")
        db_url = CANONICAL_SQLITE_URL
        engine = create_engine(
            db_url,
            connect_args={"check_same_thread": False, "timeout": 15},
            poolclass=QueuePool,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_pre_ping=True,
            echo=False,
        )

        @event.listens_for(engine, "connect")
        def _set_sqlite_pragmas_fallback(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=15000")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def create_tables():
    from app.models import user, farm, disease, chat, notification, officer, weather, audit, translation
    Base.metadata.create_all(bind=engine)
    logger.info(f"Database tables verified on {engine.url}")


