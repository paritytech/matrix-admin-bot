import { MatrixClient } from "matrix-bot-sdk"

import config from "src/config/env"
import { adminApi } from "src/admin-api"


export class CommandError extends Error {}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @returns {Promise<string>} resolves to the event ID that represents the event
 */
export function sendMessage(client: MatrixClient, roomId: string, message: string): Promise<string> {
  return client.sendMessage(roomId, { body: message, msgtype: "m.notice" })
}

type TemporaryStateProps = { ttl?: number }
export class TemporaryState<StateRecord> {
  state: Record<string, { timestamp: number, value: StateRecord }> = {}
  ttl = 1e3 * 60 * 3 // 3 min
  constructor(props: TemporaryStateProps) {
    if (props.ttl) {
      this.ttl = props.ttl
    }
  }
  private clearUp() {
    const now = Date.now()
    const newState: Record<string, { timestamp: number, value: StateRecord }> = {}
    for (const key in this.state) {
      const record = this.state[key]
      if (now - record.timestamp < this.ttl) {
        newState[key] = record
      }
    }
    this.state = newState
  }
  public set(key: string, value: StateRecord) {
    this.clearUp()
    this.state[key] = { timestamp: Date.now(), value }
  }
  public get(key: string): StateRecord | null {
    const record = this.state[key]
    return record ? record.value : null
  }
  public delete(key: string) {
    this.clearUp()
    delete this.state[key]
  }
}

export async function canExecuteCommand(userId: string, roomId: string, targetRoomId?: string): Promise<boolean> {
  if (config.ADMIN_ROOM_ID === roomId) {
    return true
  } else if (targetRoomId) {
    const powerLevelsEvent = await adminApi.getRoomPowerLevelsEvent(targetRoomId)
    const powerLevel = powerLevelsEvent?.content.users[userId] || 0
    return powerLevel === 100
  }
  return false
}
