"""Unit tests for shared/utils.py."""

from unittest.mock import patch

from shared.utils import get_local_ip


def test_get_local_ip_fallback():
    # Test fallback to 127.0.0.1 when socket is down
    with patch("socket.socket") as mock_socket:
        mock_socket.side_effect = Exception("No network")
        # Also mock gethostbyname_ex to throw, ensuring fallback
        with patch("socket.gethostbyname_ex") as mock_gethost:
            mock_gethost.side_effect = Exception("No host info")
            ip = get_local_ip()
            assert ip == "127.0.0.1"


def test_get_local_ip_isolated_subnet():
    # Test prioritizing 192.168.10.x subnet if present in gethostbyname_ex
    with patch("socket.gethostbyname_ex") as mock_gethost:
        mock_gethost.return_value = ("localhost", [], ["192.168.1.5", "192.168.10.42"])
        ip = get_local_ip()
        assert ip == "192.168.10.42"
