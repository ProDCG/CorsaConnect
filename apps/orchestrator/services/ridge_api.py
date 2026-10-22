"""Ridge Sim Racing VPS API Integration Service (Specification v1.0).

Handles:
- CSPRNG QR token generation (`chk_` + 32 hex chars)
- Registering session check-in tokens (`POST index.php?r=api/register-tokens`)
- Polling session check-in claims (`GET index.php?r=api/session-checkins&session_id=...`)
- Synchronizing lap records & finalizing sessions (`POST index.php?r=api/sync-session`)
- Querying public leaderboards & driver statistics (`GET index.php?r=api/leaderboard`, `GET index.php?r=api/driver`)
- Background polling of active check-in sessions

Security:
- Never logs raw API keys or raw QR tokens (`chk_...`).
- Enforces HTTPS/TLS and `X-API-Key` header on machine endpoints.
"""

from __future__ import annotations

import asyncio
import json
import logging
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import TYPE_CHECKING, Any

from apps.orchestrator.services.discord import send_debug_notification

if TYPE_CHECKING:
    from apps.orchestrator.state import AppState

logger = logging.getLogger("ridge.api")

MAX_BATCH_LAPS = 500
MAX_PAYLOAD_BYTES = 1_800_000  # Safely below the 2 MiB server limit


def generate_qr_token() -> str:
    """Generate a cryptographically secure QR claim token (`chk_` + 32 hex chars)."""
    return f"chk_{secrets.token_hex(16)}"


def build_checkin_qr_url(base_url: str, raw_token: str) -> str:
    """Build the public mobile check-in URL for a rig's QR code."""
    base = (base_url or "https://theridge.fun/racing-api/").rstrip("/")
    return f"{base}/index.php?r=checkin&id={urllib.parse.quote(raw_token)}"


class RidgeApiService:
    """Client and background coordinator for the Ridge Sim Racing VPS API."""

    def __init__(self, state: AppState) -> None:
        self.state = state
        self._poll_task: asyncio.Task[None] | None = None
        self._running = False

    def start(self) -> None:
        """Start the background check-in polling loop."""
        if self._poll_task is None or self._poll_task.done():
            self._running = True
            self._poll_task = asyncio.create_task(self._poll_loop())
            logger.info("RidgeApiService background check-in poller started")

    def stop(self) -> None:
        """Stop the background check-in polling loop."""
        self._running = False
        if self._poll_task and not self._poll_task.done():
            self._poll_task.cancel()
            logger.info("RidgeApiService background check-in poller stopped")

    def _get_base_url(self) -> str:
        return (getattr(self.state.settings, "ridge_api_url", None) or "https://theridge.fun/racing-api/").rstrip("/")

    def _get_api_key(self) -> str | None:
        key = getattr(self.state.settings, "ridge_api_key", None)
        return key.strip() if key and isinstance(key, str) and key.strip() else None

    def _request(
        self,
        method: str,
        route: str,
        query_params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
        require_auth: bool = True,
        override_api_key: str | None = None,
        override_base_url: str | None = None,
        timeout: float = 10.0,
    ) -> tuple[int, dict[str, Any]]:
        """Execute an HTTP request against `index.php?r=<route>`."""
        base_url = (override_base_url or self._get_base_url()).rstrip("/")
        api_key = override_api_key or self._get_api_key()

        if require_auth and not api_key:
            return 401, {"error": "missing_api_key", "message": "Ridge API key is not configured in Settings."}

        # Build query string with ?r=<route>
        url = f"{base_url}/index.php?r={route}"
        if query_params:
            clean_params = {k: str(v) for k, v in query_params.items() if v is not None and str(v) != ""}
            if clean_params:
                url += "&" + urllib.parse.urlencode(clean_params)

        headers: dict[str, str] = {
            "Accept": "application/json",
            "User-Agent": "Ridge-Link-Orchestrator/2.0",
        }
        if require_auth and api_key:
            headers["X-API-Key"] = api_key

        data_bytes: bytes | None = None
        if json_body is not None:
            headers["Content-Type"] = "application/json"
            data_bytes = json.dumps(json_body).encode("utf-8")

        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method.upper())

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status_code = resp.status
                raw_resp = resp.read().decode("utf-8", errors="replace")
                try:
                    parsed = json.loads(raw_resp) if raw_resp else {}
                except json.JSONDecodeError:
                    parsed = {"raw": raw_resp}
                return status_code, parsed
        except urllib.error.HTTPError as he:
            status_code = he.code
            raw_err = ""
            try:
                raw_err = he.read().decode("utf-8", errors="replace")
                parsed_err = json.loads(raw_err) if raw_err else {"error": f"HTTP {status_code}"}
            except Exception:
                parsed_err = {"error": f"HTTP {status_code}", "raw": raw_err[:500]}
            return status_code, parsed_err
        except Exception as e:
            logger.error("Ridge API transport error on route %s: %s", route, e)
            return 0, {"error": "network_error", "message": str(e)}

    # ------------------------------------------------------------------
    # 1. Register Session Check-in Tokens (POST index.php?r=api/register-tokens)
    # ------------------------------------------------------------------

    def register_session_tokens(
        self,
        session_id: str,
        rig_ids: list[str],
        expires_in_sec: int | None = None,
        group_id: str | None = None,
        group_name: str | None = None,
        track: str | None = None,
        track_layout: str | None = None,
        show_qr_on_rigs: bool | None = None,
    ) -> dict[str, Any]:
        """Generate CSPRNG QR tokens for each rig and register them with Ridge API."""
        if not rig_ids:
            return {"status": "error", "message": "At least one rig_id is required"}

        ttl = expires_in_sec or getattr(self.state.settings, "ridge_qr_ttl_sec", 600) or 600
        ttl = max(60, min(3600, int(ttl)))

        # Prefix with test_ if test mode is active and not already prefixed
        if getattr(self.state.settings, "ridge_test_mode", False) and not session_id.startswith("test_"):
            session_id = f"test_{session_id}"
        session_id = session_id[:64]

        now = time.time()
        expires_at = now + ttl
        base_url = self._get_base_url()

        tokens_payload: list[dict[str, Any]] = []
        local_tokens: list[dict[str, Any]] = []

        for rid in rig_ids[:50]:
            raw_token = generate_qr_token()
            tokens_payload.append({
                "token_hash": raw_token,  # Spec Section 4 & 5: send raw QR token in token_hash
                "rig_id": rid[:32],
                "expires_in_sec": ttl,
            })
            qr_url = build_checkin_qr_url(base_url, raw_token)
            local_tokens.append({
                "rig_id": rid,
                "raw_token": raw_token,
                "checkin_url": qr_url,
                "status": "pending",
                "expires_at": expires_at,
            })
            # Persist in local SQLite
            self.state.leaderboard_db.upsert_ridge_checkin(
                session_id=session_id,
                rig_id=rid,
                raw_token=raw_token,
                status="pending",
                expires_at=expires_at,
            )
            # Attach to in-memory rig state so Kiosk / Sled Splash can display QR when enabled
            self.state.upsert_rig(rid, {})
            self.state.update_rig_field(rid, "current_session_id", session_id)
            self.state.update_rig_field(rid, "checkin_url", qr_url)
            self.state.update_rig_field(rid, "checkin_status", "pending")
            self.state.update_rig_field(rid, "checkin_expires_at", expires_at)
            if show_qr_on_rigs is not None:
                self.state.update_rig_field(rid, "show_qr", bool(show_qr_on_rigs))
            else:
                self.state.update_rig_field(
                    rid, "show_qr", bool(getattr(self.state.settings, "ridge_show_qr_on_rigs", False))
                )

        # Record session in local DB
        self.state.leaderboard_db.upsert_ridge_session(
            session_id=session_id,
            group_id=group_id,
            group_name=group_name,
            track=track,
            track_layout=track_layout,
            status="created",
        )

        # If no API key is configured, we still return the generated QR URLs in local/offline preview mode
        if not self._get_api_key():
            self.state.leaderboard_db.upsert_ridge_session(
                session_id=session_id,
                group_id=group_id,
                group_name=group_name,
                track=track,
                track_layout=track_layout,
                status="local_only",
                last_error="No API key configured (local QR preview only)",
            )
            return {
                "status": "local_only",
                "http_status": 0,
                "session_id": session_id,
                "registered": 0,
                "message": "QR tokens generated locally (configure Ridge API Key in Settings to register with VPS).",
                "checkins": local_tokens,
            }

        status_code, resp = self._request(
            "POST",
            "api/register-tokens",
            json_body={"session_id": session_id, "tokens": tokens_payload},
            require_auth=True,
        )

        if status_code == 200 and resp.get("success"):
            registered_count = int(resp.get("registered", len(tokens_payload)))
            self.state.leaderboard_db.upsert_ridge_session(
                session_id=session_id,
                group_id=group_id,
                group_name=group_name,
                track=track,
                track_layout=track_layout,
                status="registered",
                last_error=None,
            )
            logger.info("Registered %d QR tokens with Ridge API for session %s", registered_count, session_id)
            send_debug_notification(
                self.state.settings,
                event_type="api_sync",
                title="🔑 Ridge API: QR Check-in Tokens Registered",
                description=f"Registered **{registered_count}** rig check-in token(s) for session `{session_id}`.",
                session_info={"Session ID": session_id, "Group": group_name or "N/A", "Track": track or "N/A"},
                extra_fields=[{"name": "RIGS", "value": ", ".join(rig_ids), "inline": False}],
            )
            return {
                "status": "success",
                "http_status": status_code,
                "session_id": session_id,
                "registered": registered_count,
                "checkins": local_tokens,
                "api_response": resp,
            }
        else:
            err_msg = str(resp.get("error") or resp.get("message") or f"HTTP {status_code}")
            self.state.leaderboard_db.upsert_ridge_session(
                session_id=session_id,
                group_id=group_id,
                group_name=group_name,
                track=track,
                track_layout=track_layout,
                status="error",
                last_error=err_msg,
            )
            logger.warning("Failed to register tokens for session %s: %s", session_id, err_msg)
            send_debug_notification(
                self.state.settings,
                event_type="api_sync",
                title="⚠️ Ridge API Error: Token Registration Failed",
                description=f"Failed to register tokens for session `{session_id}`: **{err_msg}**",
                session_info={"Session ID": session_id, "HTTP Status": status_code},
            )
            return {
                "status": "error",
                "http_status": status_code,
                "session_id": session_id,
                "message": err_msg,
                "checkins": local_tokens,
                "api_response": resp,
            }

    # ------------------------------------------------------------------
    # 2. Poll Session Check-ins (GET index.php?r=api/session-checkins)
    # ------------------------------------------------------------------

    def poll_session_checkins(self, session_id: str) -> dict[str, Any]:
        """Poll Ridge API for check-in status and bind claimed drivers to rigs."""
        base_url = self._get_base_url()
        local_rows = self.state.leaderboard_db.get_ridge_checkins(session_id)
        local_by_rig = {str(r["rig_id"]): dict(r) for r in local_rows}

        if not self._get_api_key():
            enriched = []
            for r in local_rows:
                d = dict(r)
                d["checkin_url"] = build_checkin_qr_url(base_url, str(r["raw_token"]))
                enriched.append(d)
            return {
                "status": "local_only",
                "session_id": session_id,
                "checkins": enriched,
                "message": "API key not configured; returning local check-in state.",
            }

        status_code, resp = self._request(
            "GET",
            "api/session-checkins",
            query_params={"session_id": session_id},
            require_auth=True,
        )

        if status_code != 200 or not isinstance(resp.get("checkins"), list):
            err_msg = str(resp.get("error") or resp.get("message") or f"HTTP {status_code}")
            enriched = []
            for r in local_rows:
                d = dict(r)
                d["checkin_url"] = build_checkin_qr_url(base_url, str(r["raw_token"]))
                enriched.append(d)
            return {
                "status": "error",
                "http_status": status_code,
                "session_id": session_id,
                "message": err_msg,
                "checkins": enriched,
                "api_response": resp,
            }

        remote_checkins: list[dict[str, Any]] = resp.get("checkins", [])
        newly_claimed: list[dict[str, Any]] = []

        for item in remote_checkins:
            rig_id = str(item.get("rig_id") or "")
            if not rig_id:
                continue
            c_status = str(item.get("status") or "pending")
            driver_uuid = str(item.get("driver_uuid")) if item.get("driver_uuid") else None
            driver_name = str(item.get("driver_name")) if item.get("driver_name") else None
            driver_email = str(item.get("driver_email")) if item.get("driver_email") else None
            claimed_at = float(item["claimed_at"]) if item.get("claimed_at") is not None else None
            expires_at = float(item["expires_at"]) if item.get("expires_at") is not None else None

            prev = local_by_rig.get(rig_id)
            prev_status = prev.get("status") if prev else None

            self.state.leaderboard_db.update_ridge_checkin_status(
                session_id=session_id,
                rig_id=rig_id,
                status=c_status,
                driver_uuid=driver_uuid,
                driver_name=driver_name,
                driver_email=driver_email,
                claimed_at=claimed_at,
                expires_at=expires_at,
            )

            # Update in-memory rig state
            self.state.upsert_rig(rig_id, {})
            self.state.update_rig_field(rig_id, "checkin_status", c_status)

            if c_status == "claimed" and driver_uuid:
                display = driver_name or driver_uuid
                self.state.update_rig_field(rig_id, "driver_uuid", driver_uuid)
                self.state.update_rig_field(rig_id, "driver_name", display)
                if driver_email:
                    self.state.update_rig_field(rig_id, "driver_email", driver_email)
                # Hide QR automatically on this rig once claimed!
                self.state.update_rig_field(rig_id, "show_qr", False)

                # Upsert authoritative server-issued driver_uuid into local drivers roster
                self.state.leaderboard_db.upsert_driver(
                    display_name=display,
                    email=driver_email,
                    driver_uuid=driver_uuid,
                )

                if prev_status != "claimed":
                    newly_claimed.append({
                        "rig_id": rig_id,
                        "driver_uuid": driver_uuid,
                        "driver_name": display,
                        "driver_email": driver_email,
                    })
                    logger.info(
                        "QR Check-in claimed on %s -> %s (%s)",
                        rig_id, display, driver_uuid,
                    )
                    send_debug_notification(
                        self.state.settings,
                        event_type="checkin",
                        title="📱 QR Check-in Claimed!",
                        description=f"Racer **{display}** checked into **{rig_id}** via QR code.",
                        driver_info={
                            "Rig": rig_id,
                            "Driver": display,
                            "Driver UUID": driver_uuid,
                            "Email": driver_email or "N/A",
                        },
                        session_info={"Session ID": session_id},
                    )

        updated_rows = self.state.leaderboard_db.get_ridge_checkins(session_id)
        enriched_out = []
        for r in updated_rows:
            d = dict(r)
            d["checkin_url"] = build_checkin_qr_url(base_url, str(r["raw_token"]))
            enriched_out.append(d)

        return {
            "status": "success",
            "http_status": status_code,
            "session_id": session_id,
            "checkins": enriched_out,
            "newly_claimed": newly_claimed,
            "api_response": resp,
        }

    # ------------------------------------------------------------------
    # 3. Synchronize Session Laps & Finalize (POST index.php?r=api/sync-session)
    # ------------------------------------------------------------------

    def sync_session_laps(self, session_id: str, finalize: bool = False) -> dict[str, Any]:
        """Upload unsynced laps for claimed rigs in batches <= 500 and optionally finalize."""
        if not self._get_api_key():
            return {"status": "error", "message": "Ridge API key is not configured"}

        # Poll check-ins first so we know which rigs have claimed check-ins
        self.poll_session_checkins(session_id)
        checkins = self.state.leaderboard_db.get_ridge_checkins(session_id)
        claimed_rigs = [str(c["rig_id"]) for c in checkins if c.get("status") == "claimed"]

        all_unsynced = self.state.leaderboard_db.get_unsynced_laps(session_id)
        if checkins:
            # Filter to claimed rigs so we don't trigger 409 unclaimed_rig on the whole batch
            unsynced_laps = [lap for lap in all_unsynced if lap.rig_id in claimed_rigs]
            skipped_unclaimed = len(all_unsynced) - len(unsynced_laps)
        else:
            # If no local checkin rows exist (e.g. external session), attempt all unsynced laps
            unsynced_laps = all_unsynced
            skipped_unclaimed = 0

        s_meta = self.state.leaderboard_db.get_ridge_session(session_id) or {}
        default_layout = str(s_meta.get("track_layout") or "default")

        total_inserted = 0
        total_duplicate = 0
        batches_sent = 0
        errors: list[str] = []

        # Chunk into batches of <= MAX_BATCH_LAPS (500)
        for i in range(0, len(unsynced_laps), MAX_BATCH_LAPS):
            batch_entries = unsynced_laps[i : i + MAX_BATCH_LAPS]
            laps_payload: list[dict[str, Any]] = []
            batch_db_ids: list[int] = []

            for entry in batch_entries:
                if not entry.lap_time_ms or entry.lap_time_ms <= 0 or entry.lap_time_ms > 86_400_000:
                    continue
                if entry.id is not None:
                    batch_db_ids.append(entry.id)
                laps_payload.append({
                    "source_lap_id": (entry.source_lap_id or f"lap-{entry.rig_id}-{entry.lap}-{int(entry.timestamp * 1000)}")[:128],
                    "rig_id": entry.rig_id[:32],
                    "track": (entry.track or str(s_meta.get("track") or "monza"))[:100],
                    "track_layout": (entry.track_layout or default_layout or "default")[:100],
                    "car": (entry.car or "unknown")[:100],
                    "lap_time_ms": int(entry.lap_time_ms),
                    "timestamp": float(entry.timestamp),
                    "is_valid": bool(entry.is_valid),
                })

            if not laps_payload:
                continue

            body = {
                "session_id": session_id,
                "final_batch": False,
                "laps": laps_payload,
            }

            status_code, resp = self._request("POST", "api/sync-session", json_body=body, require_auth=True)
            batches_sent += 1

            if status_code == 200 and resp.get("success"):
                self.state.leaderboard_db.mark_laps_synced(batch_db_ids)
                if resp.get("duplicate_batch"):
                    dup_cnt = int(resp.get("original_inserted_laps", len(laps_payload)))
                    total_duplicate += dup_cnt
                else:
                    ins_cnt = int(resp.get("inserted_laps", 0))
                    dup_cnt = int(resp.get("duplicate_laps", 0))
                    total_inserted += ins_cnt
                    total_duplicate += dup_cnt

                srv_status = str(resp.get("session_status") or "receiving")
                self.state.leaderboard_db.update_ridge_session_counts(
                    session_id=session_id,
                    inserted_laps=int(resp.get("inserted_laps", 0)),
                    duplicate_laps=int(resp.get("duplicate_laps", 0)),
                    status=srv_status,
                    last_error=None,
                )
            else:
                err_code = str(resp.get("error") or f"HTTP_{status_code}")
                err_detail = json.dumps(resp)
                errors.append(f"{err_code}: {err_detail}")
                self.state.leaderboard_db.update_ridge_session_counts(
                    session_id=session_id,
                    status="completed" if err_code == "session_already_completed" else "error",
                    last_error=f"{err_code} ({status_code})",
                )
                logger.error("Ridge API sync-session error for %s: %s", session_id, err_detail)
                break

        # Finalize session if requested and no batch errors occurred
        final_resp: dict[str, Any] | None = None
        if finalize and not errors:
            f_code, f_data = self._request(
                "POST",
                "api/sync-session",
                json_body={"session_id": session_id, "final_batch": True, "laps": []},
                require_auth=True,
            )
            final_resp = f_data
            if f_code == 200 and f_data.get("success"):
                self.state.leaderboard_db.update_ridge_session_counts(
                    session_id=session_id,
                    status=str(f_data.get("session_status") or "completed"),
                    last_error=None,
                )
            elif f_data.get("error") == "session_already_completed":
                self.state.leaderboard_db.update_ridge_session_counts(
                    session_id=session_id,
                    status="completed",
                    last_error=None,
                )
            else:
                err_code = str(f_data.get("error") or f"HTTP_{f_code}")
                errors.append(f"finalize_failed: {err_code}")
                self.state.leaderboard_db.update_ridge_session_counts(
                    session_id=session_id,
                    status="error",
                    last_error=err_code,
                )

        if errors:
            send_debug_notification(
                self.state.settings,
                event_type="api_sync",
                title="⚠️ Ridge API Lap Sync Error",
                description=f"Session `{session_id}` encountered error(s) during sync: `{'; '.join(errors)}`",
                session_info={
                    "Session ID": session_id,
                    "Inserted": total_inserted,
                    "Skipped (Unclaimed)": skipped_unclaimed,
                },
            )
            return {
                "status": "error",
                "session_id": session_id,
                "batches_sent": batches_sent,
                "inserted_laps": total_inserted,
                "duplicate_laps": total_duplicate,
                "skipped_unclaimed_laps": skipped_unclaimed,
                "errors": errors,
                "final_response": final_resp,
            }

        if batches_sent > 0 or finalize:
            send_debug_notification(
                self.state.settings,
                event_type="api_sync",
                title="✅ Ridge API Lap Sync Complete" if not finalize else "🏁 Ridge API Session Finalized",
                description=(
                    f"Synced **{total_inserted}** new lap(s) ({total_duplicate} duplicate, "
                    f"{skipped_unclaimed} unclaimed skipped) for `{session_id}`."
                ),
                session_info={
                    "Session ID": session_id,
                    "Batches": batches_sent,
                    "Finalized": str(finalize),
                },
            )

        return {
            "status": "success",
            "session_id": session_id,
            "batches_sent": batches_sent,
            "inserted_laps": total_inserted,
            "duplicate_laps": total_duplicate,
            "skipped_unclaimed_laps": skipped_unclaimed,
            "finalized": finalize,
            "final_response": final_resp,
        }

    # ------------------------------------------------------------------
    # 4. Read-only Public Endpoints (Leaderboard & Driver Statistics)
    # ------------------------------------------------------------------

    def fetch_remote_leaderboard(
        self,
        track: str | None = None,
        layout: str | None = None,
        car: str | None = None,
        limit: int = 10,
    ) -> dict[str, Any]:
        """GET index.php?r=api/leaderboard&track=...&layout=...&car=...&limit=..."""
        lim = max(1, min(100, int(limit)))
        status_code, resp = self._request(
            "GET",
            "api/leaderboard",
            query_params={"track": track, "layout": layout, "car": car, "limit": lim},
            require_auth=False,
        )
        # Defensively coerce numeric fields per Spec Section 9
        if status_code == 200 and isinstance(resp.get("leaderboard"), list):
            for row in resp["leaderboard"]:
                if isinstance(row, dict) and "fastest_lap_ms" in row and row["fastest_lap_ms"] is not None:
                    try:
                        row["fastest_lap_ms"] = int(float(str(row["fastest_lap_ms"])))
                    except (ValueError, TypeError):
                        pass
        return {"http_status": status_code, "data": resp}

    def fetch_remote_driver_stats(self, driver_uuid: str) -> dict[str, Any]:
        """GET index.php?r=api/driver&uuid=drv_..."""
        status_code, resp = self._request(
            "GET",
            "api/driver",
            query_params={"uuid": driver_uuid},
            require_auth=False,
        )
        # Defensively coerce numeric fields per Spec Section 9
        if status_code == 200 and isinstance(resp, dict):
            stats = resp.get("stats")
            if isinstance(stats, dict):
                for k in ("total_valid_laps", "sessions_participated", "overall_personal_best_ms"):
                    if k in stats and stats[k] is not None:
                        try:
                            stats[k] = int(float(str(stats[k])))
                        except (ValueError, TypeError):
                            pass
            for list_key in ("personal_bests", "recent_laps"):
                items = resp.get(list_key)
                if isinstance(items, list):
                    for item in items:
                        if isinstance(item, dict):
                            for nk in ("best_lap_ms", "lap_Count", "lap_count", "lap_time_ms"):
                                if nk in item and item[nk] is not None:
                                    try:
                                        item[nk] = int(float(str(item[nk])))
                                    except (ValueError, TypeError):
                                        pass
        return {"http_status": status_code, "data": resp}

    # ------------------------------------------------------------------
    # Background Poller
    # ------------------------------------------------------------------

    async def _poll_loop(self) -> None:
        """Periodically poll active check-in sessions when Ridge API key is configured."""
        while self._running:
            interval = max(2, int(getattr(self.state.settings, "ridge_poll_interval_sec", 3) or 3))
            try:
                if self._get_api_key():
                    sessions = self.state.leaderboard_db.get_ridge_sessions(limit=5)
                    now = time.time()
                    for s in sessions:
                        st = str(s.get("status") or "")
                        created_at = float(s.get("created_at") or 0)
                        # Poll sessions created in the last 60 minutes that are registered or receiving
                        if st in ("registered", "receiving") and (now - created_at) < 3600:
                            sid = str(s["session_id"])
                            await asyncio.to_thread(self.poll_session_checkins, sid)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug("Ridge API background poll error: %s", e)

            await asyncio.sleep(interval)
