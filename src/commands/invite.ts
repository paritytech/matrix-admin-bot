import {
  LogService,
  MatrixClient,
  MessageEvent,
  MessageEventContent,
} from "matrix-bot-sdk"
import { MatrixProfileInfo } from "matrix-bot-sdk/lib/models/MatrixProfile"

import { groupedRooms, RoomGroups } from "src/config/rooms"
import { CommandError, sleep } from "src/utils"

const MATRIX_HOMESERVER = "matrix.parity.io"

const moduleName = "InviteCommand"
export const defaultGroups = [RoomGroups.common, RoomGroups.engineering]

type InviteReport = { succeedInviteCount: number; failedInvites: string[] }
type RoomsList = string[]

export async function runInviteCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
): Promise<string> {
  const [, userId, ...userGroups] = args
  const groups: string[] = userGroups?.length ? userGroups : defaultGroups
  const username: string = await getUserDisplayName(client, userId)
  const rooms: RoomsList = getRoomsByGroups(groups)

  if (!userId.includes(`:${MATRIX_HOMESERVER}`)) {
    // userId is something like "@username:identity.server.org"
    const [, wrongHomeServer] = userId.split(":")
    throw new CommandError(
      `This handle is not registered under ${MATRIX_HOMESERVER}, but ${wrongHomeServer}. \nMake sure that username ends with ":${MATRIX_HOMESERVER}"`,
    )
  }

  await sendMessage(
    client,
    roomId,
    `Started sending invites of ${username} to ${groups.join(", ")} groups`,
  )
  const report: InviteReport = await inviteUserToRooms(client, rooms, userId)

  let resultMessage = `Added ${username} to ${report.succeedInviteCount}/${rooms.length} rooms`

  if (report.failedInvites.length) {
    resultMessage +=
      "\n\nFailed invites:\n" + report.failedInvites.join("\n") + "\nDone!"
    LogService.error(moduleName, resultMessage)
  } else {
    resultMessage += " 🎉"
  }

  // Now send that message as a notice (along with failed invite messages, if there are).
  return await sendMessage(client, roomId, resultMessage)
}

function getRoomsByGroups(groups: string[]): RoomsList {
  const roomsSet = new Set<string>()

  // see if some wrong groups used
  const wrongGroups = groups.filter((group) => {
    return !Object.keys(RoomGroups).includes(group)
  })

  // stop execution, so user has a chance to fix (if it was a typo)
  if (wrongGroups?.length) {
    throw new CommandError(`Groups "${wrongGroups.join(", ")}" were not found`)
  }

  // add each group of rooms to set, so the merged list is unique
  groups.forEach((group) => {
    groupedRooms[group].forEach((rooms) => {
      roomsSet.add(rooms)
    })
  })

  return [...roomsSet]
}

async function getUserDisplayName(
  client: MatrixClient,
  userId: string,
): Promise<string> {
  const user = (await client.getUserProfile(userId)) as MatrixProfileInfo

  if (!user.displayname) {
    throw new CommandError(`Can not find the user "${userId}"`)
  }

  return user.displayname
}

async function inviteUserToRooms(
  client: MatrixClient,
  rooms: RoomsList,
  userId: string,
): Promise<InviteReport> {
  const report: InviteReport = { failedInvites: [], succeedInviteCount: 0 }

  for (const inviteToRoomId of rooms) {
    let room: { name?: string } = {}

    // check if room exists. Also, we'll use its name
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

  return report
}

function sendMessage(
  client: MatrixClient,
  roomId: string,
  message: string,
): Promise<string> {
  return client.sendMessage(roomId, { body: message, msgtype: "m.notice" })
}
