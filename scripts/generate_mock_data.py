"""Script to generate 1000 mock leaderboard entries for testing."""

import random
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

# Add project root to sys.path so we can import apps
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from apps.orchestrator.services.leaderboard_db import LeaderboardDB

from shared.models import LeaderboardEntry

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "leaderboard.db"

DRIVERS = ["Mason", "Alex", "Jordan", "Taylor", "Riley", "Casey", "Morgan", "Drew", "Sam", "Jamie"]
CARS = ["ks_ferrari_488_gt3", "ks_porsche_911_gt3_rs", "ks_lamborghini_huracan_gt3", "ks_mclaren_650s_gt3"]
TRACKS = ["monza", "spa", "imola", "nurburgring", "silverstone"]
WEATHERS = ["Sunny", "Rain", "Cloudy", "Clear"]
SESSION_TYPES = ["race", "qualify"]


def generate():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = LeaderboardDB(DB_PATH)

    # clear existing just in case or leave it? We'll leave existing data and just add.
    print(f"Generating 1000 mock entries into {DB_PATH}...")

    now = datetime.now()

    for i in range(1000):
        driver = random.choice(DRIVERS)
        track = random.choice(TRACKS)
        car = random.choice(CARS)
        weather = random.choice(WEATHERS)
        session_type = random.choice(SESSION_TYPES)

        # Random time in the past year
        days_ago = random.randint(0, 365)
        hours_ago = random.randint(0, 23)
        ts = (now - timedelta(days=days_ago, hours=hours_ago)).timestamp()

        lap_time_ms = random.randint(100_000, 150_000)  # 1:40 to 2:30 roughly

        entry = LeaderboardEntry(
            rig_id=f"RIG-{random.randint(1, 8):02d}",
            driver_name=driver,
            driver_email=f"{driver.lower()}@example.com",
            driver_phone="555-0199",
            car=car,
            track=track,
            weather=weather,
            group_name="Mock Group",
            session_type=session_type,
            lap=random.randint(1, 15),
            lap_time_ms=lap_time_ms,
            session_id=str(uuid.uuid4())[:8],
            timestamp=ts,
            notification_pending=False,
        )

        db.insert(entry)
        db.upsert_session_best(entry)

        if (i + 1) % 100 == 0:
            print(f"Inserted {i + 1} records...")

    print("Done generating 1000 mock entries.")


if __name__ == "__main__":
    generate()
