"""
Cross-dialect types supporting both PostgreSQL (native UUID & JSONB) and SQLite (CHAR(36) & JSON).
Allows seamless development, testing, and production deployment.
"""
import uuid
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB


class GUID(TypeDecorator):
    """
    Platform-independent GUID/UUID type.
    Uses PostgreSQL's native UUID type when running on postgres,
    otherwise uses CHAR(36), storing as stringified hex for SQLite.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return value
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                try:
                    return uuid.UUID(str(value))
                except (ValueError, TypeError):
                    return value
            return value


# Universal JSON type (uses native JSONB on PostgreSQL if available, JSON text on SQLite)
JSONType = JSON
