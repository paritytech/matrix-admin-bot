import { MatrixClient } from "matrix-bot-sdk"
import { nanoid } from "nanoid"

import { adminApi } from "src/admin-api"
import config from "src/config/env"

import { CommandReport } from "./admin-api/types"

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
  state: Record<string, { timestamp: number; value: StateRecord }> = {}
  ttl = 1e3 * 60 * 3 // 3 min
  constructor(props: TemporaryStateProps) {
    if (props.ttl) {
      this.ttl = props.ttl
    }
  }
  private clearUp() {
    const now = Date.now()
    const newState: Record<string, { timestamp: number; value: StateRecord }> = {}
    for (const key in this.state) {
      const record = this.state[key]
      if (now - record.timestamp < this.ttl) {
        newState[key] = record
      }
    }
    this.state = newState
  }
  public set(key: string, value: StateRecord): void {
    this.clearUp()
    this.state[key] = { timestamp: Date.now(), value }
  }
  public get(key: string): StateRecord | null {
    const record = this.state[key]
    return record !== undefined ? record.value : null
  }
  public delete(key: string): void {
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

export function generatePassword(): string {
  return nanoid(16)
}

function chunkBy(value: string, maxLength: number, separator = "\n"): string[] {
  const lines = value.split(separator)
  const result = []
  for (let i = 0; i < lines.length; i += maxLength) {
    const chunk = lines.slice(i, i + maxLength).join(separator)
    result.push(chunk)
  }
  return result
}

export async function sendReport(client: MatrixClient, report: CommandReport, roomId: string) {
  const reportContent = report.failedInvites.concat(report.succeedInvites).join("\n")
  if (!reportContent) {
    return ""
  }
  const reportContentChunks = chunkBy(reportContent, 100, "\n")

  for (const [i, chunk] of reportContentChunks.entries()) {
    await client.sendHtmlText(
      roomId,
      `Command execution report ${i + 1}/${reportContentChunks.length}<br /><pre>${chunk}</pre>`,
    )
  }
}

export function getErrorMessage(e: any) {
  if (e instanceof CommandError) {
    return e.message
  } else if (typeof e?.body?.error === "string") {
    return e.body.error as string
  } else {
    return `unknown problem`
  }
}

export async function validateUserAuthProvider(userId: string): Promise<void> {
  const account = await adminApi.getUserAccount(userId)
  if (
    !account ||
    !account.external_ids?.length ||
    !account.external_ids.some((x) => x.auth_provider === config.USER_AUTH_PROVIDER)
  ) {
    throw new CommandError(`Wrong authentication provider. Should be "${config.USER_AUTH_PROVIDER}"`)
  }
}
