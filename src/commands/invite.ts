import { LogService, MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"
import { MatrixProfileInfo } from "matrix-bot-sdk/lib/models/MatrixProfile"

import { groupedRooms } from "src/config/rooms"
import { CommandError, sendMessage, sleep } from "src/utils"

const moduleName = "InviteCommand"
export const defaultGroups = groupedRooms.filter((group) => group.default).map((group) => group.groupName)

export const INVITE_COMMAND = "invite"

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
  await sendMessage(client, roomId, `Started sending invites of ${username} to ${groups.join(", ")} groups`)
  const report: InviteReport = await inviteUserToRooms(client, rooms, userId)

  let resultMessage = `Added ${username} to ${report.succeedInviteCount}/${rooms.length} rooms`

  if (report.failedInvites.length) {
    resultMessage += "\n\nFailed invites:\n" + report.failedInvites.join("\n") + "\nDone!"
    LogService.error(moduleName, resultMessage)
  } else {
    resultMessage += " 🎉"
  }

  // Now send that message as a notice (along with failed invite messages, if there are).
  return await sendMessage(client, roomId, resultMessage)
}

function getRoomsByGroups(groupNames: string[]): RoomsList {
  const roomsSet = new Set<string>()

  const existingGroups = groupedRooms.map((group) => group.groupName)
  const wrongGroups = groupNames.filter((groupName) => !existingGroups.includes(groupName))

  // stop execution, so user has a chance to fix (if it was a typo)
  if (wrongGroups?.length) {
    throw new CommandError(`Groups "${wrongGroups.join(", ")}" were not found`)
  }

  // add each group of rooms to set, so the merged list is unique
  groupNames.forEach((groupName) => {
    const foundGroup = groupedRooms.find((group) => group.groupName == groupName)
    foundGroup?.list.forEach((room) => roomsSet.add(room.id))
  })

  return [...roomsSet]
}

async function getUserDisplayName(client: MatrixClient, userId: string): Promise<string> {
  const user = (await client.getUserProfile(userId)) as MatrixProfileInfo

  if (!user.displayname) {
    throw new CommandError(`Can not find the user "${userId}"`)
  }

  return user.displayname
}

async function inviteUserToRooms(client: MatrixClient, rooms: RoomsList, userId: string): Promise<InviteReport> {
  const report: InviteReport = { failedInvites: [], succeedInviteCount: 0 }

  for (const inviteToRoomId of rooms) {
    let room: { name?: string } = {}

    // check if room exists. Also, we'll use its name
    try {
      room = (await client.getRoomStateEvent(inviteToRoomId, "m.room.name", null)) as { name: string }
    } catch (e) {
      report.failedInvites.push(`Can't find room "${inviteToRoomId}", skipping it.`)
    }

    // skip if room wasn't found
    if (room?.name) {
      const roomName = `room: "${room.name}" (${inviteToRoomId})`
      try {
        await client.inviteUser(userId, inviteToRoomId)
        report.succeedInviteCount++
        LogService.info(moduleName, `Invited ${userId} to ${roomName}`)
      } catch (e) {
        const errorMessage: string = ((e?.body?.error as string) || `Failed to add ${userId}`) + ` | ` + roomName
        report.failedInvites.push("- " + errorMessage)
      }
    }

    await sleep(300)
  }

  return report
}
