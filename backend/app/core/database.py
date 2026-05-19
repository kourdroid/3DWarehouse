from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

Base = declarative_base()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

get_db_session = get_db


async def ensure_layout_schema_compat(conn) -> None:
    """Additive SQLite compatibility for local databases without Alembic."""
    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    async def add_missing_columns(table: str, columns: dict[str, str]) -> None:
        result = await conn.exec_driver_sql(f"PRAGMA table_info({table})")
        existing = {row[1] for row in result.fetchall()}
        for column_name, column_sql in columns.items():
            if column_name not in existing:
                await conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column_name} {column_sql}")

    await add_missing_columns("layout_zone", {"code": "VARCHAR(50)"})
    await add_missing_columns("layout_aisle", {"spacing_meters": "FLOAT NOT NULL DEFAULT 0.0"})
    await add_missing_columns("layout_rack_bay", {"depth_meters": "FLOAT NOT NULL DEFAULT 1.2"})
    await add_missing_columns(
        "layout_storage_unit",
        {
            "position_number": "INTEGER NOT NULL DEFAULT 1",
            "storage_kind": "VARCHAR(6) NOT NULL DEFAULT 'PALLET'",
            "x_meters": "FLOAT NOT NULL DEFAULT 0.0",
            "y_meters": "FLOAT NOT NULL DEFAULT 0.0",
            "z_meters": "FLOAT NOT NULL DEFAULT 0.0",
            "width_meters": "FLOAT NOT NULL DEFAULT 1.2",
            "depth_meters": "FLOAT NOT NULL DEFAULT 1.2",
            "height_meters": "FLOAT NOT NULL DEFAULT 1.2",
            "status": "VARCHAR(8) NOT NULL DEFAULT 'EMPTY'",
            "sku": "VARCHAR(100)",
            "quantity": "INTEGER NOT NULL DEFAULT 0",
            "pallet_id": "VARCHAR(100)",
            "last_updated_at": "DATETIME",
        },
    )
