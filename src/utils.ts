import { MatrixClient, LogService, EncryptionAlgorithm } from "matrix-bot-sdk"
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

export const matrixRoomAliasRegex = new RegExp(
  `^#([A-Za-z0-9_.-]+):${config.MATRIX_SERVER_DOMAIN.replace(/\./g, ".")}$`,
)

export const matrixRoomIdRegex = new RegExp(`^!([A-Za-z0-9]+):${config.MATRIX_SERVER_DOMAIN.replace(/\./g, ".")}$`)

export const matrixUserIdRegex = new RegExp(`^@([A-Za-z0-9_.-]+):${config.MATRIX_SERVER_DOMAIN.replace(/\./g, ".")}$`)

export async function resolveRoomAlias(client: MatrixClient, roomIdOrAlias: string): Promise<string | null> {
  let roomId = roomIdOrAlias
  if (matrixRoomAliasRegex.test(roomIdOrAlias)) {
    try {
      roomId = (await client.resolveRoom(roomIdOrAlias)) as string
    } catch (e) {
      return null
      // throw new CommandError(`The provided room handle does not represent a room`)
    }
  }
  return roomId
}

export async function createDmRoom(client: MatrixClient, userId: string, encryption = false): Promise<string> {
  const directEvent = await getAccountDataDirect(client)
  const currentDmRoomIds = (directEvent[userId] || []).filter(Boolean)

  const roomId = await client.createRoom({
    invite: [userId],
    is_direct: true,
    visibility: "private",
    initial_state: encryption
      ? [{ type: "m.room.encryption", state_key: "", content: { algorithm: EncryptionAlgorithm.MegolmV1AesSha2 } }]
      : [],
  })
  LogService.info("utils", `Created a new DM room ${roomId} for user ${userId} (E2EE: ${encryption})`)

  directEvent[userId] = [roomId].concat(currentDmRoomIds)
  await client.setAccountData("m.direct", directEvent)
  return roomId
}

export async function ensureEncryptedDmRoom(client: MatrixClient, userId: string): Promise<string | null> {
  await fixDms(client, userId)
  const directEvent = await getAccountDataDirect(client)
  const dmRoomIds = (directEvent[userId] || []).filter(Boolean)

  for (const roomId of dmRoomIds) {
    const events = await client.getRoomState(roomId)
    const encryptionEvent = events.find((x) => x.type === "m.room.encryption")
    if (!encryptionEvent) {
      continue
    }
    const membershipEvent = events.find((x) => x.type === "m.room.member" && x.state_key === userId)
    if (membershipEvent?.content?.membership === "join") {
      return roomId
    }
    return null
  }

  await createDmRoom(client, userId, true)
  return null
}

export async function ensureDmRoom(client: MatrixClient, userId: string): Promise<string> {
  await fixDms(client, userId)
  const directEvent = await getAccountDataDirect(client)
  const dmRoomIds = (directEvent[userId] || []).filter(Boolean)

  for (const roomId of dmRoomIds) {
    const events = await client.getRoomState(roomId)
    const encryptionEvent = events.find((x) => x.type === "m.room.encryption")
    const membershipEvent = events.find((x) => x.type === "m.room.member" && x.state_key === userId)
    if (encryptionEvent && membershipEvent?.content?.membership === "join") {
      return roomId
    }
  }

  const roomId = await createDmRoom(client, userId, false)
  return roomId
}

export function usernameToLocalpart(username: string): string {
  return username.replace(/^@/, "").replace(new RegExp(`:${config.MATRIX_SERVER_DOMAIN}$`), "")
}

export function localpartToUserId(localpart: string): string {
  let result = localpart
  if (!result.startsWith("@")) {
    result = `@${result}`
  }
  if (!result.endsWith(`:${config.MATRIX_SERVER_DOMAIN}`)) {
    result += `:${config.MATRIX_SERVER_DOMAIN}`
  }
  return result
}

async function fixDms(client: MatrixClient, userId: string): Promise<void> {
  const directEvent = await getAccountDataDirect(client)
  const currentRooms = (directEvent[userId] || []).filter(Boolean)
  if (!currentRooms.length) return

  const toKeep: string[] = []
  for (const roomId of currentRooms) {
    try {
      const members = await client.getAllRoomMembers(roomId)
      const joined = members.filter((m) => m.effectiveMembership === "join" || m.effectiveMembership === "invite")
      if (joined.some((m) => m.membershipFor === userId)) {
        toKeep.push(roomId)
      }
    } catch (e) {}
  }

  if (toKeep.length === currentRooms.length) return
  directEvent[userId] = toKeep
  await client.setAccountData("m.direct", directEvent)
}

async function getAccountDataDirect(client: MatrixClient): Promise<Record<string, string[]>> {
  try {
    return (await client.getAccountData("m.direct")) || {}
  } catch (e) {
    return {}
  }
}
