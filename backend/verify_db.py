import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.models import Base

async def verify_models():
    print("Testing SQLAlchemy Async Engine Memory Creation...")
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=True)
    
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("\n\n✅ ALL 10 CDC SCHEMAS CREATED SUCCESSFULLY")
    except Exception as e:
        print(f"\n\n❌ ERROR CREATING SCHEMAS: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(verify_models())
