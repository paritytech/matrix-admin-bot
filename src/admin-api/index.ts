import axios from "axios"

import config from "src/config/env"

import {
  RoomDeletionResponse,
  RoomInfoResponse,
  RoomMembersResponse,
  RoomPowerLevelsEvent,
  UserAccountResponse,
} from "./types"

class AdminApi {
  private host!: string
  private accessToken!: string

  constructor(props: { host: string; accessToken: string }) {
    this.host = props.host
    this.accessToken = props.accessToken
  }

  private async makeRequest(method: string, path: string, data?: Record<string, unknown>): Promise<unknown> {
    return await axios({
      url: `${this.host}/_synapse/admin${path}`,
      method,
      headers: { Authorization: `Bearer ${this.accessToken}` },
      data: data || null,
    }).then((res) => res.data)
  }

  async getRoomInfo(roomId: string): Promise<RoomInfoResponse | null> {
    try {
      return (await this.makeRequest("GET", `/v1/rooms/${roomId}`)) as RoomInfoResponse
    } catch (err) {
      if (err.response.status === 404) {
        return null
      }
      throw err
    }
  }

  async deleteRoom(roomId: string): Promise<RoomDeletionResponse> {
    return (await this.makeRequest("DELETE", `/v1/rooms/${roomId}`, {
      block: true,
      purge: true,
    })) as RoomDeletionResponse
  }

  async getRoomPowerLevelsEvent(roomId: string): Promise<RoomPowerLevelsEvent | null> {
    try {
      const data = (await this.makeRequest("GET", `/v1/rooms/${roomId}/state`)) as {
        state: RoomPowerLevelsEvent[]
      }
      const powerLevelEvent = data.state.find((x) => x.type === "m.room.power_levels")
      if (!powerLevelEvent) {
        return null
      }
      return powerLevelEvent
    } catch (err) {
      if (err.response.status === 404) {
        return null
      }
      throw err
    }
  }

  async getRoomMembers(roomId: string): Promise<RoomMembersResponse | null> {
    try {
      return (await this.makeRequest("GET", `/v1/rooms/${roomId}/members`)) as RoomMembersResponse
    } catch (err) {
      if (err.response.status === 404) {
        return null
      }
      throw err
    }
  }

  async activateUser(userId: string, password: string): Promise<void> {
    await this.makeRequest("PUT", `/v2/users/${userId}`, { deactivated: false, password })
  }

  async deactivateUser(userId: string): Promise<void> {
    await this.makeRequest("PUT", `/v2/users/${userId}`, { deactivated: true })
  }

  async getUserAccount(userId: string): Promise<UserAccountResponse | null> {
    try {
      return (await this.makeRequest("GET", `/v2/users/${userId}`)) as UserAccountResponse
    } catch (err) {
      if (err.response.status === 404) {
        return null
      }
      throw err
    }
  }
}

export const adminApi = new AdminApi({ host: config.MATRIX_SERVER_URL, accessToken: config.ACCESS_TOKEN })