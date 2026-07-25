"""Unit tests for ACServerManager."""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock

from apps.orchestrator.services.acserver import ACServerManager


def test_write_server_cfg_generation():
    state_mock = MagicMock()
    state_mock.settings.content_folder = "/mock/content"

    with tempfile.TemporaryDirectory() as tmpdir:
        manager = ACServerManager(state=state_mock, ac_server_path="")
        cfg = manager._write_server_cfg(
            config_dir=tmpdir,
            name="TestServer",
            track="monza",
            cars=["ks_ferrari_488_gt3"],
            udp_port=9600,
            tcp_port=9600,
            http_port=8080,
            race_laps=10,
            practice_time=15,
            qualy_time=10,
            max_clients=10,
            weather="3_clear",
            sun_angle=48,
            enable_csp=True,
            write_to_disk=True,
        )

        assert cfg is not None
        # Check generated INI config contents
        assert "[SERVER]" in cfg
        assert "monza" in cfg
        assert "CARS=ks_ferrari_488_gt3" in cfg
        assert "UDP_PORT=9600" in cfg
        assert "TCP_PORT=9600" in cfg
        assert "HTTP_PORT=8080" in cfg
        assert "MAX_CLIENTS=10" in cfg
        assert "REAL_CONDITIONS_PARAMS=" in cfg

        # Verify it wrote file to disk
        cfg_file = Path(tmpdir) / "cfg" / "server_cfg.ini"
        assert cfg_file.exists()
        assert "[SERVER]" in cfg_file.read_text()
