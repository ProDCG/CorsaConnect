"""Unit tests for leaderboard_db."""

import tempfile
from datetime import datetime, timedelta
from pathlib import Path

from apps.orchestrator.services.leaderboard_db import LeaderboardDB

from shared.models import LeaderboardEntry


def test_leaderboard_filtering_and_dethrone():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        db = LeaderboardDB(db_path)

        now = datetime.now()

        # Insert some records
        e1 = LeaderboardEntry(
            rig_id="RIG-1",
            driver_name="Alice",
            car="Ferrari",
            track="Monza",
            weather="Sunny",
            session_type="race",
            lap=5,
            lap_time_ms=100000,
            session_id="S1",
            timestamp=(now - timedelta(days=2)).timestamp(),
        )
        db.insert(e1)

        e2 = LeaderboardEntry(
            rig_id="RIG-2",
            driver_name="Bob",
            car="Ferrari",
            track="Monza",
            weather="Sunny",
            session_type="race",
            lap=5,
            lap_time_ms=90000,
            session_id="S1",
            timestamp=(now - timedelta(hours=2)).timestamp(),
        )
        db.insert(e2)

        e3 = LeaderboardEntry(
            rig_id="RIG-3",
            driver_name="Charlie",
            car="Porsche",
            track="Monza",
            weather="Rain",
            session_type="race",
            lap=3,
            lap_time_ms=110000,
            session_id="S2",
            timestamp=now.timestamp(),
        )
        db.insert(e3)

        # Test filtering by track
        res = db.get_filtered_leaderboard(track="Monza")
        assert len(res) == 3
        # Should be ordered by lap_time_ms ASC
        assert res[0].driver_name == "Bob"
        assert res[1].driver_name == "Alice"
        assert res[2].driver_name == "Charlie"

        # Test filtering by car
        res = db.get_filtered_leaderboard(car="Ferrari")
        assert len(res) == 2

        # Test filtering by weather
        res = db.get_filtered_leaderboard(weather="Rain")
        assert len(res) == 1
        assert res[0].driver_name == "Charlie"

        # Test time window 'day'
        res = db.get_filtered_leaderboard(time_window="day")
        # Alice is 2 days old, so only Bob and Charlie
        assert len(res) == 2
        names = {r.driver_name for r in res}
        assert names == {"Bob", "Charlie"}

        # Test limit
        res = db.get_filtered_leaderboard(limit=1)
        assert len(res) == 1
        assert res[0].driver_name == "Bob"


def test_session_best_and_hall_of_fame():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        db = LeaderboardDB(db_path)

        entry1 = LeaderboardEntry(
            rig_id="RIG-1",
            driver_name="Dave",
            car="Porsche",
            track="Spa",
            lap=10,
            lap_time_ms=80000,
            session_id="S1",
            timestamp=datetime.now().timestamp(),
        )
        db.insert(entry1)
        db.upsert_session_best(entry1)

        entry2 = LeaderboardEntry(
            rig_id="RIG-1",
            driver_name="Dave",
            car="Porsche",
            track="Spa",
            lap=12,
            lap_time_ms=75000,
            session_id="S1",
            timestamp=datetime.now().timestamp(),
        )
        db.insert(entry2)
        db.upsert_session_best(entry2)

        # Spa session best for Dave should be 75000 (faster)
        best = db.get_session_best(session_id="S1")
        assert len(best) == 1
        assert best[0].lap_time_ms == 75000

        # Test hall of fame
        hof = db.get_hall_of_fame(limit=5)
        assert len(hof) == 1
        assert hof[0]["driver"] == "Dave"
        assert hof[0]["fastest_laps"] == 1


def test_today_best():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        db = LeaderboardDB(db_path)

        now = datetime.now()
        entry_today = LeaderboardEntry(
            rig_id="RIG-1",
            driver_name="Eve",
            car="McLaren",
            track="Spa",
            lap=5,
            lap_time_ms=85000,
            session_id="S_TODAY",
            timestamp=now.timestamp(),
        )
        db.insert(entry_today)
        db.upsert_session_best(entry_today)

        # 2 days ago
        entry_past = LeaderboardEntry(
            rig_id="RIG-2",
            driver_name="Frank",
            car="McLaren",
            track="Spa",
            lap=5,
            lap_time_ms=82000,
            session_id="S_PAST",
            timestamp=(now - timedelta(days=2)).timestamp(),
        )
        db.insert(entry_past)
        db.upsert_session_best(entry_past)

        # get_today_best should only return Eve
        res = db.get_today_best(track="Spa")
        assert len(res) == 1
        assert res[0].driver_name == "Eve"


if __name__ == "__main__":
    test_leaderboard_filtering_and_dethrone()
