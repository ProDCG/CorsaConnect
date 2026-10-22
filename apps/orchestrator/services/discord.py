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


def format_lap_time(ms: int | float | None) -> str:
    """Format milliseconds into m:ss.mmm string."""
    if ms is None or ms <= 0:
        return "--:--.---"
    total_seconds = ms / 1000.0
    minutes = int(total_seconds // 60)
    seconds = total_seconds % 60
    return f"{minutes}:{seconds:06.3f}"


def notify_track_record(
    webhook_url: str,
    driver_name: str,
    track: str,
    car: str,
    lap_time_ms: int,
    rig_id: str,
    prev_record_ms: int | None = None,
) -> None:
    """Dispatch an embed when a driver sets a new all-time track record."""
    if not webhook_url:
        return

    time_str = format_lap_time(lap_time_ms)
    track_display = track.replace("_", " ").title() if track else "Unknown Track"
    car_display = car.replace("_", " ").title() if car else "Unknown Vehicle"
    driver_display = driver_name.strip() if driver_name and driver_name.strip() else f"Rig {rig_id}"

    title = "🏁 NEW ALL-TIME TRACK RECORD!"
    description = f"Driver **{driver_display}** just demolished the record at **{track_display}**!"

    fields: list[dict[str, Any]] = [
        {"name": "LAP TIME", "value": f"**{time_str}**", "inline": True},
        {"name": "VEHICLE", "value": car_display, "inline": True},
        {"name": "RIG", "value": rig_id, "inline": True},
    ]

    if prev_record_ms and prev_record_ms > lap_time_ms:
        gap_sec = (prev_record_ms - lap_time_ms) / 1000.0
        fields.append({"name": "GAP TO PREVIOUS", "value": f"-{gap_sec:.3f}s", "inline": True})

    send_discord_webhook(webhook_url, title, description, fields)


def notify_session_podium(
    webhook_url: str,
    session_standings: dict[str, Any],
) -> None:
    """Dispatch an embed with the podium results when a session concludes."""
    if not webhook_url or not session_standings:
        return

    drivers = session_standings.get("drivers", [])
    if not drivers:
        return

    track = str(session_standings.get("track") or "Circuit")
    track_display = track.replace("_", " ").title()
    group_name = str(session_standings.get("group_name") or "Race Group")

    # Filter to drivers with valid lap times
    valid_drivers = [d for d in drivers if d.get("best_lap_time_ms") and d.get("best_lap_time_ms", 0) > 0]
    if not valid_drivers:
        return

    title = f"🏆 Session Completed: {group_name}"
    description = f"The race session at **{track_display}** has concluded! Here are the podium standings:"

    medals = ["🥇 1st Place", "🥈 2nd Place", "🥉 3rd Place"]
    fields: list[dict[str, Any]] = []

    for idx, d in enumerate(valid_drivers[:3]):
        d_name = d.get("driver_name") or f"Rig {d.get('rig_id')}"
        time_str = format_lap_time(d.get("best_lap_time_ms"))
        car_str = str(d.get("car") or "").replace("_", " ").title()
        val = f"**Time:** {time_str}\n**Car:** {car_str or 'N/A'}"
        if d.get("gap_ms") and d.get("gap_ms", 0) > 0:
            val += f"\n**Gap:** +{d['gap_ms'] / 1000.0:.3f}s"
        fields.append({
            "name": f"{medals[idx]} — {d_name}",
            "value": val,
            "inline": False,
        })

    send_discord_webhook(webhook_url, title, description, fields)


def send_debug_notification(
    settings: Any,
    event_type: str,
    title: str,
    description: str,
    telemetry_info: dict[str, Any] | None = None,
    driver_info: dict[str, Any] | None = None,
    session_info: dict[str, Any] | None = None,
    extra_fields: list[dict[str, Any]] | None = None,
) -> None:
    """Dispatch a granular debug log embed to the Discord Debug Webhook if enabled.

    event_type can be:
      - 'race_start'
      - 'race_stop'
      - 'lap_complete'
      - 'invalid_lap'
      - 'checkin'
      - 'api_sync'
    """
    debug_url = getattr(settings, "discord_debug_webhook_url", None)
    if not debug_url or not str(debug_url).strip():
        return

    # Check event-level filter checkboxes
    event_toggle_map = {
        "race_start": getattr(settings, "discord_debug_race_start", True),
        "race_stop": getattr(settings, "discord_debug_race_stop", True),
        "lap_complete": getattr(settings, "discord_debug_lap_complete", True),
        "invalid_lap": getattr(settings, "discord_debug_invalid_laps", False),
        "checkin": getattr(settings, "discord_debug_checkin", True),
        "api_sync": getattr(settings, "discord_debug_api_sync", True),
    }
    if not event_toggle_map.get(event_type, True):
        return

    fields: list[dict[str, Any]] = []

    # Check payload field filter checkboxes
    if driver_info and getattr(settings, "discord_debug_include_driver", True):
        for k, v in driver_info.items():
            if v is not None and str(v) != "":
                val_str = str(v)
                is_multiline = "\n" in val_str or k.upper() in ("RIGS", "RIG LIST")
                fields.append({"name": k.upper(), "value": val_str, "inline": not is_multiline})

    if telemetry_info and getattr(settings, "discord_debug_include_telemetry", True):
        for k, v in telemetry_info.items():
            if v is not None and str(v) != "":
                val_str = str(v)
                fields.append({"name": k.upper(), "value": val_str, "inline": "\n" not in val_str})

    if session_info and getattr(settings, "discord_debug_include_session", True):
        for k, v in session_info.items():
            if v is not None and str(v) != "":
                val_str = str(v)
                fields.append({"name": k.upper(), "value": val_str, "inline": "\n" not in val_str})

    if extra_fields:
        fields.extend(extra_fields)

    send_discord_webhook(str(debug_url).strip(), title, description, fields)


