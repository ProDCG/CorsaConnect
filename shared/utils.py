import socket


def get_local_ip() -> str:
    """Best-effort local IP discovery, including when offline.
    Prioritizes the 192.168.10.x subnet for the isolated ethernet network.
    """
    # 1. First, check if there's a local interface on the 192.168.10.x subnet
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if ip.startswith("192.168.10."):
                return ip
    except Exception:
        pass

    # 2. Fall back to standard route detection
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    except Exception:
        # Fallback to hostname resolution immediately if socket creation fails
        try:
            ip = socket.gethostbyname(socket.gethostname())
            if ip and not ip.startswith("127."):
                return ip
        except Exception:
            pass
        return "127.0.0.1"

    try:
        # Try a public IP first (works if default route exists)
        s.connect(("8.8.8.8", 80))
        resolved_ip = str(s.getsockname()[0])
        # If this resolved to a different adapter, but we have a 192.168.10.x, we still want that
        return resolved_ip
    except Exception:
        pass

    try:
        # Try local broadcast - this often works offline to find the primary interface
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.connect(("<broadcast>", 0))
        return str(s.getsockname()[0])
    except Exception:
        pass

    # Try some common private network gateways as a fallback
    for ip in ["192.168.10.1", "192.168.1.1", "10.0.0.1", "172.16.0.1", "192.168.0.1", "192.168.9.1"]:
        try:
            s.connect((ip, 80))
            return str(s.getsockname()[0])
        except Exception:
            pass

    # Fallback to hostname resolution
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass

    return "127.0.0.1"
