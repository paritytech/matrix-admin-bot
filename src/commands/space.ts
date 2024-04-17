import { AxiosError } from "axios"
import htmlEscape from "escape-html"
import { LogService, MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import config from "src/config/env"
import { CommandError, resolveRoomAlias, sendMessage } from "src/utils"

import { adminApi } from "../admin-api"
import { RoomInfoShort } from "../admin-api/types"

const moduleName = "SpaceCommand"
export const SPACE_COMMAND = "space"

export async function runSpaceCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
): Promise<string> {
  // 1. Retrive and validate arguments
  const [, spaceRoomIdOrAlias, operator, targetRoomIdOrAlias] = args
  if (!spaceRoomIdOrAlias) {
    throw new CommandError(`Missing space room id argument`)
  }
  const spaceRoomId = await resolveRoomAlias(client, spaceRoomIdOrAlias)
  if (!spaceRoomId) {
    throw new CommandError(`The provided space handle does not represent a space`)
  }
  if (!["add", "remove", "list"].includes(operator)) {
    throw new CommandError(`Invalid operator. Should be "add", "remove", or "list"`)
  }
  let targetRoomId: string | null
  if (operator === "add" || operator === "remove") {
    if (!targetRoomIdOrAlias) {
      throw new CommandError(`Missing target room id argument`)
    }
    targetRoomId = await resolveRoomAlias(client, targetRoomIdOrAlias)
    if (!targetRoomId) {
      throw new CommandError(`The provided target room handle does not represent a room`)
    }
  }

  // 2. Execute a command
  switch (operator) {
    case "list": {
      await listSpace(roomId, client, spaceRoomId)
      break
    }
    case "add": {
      await addRoomInSpace(roomId, client, spaceRoomId, targetRoomId!)
      break
    }
    case "remove": {
      await removeRoomFromSpace(roomId, client, spaceRoomId, targetRoomId!)
      break
    }
  }

  return ""
}

async function listSpace(roomId: string, client: MatrixClient, spaceRoomId: string) {
  const rooms = await adminApi.getRooms()
  const roomsById = rooms.reduce((acc, x) => {
    return { ...acc, [x.room_id]: x }
  }, {} as Record<string, RoomInfoShort>)
  const space = roomsById[spaceRoomId]
  if (!space) {
    return await sendMessage(client, roomId, `Space not found`)
  }
  const spaceRoomState = await adminApi
    .getRoomState(space.room_id)
    .catch((err: AxiosError<{ error: string; errcode: string }>) => {
      if (err.response?.data?.error) {
        throw new CommandError(err.response.data.error)
      }
      throw new CommandError(`Can't get "${space.name}" space state`)
    })
  const childRoomsMessage = spaceRoomState.state
    .filter((x) => x.type === "m.space.child" && x.content?.via)
    .map((x) => roomsById[x.state_key])
    .filter(Boolean)
    .map((x) => `${x.name} (${x.room_id})${x.room_type === "m.space" ? " [SPACE]" : ""}`)
    .join("\n")

  const html = `"${space.name}" space rooms:<br /><pre>${htmlEscape(childRoomsMessage)}</pre>`
  return await client.sendHtmlText(roomId, html)
}

async function addRoomInSpace(roomId: string, client: MatrixClient, spaceRoomId: string, targetRoomId: string) {
  const space = await client.getSpace(spaceRoomId).catch(() => null)
  if (!space) {
    throw new CommandError(`Space with id "${spaceRoomId}" not found`)
  }
  const spaceRoomInfo = await adminApi.getRoomInfo(spaceRoomId)
  const targetRoomInfo = await adminApi.getRoomInfo(targetRoomId)
  await space.addChildRoom(targetRoomId, { via: [config.MATRIX_SERVER_DOMAIN], suggested: false })
  const message = `Room "${targetRoomInfo?.name}" has been added to the space "${spaceRoomInfo?.name}"`
  await sendMessage(client, roomId, message)
  LogService.info(moduleName, message)
}

async function removeRoomFromSpace(roomId: string, client: MatrixClient, spaceRoomId: string, targetRoomId: string) {
  const space = await client.getSpace(spaceRoomId).catch(() => null)
  if (!space) {
    throw new CommandError(`Space with id "${spaceRoomId}" not found`)
  }
  const spaceRoomInfo = await adminApi.getRoomInfo(spaceRoomId)
  const targetRoomInfo = await adminApi.getRoomInfo(targetRoomId)
  await space.removeChildRoom(targetRoomId)
  const message = `Room "${targetRoomInfo?.name}" has been removed from the space "${spaceRoomInfo?.name}"`
  await sendMessage(client, roomId, message)
  LogService.info(moduleName, message)
}
