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
