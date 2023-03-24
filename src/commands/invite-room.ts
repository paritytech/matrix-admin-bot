import { LogService, MatrixClient, MessageEvent, MessageEventContent, MembershipEvent } from "matrix-bot-sdk"
import { adminApi } from "src/admin-api"
import { CommandReport, RoomInfoResponse, RoomMember } from "src/admin-api/types"
import {
  CommandError,
  sendMessage,
  canExecuteCommand,
  sendReport,
  getErrorMessage,
  validateUserAuthProvider,
} from "src/utils"

const moduleName = "InviteRoomCommand"
export const INVITE_ROOM = "invite-room"

export async function runInviteRoomCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
  botUserId: string,
) {
  await sendMessage(client, roomId, `Preparing to execute the command...`)

  // 1. Retrive and validate arguments
  const [, targetRoomId] = args
  if (!targetRoomId) {
    throw new CommandError("Target room id is missing.")
  }

  // 2. Ensure the user can execute the command
  const canExecute = await canExecuteCommand(event.sender, roomId, targetRoomId)
  if (!canExecute) {
    throw new CommandError(
      `Command rejected. Please make sure the bot has been invited to the "${roomId}" room and has admin privileges.`,
    )
  }

  // 3. Retrieve room details
  let targetRoom: RoomInfoResponse | null = null
  let currentRoom: RoomInfoResponse | null = null
  try {
    targetRoom = await adminApi.getRoomInfo(targetRoomId)
    currentRoom = await adminApi.getRoomInfo(roomId)
  } catch (e) {
    LogService.error(moduleName, e)
    throw new CommandError(`Unable to retrieve room details.`)
  }

  if (!targetRoom) {
    throw new CommandError(`The room "${targetRoomId}" cannot be found.`)
  }
  if (!currentRoom) {
    throw new CommandError(`There was an issue retrieving information about the current room "${roomId}".`)
  }

  // 3. Get members of the current room to invite to the targetRoom
  await sendMessage(client, roomId, `Fetching member list of the current room ${currentRoom.name}.`)

  let roomMemberEvents: RoomMember[]
  try {
    const _roomMemberEvents = (await client.getRoomMembers(roomId)) as unknown as Array<{
      event: MembershipEvent
    }>
    roomMemberEvents = _roomMemberEvents.map((x) => x.event as unknown as RoomMember)

    await sendMessage(
      client,
      roomId,
      [`Current room ${currentRoom.name} has ${roomMemberEvents.length} memebers`].filter(Boolean).join(" "),
    )
    await sendMessage(
      client,
      roomId,
      `Starting to invite ${roomMemberEvents.length} users to the "${targetRoom.name}" room.`,
    )
  } catch (e) {
    throw new CommandError(`Could not retrieve a list of members from the room ${roomId}`)
  }

  // Iterate over users
  const report: CommandReport = { failedInvites: [], succeedInvites: [], skippedInvitesNumber: 0 }
  for (const user of roomMemberEvents) {
    try {
      if (user.user_id == botUserId) {
        report.skippedInvitesNumber++
        continue
      }
      await validateUserAuthProvider(user.user_id)
      await client.inviteUser(user.user_id, targetRoomId)
      report.succeedInvites.push(`✓ Successfully invited ${user.user_id}`)
      LogService.info(
        moduleName,
        `Invited ${user.content.displayname} (${user.user_id}) to room "${targetRoom.name}" (${targetRoom.room_id})`,
      )
    } catch (e) {
      let errorMessage = getErrorMessage(e)
      if (errorMessage.endsWith("is already in the room.")) {
        report.skippedInvitesNumber++
      } else {
        report.failedInvites.push(`✕ Failed to invite ${user.content.displayname} | ` + errorMessage)
      }
    }
  }
  await sendMessage(
    client,
    roomId,
    [
      `Successfully invited  ${report.succeedInvites.length} users to join ${targetRoom.name} ${targetRoom.room_id}`,
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
  await sendReport(client, report, roomId)
}
