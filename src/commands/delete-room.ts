import htmlEscape from "escape-html"
import { LogService, MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import { adminApi } from "src/admin-api"
import { RoomInfoResponse } from "src/admin-api/types"
import config from "src/config/env"
import { commandPrefix } from "src/constants"
import { canExecuteCommand, CommandError, matrixRoomAliasRegex, sendMessage, TemporaryState } from "src/utils"

const moduleName = "DeleteRoomCommand"
export const DELETE_ROOM_COMMAND = "delete-room"
const DELTE_ROOM_CONFIRMATION_FLAG = "confirm"
const DELETE_ROOM_CONFIRMATION_DELAY_MINUTES = 2

type State = {
  roomId: string
  roomName: string
}
const tempState = new TemporaryState<State>({ ttl: 1e3 * 60 * DELETE_ROOM_CONFIRMATION_DELAY_MINUTES })

export async function runDeleteRoomCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
): Promise<string> {
  // 0. Perform room deletion (after confirmation)
  if (args[1] === DELTE_ROOM_CONFIRMATION_FLAG) {
    const request = tempState.get(event.sender)
    if (!request) {
      throw new CommandError(
        `There is nothing to confirm. It is possible that your room deletion request has expired. Please run the command for deleting the room again.`,
      )
    }
    tempState.delete(event.sender)
    await sendMessage(client, roomId, `Beginning the process of removing the room "${request.roomName}"...`)
    let deletionResponse
    try {
      deletionResponse = await adminApi.deleteRoom(request.roomId)
    } catch (e) {
      LogService.error(moduleName, e)
      throw new CommandError(`Unable to delete the room. An error has occurred.`)
    }
    const kickedUserIds = deletionResponse.kicked_users
    const failedToKickUserIds = deletionResponse.failed_to_kick_users
    const html = `Done! The room "${request.roomName}" has been successfully deleted.${
      failedToKickUserIds.length
        ? `<br /><br />Failed to kick users:<br/><pre>${failedToKickUserIds.join("\n")}</pre>`
        : ""
    }${kickedUserIds.length ? `<br /><br />Kicked users:<br /><pre>${kickedUserIds.join("\n")}</pre>` : ""}`
    return await client.sendHtmlText(roomId, html)
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
  const canExecute = await canExecuteCommand(event.sender, roomId, targetRoomId)
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

  // 4. Prompt the user if they're sure to delete the room
  tempState.set(event.sender, { roomId: targetRoomId, roomName: room.name })
  const command = `${commandPrefix} ${DELETE_ROOM_COMMAND} ${DELTE_ROOM_CONFIRMATION_FLAG}`
  const html = `Are you sure you want to remove the room "${
    room.name
  }" completely?<br />To proceed with the deletion, please reply with the following command within ${DELETE_ROOM_CONFIRMATION_DELAY_MINUTES} minute${
    DELETE_ROOM_CONFIRMATION_DELAY_MINUTES > 1 ? "s" : ""
  }:<br /><code>${htmlEscape(command)}</code>`
  return await client.sendHtmlText(roomId, html)
}
