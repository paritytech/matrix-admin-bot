import {
  LogService,
  MatrixClient,
  MessageEvent,
  MessageEventContent,
} from "matrix-bot-sdk"
import { MatrixProfileInfo } from "matrix-bot-sdk/lib/models/MatrixProfile"

// eslint-disable-next-line no-restricted-imports
import { groupedRooms, RoomGroups } from "../config/rooms"
// eslint-disable-next-line no-restricted-imports
import { sleep } from "../utils"

const moduleName = "InviteCommand"
export const roomsGroupSeparator = "|"
export const defaultGroup = [RoomGroups.common, RoomGroups.engineering]

export async function runInviteCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
) {
  const [, userId, groups] = args
  let rooms: string[] = []
  const report: { succeedInviteCount: number; failedInvites: string[] } = {
    failedInvites: [],
    succeedInviteCount: 0,
  }
  const user: MatrixProfileInfo = (await client.getUserProfile(
    userId,
  )) as MatrixProfileInfo

  if (!user.displayname) {
    throw new Error(`Can not find the user "${userId}"`)
  }

  if (groups?.length && groups.includes(roomsGroupSeparator)) {
    rooms = groups
      .trim()
      .split(roomsGroupSeparator)
      .reduce((acc, group) => {
        if (group in RoomGroups && groupedRooms[group]?.length) {
          acc.push(...groupedRooms[group])
        }
        return acc
      }, [] as string[])
  } else {
    // if no groups, just do invite in most common rooms
    defaultGroup.forEach((group) => {
      rooms.push(...groupedRooms[group])
    })
  }

  for (const inviteToRoomId of rooms) {
    let room: { name?: string } = {}

    // check if room exists. Also we'll use its name
    try {
      room = (await client.getRoomStateEvent(
        inviteToRoomId,
        "m.room.name",
        null,
      )) as { name: string }
    } catch (e) {
      report.failedInvites.push(
        `Can't find room "${inviteToRoomId}", skipping it.`,
      )
    }

    // skip if room wasn't found
    if (room?.name) {
      const roomName = `room: "${room.name}" (${inviteToRoomId})`
      try {
        await client.inviteUser(userId, inviteToRoomId)
        report.succeedInviteCount++
        LogService.info(moduleName, `Invited ${userId} to ${roomName}`)
      } catch (e) {
        const errorMessage: string =
          ((e?.body?.error as string) || `Failed to add ${userId}`) +
          ` | ` +
          roomName
        report.failedInvites.push("- " + errorMessage)
      }
    }

    await sleep(300)
  }

  let resultMessage = `Added ${user.displayname} to ${report.succeedInviteCount}/${rooms.length} rooms`

  if (report.failedInvites.length) {
    resultMessage += "\n👎 Failed invites:\n" + report.failedInvites.join("\n")
    LogService.error(moduleName, resultMessage)
  } else {
    resultMessage += " 🎉"
  }

  // Now send that message as a notice (along with failed invite messages, if there are).
  return client.sendMessage(roomId, {
    body: resultMessage,
    msgtype: "m.notice",
  })
}
