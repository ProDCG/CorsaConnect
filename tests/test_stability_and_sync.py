"""Unit tests for Phase 1 stability fixes: atomic JSON writes, safe robocopy, driver CRUD."""

import os
import tempfile
from pathlib import Path
from unittest.mock import patch

from apps.orchestrator.services.leaderboard_db import LeaderboardDB
from apps.orchestrator.state import AppState
from apps.sled.config import SledConfig
from apps.sled.launcher import sync_mods


def test_atomic_json_save():
    with tempfile.TemporaryDirectory() as tmpdir:
        state = AppState(data_dir=tmpdir)
        test_file = os.path.join(tmpdir, "test_atomic.json")

        # Save data atomically
        data = {"key": "value", "items": [1, 2, 3]}
        state._atomic_save_json(test_file, data)

        assert os.path.exists(test_file)
        assert not os.path.exists(f"{test_file}.tmp")

        # Verify content
        import json
        with open(test_file) as f:
            loaded = json.load(f)
        assert loaded == data


def test_driver_crud():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_drivers.db"
        db = LeaderboardDB(db_path)

        # Upsert driver
        d1 = db.upsert_driver("Mason Stuart", email="mason@example.com", phone="555-1234")
        assert d1["display_name"] == "Mason Stuart"
        assert d1["email"] == "mason@example.com"
        uuid1 = d1["driver_uuid"]

        # List drivers
        drivers = db.get_drivers()
        assert len(drivers) == 1
        assert drivers[0]["driver_uuid"] == uuid1

        # Update driver
        d1_updated = db.upsert_driver("Mason S.", email="mason@example.com", driver_uuid=uuid1)
        assert d1_updated["display_name"] == "Mason S."

        # Delete driver
        assert db.delete_driver(uuid1) is True
        assert len(db.get_drivers()) == 0


def test_safe_robocopy_validation():
    with tempfile.TemporaryDirectory() as tmpdir:
        config = SledConfig(
            admin_shared_folder=os.path.join(tmpdir, "nonexistent_source"),
            local_ac_folder=os.path.join(tmpdir, "local_ac"),
        )

        # Non-existent source should fail safely without executing robocopy
        with patch("apps.sled.launcher.IS_WINDOWS", True):
            assert sync_mods(config) is False

        # Empty source folder should skip copying and prevent wiping
        empty_source = os.path.join(tmpdir, "empty_source")
        os.makedirs(os.path.join(empty_source, "cars"), exist_ok=True)
        config.admin_shared_folder = empty_source

        with patch("apps.sled.launcher.IS_WINDOWS", True), patch("subprocess.run") as mock_sp:
            res = sync_mods(config)
            # Subprocess shouldn't be called because car folder is empty
            assert not mock_sp.called
            assert res is True


def test_raw_laps_and_validity_toggle():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_laps.db"
        db = LeaderboardDB(db_path)

        from shared.models import LeaderboardEntry
        entry = LeaderboardEntry(
            rig_id="RIG-01",
            driver_name="Test Driver",
            car="ks_ferrari_488_gt3",
            track="spa",
            lap=3,
            lap_time_ms=134567,
            timestamp=1700000000.0,
            is_valid=True,
        )
        db.insert(entry)

        laps = db.get_raw_laps()
        assert len(laps) == 1
        assert laps[0].lap_time_ms == 134567
        assert laps[0].is_valid is True
        lap_id = laps[0].id
        assert lap_id is not None

        # Toggle validity to invalid
        assert db.toggle_lap_validity(lap_id) is True
        laps_after = db.get_raw_laps()
        assert laps_after[0].is_valid is False

        # Toggle back to valid
        assert db.toggle_lap_validity(lap_id) is True
        laps_after2 = db.get_raw_laps()
        assert laps_after2[0].is_valid is True
