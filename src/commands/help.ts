import htmlEscape from "escape-html"
import { MatrixClient, MessageEvent, MessageEventContent, RichReply } from "matrix-bot-sdk"

import config from "src/config/env"
import { commandPrefix } from "src/constants"
import { groupedRooms } from "src/config/rooms"
import { LIST_ROOMS_COMMAND } from "src/commands/list-rooms"
import { defaultGroups, INVITE_COMMAND } from "src/commands/invite"
import { PROMOTE_COMMAND } from "src/commands/promote"
import { DELETE_ROOM_COMMAND } from "src/commands/delete-room"

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

${commandPrefix} ${INVITE_COMMAND} <userId> [<group>]
    Invite user to a group of rooms.
    <userId>    - Matrix user id @username:${config.MATRIX_SERVER_DOMAIN}
    [<group>]   - (Optional) group(s) of rooms to invite user (space separated)
                Available groups: ${allRoomGroups}
                Default: ${defaultRoomGroups}
                To see all rooms & groups - write "${commandPrefix} invite list-rooms"

    Examples:
    - "${commandPrefix} invite @username:${config.MATRIX_SERVER_DOMAIN}" - invite user to default ${allRoomGroups}
    - "${commandPrefix} invite @username:${config.MATRIX_SERVER_DOMAIN} common opstooling" - custom groups

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
