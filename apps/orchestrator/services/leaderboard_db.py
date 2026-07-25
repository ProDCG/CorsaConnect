"""SQLite-backed leaderboard persistence.

Stores lap records so the leaderboard survives orchestrator restarts.
Uses Python's built-in sqlite3 — no additional dependencies required.
"""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path
from typing import Any

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

            # Migration: add new columns if missing
            for table in ("laps", "session_best"):
                columns = [
                    "driver_email TEXT",
                    "driver_phone TEXT",
                    "weather TEXT",
                    "session_type TEXT",
                    "notification_pending BOOLEAN DEFAULT 0",
                ]
                for col in columns:
                    try:
                        conn.execute(f"ALTER TABLE {table} ADD COLUMN {col};")
                    except sqlite3.OperationalError:
                        pass

            conn.commit()
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
                """INSERT INTO laps (rig_id, driver_name, driver_email, driver_phone, car, track, weather, group_name, session_type, lap, lap_time_ms, session_id, timestamp, notification_pending)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    entry.rig_id,
                    entry.driver_name,
                    entry.driver_email,
                    entry.driver_phone,
                    entry.car,
                    entry.track,
                    entry.weather,
                    entry.group_name,
                    entry.session_type,
                    entry.lap,
                    entry.lap_time_ms,
                    entry.session_id,
                    entry.timestamp,
                    entry.notification_pending,
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
                INSERT INTO session_best (rig_id, driver_name, driver_email, driver_phone, car, track, weather, group_name, session_type, lap, lap_time_ms, session_id, timestamp, notification_pending)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                       driver_email = COALESCE(EXCLUDED.driver_email, session_best.driver_email),
                       driver_phone = COALESCE(EXCLUDED.driver_phone, session_best.driver_phone),
                       car = COALESCE(EXCLUDED.car, session_best.car),
                       track = COALESCE(EXCLUDED.track, session_best.track),
                       weather = COALESCE(EXCLUDED.weather, session_best.weather),
                       group_name = COALESCE(EXCLUDED.group_name, session_best.group_name),
                       session_type = COALESCE(EXCLUDED.session_type, session_best.session_type),
                       timestamp = EXCLUDED.timestamp,
                       notification_pending = EXCLUDED.notification_pending
                """,
                (
                    entry.rig_id,
                    entry.driver_name,
                    entry.driver_email,
                    entry.driver_phone,
                    entry.car,
                    entry.track,
                    entry.weather,
                    entry.group_name,
                    entry.session_type,
                    entry.lap,
                    entry.lap_time_ms,
                    entry.session_id,
                    entry.timestamp,
                    entry.notification_pending,
                ),
            )
            conn.commit()
            conn.close()

    def _rows_to_entries(self, rows: list[sqlite3.Row]) -> list[LeaderboardEntry]:
        def get_col(r: sqlite3.Row, col: str, default: Any = None) -> Any:
            return r[col] if col in r.keys() else default

        return [
            LeaderboardEntry(
                id=get_col(r, "id"),
                rig_id=r["rig_id"],
                driver_name=get_col(r, "driver_name"),
                driver_email=get_col(r, "driver_email"),
                driver_phone=get_col(r, "driver_phone"),
                car=get_col(r, "car"),
                track=get_col(r, "track"),
                weather=get_col(r, "weather"),
                group_name=get_col(r, "group_name"),
                session_type=get_col(r, "session_type"),
                lap=r["lap"],
                lap_time_ms=r["lap_time_ms"],
                session_id=get_col(r, "session_id"),
                timestamp=r["timestamp"],
                notification_pending=bool(get_col(r, "notification_pending", False)),
            )
            for r in rows
        ]

    def delete_record(self, record_id: int) -> bool:
        """Delete a specific record from laps. Does not affect session_best for simplicity."""
        conn = self._connect()
        cursor = conn.execute("DELETE FROM laps WHERE id = ?", (record_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

    def clear_leaderboard(self) -> None:
        """Clear all records from laps and session_best."""
        conn = self._connect()
        conn.execute("DELETE FROM laps")
        conn.execute("DELETE FROM session_best")
        conn.commit()
        conn.close()

    def get_all(self, limit: int = 200) -> list[LeaderboardEntry]:
        """Get all entries, returning only the fastest lap per driver per track."""
        conn = self._connect()
        rows = conn.execute(
            """SELECT * FROM laps
               WHERE lap_time_ms IS NOT NULL AND lap_time_ms > 0
               GROUP BY track, COALESCE(driver_name, rig_id)
               HAVING lap_time_ms = MIN(lap_time_ms)
               ORDER BY timestamp DESC LIMIT ?""",
            (limit,),
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

    def get_filtered_leaderboard(
        self,
        track: str | None = None,
        car: str | None = None,
        weather: str | None = None,
        time_window: str | None = None,
        limit: int = 100,
    ) -> list[LeaderboardEntry]:
        from datetime import datetime, timedelta

        conn = self._connect()
        query = "SELECT * FROM laps WHERE lap_time_ms IS NOT NULL AND lap_time_ms > 0"
        params: list[Any] = []

        if track:
            query += " AND track = ?"
            params.append(track)
        if car:
            query += " AND car = ?"
            params.append(car)
        if weather:
            query += " AND weather = ?"
            params.append(weather)

        if time_window and time_window != "all_time":
            now = datetime.now()
            if time_window == "day":
                threshold = now - timedelta(days=1)
            elif time_window == "week":
                threshold = now - timedelta(weeks=1)
            elif time_window == "month":
                threshold = now - timedelta(days=30)
            elif time_window == "6_months":
                threshold = now - timedelta(days=180)
            elif time_window == "year":
                threshold = now - timedelta(days=365)
            else:
                threshold = None

            if threshold:
                query += " AND timestamp >= ?"
                params.append(threshold.timestamp())

        # Get best lap per driver given the filters
        query += " GROUP BY COALESCE(driver_name, rig_id) HAVING lap_time_ms = MIN(lap_time_ms) ORDER BY lap_time_ms ASC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, tuple(params)).fetchall()
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
            rows = conn.execute(
                """SELECT * FROM session_best
                   WHERE session_id = ?
                   ORDER BY CASE WHEN lap_time_ms IS NULL THEN 1 ELSE 0 END,
                            lap_time_ms ASC
                   LIMIT ?""",
                (session_id, limit),
            ).fetchall()
        else:
            row = conn.execute(
                "SELECT session_id FROM session_best WHERE session_id IS NOT NULL ORDER BY timestamp DESC LIMIT 1"
            ).fetchone()
            if not row:
                conn.close()
                return []
            rows = conn.execute(
                """SELECT * FROM session_best
                   WHERE session_id = ?
                   ORDER BY CASE WHEN lap_time_ms IS NULL THEN 1 ELSE 0 END,
                            lap_time_ms ASC
                   LIMIT ?""",
                (row["session_id"], limit),
            ).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def get_session_best_all(
        self, track: str | None = None, sort_desc: bool = False, limit: int = 100
    ) -> list[LeaderboardEntry]:
        """Get all session-best entries across all sessions. Supports track filtering and sorting."""
        conn = self._connect()
        query = "SELECT * FROM session_best WHERE lap_time_ms IS NOT NULL AND lap_time_ms > 0"
        params: list[Any] = []
        if track:
            query += " AND track = ?"
            params.append(track)

        order_dir = "DESC" if sort_desc else "ASC"
        query += f" ORDER BY lap_time_ms {order_dir} LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, tuple(params)).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def get_today_best(
        self, track: str | None = None, sort_desc: bool = False, limit: int = 100
    ) -> list[LeaderboardEntry]:
        """Get best entries from the current day."""
        from datetime import datetime
        from datetime import time as datetime_time

        # Get start of today (midnight) as unix timestamp
        today = datetime.combine(datetime.today(), datetime_time.min)
        start_of_today = today.timestamp()

        conn = self._connect()
        query = "SELECT * FROM session_best WHERE timestamp >= ? AND lap_time_ms IS NOT NULL AND lap_time_ms > 0"
        params: list[Any] = [start_of_today]

        if track:
            query += " AND track = ?"
            params.append(track)

        order_dir = "DESC" if sort_desc else "ASC"
        query += f" ORDER BY lap_time_ms {order_dir} LIMIT ?"
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
            (limit,),
        ).fetchall()
        conn.close()
        return [{"driver": r["driver"], "fastest_laps": r["fastest_laps"]} for r in rows]
