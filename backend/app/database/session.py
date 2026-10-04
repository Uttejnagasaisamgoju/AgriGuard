import logging
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from app.core.config import settings

logger = logging.getLogger(__name__)

_local_dev_dir = Path(r"c:\sih3\backend")
if _local_dev_dir.exists():
    CANONICAL_DB_FILE = (_local_dev_dir / "agriguard.db").resolve()
else:
    CANONICAL_DB_FILE = (Path(__file__).resolve().parent.parent.parent / "agriguard.db").resolve()

CANONICAL_SQLITE_URL = f"sqlite:///{CANONICAL_DB_FILE.as_posix()}"

db_url = settings.DATABASE_URL
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

if not db_url:
    db_url = CANONICAL_SQLITE_URL
elif "sqlite" in db_url.lower():
    # If using sqlite but the configured path refers to non-existent Windows paths, fall back to container path
    if ("c:" in db_url.lower() or "sih3" in db_url.lower()) and not _local_dev_dir.exists():
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


