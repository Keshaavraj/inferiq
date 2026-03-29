"""
Run once to seed the SQLite database with pre-computed benchmark results.

Usage:
    python seed.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DATABASE_PATH", "./inferiq.db")

from storage.database import init_db, insert_result


async def main():
    seed_file = Path(__file__).parent.parent / "benchmarks" / "seed_results.json"
    if not seed_file.exists():
        print(f"Seed file not found: {seed_file}")
        sys.exit(1)

    with open(seed_file) as f:
        data = json.load(f)

    await init_db()

    count = 0
    for result in data["results"]:
        await insert_result(result)
        count += 1

    print(f"Seeded {count} benchmark results into inferiq.db")
    print(f"Models: {set(r['model_name'] for r in data['results'])}")
    print(f"Quant levels: {set(r['quant_level'] for r in data['results'])}")
    print(f"Task types: {set(r['task_type'] for r in data['results'])}")


if __name__ == "__main__":
    asyncio.run(main())
