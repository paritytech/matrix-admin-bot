import axios from "axios"
import config from "src/config/env"

class AdminApi {
  private host!: string
  private accessToken!: string

  constructor(props: { host: string; accessToken: string }) {
    this.host = props.host
    this.accessToken = props.accessToken
  }

  private async makeRequest(method: string, path: string, data?: Record<string, unknown>): Promise<unknown> {
    return axios({
      url: `${this.host}/_synapse/admin${path}`,
      method,
      headers: { Authorization: `Bearer ${this.accessToken}` },
      data: data || null,
    }).then((res) => res.data)
  }

  async getRoomInfo(roomId: string): Promise<RoomInfoResponse | null> {
    try {
      const data = (await this.makeRequest("GET", `/v1/rooms/${roomId}`)) as RoomInfoResponse
      return data
    } catch (err) {
      if (err.response.status === 404) {
        return null
      }
      throw err
    }
  }

  async deleteRoom(roomId: string): Promise<RoomDeletionResponse> {
    const data = (await this.makeRequest("DELETE", `/v1/rooms/${roomId}`, {
      block: true,
      purge: true,
    })) as RoomDeletionResponse
    return data
  }
}

export const adminApi = new AdminApi({ host: config.MATRIX_SERVER_URL, accessToken: config.ACCESS_TOKEN })

type RoomInfoResponse = {
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

type RoomDeletionResponse = {
  kicked_users: string[]
  failed_to_kick_users: string[]
  local_aliases: string[]
  new_room_id: string | null
}
