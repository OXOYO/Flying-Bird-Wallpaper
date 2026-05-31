# -*- coding: utf-8 -*-
"""一次性迁移插件 resourceName 为 源_插件（不改 fileName）"""
import json
import os
import sqlite3
import sys

DB = os.environ.get(
    "FBW_DATABASE_FILE_PATH",
    os.path.join(os.environ.get("APPDATA", ""), "Flying Bird Wallpaper", "database", "fbw.db"),
)
FORCE = "--force" in sys.argv
MIGRATION_KEY = "pluginResourceIdFormatV1"
RESERVED = {"resources", "local", "favorites", "history", "privacy_space"}


def get_sys(conn, key):
    row = conn.execute("SELECT storeData, storeType FROM fbw_sys WHERE storeKey = ?", (key,)).fetchone()
    if not row:
        return None
    data, st = row
    if st in ("object", "array"):
        return json.loads(data)
    return data


def set_sys(conn, key, data, store_type="string"):
    if store_type in ("object", "array"):
        payload = json.dumps(data, ensure_ascii=False)
    else:
        payload = str(data)
    conn.execute(
        """
        INSERT INTO fbw_sys (storeKey, storeData, storeType, updated_at)
        VALUES (?, ?, ?, datetime('now', 'localtime'))
        ON CONFLICT(storeKey) DO UPDATE SET
          storeData=excluded.storeData,
          storeType=excluded.storeType,
          updated_at=datetime('now', 'localtime')
        """,
        (key, payload, store_type),
    )


def colon_to_underscore(s):
    return s.replace(":", "_") if ":" in s else s


def main():
    print("DB:", DB)
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    if not FORCE and get_sys(conn, MIGRATION_KEY) == "done":
        print("already migrated (use --force to re-run)")
        conn.close()
        return

    if FORCE:
        conn.execute("DELETE FROM fbw_sys WHERE storeKey = ?", (MIGRATION_KEY,))

    plugins = get_sys(conn, "plugins") or {}
    composite_by_short = {}
    composite_by_colon = {}
    for entry in plugins.values():
        if not entry or not entry.get("sourceName") or not entry.get("name"):
            continue
        src = entry["sourceName"].strip()
        name = entry["name"].strip()
        composite = f"{src}_{name}"
        composite_by_short[name] = composite
        composite_by_colon[f"{src}:{name}"] = composite
        if entry.get("pluginKey"):
            composite_by_colon[entry["pluginKey"]] = composite

    stats = {"resources": 0, "secretKeys": 0, "downloadSources": 0, "plugins": len(plugins)}

    rows = conn.execute(
        "SELECT DISTINCT resourceName FROM fbw_resources WHERE resourceName IS NOT NULL AND resourceName != ''"
    ).fetchall()

    for row in rows:
        old = row["resourceName"]
        if old in RESERVED:
            continue
        if "_" in old and ":" not in old:
            parts = old.split("_", 1)
            if len(parts) == 2 and parts[1] in composite_by_short:
                continue
        new = None
        if ":" in old:
            new = composite_by_colon.get(old) or colon_to_underscore(old)
        else:
            new = composite_by_short.get(old)
        if not new or new == old:
            continue
        cur = conn.execute(
            "UPDATE fbw_resources SET resourceName = ? WHERE resourceName = ?", (new, old)
        )
        stats["resources"] += cur.rowcount

    setting = get_sys(conn, "settingData") or {}
    secret_keys = dict(setting.get("remoteResourceSecretKeys") or {})
    changed = False
    for key in list(secret_keys.keys()):
        new_key = None
        if ":" in key:
            new_key = composite_by_colon.get(key) or colon_to_underscore(key)
        elif key in composite_by_short:
            new_key = composite_by_short[key]
        if new_key and new_key != key:
            if new_key not in secret_keys:
                secret_keys[new_key] = secret_keys[key]
            del secret_keys[key]
            changed = True
            stats["secretKeys"] += 1
    if changed:
        setting["remoteResourceSecretKeys"] = secret_keys

    ds = list(setting.get("downloadSources") or [])
    ds_changed = False
    for i, v in enumerate(ds):
        nv = None
        if isinstance(v, str) and ":" in v:
            nv = composite_by_colon.get(v) or colon_to_underscore(v)
        elif v in composite_by_short:
            nv = composite_by_short[v]
        if nv and nv != v:
            ds[i] = nv
            ds_changed = True
            stats["downloadSources"] += 1
    if ds_changed:
        setting["downloadSources"] = ds

    if changed or ds_changed:
        set_sys(conn, "settingData", setting, "object")

    plugins_next = {}
    for entry in plugins.values():
        if not entry:
            continue
        src = (entry.get("sourceName") or "").strip()
        name = (entry.get("name") or "").strip()
        if not src or not name:
            continue
        composite = f"{src}_{name}"
        plugins_next[composite] = {
            **entry,
            "pluginKey": composite,
            "value": composite,
            "label": composite,
            "displayName": composite,
        }
    set_sys(conn, "plugins", plugins_next, "object")

    set_sys(conn, MIGRATION_KEY, "done", "string")
    conn.commit()

    print("Migration stats:", stats)
    sample = conn.execute(
        """
        SELECT resourceName, COUNT(*) c FROM fbw_resources
        WHERE resourceName NOT IN ('local','resources','favorites','history','privacy_space')
        GROUP BY resourceName ORDER BY c DESC LIMIT 10
        """
    ).fetchall()
    print("Top resourceName:", [dict(r) for r in sample])
    conn.close()


if __name__ == "__main__":
    main()
