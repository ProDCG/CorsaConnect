from unittest.mock import MagicMock, patch

from apps.orchestrator.services.discord import send_discord_webhook


def test_send_discord_webhook():
    with patch("urllib.request.urlopen") as mock_urlopen:
        # Mock response
        mock_response = MagicMock()
        mock_response.status = 204
        mock_urlopen.return_value.__enter__.return_value = mock_response

        webhook_url = "https://discord.com/api/webhooks/test/test"
        title = "Test Title"
        description = "Test Description"
        fields = [{"name": "Driver 1", "value": "1:23.456", "inline": False}]

        send_discord_webhook(webhook_url, title, description, fields)

        assert mock_urlopen.called
        req = mock_urlopen.call_args[0][0]
        assert req.full_url == webhook_url
        assert req.get_method() == "POST"
        assert req.headers["Content-type"] == "application/json"


def test_webhook_payload_structure():
    import json

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_response = MagicMock()
        mock_response.status = 204
        mock_urlopen.return_value.__enter__.return_value = mock_response

        webhook_url = "https://discord.com/api/webhooks/test/test"
        title = "🏁 Session Ended: Test Group"
        description = "The session at Monza has concluded. Here are the final results:"
        fields = [
            {"name": "#1 - Mason", "value": "**Time:** 1:48.231\n**Car:** Ferrari 488 Gt3", "inline": False},
        ]

        send_discord_webhook(webhook_url, title, description, fields)

        req = mock_urlopen.call_args[0][0]
        payload = json.loads(req.data.decode("utf-8"))

        assert "embeds" in payload
        assert len(payload["embeds"]) == 1
        embed = payload["embeds"][0]
        assert embed["title"] == title
        assert embed["description"] == description
        assert embed["color"] == 0x6366F1
        assert len(embed["fields"]) == 1
        assert embed["fields"][0]["name"] == "#1 - Mason"


def test_notify_track_record():
    import json
    from apps.orchestrator.services.discord import notify_track_record

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_response = MagicMock()
        mock_response.status = 204
        mock_urlopen.return_value.__enter__.return_value = mock_response

        webhook_url = "https://discord.com/api/webhooks/test/test"
        notify_track_record(
            webhook_url=webhook_url,
            driver_name="Alex Johnson",
            track="spa_francorchamps",
            car="ks_ferrari_488_gt3",
            lap_time_ms=137382,
            rig_id="RIG-04",
            prev_record_ms=137794,
        )

        assert mock_urlopen.called
        req = mock_urlopen.call_args[0][0]
        payload = json.loads(req.data.decode("utf-8"))
        assert "embeds" in payload
        embed = payload["embeds"][0]
        assert "NEW ALL-TIME TRACK RECORD" in embed["title"]
        assert "Alex Johnson" in embed["description"]
        assert any(f["name"] == "LAP TIME" and "2:17.382" in f["value"] for f in embed["fields"])
        assert any(f["name"] == "GAP TO PREVIOUS" and "-0.412s" in f["value"] for f in embed["fields"])


def test_notify_session_podium():
    import json
    from apps.orchestrator.services.discord import notify_session_podium

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_response = MagicMock()
        mock_response.status = 204
        mock_urlopen.return_value.__enter__.return_value = mock_response

        webhook_url = "https://discord.com/api/webhooks/test/test"
        standings = {
            "session_id": "sess_123",
            "track": "monza",
            "group_name": "GT3 Championship",
            "drivers": [
                {"position": 1, "driver_name": "Driver A", "rig_id": "RIG-01", "car": "Ferrari 488 GT3", "best_lap_time_ms": 108231, "gap_ms": 0},
                {"position": 2, "driver_name": "Driver B", "rig_id": "RIG-02", "car": "Porsche 911 GT3", "best_lap_time_ms": 109450, "gap_ms": 1219},
                {"position": 3, "driver_name": "Driver C", "rig_id": "RIG-03", "car": "Audi R8 LMS", "best_lap_time_ms": 110100, "gap_ms": 1869},
                {"position": 4, "driver_name": "Driver D", "rig_id": "RIG-04", "car": "BMW M4 GT3", "best_lap_time_ms": 112000, "gap_ms": 3769},
            ]
        }
        notify_session_podium(webhook_url, standings)

        assert mock_urlopen.called
        req = mock_urlopen.call_args[0][0]
        payload = json.loads(req.data.decode("utf-8"))
        embed = payload["embeds"][0]
        assert "Session Completed: GT3 Championship" in embed["title"]
        # Only top 3 podium drivers should be in the embed
        assert len(embed["fields"]) == 3
        assert "Driver A" in embed["fields"][0]["name"]
        assert "Driver B" in embed["fields"][1]["name"]
        assert "Driver C" in embed["fields"][2]["name"]

