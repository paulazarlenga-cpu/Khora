import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / ".tmp-phase-a-d1" / "khora-production-export.json"
IMPORT_ORDER = [
    "categories",
    "code_base",
    "suppliers",
    "clients",
    "raw_materials",
    "products",
    "raw_material_purchases",
    "recipes",
    "recipe_items",
    "combos",
    "combo_recipe_items",
    "manufacturing_batches",
    "manufacturing_materials",
    "combo_batches",
    "combo_batch_items",
    "sales",
    "sale_items",
    "material_sale_items",
    "expenses",
    "stock_movements",
    "monthly_profits",
    "profit_history",
]


def find_database() -> Path:
    candidates = sorted(
        (ROOT / ".wrangler" / "state" / "v3" / "d1").rglob("*.sqlite"),
        key=lambda candidate: candidate.stat().st_size,
        reverse=True,
    )
    for candidate in candidates:
        connection = sqlite3.connect(f"file:{candidate}?mode=ro", uri=True)
        try:
            tables = {
                row[0]
                for row in connection.execute(
                    "select name from sqlite_master where type='table'"
                )
            }
            if {"products", "raw_materials", "sales"}.issubset(tables):
                return candidate
        finally:
            connection.close()
    raise RuntimeError("No se encontró la base D1 local de KHORA")


source = find_database()
database = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
database.row_factory = sqlite3.Row
try:
    data = {
        table: [dict(row) for row in database.execute(f'SELECT * FROM "{table}"')]
        for table in IMPORT_ORDER
    }
finally:
    database.close()

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(
    json.dumps({"version": 1, "tables": data}, ensure_ascii=False),
    encoding="utf-8",
)
print(
    json.dumps(
        {
            "exported": True,
            "target": str(OUTPUT.relative_to(ROOT)),
            "counts": {table: len(rows) for table, rows in data.items()},
        },
        ensure_ascii=False,
    )
)
