# CloudBase import files

Use CloudBase 文档型数据库 -> 集合 -> 导入数据.

- events -> events.jsonl (9 records)
- flashes -> flashes.jsonl (10 records)
- articles -> articles.jsonl (4 records)

Format: UTF-8 JSON Lines (one Mongo-style JSON document per line).
Recommended mode for first import: Insert.
For later repeated syncs: Upsert by _id.
