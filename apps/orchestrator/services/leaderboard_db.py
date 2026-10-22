"""SQLite-backed leaderboard persistence.

Stores lap records so the leaderboard survives orchestrator restarts.
Uses Python's built-in sqlite3 — no additional dependencies required.
"""

from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path

from shared.models import LeaderboardEntry

_SCHEMA = """
CREATE TABLE IF NOT EXISTS laps (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    rig_id        TEXT NOT NULL,
    driver_name   TEXT,
    car           TEXT,
    track         TEXT,
    track_layout  TEXT,
    group_name    TEXT,
    lap           INTEGER NOT NULL DEFAULT 0,
    lap_time_ms   INTEGER,
    session_id    TEXT,
    source_lap_id TEXT,
    timestamp     REAL NOT NULL,
    driver_email  TEXT,
    driver_phone  TEXT,
    driver_uuid   TEXT,
    weather       TEXT,
    session_type  TEXT,
    notification_pending BOOLEAN DEFAULT 0,
    is_valid      BOOLEAN DEFAULT 1,
    synced_to_ridge BOOLEAN DEFAULT 0
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

CREATE TABLE IF NOT EXISTS drivers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_uuid   TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    email         TEXT UNIQUE,
    phone         TEXT,
    created_at    REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ridge_sessions (
    session_id    TEXT PRIMARY KEY,
    group_id      TEXT,
    group_name    TEXT,
    track         TEXT,
    track_layout  TEXT,
    status        TEXT NOT NULL DEFAULT 'created',
    last_error    TEXT,
    synced_laps   INTEGER DEFAULT 0,
    duplicate_laps INTEGER DEFAULT 0,
    created_at    REAL NOT NULL,
    updated_at    REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ridge_checkins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL,
    rig_id        TEXT NOT NULL,
    raw_token     TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    driver_uuid   TEXT,
    driver_name   TEXT,
    driver_email  TEXT,
    expires_at    REAL,
    claimed_at    REAL,
    created_at    REAL NOT NULL,
    UNIQUE(session_id, rig_id)
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
            # Run column migrations if laps existed before newer columns
            for col, col_type in [
                ("driver_email", "TEXT"),
                ("driver_phone", "TEXT"),
                ("driver_uuid", "TEXT"),
                ("weather", "TEXT"),
                ("session_type", "TEXT"),
                ("notification_pending", "BOOLEAN DEFAULT 0"),
                ("is_valid", "BOOLEAN DEFAULT 1"),
                ("track_layout", "TEXT"),
                ("source_lap_id", "TEXT"),
                ("synced_to_ridge", "BOOLEAN DEFAULT 0"),
            ]:
                try:
                    conn.execute(f"ALTER TABLE laps ADD COLUMN {col} {col_type}")
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
        source_lap_id = entry.source_lap_id
        if not source_lap_id:
            sid_clean = (entry.session_id or "nosess")[:24]
            source_lap_id = f"lap-{entry.rig_id}-{sid_clean}-L{entry.lap}-{int(entry.timestamp * 1000)}"[:128]
            entry.source_lap_id = source_lap_id

        with self._lock:
            conn = self._connect()
            conn.execute(
                """INSERT INTO laps (rig_id, driver_name, car, track, track_layout, group_name, lap, lap_time_ms,
                                     session_id, source_lap_id, timestamp, driver_email, driver_phone, driver_uuid,
                                     weather, session_type, notification_pending, is_valid, synced_to_ridge)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    entry.rig_id,
                    entry.driver_name,
                    entry.car,
                    entry.track,
                    entry.track_layout,
                    entry.group_name,
                    entry.lap,
                    entry.lap_time_ms,
                    entry.session_id,
                    entry.source_lap_id,
                    entry.timestamp,
                    entry.driver_email,
                    entry.driver_phone,
                    entry.driver_uuid,
                    entry.weather,
                    entry.session_type,
                    1 if entry.notification_pending else 0,
                    1 if entry.is_valid else 0,
                    1 if entry.synced_to_ridge else 0,
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
                driver_email=dict(r).get("driver_email"),
                driver_phone=dict(r).get("driver_phone"),
                driver_uuid=dict(r).get("driver_uuid"),
                car=r["car"],
                track=r["track"],
                track_layout=dict(r).get("track_layout"),
                weather=dict(r).get("weather"),
                group_name=r["group_name"],
                session_type=dict(r).get("session_type"),
                lap=r["lap"],
                lap_time_ms=r["lap_time_ms"],
                session_id=r["session_id"],
                source_lap_id=dict(r).get("source_lap_id"),
                timestamp=r["timestamp"],
                notification_pending=bool(dict(r).get("notification_pending", 0)),
                is_valid=bool(dict(r).get("is_valid", 1) if dict(r).get("is_valid") is not None else True),
                synced_to_ridge=bool(dict(r).get("synced_to_ridge", 0)),
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

    def get_session_standings(self, session_id: str) -> dict[str, object] | None:
        """Get full standings and driver breakdown for a specific session."""
        if not session_id:
            return None

        conn = self._connect()

        # Find session info (track, group_name, started_at)
        s_row = conn.execute(
            """SELECT track, group_name, MIN(timestamp) as started_at 
               FROM laps WHERE session_id = ?""", 
            (session_id,)
        ).fetchone()

        track = s_row["track"] if (s_row and s_row["track"]) else None
        group_name = s_row["group_name"] if (s_row and s_row["group_name"]) else None
        started_at = s_row["started_at"] if (s_row and s_row["started_at"]) else None

        # Query all drivers in this session with best lap and total laps
        query = """
            SELECT 
                rig_id,
                driver_name,
                car,
                track,
                group_name,
                MIN(lap_time_ms) as best_lap_time_ms,
                MAX(lap) as total_laps,
                MAX(timestamp) as last_lap_timestamp
            FROM laps
            WHERE session_id = ? AND lap_time_ms IS NOT NULL AND lap_time_ms > 0
            GROUP BY rig_id
            ORDER BY best_lap_time_ms ASC
        """
        rows = conn.execute(query, (session_id,)).fetchall()

        if not rows:
            # Fallback: check session_best table for this session
            rows = conn.execute(
                """SELECT rig_id, driver_name, car, track, group_name, 
                          lap_time_ms as best_lap_time_ms, lap as total_laps, timestamp as last_lap_timestamp
                   FROM session_best
                   WHERE session_id = ? AND lap_time_ms IS NOT NULL AND lap_time_ms > 0
                   ORDER BY best_lap_time_ms ASC""",
                (session_id,),
            ).fetchall()

        conn.close()

        if not rows:
            return None

        p1_best = rows[0]["best_lap_time_ms"]
        drivers: list[dict[str, object]] = []

        for idx, r in enumerate(rows):
            best_ms = r["best_lap_time_ms"]
            gap_ms = (best_ms - p1_best) if (best_ms and p1_best) else 0
            drivers.append({
                "position": idx + 1,
                "driver_name": r["driver_name"],
                "rig_id": r["rig_id"],
                "car": r["car"],
                "track": r["track"] or track,
                "group_name": r["group_name"] or group_name,
                "best_lap_time_ms": best_ms,
                "gap_ms": gap_ms,
                "total_laps": r["total_laps"] or 0,
                "last_lap_time_ms": best_ms,
                "timestamp": r["last_lap_timestamp"],
            })

        return {
            "session_id": session_id,
            "track": track or (rows[0]["track"] if rows else None),
            "group_name": group_name or (rows[0]["group_name"] if rows else None),
            "started_at": started_at,
            "drivers": drivers,
        }

    def get_recent_session_ids(self, limit: int = 5, max_age_seconds: int = 180) -> list[str]:
        """Get distinct recent session IDs within max_age_seconds ordered by latest lap timestamp."""
        conn = self._connect()
        cutoff = time.time() - max_age_seconds
        rows = conn.execute(
            """SELECT session_id, MAX(timestamp) as latest_ts 
               FROM laps 
               WHERE session_id IS NOT NULL AND session_id != ''
               GROUP BY session_id 
               HAVING latest_ts >= ?
               ORDER BY latest_ts DESC 
               LIMIT ?""",
            (cutoff, limit),
        ).fetchall()
        conn.close()
        return [r["session_id"] for r in rows if r["session_id"]]

    def get_filtered_leaderboard(
        self,
        track: str | None = None,
        car: str | None = None,
        weather: str | None = None,
        time_window: str | None = None,
        limit: int = 100,
    ) -> list[LeaderboardEntry]:
        """Query leaderboard with multi-parameter filtering and time windows."""
        from datetime import datetime, timedelta

        conn = self._connect()
        query = "SELECT * FROM laps WHERE lap_time_ms IS NOT NULL AND lap_time_ms > 0"
        params: list[object] = []

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
            threshold = None
            if time_window == "day":
                threshold = now - timedelta(days=1)
            elif time_window == "week":
                threshold = now - timedelta(weeks=1)
            elif time_window == "month":
                threshold = now - timedelta(days=30)
            elif time_window == "year":
                threshold = now - timedelta(days=365)

            if threshold:
                query += " AND timestamp >= ?"
                params.append(threshold.timestamp())

        query += " ORDER BY lap_time_ms ASC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, tuple(params)).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def get_drivers(self) -> list[dict[str, object]]:
        """Return all registered drivers."""
        conn = self._connect()
        rows = conn.execute("SELECT * FROM drivers ORDER BY display_name ASC").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def upsert_driver(
        self,
        display_name: str,
        email: str | None = None,
        phone: str | None = None,
        driver_uuid: str | None = None,
    ) -> dict[str, object]:
        """Insert or update a registered driver."""
        import uuid as _uuid
        with self._lock:
            conn = self._connect()
            uuid_val = driver_uuid or f"drv_{_uuid.uuid4().hex[:8]}"
            now = time.time()
            # If email already exists with a different driver_uuid, update that row or handle gracefully
            if email:
                existing_by_email = conn.execute(
                    "SELECT driver_uuid FROM drivers WHERE email = ?", (email,)
                ).fetchone()
                if existing_by_email and existing_by_email["driver_uuid"] != uuid_val:
                    if driver_uuid:
                        # Authoritative server UUID wins — update the existing row's driver_uuid
                        conn.execute(
                            "UPDATE drivers SET driver_uuid = ?, display_name = ?, phone = COALESCE(?, phone) WHERE email = ?",
                            (uuid_val, display_name, phone, email),
                        )
                        conn.commit()
                        row = conn.execute("SELECT * FROM drivers WHERE driver_uuid = ?", (uuid_val,)).fetchone()
                        conn.close()
                        return dict(row) if row else {"driver_uuid": uuid_val, "display_name": display_name}
                    else:
                        uuid_val = str(existing_by_email["driver_uuid"])

            conn.execute(
                """INSERT INTO drivers (driver_uuid, display_name, email, phone, created_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(driver_uuid) DO UPDATE SET
                       display_name = excluded.display_name,
                       email = COALESCE(excluded.email, drivers.email),
                       phone = COALESCE(excluded.phone, drivers.phone)""",
                (uuid_val, display_name, email, phone, now),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM drivers WHERE driver_uuid = ?", (uuid_val,)).fetchone()
            conn.close()
            return dict(row) if row else {"driver_uuid": uuid_val, "display_name": display_name}

    def delete_driver(self, driver_uuid: str) -> bool:
        """Delete a registered driver by UUID."""
        conn = self._connect()
        conn.execute("DELETE FROM drivers WHERE driver_uuid = ?", (driver_uuid,))
        conn.commit()
        conn.close()
        return True

    def get_raw_laps(
        self,
        track: str | None = None,
        car: str | None = None,
        driver_name: str | None = None,
        is_valid: bool | None = None,
        limit: int = 150,
        offset: int = 0,
    ) -> list[LeaderboardEntry]:
        """Fetch raw lap entries with optional filtering, search, and pagination."""
        conn = self._connect()
        query = "SELECT * FROM laps WHERE 1=1"
        params: list[object] = []
        if track:
            query += " AND track = ?"
            params.append(track)
        if car:
            query += " AND car = ?"
            params.append(car)
        if driver_name:
            query += " AND (driver_name LIKE ? OR rig_id LIKE ?)"
            params.append(f"%{driver_name}%")
            params.append(f"%{driver_name}%")
        if is_valid is not None:
            query += " AND is_valid = ?"
            params.append(1 if is_valid else 0)
        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = conn.execute(query, tuple(params)).fetchall()
        conn.close()
        return self._rows_to_entries(rows)

    def toggle_lap_validity(self, lap_id: int) -> bool:
        """Toggle the is_valid status of a specific lap record."""
        conn = self._connect()
        row = conn.execute("SELECT is_valid FROM laps WHERE id = ?", (lap_id,)).fetchone()
        if not row:
            conn.close()
            return False
        new_val = 0 if row["is_valid"] else 1
        conn.execute("UPDATE laps SET is_valid = ? WHERE id = ?", (new_val, lap_id))
        conn.commit()
        conn.close()
        return True

    # ------------------------------------------------------------------
    # Ridge Sim Racing API Sync & Check-in Persistence
    # ------------------------------------------------------------------

    def upsert_ridge_session(
        self,
        session_id: str,
        group_id: str | None = None,
        group_name: str | None = None,
        track: str | None = None,
        track_layout: str | None = None,
        status: str = "created",
        last_error: str | None = None,
    ) -> dict[str, object]:
        now = time.time()
        with self._lock:
            conn = self._connect()
            conn.execute(
                """INSERT INTO ridge_sessions (session_id, group_id, group_name, track, track_layout, status, last_error, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(session_id) DO UPDATE SET
                       group_id = COALESCE(excluded.group_id, ridge_sessions.group_id),
                       group_name = COALESCE(excluded.group_name, ridge_sessions.group_name),
                       track = COALESCE(excluded.track, ridge_sessions.track),
                       track_layout = COALESCE(excluded.track_layout, ridge_sessions.track_layout),
                       status = excluded.status,
                       last_error = excluded.last_error,
                       updated_at = excluded.updated_at""",
                (session_id, group_id, group_name, track, track_layout, status, last_error, now, now),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM ridge_sessions WHERE session_id = ?", (session_id,)).fetchone()
            conn.close()
            return dict(row) if row else {"session_id": session_id, "status": status}

    def update_ridge_session_counts(self, session_id: str, inserted_laps: int = 0, duplicate_laps: int = 0, status: str | None = None, last_error: str | None = None) -> None:
        now = time.time()
        with self._lock:
            conn = self._connect()
            if status:
                conn.execute(
                    """UPDATE ridge_sessions SET
                           synced_laps = COALESCE(synced_laps, 0) + ?,
                           duplicate_laps = COALESCE(duplicate_laps, 0) + ?,
                           status = ?,
                           last_error = ?,
                           updated_at = ?
                       WHERE session_id = ?""",
                    (inserted_laps, duplicate_laps, status, last_error, now, session_id),
                )
            else:
                conn.execute(
                    """UPDATE ridge_sessions SET
                           synced_laps = COALESCE(synced_laps, 0) + ?,
                           duplicate_laps = COALESCE(duplicate_laps, 0) + ?,
                           last_error = ?,
                           updated_at = ?
                       WHERE session_id = ?""",
                    (inserted_laps, duplicate_laps, last_error, now, session_id),
                )
            conn.commit()
            conn.close()

    def get_ridge_sessions(self, limit: int = 25) -> list[dict[str, object]]:
        conn = self._connect()
        rows = conn.execute("SELECT * FROM ridge_sessions ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_ridge_session(self, session_id: str) -> dict[str, object] | None:
        conn = self._connect()
        row = conn.execute("SELECT * FROM ridge_sessions WHERE session_id = ?", (session_id,)).fetchone()
        conn.close()
        return dict(row) if row else None

    def upsert_ridge_checkin(
        self,
        session_id: str,
        rig_id: str,
        raw_token: str,
        status: str = "pending",
        expires_at: float | None = None,
    ) -> None:
        now = time.time()
        with self._lock:
            conn = self._connect()
            conn.execute(
                """INSERT INTO ridge_checkins (session_id, rig_id, raw_token, status, expires_at, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(session_id, rig_id) DO UPDATE SET
                       raw_token = excluded.raw_token,
                       status = excluded.status,
                       expires_at = excluded.expires_at""",
                (session_id, rig_id, raw_token, status, expires_at, now),
            )
            conn.commit()
            conn.close()

    def update_ridge_checkin_status(
        self,
        session_id: str,
        rig_id: str,
        status: str,
        driver_uuid: str | None = None,
        driver_name: str | None = None,
        driver_email: str | None = None,
        claimed_at: float | None = None,
        expires_at: float | None = None,
    ) -> None:
        with self._lock:
            conn = self._connect()
            conn.execute(
                """UPDATE ridge_checkins SET
                       status = ?,
                       driver_uuid = COALESCE(?, driver_uuid),
                       driver_name = COALESCE(?, driver_name),
                       driver_email = COALESCE(?, driver_email),
                       claimed_at = COALESCE(?, claimed_at),
                       expires_at = COALESCE(?, expires_at)
                   WHERE session_id = ? AND rig_id = ?""",
                (status, driver_uuid, driver_name, driver_email, claimed_at, expires_at, session_id, rig_id),
            )
            conn.commit()
            conn.close()

    def get_ridge_checkins(self, session_id: str) -> list[dict[str, object]]:
        conn = self._connect()
        rows = conn.execute(
            "SELECT * FROM ridge_checkins WHERE session_id = ? ORDER BY rig_id ASC",
            (session_id,),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_latest_checkin_for_rig(self, rig_id: str) -> dict[str, object] | None:
        conn = self._connect()
        row = conn.execute(
            "SELECT * FROM ridge_checkins WHERE rig_id = ? ORDER BY created_at DESC LIMIT 1",
            (rig_id,),
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    def get_unsynced_laps(self, session_id: str, only_claimed_rigs: list[str] | None = None) -> list[LeaderboardEntry]:
        """Return laps for session_id that have not yet been acknowledged by the Ridge API."""
        conn = self._connect()
        query = """SELECT * FROM laps
                   WHERE session_id = ?
                     AND (synced_to_ridge IS NULL OR synced_to_ridge = 0)
                     AND lap_time_ms IS NOT NULL AND lap_time_ms > 0 AND lap_time_ms <= 86400000"""
        params: list[object] = [session_id]
        if only_claimed_rigs is not None:
            if not only_claimed_rigs:
                conn.close()
                return []
            placeholders = ",".join("?" for _ in only_claimed_rigs)
            query += f" AND rig_id IN ({placeholders})"
            params.extend(only_claimed_rigs)
        query += " ORDER BY id ASC"
        rows = conn.execute(query, tuple(params)).fetchall()
        conn.close()
        entries = self._rows_to_entries(rows)
        # Ensure every entry has a source_lap_id
        for e in entries:
            if not e.source_lap_id:
                sid_clean = (e.session_id or "nosess")[:24]
                e.source_lap_id = f"lap-{e.rig_id}-{sid_clean}-L{e.lap}-{int(e.timestamp * 1000)}"[:128]
                if e.id is not None:
                    with self._lock:
                        c2 = self._connect()
                        c2.execute("UPDATE laps SET source_lap_id = ? WHERE id = ?", (e.source_lap_id, e.id))
                        c2.commit()
                        c2.close()
        return entries

    def mark_laps_synced(self, lap_ids: list[int]) -> None:
        if not lap_ids:
            return
        with self._lock:
            conn = self._connect()
            placeholders = ",".join("?" for _ in lap_ids)
            conn.execute(f"UPDATE laps SET synced_to_ridge = 1 WHERE id IN ({placeholders})", tuple(lap_ids))
            conn.commit()
            conn.close()


