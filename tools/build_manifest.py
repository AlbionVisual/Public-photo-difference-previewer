#!/usr/bin/env python3
"""Собирает pairs.json по папкам pairs/*/.

В каждой папке пары должны быть файлы a.<ext> и b.<ext>
(jpg, jpeg, png, webp, avif). Необязательный meta.json:
    {"title": "Человекочитаемое название"}

Запуск из корня проекта:
    python3 tools/build_manifest.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAIRS = ROOT / "pairs"
EXTS = [".jpg", ".jpeg", ".png", ".webp", ".avif"]


def find(folder: Path, base: str):
    for ext in EXTS:
        for name in (base + ext, base + ext.upper()):
            p = folder / name
            if p.is_file():
                return p.relative_to(ROOT).as_posix()
    return None


def main() -> int:
    if not PAIRS.is_dir():
        print(f"нет папки {PAIRS}")
        return 1
    items = []
    for d in sorted(p for p in PAIRS.iterdir() if p.is_dir()):
        if d.name.startswith("."):
            continue
        a, b = find(d, "a"), find(d, "b")
        if not a or not b:
            print(f"пропуск {d.name}: нужны a.* и b.*")
            continue
        title = d.name
        meta = d / "meta.json"
        if meta.is_file():
            try:
                title = json.loads(meta.read_text(encoding="utf-8")).get("title", title)
            except Exception as e:
                print(f"meta.json в {d.name}: {e}")
        items.append({"slug": d.name, "title": title, "a": a, "b": b})
    (ROOT / "pairs.json").write_text(
        json.dumps({"pairs": items}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"pairs.json: {len(items)} пар(ы)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
