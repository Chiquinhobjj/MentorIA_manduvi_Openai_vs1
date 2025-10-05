import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


DB_DIR = Path(__file__).resolve().parents[1] / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "progress.db"
XP_GOAL = 300
BADGE_THRESHOLDS = [
    (50, "Bronze"),
    (100, "Prata"),
    (150, "Ouro"),
]
LEVEL_LABELS = [
    "Diagnóstico",
    "Fundamentos",
    "Prática Guiada",
    "Desafios Avançados",
    "Mentoria",
]


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS progress (
                session_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                xp_total INTEGER NOT NULL DEFAULT 0,
                level INTEGER NOT NULL DEFAULT 0,
                topic TEXT DEFAULT '',
                gaps TEXT DEFAULT '[]',
                path_position TEXT DEFAULT '{}',
                badges TEXT DEFAULT '[]',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (session_id, agent_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                type TEXT NOT NULL,
                payload TEXT,
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


_init_db()


@dataclass
class ProgressSummary:
    xp: int
    goal: int
    badges: List[str]
    path_position: Dict[str, Any]
    gaps: List[str]
    recent_events: List[Dict[str, Any]]
    awarded: int = 0


class ProgressTracker:
    """Persistence layer para progresso, XP e eventos do aluno."""

    def __init__(self) -> None:
        _init_db()

    def ensure_profile(self, session_id: str, agent_id: str) -> None:
        with _connect() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO progress (session_id, agent_id)
                VALUES (?, ?)
                """,
                (session_id, agent_id),
            )

    def log_event(self, session_id: str, agent_id: str, event_type: str, payload: Optional[Dict[str, Any]] = None) -> None:
        with _connect() as conn:
            conn.execute(
                """
                INSERT INTO events (session_id, agent_id, type, payload)
                VALUES (?, ?, ?, ?)
                """,
                (
                    session_id,
                    agent_id,
                    event_type,
                    json.dumps(payload or {}, ensure_ascii=False),
                ),
            )

    def update_gaps(self, session_id: str, agent_id: str, gaps: Optional[List[str]]) -> None:
        if gaps is None:
            return
        self.ensure_profile(session_id, agent_id)
        with _connect() as conn:
            conn.execute(
                """
                UPDATE progress
                SET gaps = ?, updated_at = CURRENT_TIMESTAMP
                WHERE session_id = ? AND agent_id = ?
                """,
                (json.dumps(gaps, ensure_ascii=False), session_id, agent_id),
            )

    def _compute_badges(self, xp: int) -> List[str]:
        return [name for threshold, name in BADGE_THRESHOLDS if xp >= threshold]

    def _compute_path_position(self, xp: int) -> Dict[str, Any]:
        level = min(xp // 50, len(LEVEL_LABELS) - 1)
        xp_to_next = max(0, ((level + 1) * 50) - xp)
        return {
            "level": level,
            "label": LEVEL_LABELS[level],
            "xpToNext": xp_to_next,
        }

    def _fetch_recent_events(self, session_id: str, agent_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT type, payload, ts
                FROM events
                WHERE session_id = ? AND agent_id = ?
                ORDER BY ts DESC
                LIMIT ?
                """,
                (session_id, agent_id, limit),
            ).fetchall()

        events: List[Dict[str, Any]] = []
        for row in rows:
            payload: Dict[str, Any] = {}
            if row["payload"]:
                try:
                    payload = json.loads(row["payload"])
                except json.JSONDecodeError:
                    payload = {"raw": row["payload"]}
            events.append(
                {
                    "type": row["type"],
                    "payload": payload,
                    "timestamp": row["ts"],
                }
            )
        return events

    def _load_profile(self, session_id: str, agent_id: str) -> ProgressSummary:
        self.ensure_profile(session_id, agent_id)
        with _connect() as conn:
            row = conn.execute(
                """
                SELECT xp_total, level, gaps, badges, path_position
                FROM progress
                WHERE session_id = ? AND agent_id = ?
                """,
                (session_id, agent_id),
            ).fetchone()

        xp_total = row["xp_total"] if row else 0
        badges: List[str] = []
        gaps: List[str] = []
        path_position: Dict[str, Any] = {}

        if row:
            if row["badges"]:
                try:
                    badges = json.loads(row["badges"])
                except json.JSONDecodeError:
                    badges = []
            if row["gaps"]:
                try:
                    gaps = json.loads(row["gaps"])
                except json.JSONDecodeError:
                    gaps = []
            if row["path_position"]:
                try:
                    path_position = json.loads(row["path_position"])
                except json.JSONDecodeError:
                    path_position = {}

        if not path_position:
            path_position = self._compute_path_position(xp_total)

        if not badges:
            badges = self._compute_badges(xp_total)

        recent_events = self._fetch_recent_events(session_id, agent_id)
        return ProgressSummary(
            xp=xp_total,
            goal=XP_GOAL,
            badges=badges,
            path_position=path_position,
            gaps=gaps,
            recent_events=recent_events,
        )

    def award_xp(
        self,
        session_id: str,
        agent_id: str,
        amount: int,
        reason: str,
        payload: Optional[Dict[str, Any]] = None,
        gaps: Optional[List[str]] = None,
    ) -> ProgressSummary:
        self.ensure_profile(session_id, agent_id)
        with _connect() as conn:
            row = conn.execute(
                "SELECT xp_total FROM progress WHERE session_id = ? AND agent_id = ?",
                (session_id, agent_id),
            ).fetchone()
            current_xp = row["xp_total"] if row else 0
            new_xp = max(0, current_xp + max(0, amount))
            badges = self._compute_badges(new_xp)
            path_position = self._compute_path_position(new_xp)
            conn.execute(
                """
                UPDATE progress
                SET xp_total = ?, level = ?, badges = ?, path_position = ?, updated_at = CURRENT_TIMESTAMP
                WHERE session_id = ? AND agent_id = ?
                """,
                (
                    new_xp,
                    path_position["level"],
                    json.dumps(badges, ensure_ascii=False),
                    json.dumps(path_position, ensure_ascii=False),
                    session_id,
                    agent_id,
                ),
            )

        if gaps:
            self.update_gaps(session_id, agent_id, gaps)

        event_payload = payload.copy() if payload else {}
        event_payload.update({
            "xp": amount,
            "reason": reason,
        })
        self.log_event(session_id, agent_id, "xp", event_payload)

        summary = self._load_profile(session_id, agent_id)
        summary.awarded = amount
        return summary

    def get_progress(self, session_id: str, agent_id: str) -> ProgressSummary:
        return self._load_profile(session_id, agent_id)
