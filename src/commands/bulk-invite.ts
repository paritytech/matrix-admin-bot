import htmlEscape from "escape-html"
import { LogService, MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import { adminApi } from "src/admin-api"
import { CommandReport, RoomInfoResponse } from "src/admin-api/types"
import config from "src/config/env"
import { commandPrefix } from "src/constants"
import { canExecuteCommand, CommandError, matrixRoomAliasRegex, sendMessage, TemporaryState } from "src/utils"

const moduleName = "BulkInviteCommand"
export const BULK_INVITE_COMMAND = "bulk-invite"
const CONFIRMATION_FLAG = "confirm"
const CONFIRMATION_DELAY_MINUTES = 2

type State = {
  roomId: string
  roomName: string
  roomAlias: string | null
}
const tempState = new TemporaryState<State>({ ttl: 1e3 * 60 * CONFIRMATION_DELAY_MINUTES })

function chunkBy(value: string, maxLength: number, separator = "\n"): string[] {
  const lines = value.split(separator)
  const result = []
  for (let i = 0; i < lines.length; i += maxLength) {
    const chunk = lines.slice(i, i + maxLength).join(separator)
    result.push(chunk)
  }
  return result
}

export async function runBulkInviteCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
): Promise<string> {
  // 0. Perform bulk invitation (after confirmation)
  if (args[1] === CONFIRMATION_FLAG) {
    const request = tempState.get(event.sender)
    if (!request) {
      throw new CommandError(
        `There is nothing to confirm. It is possible that your bulk invitation request has expired. Please run the command again.`,
      )
    }
    tempState.delete(event.sender)

    // Fetch users
    await sendMessage(client, roomId, `Preparing to execute the command...`)
    let users
    try {
      users = await adminApi.getUserAccounts()
    } catch (err) {
      throw new CommandError(`Failed to retrieve user accounts`)
    }
    await sendMessage(client, roomId, `Starting to invite ${users.length} users to the "${request.roomName}" room.`)

    // Iterate over users
    const report: CommandReport = { failedInvites: [], succeedInvites: [], skippedInvitesNumber: 0 }
    for (const user of users) {
      try {
        await validateUserAuthProvider(user.name)
        await client.inviteUser(user.name, request.roomId)
        report.succeedInvites.push(`✓ Successfully invited ${user.name}`)
        LogService.info(
          moduleName,
          `Invited ${user.name} to room "${request.roomName}" (${request.roomAlias || request.roomId})`,
        )
      } catch (e) {
        let errorMessage = ""
        if (e instanceof CommandError) {
          errorMessage = e.message
        } else if (typeof e?.body?.error === "string") {
          errorMessage = e.body.error as string
        } else {
          errorMessage = `unknown problem`
        }
        if (errorMessage.endsWith("is already in the room.")) {
          report.skippedInvitesNumber++
        } else {
          report.failedInvites.push(`✕ Failed to invite ${user.name} | ` + errorMessage)
        }
      }
    }

    await sendMessage(
      client,
      roomId,
      [
        `Done! Successfully invited ${report.succeedInvites.length} users to the room "${request.roomName}".`,
        report.skippedInvitesNumber
          ? `${report.skippedInvitesNumber} user${
              report.skippedInvitesNumber === 1 ? " is" : "s are"
            } already in the room.`
          : null,
        report.failedInvites.length ? `Failed to invite ${report.failedInvites.length} users` : null,
      ]
        .filter(Boolean)
        .join(" "),
    )

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

    return ""
  }

  // 1. Retrive and validate arguments
  const [, targetRoomIdOrAlias] = args
  if (!event.sender.includes(`:${config.MATRIX_SERVER_DOMAIN}`)) {
    throw new CommandError(`Access denied.`)
  }
  if (!targetRoomIdOrAlias || !targetRoomIdOrAlias.includes(`:${config.MATRIX_SERVER_DOMAIN}`)) {
    const [, wrongHomeServer] = targetRoomIdOrAlias.split(":")
    throw new CommandError(
      `The provided room handle is not registered under ${config.MATRIX_SERVER_DOMAIN}, but ${wrongHomeServer}. \nMake sure that the room handle ends with ":${config.MATRIX_SERVER_DOMAIN}"`,
    )
  }
  let targetRoomId = targetRoomIdOrAlias
  if (matrixRoomAliasRegex.test(targetRoomIdOrAlias)) {
    try {
      targetRoomId = (await client.resolveRoom(targetRoomIdOrAlias)) as string
    } catch (e) {
      throw new CommandError(`The provided room handle does not represent a room`)
    }
  }

  // 2. Ensure the user can execute the command
  const canExecute = await canExecuteCommand(event.sender, roomId)
  if (!canExecute) {
    throw new CommandError(`Access denied`)
  }

  // 3. Retrieve room details
  let room: RoomInfoResponse | null = null
  try {
    room = await adminApi.getRoomInfo(targetRoomId)
  } catch (e) {
    LogService.error(moduleName, e)
    throw new CommandError(`Unable to retrieve room details.`)
  }
  if (!room) {
    throw new CommandError(`The room "${targetRoomId}" cannot be found.`)
  }

  // 4. Ensure the bot is admin in the target room
  const botUserId = await client.getUserId()
  const powerLevelsEvent = await adminApi.getRoomPowerLevelsEvent(targetRoomId)
  const powerLevel = powerLevelsEvent?.content.users[botUserId] || 0
  if (powerLevel !== 100) {
    throw new CommandError(
      `Command rejected. Please make sure the bot has been invited to the "${room.name}" room and has admin privileges.`,
    )
  }

  // 5. Prompt the user if they're sure to delete the room
  tempState.set(event.sender, {
    roomId: targetRoomId,
    roomName: room.name,
    roomAlias: targetRoomId !== targetRoomIdOrAlias ? targetRoomIdOrAlias : null,
  })
  const command = `${commandPrefix} ${BULK_INVITE_COMMAND} ${CONFIRMATION_FLAG}`
  const html = `Are you sure you want to invite all members of the current server to the "${
    room.name
  }" room?<br />To proceed with the bulk invitation, please reply with the following command within ${CONFIRMATION_DELAY_MINUTES} minute${
    CONFIRMATION_DELAY_MINUTES > 1 ? "s" : ""
  }:<br /><code>${htmlEscape(command)}</code>`
  return await client.sendHtmlText(roomId, html)
}

async function validateUserAuthProvider(userId: string): Promise<void> {
  const account = await adminApi.getUserAccount(userId)
  if (
    !account ||
    !account.external_ids?.length ||
    !account.external_ids.some((x) => x.auth_provider === config.USER_AUTH_PROVIDER)
  ) {
    throw new CommandError(`Wrong authentication provider. Should be "${config.USER_AUTH_PROVIDER}"`)
  }
}
