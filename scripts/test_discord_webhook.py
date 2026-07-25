import sys
import os

# Add project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from apps.orchestrator.services.discord import send_discord_webhook

def main():
    webhook_url = "https://discord.com/api/webhooks/1521942234012979400/ZrMjGmJD9L3gkgM3s0SXb_kxMNTyPNnVRGKKoaWi0jjdPgwwFEztrpRz0fwH9keIkIB0"
    
    print(f"Sending test webhook to: {webhook_url}")
    
    # Example end of race summary
    title = "🏁 Session Ended: Test Group"
    description = "The session at Monza has concluded. Here are the final results:"
    fields = [
        {"name": "#1 - Mason", "value": "**Time:** 1:48.231\n**Car:** Ferrari 488 Gt3", "inline": False},
        {"name": "#2 - Alex", "value": "**Time:** 1:49.005\n**Car:** Porsche 911 Gt3 R", "inline": False},
        {"name": "#3 - Jordan", "value": "**Time:** 1:50.112\n**Car:** Lamborghini Huracan Gt3", "inline": False},
    ]
    
    send_discord_webhook(webhook_url, title, description, fields)
    print("Test webhook sent successfully (check Discord).")

if __name__ == "__main__":
    main()
