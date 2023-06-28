import htmlEscape from "escape-html"
import { MatrixClient, MessageEvent, MessageEventContent, RichReply } from "matrix-bot-sdk"

import { BULK_INVITE_COMMAND } from "src/commands/bulk-invite"
import { DEACTIVATE_USER_COMMAND } from "src/commands/deactivate-user"
import { DELETE_ROOM_COMMAND } from "src/commands/delete-room"
import { defaultGroups, INVITE_COMMAND } from "src/commands/invite"
import { LIST_ROOMS_COMMAND } from "src/commands/list-rooms"
import { LIST_SPACES_COMMAND } from "src/commands/list-spaces"
import { PROMOTE_COMMAND } from "src/commands/promote"
import config from "src/config/env"
import { groupedRooms } from "src/config/rooms"
import { commandPrefix } from "src/constants"

import { INVITE_ROOM } from "./invite-room"

export async function runHelpCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  client: MatrixClient,
): Promise<string> {
  const allRoomGroups = groupedRooms.map((group) => group.groupName).join(", ")
  const defaultRoomGroups = defaultGroups.join(", ")
  const help = `
${commandPrefix} ${LIST_ROOMS_COMMAND} [<group>]
    Show the list of available groups & rooms
    [<group>]   - (Optional) group(s) of rooms to invite user (space separated)
                Available groups: ${allRoomGroups}

--------------------------------------------------

${commandPrefix} ${LIST_SPACES_COMMAND}
    Show the list of all rooms and spaces on the current server in CSV format

--------------------------------------------------

${commandPrefix} ${INVITE_COMMAND} <userId> [<group>]
    Invite user to a group of rooms.
    <userId>    - Matrix user id @username:${config.MATRIX_SERVER_DOMAIN}
    [<group>]   - (Optional) group(s) of rooms to invite user (space separated)
                Available groups: ${allRoomGroups}
                Default: ${defaultRoomGroups}
                To see all rooms & groups - write "${commandPrefix} invite list-rooms"

    Examples:
    - "${commandPrefix} ${INVITE_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN}" - invite user to default ${allRoomGroups}
    - "${commandPrefix} ${INVITE_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN} common opstooling" - custom groups

--------------------------------------------------

${commandPrefix} ${BULK_INVITE_COMMAND} <roomId>
    Invite all members of the current server to a given room.
    Disabled, banned, and non Google SSO users will be ignored.
    <roomId>    - Matrix room id !RaNdOmRoOmId:${config.MATRIX_SERVER_DOMAIN}

    Examples:
    - "${commandPrefix} ${BULK_INVITE_COMMAND} !MzyrIlxGUHXYwtRGrO:${config.MATRIX_SERVER_DOMAIN}"

--------------------------------------------------

${commandPrefix} ${INVITE_ROOM} <fromRoomId> <targetRoomId>
    Invite all members from the room specified by <fromRoomId> to the room specified by <targetRoomId>.
    Disabled, banned, and non Google SSO users will be ignored.
    <fromRoomId>      - Matrix room id to invite users from !RaNdOmRoOmId:${config.MATRIX_SERVER_DOMAIN}
    <targetRoomId>    - Matrix room id to invite users to   !RaNdOmRoOmId:${config.MATRIX_SERVER_DOMAIN}

    Examples:
    - "${commandPrefix} ${INVITE_ROOM} !RaNdOmRoOmId:${config.MATRIX_SERVER_DOMAIN} !RaNdOmRoOmId:${config.MATRIX_SERVER_DOMAIN}"

--------------------------------------------------

${commandPrefix} ${PROMOTE_COMMAND} <userId> <roomId> <powerLevel>
    Assign a specific power level to the user in the room.
    <userId>     - Matrix user id @username:${config.MATRIX_SERVER_DOMAIN}
    <roomId>     - Matrix room id !RaNdOmRoOmId:${config.MATRIX_SERVER_DOMAIN} or #roomAlias:${config.MATRIX_SERVER_DOMAIN}
    <powerLewel> - Ddesired power level for the user as a number or alias:
                   - Number (0-100)
                   - Aliases:
                     - default: 0
                     - moderator: 50
                     - admin: 100

    Examples:
    - "${commandPrefix} ${PROMOTE_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN} !MzyrIlxGUHXYwtRGrO:${config.MATRIX_SERVER_DOMAIN} 99" - promote the user to level 99
    - "${commandPrefix} ${PROMOTE_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN} #pupps:${config.MATRIX_SERVER_DOMAIN} moderator" - promote the user to moderator level (50)

--------------------------------------------------

${commandPrefix} ${DELETE_ROOM_COMMAND} <roomId>
    Kick all room members and completely delete the room.
    <roomId>     - Matrix room id !RaNdOmRoOmId:${config.MATRIX_SERVER_DOMAIN} or #roomAlias:${config.MATRIX_SERVER_DOMAIN}

    Example:
    - "${commandPrefix} ${DELETE_ROOM_COMMAND} !MzyrIlxGUHXYwtRGrO:${config.MATRIX_SERVER_DOMAIN}" - delete the room

--------------------------------------------------

${commandPrefix} ${DEACTIVATE_USER_COMMAND} <userId> [recover]
    Deactivate a user's account. It removes active access tokens, resets the password, and deletes third-party IDs (to prevent the user requesting a password reset).
    Messages sent by the user will still be visible by anyone that was in the room when these messages were sent, but hidden from users joining the room afterwards.

    <userId>     - Matrix user id @username:${config.MATRIX_SERVER_DOMAIN}
    [recover]    - (Optional) flag for user account activation. The bot will provide a new random user password.

    Examples:
    - "${commandPrefix} ${DEACTIVATE_USER_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN}" - deactivate the user
    - "${commandPrefix} ${DEACTIVATE_USER_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN} recover" - activate user with password reset

--------------------------------------------------

${commandPrefix} help
    This menu
`

  const text = `Help menu:\n${help}`
  const html = `<b>Help menu:</b><br /><pre><code>${htmlEscape(help)}</code></pre>`

  // Note that we're using the raw event, not the parsed one!
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const reply = RichReply.createFor(roomId, event, text, html)
  reply.msgtype = "m.notice" // Bots should always use notices
  return await client.sendMessage(roomId, reply)
}
