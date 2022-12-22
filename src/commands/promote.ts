import { MatrixClient, MessageEvent, MessageEventContent, MembershipEvent } from "matrix-bot-sdk"

import { CommandError, sendMessage, sleep } from "src/utils"
import config from "src/config/env"


export const PROMOTE_COMMAND = "promote"
export const POWER_LEVEL_ALIAS: Record<string, number> = {
  default: 0,
  moderator: 50,
  admin: 100
}

export async function runPromoteCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
  botUserId: string,
): Promise<string> {
  // 1. Retrive and validate arguments
  const [, userId, targetRoomId, powerLevelArg] = args
  if (!userId || !userId.includes(`:${config.MATRIX_SERVER_DOMAIN}`)) {
    const [, wrongHomeServer] = userId.split(":")
    throw new CommandError(
      `The provided user handle is not registered under ${config.MATRIX_SERVER_DOMAIN}, but ${wrongHomeServer}. \nMake sure that username ends with ":${config.MATRIX_SERVER_DOMAIN}"`,
    )
  }
  if (!targetRoomId || !targetRoomId.includes(`:${config.MATRIX_SERVER_DOMAIN}`)) {
    const [, wrongHomeServer] = targetRoomId.split(":")
    throw new CommandError(
      `The provided room handle is not registered under ${config.MATRIX_SERVER_DOMAIN}, but ${wrongHomeServer}. \nMake sure that the room handle ends with ":${config.MATRIX_SERVER_DOMAIN}"`,
    )
  }
  if (!powerLevelArg) {
    throw new CommandError(`Power level argument is missing. It should be a number (0-100).`)
  }

  let powerLevel = NaN
  if (POWER_LEVEL_ALIAS[powerLevelArg] !== undefined) {
    powerLevel = POWER_LEVEL_ALIAS[powerLevelArg]
  } else {
    powerLevel = parseInt(powerLevelArg, 10)
  }
  if (isNaN(powerLevel) || powerLevel < 0 || powerLevel > 100) {
    throw new CommandError(
      `Invalid power level argument. It should be a number (0-100). Provided value: "${powerLevelArg}".`,
    )
  }

  // 2. Check if the room exists
  let room: { name?: string } = {}
  try {
    room = (await client.getRoomStateEvent(targetRoomId, "m.room.name", null)) as { name: string }
  } catch (e) {
    throw new CommandError(`The room "${targetRoomId}" cannot be found.`)
  }

  // 3. Check whether the user is a member of the room
  let userMembershipEvent: MembershipEvent | null = null
  let botMembershipEvent: MembershipEvent | null = null
  try {
    const _roomMemberEvents = (await client.getRoomMembers(targetRoomId)) as unknown as Array<{ event: MembershipEvent }>
    const roomMemberEvents = _roomMemberEvents.map((x) => x.event)
    userMembershipEvent = roomMemberEvents.find((x) => x.sender === userId) || null
    botMembershipEvent = roomMemberEvents.find((x) => x.sender === botUserId) || null
  } catch (e) {
    throw new CommandError(`Unable to retrieve a list of the room members.`)
  }
  if (!botMembershipEvent || botMembershipEvent.content.membership !== "join") {
    throw new CommandError(
      `The bot is not a participant in the room "${room.name}". Make sure the bot has joined the room and has enough power level to promote others.`,
    )
  }
  if (!userMembershipEvent || userMembershipEvent.content.membership !== "join") {
    throw new CommandError(`The user is not a participant in the room "${room.name}".`)
  }

  // 4. Check the current power levels of the user and the bot
  let userPowerLevel: number = NaN
  let botPowerLevel: number = NaN
  let requiredPowerLevel: number = NaN
  try {
    const powerLevelsEvent = await client.getRoomStateEvent(targetRoomId, "m.room.power_levels", null)
    userPowerLevel = powerLevelsEvent.users[userId] || 0
    botPowerLevel = powerLevelsEvent.users[botUserId] || 0
    requiredPowerLevel = powerLevelsEvent.events["m.room.power_levels"] || 0
  } catch (e) {
    throw new CommandError(`Unable to retrieve the current power level of the user.`)
  }
  if (botPowerLevel < requiredPowerLevel) {
    throw new CommandError(
      `The command cannot be executed because the bot's power level (${botPowerLevel}) is lower than the required power level (${requiredPowerLevel}) for changing another user's power level.`,
    )
  }
  if (botPowerLevel < userPowerLevel) {
    throw new CommandError(
      `Cannot assign the required power level (${userPowerLevel}) to the user because the bot has a lower power level (${botPowerLevel}).`,
    )
  }

  // 5. Promote
  await client.setUserPowerLevel(userId, targetRoomId, powerLevel)
  return await sendMessage(
    client,
    roomId,
    `Done! ${
      userMembershipEvent.content?.displayname || "The user"
    } now has a power level of ${powerLevel}${getPowerLevelAliasString(powerLevel)} in the room ${
      room.name
    }. Previously it was ${userPowerLevel}${getPowerLevelAliasString(userPowerLevel)}.`,
  )
}

const getPowerLevelAliasString = (powerLevel: number): string => {
  const alias = Object.keys(POWER_LEVEL_ALIAS).find((x) => POWER_LEVEL_ALIAS[x] === powerLevel)
  return alias ? ` (${alias})` : ""
}
