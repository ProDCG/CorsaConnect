export interface Rig {
    rig_id: string
    ip: string
    status: 'idle' | 'racing' | 'offline' | 'setup' | 'ready'
    mode?: 'lockout' | 'freeuse'
    selected_car?: string | null
    driver_name?: string | null
    driver_email?: string | null
    driver_uuid?: string | null
    cpu_temp: number
    mod_version: string
    last_seen: number
    telemetry?: {
        velocity?: [number, number, number]
        speed_kmh?: number
        gear?: string | number
        rpms?: number
        max_rpm?: number
        gas?: number
        brake?: number
        completed_laps?: number
        current_lap?: number
        total_laps?: number
        last_lap_time?: number | string
        best_lap_time?: number | string
        current_lap_time?: number | string
        is_lap_valid?: boolean
        normalized_pos?: number
        [key: string]: any
    }
    simhub_connected?: boolean
    mumble_connected?: boolean
    steam_connected?: boolean
    moza_connected?: boolean
    simcube_connected?: boolean
    mumble_channel?: string | null
    group_id?: string | null
}

export interface RigGroup {
    id: string
    name: string
    mode: 'multiplayer' | 'solo'
    rig_ids: string[]
    track: string
    track_layout?: string | null
    weather: string
    car_pool: string[]
    ai_count: number
    ai_difficulty: number
    practice_enabled?: boolean
    practice_time?: number
    qualy_enabled?: boolean
    qualy_time?: number
    race_enabled?: boolean
    race_laps?: number
    penalties_enabled?: boolean
    unlimited_fuel?: boolean
    damage_enabled?: boolean
    allow_wrong_way?: boolean
    sun_angle?: number
    time_mult?: number
    session_duration_min?: number
    ambient_temp?: number
    track_grip?: number
    freeplay?: boolean
    voice_channel?: string | null
}

export interface Driver {
    id?: number
    driver_uuid: string
    display_name: string
    email?: string | null
    phone?: string | null
    created_at?: number
}

export interface LeaderboardEntry {
    id?: number
    rig_id: string
    driver_name?: string | null
    driver_email?: string | null
    driver_uuid?: string | null
    car?: string | null
    track?: string | null
    weather?: string | null
    group_name?: string | null
    session_type?: string | null
    lap: number
    lap_time_ms?: number | null
    session_id?: string | null
    timestamp: number
    notification_pending?: boolean
    is_valid?: boolean
}

export interface GlobalSettings {
    practice_time: number
    qualy_time: number
    race_laps: number
    race_time: number
    allow_drs: boolean
    selected_track: string
    selected_weather: string
    content_folder: string
    sync_source_path?: string
    sync_target_path?: string
    enable_csp: boolean
    discord_webhook_url?: string | null
    discord_channel_name?: string | null
    discord_notify_records?: boolean
    discord_notify_podiums?: boolean
}

export interface Branding {
    logo_url: string
    video_url: string
}

export interface Preset {
    id: string
    name: string
    track: string
    weather: string
    practice_time: number
    qualy_time: number
    race_laps: number
    race_time: number
    allow_drs: boolean
    selected_car?: string | null
    car_pool: string[]
}

export interface StreamSnapshot {
    timestamp: number
    server_status: 'online' | 'offline'
    rigs: Rig[]
    active_rigs_count: number
    idle_rigs_count: number
    setup_rigs_count: number
    total_rigs_count: number
    groups: RigGroup[]
    sessions: any[]
    active_session: any
    top_10_today: LeaderboardEntry[]
    top_10_all_time: LeaderboardEntry[]
    health: {
        heartbeats_ok: boolean
        telemetry_ok: boolean
        server_status: string
    }
}
