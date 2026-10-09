"""Discord webhook service for Ridge-Link."""

import json
import logging
import urllib.request
from typing import Any

logger = logging.getLogger("ridge.discord")


def send_discord_webhook(
    webhook_url: str, title: str, description: str, fields: list[dict[str, Any]] | None = None
) -> None:
    """Send a rich embed message to a Discord webhook."""
    if not webhook_url:
        return

    payload = {
        "embeds": [
            {
                "title": title,
                "description": description,
                "color": 0x6366F1,  # Indigo color (ridge-brand)
                "fields": fields or [],
            }
        ]
    }

    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        webhook_url, data=data, headers={"Content-Type": "application/json", "User-Agent": "Ridge-Link/2.0"}
    )

    try:
        with urllib.request.urlopen(req, timeout=5.0) as response:
            if response.status not in (200, 204):
                logger.error(f"Discord webhook failed with status: {response.status}")
            else:
                logger.info("Discord webhook sent successfully.")
    except Exception as e:
        logger.error(f"Discord webhook error: {e}")
