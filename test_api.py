from apps.orchestrator.services.leaderboard_db import LeaderboardDB

db = LeaderboardDB("data/leaderboard.db")
res = db.get_filtered_leaderboard()
print(f"Count: {len(res)}")
