import { MatrixClient } from "matrix-bot-sdk"


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