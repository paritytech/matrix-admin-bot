export type RoomInfoResponse = {
  room_id: string
  name: string
  canonical_alias: string | null
  joined_members: number
  joined_local_members: number
  version: string
  creator: string
  encryption: string | null
  federatable: boolean
  public: boolean
  join_rules: string
  guest_access: string
  history_visibility: string
  state_events: number
  avatar: string | null
  topic: string | null
  room_type: string | null
  joined_local_devices: number
  forgotten: boolean
}

export type RoomDeletionResponse = {
  kicked_users: string[]
  failed_to_kick_users: string[]
  local_aliases: string[]
  new_room_id: string | null
}

export type RoomPowerLevelsEvent = {
  content: {
    ban: number
    events: Record<string, number>
    events_default: number
    historical: number
    invite: number
    kick: number
    redact: number
    state_default: number
    users: Record<string, number>
    users_default: number
  },
  origin_server_ts: number
  room_id: string
  sender: string
  state_key: string
  type: string
  unsigned: {
    age: number
  },
  event_id: string
  user_id: string
  age: number
}

export type RoomMembersResponse = {
  members: string[],
  total: number
}

export type UserAccountResponse = {
  name: string,
  displayname: string | null
  threepids: Array<{
    medium: string,
    address: string,
    added_at: number,
    validated_at: number,
  }>
  avatar_url: string | null
  is_guest: number,
  admin: number
  deactivated: number
  erased: boolean,
  shadow_banned: number
  creation_ts: number,
  appservice_id: string | null,
  consent_server_notice_sent: string | null,
  consent_version: string | null,
  consent_ts: string | null,
  external_ids: Array<{
    auth_provider: string
    external_id: string
  }>
  user_type: string | null,
}
