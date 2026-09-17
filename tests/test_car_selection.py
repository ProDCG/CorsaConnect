import pytest
from apps.orchestrator.state import AppState
from apps.orchestrator.services.acserver import ACServerManager
from apps.orchestrator.services.content_scanner import scan_cars, scan_tracks


def test_rig_car_selection(tmp_path):
    state = AppState(data_dir=str(tmp_path))
    state.upsert_rig("RIG-01", {"ip": "192.168.1.100"})
    
    # Test initial state (no car selected)
    rig = state.get_rig("RIG-01")
    assert rig is not None
    assert rig.get("selected_car") is None

    # Test explicit car selection
    state.update_rig_field("RIG-01", "selected_car", "ks_ferrari_488_gt3")
    rig = state.get_rig("RIG-01")
    assert rig["selected_car"] == "ks_ferrari_488_gt3"

    # Test clearing car selection
    state.update_rig_field("RIG-01", "selected_car", None)
    rig = state.get_rig("RIG-01")
    assert rig["selected_car"] is None


def test_acserver_entry_list_car_fallback(tmp_path):
    state = AppState(data_dir=str(tmp_path))
    state.upsert_rig("RIG-01", {"ip": "192.168.1.100"})
    
    manager = ACServerManager(state)
    available_cars = ["ks_ferrari_488_gt3", "ks_porsche_911_gt3_rs"]
    
    cfg_dir = tmp_path / "cfg"
    cfg_dir.mkdir(parents=True, exist_ok=True)
    
    # When no car is selected on RIG-01, entry list should assign available_cars[0] as fallback
    manager._write_entry_list(
        config_dir=str(tmp_path),
        rig_ids=["RIG-01"],
        cars=available_cars,
        total_slots=1,
    )
    
    entry_list = (cfg_dir / "entry_list.ini").read_text()
    assert "MODEL=ks_ferrari_488_gt3" in entry_list


def test_mock_content_scanner_fallback(tmp_path):
    non_existent_folder = str(tmp_path / "non_existent")
    cars = scan_cars(non_existent_folder)
    tracks = scan_tracks(non_existent_folder)
    
    assert len(cars) > 0
    assert any(c.id == "ks_ferrari_488_gt3" for c in cars)
    assert len(tracks) > 0
    assert any(t.id == "monza" for t in tracks)
