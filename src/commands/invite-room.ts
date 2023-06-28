import htmlEscape from "escape-html"
import { LogService, MatrixClient, MembershipEvent, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import { adminApi } from "src/admin-api"
import { CommandReport, RoomInfoResponse, RoomMember } from "src/admin-api/types"
import { commandPrefix } from "src/constants"
import {
  CommandError,
  getErrorMessage,
  sendMessage,
  sendReport,
  TemporaryState,
  validateUserAuthProvider,
} from "src/utils"

const moduleName = "InviteRoomCommand"
export const INVITE_ROOM = "invite-room"
const CONFIRMATION_DELAY_MINUTES = 2
const CONFIRMATION_FLAG = "confirm"

type State = {
  targetRoomId: string
  sourceRoomId: string
}
const tempState = new TemporaryState<State>({ ttl: 1e3 * 60 * CONFIRMATION_DELAY_MINUTES })

const getMembersOfTheRoom = async (client: MatrixClient, room_id: string | undefined): Promise<RoomMember[]> => {
  let roomMemberEvents: RoomMember[]

  try {
    if (!room_id) {
      throw new Error()
    }
    const _roomMemberEvents = (await client.getRoomMembers(room_id)) as unknown as {
      event: MembershipEvent
    }[]
    roomMemberEvents = _roomMemberEvents.map((x) => x.event as unknown as RoomMember)
  } catch (e) {
    throw new CommandError(`Could not retrieve a list of members from the room ${String(room_id)}`)
  }
  return roomMemberEvents
}

const getRoomDetails = async (roomId: string | undefined): Promise<RoomInfoResponse | null> => {
  let room: RoomInfoResponse | null = null
  try {
    if (!roomId) {
      throw new Error()
    }
    room = await adminApi.getRoomInfo(roomId)
  } catch (e) {
    LogService.error(moduleName, e)
    throw new CommandError(`Unable to retrieve room details.`)
  }

  if (!room) {
    throw new CommandError(`The room "${roomId}" cannot be found.`)
  }
  return room
}

export async function runInviteRoomCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
  botUserId: string,
): Promise<string> {
  await sendMessage(client, roomId, `Preparing to execute the command...`)

  if (args[1] === CONFIRMATION_FLAG) {
    // 2.1 Check the request
    const request = tempState.get(event.sender)
    if (!request) {
      throw new CommandError(
        `There is nothing to confirm. It is possible that your room invitation request has expired. Please run the command again.`,
      )
    }
    tempState.delete(event.sender)

    // 2.2 Retrieve room details
    const targetRoom = await getRoomDetails(request.targetRoomId)
    const sourceRoom = await getRoomDetails(request.sourceRoomId)
    if (!targetRoom || !sourceRoom) {
      throw new CommandError("Could not retrieve information about rooms.")
    }

    // 2.3 Get room members
    const roomMemberEvents = await getMembersOfTheRoom(client, sourceRoom?.room_id)
    await sendMessage(
      client,
      roomId,
      `Starting to invite ${roomMemberEvents.length} users to the "${targetRoom?.name}" room.`,
    )

    // 2.4 Invite room members
    const report: CommandReport = { failedInvites: [], succeedInvites: [], skippedInvitesNumber: 0 }
    for (const user of roomMemberEvents) {
      try {
        if (user.user_id == botUserId) {
          report.skippedInvitesNumber++
          continue
        }
        await validateUserAuthProvider(user.user_id)
        await client.inviteUser(user.user_id, request.targetRoomId)
        report.succeedInvites.push(`✓ Successfully invited ${user.user_id}`)
        LogService.info(
          moduleName,
          `Invited ${user.content.displayname} (${user.user_id}) to room "${targetRoom.name}" (${targetRoom.room_id})`,
        )
      } catch (e) {
        const errorMessage = getErrorMessage(e)
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
    return ""
  }

  // 1. Retrive and validate arguments
  const [, sourceRoomId, targetRoomId] = args
  if (!targetRoomId) {
    throw new CommandError("Target room id is missing.")
  }

  // 2. Retrieve room details
  const targetRoom = await getRoomDetails(targetRoomId)
  const sourceRoom = await getRoomDetails(sourceRoomId)
  if (!targetRoom || !sourceRoom) {
    throw new CommandError("Could not retrieve information about rooms.")
  }

  // 3. Get members of the current room to invite to the targetRoom
  await sendMessage(client, roomId, `Fetching member list of the ${sourceRoom?.name}.`)
  const roomMemberEvents = await getMembersOfTheRoom(client, sourceRoom?.room_id)
  await sendMessage(
    client,
    roomId,
    [`Room ${sourceRoom?.name} has ${roomMemberEvents.length} memebers`].filter(Boolean).join(" "),
  )

  // 4. Prompt the user if they're sure to delete the room
  tempState.set(event.sender, { targetRoomId: targetRoom?.room_id, sourceRoomId: sourceRoom?.room_id })
  const command = `${commandPrefix} ${INVITE_ROOM} ${CONFIRMATION_FLAG}`
  const html = `Are you sure you want to <b> invite all ${roomMemberEvents.length} members</b> of the "${
    sourceRoom?.name
  }" to the "${
    targetRoom?.name
  }" ?<br />To proceed the invitation for all room members, please reply with the following command within ${CONFIRMATION_DELAY_MINUTES} minute${
    CONFIRMATION_DELAY_MINUTES > 1 ? "s" : ""
  }:<br /><code>${htmlEscape(command)}</code>`
  return await client.sendHtmlText(roomId, html)
}
