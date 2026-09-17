"""SQLite-backed leaderboard persistence.

Stores lap records so the leaderboard survives orchestrator restarts.
Uses Python's built-in sqlite3 — no additional dependencies required.
"""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from shared.models import LeaderboardEntry

_SCHEMA = """
CREATE TABLE IF NOT EXISTS laps (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    rig_id        TEXT NOT NULL,
    driver_name   TEXT,
    car           TEXT,
    track         TEXT,
    group_name    TEXT,
    lap           INTEGER NOT NULL DEFAULT 0,
    lap_time_ms   INTEGER,
    session_id    TEXT,
    timestamp     REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_laps_track ON laps(track);
CREATE INDEX IF NOT EXISTS idx_laps_session ON laps(session_id);
CREATE INDEX IF NOT EXISTS idx_laps_timestamp ON laps(timestamp DESC);

CREATE TABLE IF NOT EXISTS session_best (
    rig_id        TEXT NOT NULL,
    driver_name   TEXT,
    car           TEXT,
    track         TEXT,
    group_name    TEXT,
    lap           INTEGER NOT NULL DEFAULT 0,
    lap_time_ms   INTEGER,
    session_id    TEXT NOT NULL,
    timestamp     REAL NOT NULL,
    PRIMARY KEY (rig_id, session_id)
);
"""


class LeaderboardDB:
    """Thread-safe SQLite wrapper for leaderboard data."""

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = str(db_path)
        self._lock = threading.Lock()
        self._init_db()

    def _init_db(self) -> None:
        with self._lock:
            conn = sqlite3.connect(self._db_path)
            conn.executescript(_SCHEMA)
            conn.close()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def insert(self, entry: LeaderboardEntry) -> None:
        """Insert a new lap record."""
        with self._lock:
            conn = self._connect()
            conn.execute(
                """INSERT INTO laps (rig_id, driver_name, car, track, group_name, lap, lap_time_ms, session_id, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    entry.rig_id,
                    entry.driver_name,
                    entry.car,
                    entry.track,
                    entry.group_name,
                    entry.lap,
                    entry.lap_time_ms,
                    entry.session_id,
                    entry.timestamp,
                ),
            )
            conn.commit()
            conn.close()

    def upsert_session_best(self, entry: LeaderboardEntry) -> None:
        """Insert or update the session best for this rig/driver."""
        if not entry.session_id:
            return
        with self._lock:
            conn = self._connect()
            conn.execute(
                """
                INSERT INTO session_best (rig_id, driver_name, car, track, group_name, lap, lap_time_ms, session_id, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(rig_id, session_id) DO UPDATE SET
                       lap_time_ms = CASE
                           WHEN session_best.lap_time_ms IS NULL OR session_best.lap_time_ms <= 0 THEN EXCLUDED.lap_time_ms
                           WHEN EXCLUDED.lap_time_ms > 0 AND (
                               EXCLUDED.lap_time_ms < session_best.lap_time_ms
                           ) THEN EXCLUDED.lap_time_ms
                           ELSE session_best.lap_time_ms
                       END,
                       lap = MAX(session_best.lap, EXCLUDED.lap),
                       driver_name = COALESCE(EXCLUDED.driver_name, session_best.driver_name),
                       car = COALESCE(EXCLUDED.car, session_best.car),
                       track = COALESCE(EXCLUDED.track, session_best.track),
                       group_name = COALESCE(EXCLUDED.group_name, session_best.group_name),
                       timestamp = EXCLUDED.timestamp
                """,
                (
                    entry.rig_id,
                    entry.driver_name,
                    entry.car,
                    entry.track,
                    entry.group_name,
                    entry.lap,
                    entry.lap_time_ms,
                    entry.session_id,
                    entry.timestamp,
                ),
            )
            conn.commit()
            conn.close()

    def _rows_to_entries(self, rows: list[sqlite3.Row]) -> list[LeaderboardEntry]:
        return [
            LeaderboardEntry(
                id=dict(r).get("id"),
                rig_id=r["rig_id"],
                driver_name=r["driver_name"],
                car=r["car"],
                track=r["track"],
                group_name=r["group_name"],
                lap=r["lap"],
                lap_time_ms=r["lap_time_ms"],
                session_id=r["session_id"],
                timestamp=r["timestamp"],
            )
            for r in rows
        ]

    def delete_record(self, record_id: int) -> bool:
        """Delete a specific record from laps and clean up session_best if applicable."""
        conn = self._connect()
        row = conn.execute("SELECT * FROM laps WHERE id = ?", (record_id,)).fetchone()
        if not row:
            conn.close()
            return False

        conn.execute("DELETE FROM laps WHERE id = ?", (record_id,))

        # Recompute or remove from session_best
        if row["session_id"] and row["rig_id"]:
            best_remaining = conn.execute(
                """SELECT * FROM laps 
                   WHERE rig_id = ? AND session_id = ? AND lap_time_ms IS NOT NULL AND lap_time_ms > 0
                   ORDER BY lap_time_ms ASC LIMIT 1""",
                (row["rig_id"], row["session_id"]),
            ).fetchone()
            if best_remaining:
                conn.execute(
                    """UPDATE session_best SET
                           lap_time_ms = ?,
                           lap = ?,
                           timestamp = ?
                       WHERE rig_id = ? AND session_id = ?""",
                    (
                        best_remaining["lap_time_ms"],
                        best_remaining["lap"],
                        best_remaining["timestamp"],
                        row["rig_id"],
                        row["session_id"],
                    ),
                )
            else:
                conn.execute(
                    "DELETE FROM session_best WHERE rig_id = ? AND session_id = ?",
                    (row["rig_id"], row["session_id"]),
                )

        conn.commit()
        conn.close()
        return True

    def clear_leaderboard(self) -> None:
        """Clear all records from laps and session_best."""
        conn = self._connect()
        conn.execute("DELETE FROM laps")
        conn.execute("DELETE FROM session_best")
        conn.commit()
        conn.close()

    def delete_by_match(
        self,
        rig_id: str,
        track: str | None = None,
        session_id: str | None = None,
        lap_time_ms: int | None = None,
    ) -> bool:
        """Fallback deletion by matching fields if direct ID is unknown."""
        conn = self._connect()
        query = "SELECT id FROM laps WHERE (rig_id = ? OR driver_name = ?)"
        params: list[object] = [rig_id, rig_id]
        if track:
            query += " AND track = ?"
            params.append(track)
        if session_id:
            query += " AND session_id = ?"
            params.append(session_id)
        if lap_time_ms:
            query += " AND lap_time_ms = ?"
            params.append(lap_time_ms)
        query += " ORDER BY id DESC LIMIT 1"
        row = conn.execute(query, tuple(params)).fetchone()
        conn.close()
        if row:
            return self.delete_record(row["id"])

        conn = self._connect()
        conn.execute("DELETE FROM session_best WHERE (rig_id = ? OR driver_name = ?)", (rig_id, rig_id))
        conn.commit()
        conn.close()
        return True

    def get_all(self, limit: int = 200) -> list[LeaderboardEntry]:
        """Get all entries, returning only the fastest lap per driver per track."""
        conn = self._connect()
        rows = conn.execute(
            """SELECT * FROM laps 
               WHERE lap_time_ms IS NOT NULL AND lap_time_ms > 0
               GROUP BY track, COALESCE(driver_name, rig_id) 
               HAVING lap_time_ms = MIN(lap_time_ms) 
               ORDER BY timestamp DESC LIMIT ?""", 
            (limit,)
        ).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def get_by_track(self, track: str, limit: int = 100) -> list[LeaderboardEntry]:
        """Get entries filtered by track, returning only the fastest lap per driver."""
        conn = self._connect()
        rows = conn.execute(
            """SELECT * FROM laps 
               WHERE track = ? AND lap_time_ms IS NOT NULL AND lap_time_ms > 0
               GROUP BY COALESCE(driver_name, rig_id) 
               HAVING lap_time_ms = MIN(lap_time_ms) 
               ORDER BY lap_time_ms ASC LIMIT ?""",
            (track, limit),
        ).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def get_by_session(self, session_id: str) -> list[LeaderboardEntry]:
        """Get entries for a specific session."""
        conn = self._connect()
        rows = conn.execute(
            "SELECT * FROM laps WHERE session_id = ? ORDER BY lap DESC",
            (session_id,),
        ).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def get_recent_session(self) -> list[LeaderboardEntry]:
        """Get entries from the most recent session."""
        conn = self._connect()
        row = conn.execute(
            "SELECT session_id FROM laps WHERE session_id IS NOT NULL ORDER BY timestamp DESC LIMIT 1"
        ).fetchone()
        if not row:
            conn.close()
            return []
        rows = conn.execute(
            "SELECT * FROM laps WHERE session_id = ? ORDER BY lap DESC",
            (row["session_id"],),
        ).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def get_best_per_track(self) -> list[LeaderboardEntry]:
        """Get the best lap (highest lap count) per rig per track."""
        conn = self._connect()
        rows = conn.execute(
            """SELECT * FROM laps l1
               WHERE lap = (SELECT MAX(lap) FROM laps l2
                            WHERE l2.rig_id = l1.rig_id AND l2.track = l1.track)
               ORDER BY track, lap DESC"""
        ).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def get_session_best(self, session_id: str | None = None, limit: int = 50) -> list[LeaderboardEntry]:
        """Get session-best entries (one per driver, fastest lap only)."""
        conn = self._connect()
        if session_id:
            query = """
                SELECT sb.rig_id, sb.driver_name, sb.car, sb.track, sb.group_name,
                       sb.lap, sb.lap_time_ms, sb.session_id, sb.timestamp,
                       (SELECT l.id FROM laps l 
                        WHERE l.rig_id = sb.rig_id AND l.session_id = sb.session_id AND l.lap_time_ms = sb.lap_time_ms 
                        ORDER BY l.id DESC LIMIT 1) as id
                FROM session_best sb
                WHERE sb.session_id = ?
                ORDER BY CASE WHEN sb.lap_time_ms IS NULL THEN 1 ELSE 0 END,
                         sb.lap_time_ms ASC
                LIMIT ?
            """
            rows = conn.execute(query, (session_id, limit)).fetchall()
        else:
            row = conn.execute(
                "SELECT session_id FROM session_best WHERE session_id IS NOT NULL ORDER BY timestamp DESC LIMIT 1"
            ).fetchone()
            if not row:
                conn.close()
                return []
            query = """
                SELECT sb.rig_id, sb.driver_name, sb.car, sb.track, sb.group_name,
                       sb.lap, sb.lap_time_ms, sb.session_id, sb.timestamp,
                       (SELECT l.id FROM laps l 
                        WHERE l.rig_id = sb.rig_id AND l.session_id = sb.session_id AND l.lap_time_ms = sb.lap_time_ms 
                        ORDER BY l.id DESC LIMIT 1) as id
                FROM session_best sb
                WHERE sb.session_id = ?
                ORDER BY CASE WHEN sb.lap_time_ms IS NULL THEN 1 ELSE 0 END,
                         sb.lap_time_ms ASC
                LIMIT ?
            """
            rows = conn.execute(query, (row["session_id"], limit)).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def get_session_best_all(self, track: str | None = None, sort_desc: bool = False, limit: int = 100) -> list[LeaderboardEntry]:
        """Get all session-best entries across all sessions. Supports track filtering and sorting."""
        conn = self._connect()
        query = """
            SELECT sb.rig_id, sb.driver_name, sb.car, sb.track, sb.group_name,
                   sb.lap, sb.lap_time_ms, sb.session_id, sb.timestamp,
                   (SELECT l.id FROM laps l 
                    WHERE l.rig_id = sb.rig_id AND l.session_id = sb.session_id AND l.lap_time_ms = sb.lap_time_ms 
                    ORDER BY l.id DESC LIMIT 1) as id
            FROM session_best sb
            WHERE sb.lap_time_ms IS NOT NULL AND sb.lap_time_ms > 0
        """
        params: list[object] = []
        if track:
            query += " AND sb.track = ?"
            params.append(track)

        order_dir = "DESC" if sort_desc else "ASC"
        query += f" ORDER BY sb.lap_time_ms {order_dir} LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, tuple(params)).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def get_today_best(self, track: str | None = None, sort_desc: bool = False, limit: int = 100) -> list[LeaderboardEntry]:
        """Get best entries from the current day."""
        import time
        from datetime import datetime, time as datetime_time

        today = datetime.combine(datetime.today(), datetime_time.min)
        start_of_today = today.timestamp()

        conn = self._connect()
        query = """
            SELECT sb.rig_id, sb.driver_name, sb.car, sb.track, sb.group_name,
                   sb.lap, sb.lap_time_ms, sb.session_id, sb.timestamp,
                   (SELECT l.id FROM laps l 
                    WHERE l.rig_id = sb.rig_id AND l.session_id = sb.session_id AND l.lap_time_ms = sb.lap_time_ms 
                    ORDER BY l.id DESC LIMIT 1) as id
            FROM session_best sb
            WHERE sb.timestamp >= ? AND sb.lap_time_ms IS NOT NULL AND sb.lap_time_ms > 0
        """
        params: list[object] = [start_of_today]

        if track:
            query += " AND sb.track = ?"
            params.append(track)

        order_dir = "DESC" if sort_desc else "ASC"
        query += f" ORDER BY sb.lap_time_ms {order_dir} LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, tuple(params)).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def get_hall_of_fame(self, limit: int = 10) -> list[dict[str, object]]:
        """Get drivers ranked by the number of times they've recorded a session-best fastest lap.
        
        This acts as a 'Hall of Fame' metric showing consistently fast drivers.
        """
        conn = self._connect()
        rows = conn.execute(
            """SELECT COALESCE(driver_name, rig_id) as driver, COUNT(*) as fastest_laps
               FROM session_best
               WHERE lap_time_ms IS NOT NULL AND lap_time_ms > 0
               GROUP BY COALESCE(driver_name, rig_id)
               ORDER BY fastest_laps DESC
               LIMIT ?""",
            (limit,)
        ).fetchall()
        conn.close()
        return [{"driver": r["driver"], "fastest_laps": r["fastest_laps"]} for r in rows]
