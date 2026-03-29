import aiosqlite
import os
from datetime import datetime

DATABASE_PATH = os.getenv("DATABASE_PATH", "./inferiq.db")


async def init_db():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS benchmark_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name TEXT NOT NULL,
                quant_format TEXT NOT NULL,
                quant_level TEXT NOT NULL,
                task_type TEXT NOT NULL,
                ttft_ms REAL,
                tokens_per_sec REAL,
                vram_mb REAL,
                ram_mb REAL,
                quality_score REAL,
                quality_retention_pct REAL,
                rouge_l REAL,
                consistency_score REAL,
                hardware TEXT,
                run_at TEXT,
                notes TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS demo_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                prompt TEXT,
                model_a TEXT,
                model_b TEXT,
                response_a TEXT,
                response_b TEXT,
                ttft_a_ms REAL,
                ttft_b_ms REAL,
                tokens_sec_a REAL,
                tokens_sec_b REAL,
                created_at TEXT
            )
        """)
        await db.commit()


async def get_all_results(task_type: str = None, quant_format: str = None, model_name: str = None):
    filters = []
    params = []

    if task_type:
        filters.append("task_type = ?")
        params.append(task_type)
    if quant_format:
        filters.append("quant_format = ?")
        params.append(quant_format)
    if model_name:
        filters.append("model_name = ?")
        params.append(model_name)

    where = f"WHERE {' AND '.join(filters)}" if filters else ""

    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            f"SELECT * FROM benchmark_results {where} ORDER BY quality_retention_pct DESC",
            params
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def insert_result(result: dict):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("""
            INSERT INTO benchmark_results (
                model_name, quant_format, quant_level, task_type,
                ttft_ms, tokens_per_sec, vram_mb, ram_mb,
                quality_score, quality_retention_pct, rouge_l,
                consistency_score, hardware, run_at, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            result["model_name"], result["quant_format"], result["quant_level"],
            result["task_type"], result["ttft_ms"], result["tokens_per_sec"],
            result["vram_mb"], result["ram_mb"], result["quality_score"],
            result["quality_retention_pct"], result["rouge_l"],
            result["consistency_score"], result["hardware"],
            result.get("run_at", datetime.utcnow().isoformat()), result.get("notes", "")
        ))
        await db.commit()


async def log_demo(log: dict):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("""
            INSERT INTO demo_logs (
                session_id, prompt, model_a, model_b,
                response_a, response_b, ttft_a_ms, ttft_b_ms,
                tokens_sec_a, tokens_sec_b, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            log["session_id"], log["prompt"], log["model_a"], log["model_b"],
            log.get("response_a", ""), log.get("response_b", ""),
            log.get("ttft_a_ms"), log.get("ttft_b_ms"),
            log.get("tokens_sec_a"), log.get("tokens_sec_b"),
            datetime.utcnow().isoformat()
        ))
        await db.commit()
