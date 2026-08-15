"""特征库持久化：data/faces.json 的读写与 CRUD。

数据格式:
    {"people": [{"id", "name", "descriptors": [[128...], ...],
                 "samples", "created_at", "updated_at"}]}
"""
import json
import os
import shutil
import threading
import uuid
from datetime import datetime
from typing import Any, Optional

from . import config


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _public(person: dict) -> dict:
    """对外返回时省略 128 维描述子，避免响应过大。"""
    return {k: v for k, v in person.items() if k != "descriptors"}


class FaceStore:
    def __init__(self, path=None):
        self.path = path or config.FACES_FILE
        self._lock = threading.Lock()
        self._data = self._load()

    # ------------------------------------------------------------ 基础读写
    def _load(self) -> dict:
        if not self.path.exists():
            return {"people": []}
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict) or "people" not in data:
                raise ValueError("特征库格式异常")
            return data
        except Exception as exc:  # noqa: BLE001
            backup = self.path.with_suffix(".json.bak")
            try:
                shutil.copyfile(self.path, backup)
            except OSError:
                pass
            print(f"[store] 特征库损坏，已备份到 {backup} 并重建：{exc}")
            return {"people": []}

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self.path)  # 原子替换，避免写一半损坏

    # ------------------------------------------------------------ 查询
    def list_people(self) -> list:
        with self._lock:
            return [_public(p) for p in self._data["people"]]

    def all_people(self) -> list:
        """含 128 维描述子的完整数据，供前端识别匹配使用（本地小规模数据量可接受）。"""
        with self._lock:
            return [dict(p) for p in self._data["people"]]

    def get_person(self, person_id: str) -> Optional[dict]:
        with self._lock:
            for p in self._data["people"]:
                if p["id"] == person_id:
                    return p
        return None

    # ------------------------------------------------------------ 写入
    def add_person(self, name: str, descriptors: list, force: bool = False) -> dict:
        """新增人员。同名且未 force 时返回 conflict 供前端确认覆盖。"""
        name = (name or "").strip()
        if not name:
            return {"conflict": False, "error": "名字不能为空"}
        if not descriptors:
            return {"conflict": False, "error": "描述子为空"}

        with self._lock:
            existing = next(
                (p for p in self._data["people"] if p["name"] == name), None
            )
            if existing is not None and not force:
                return {"conflict": True, "existing": _public(existing)}

            now = _now()
            if existing is not None:
                existing["descriptors"] = [list(map(float, d)) for d in descriptors]
                existing["samples"] = len(descriptors)
                existing["updated_at"] = now
                person = existing
            else:
                person = {
                    "id": uuid.uuid4().hex[:12],
                    "name": name,
                    "descriptors": [list(map(float, d)) for d in descriptors],
                    "samples": len(descriptors),
                    "created_at": now,
                    "updated_at": now,
                }
                self._data["people"].append(person)
            self._save()
            return {"conflict": False, "person": _public(person)}

    def delete_person(self, person_id: str) -> bool:
        with self._lock:
            before = len(self._data["people"])
            self._data["people"] = [
                p for p in self._data["people"] if p["id"] != person_id
            ]
            if len(self._data["people"]) != before:
                self._save()
                return True
        return False

    def names(self) -> list:
        with self._lock:
            return [p["name"] for p in self._data["people"]]
