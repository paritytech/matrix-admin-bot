import htmlEscape from "escape-html"
import { MatrixClient, MessageEvent, MessageEventContent, RichReply } from "matrix-bot-sdk"

import { commandPrefix } from "src/bot"
import { LIST_ROOMS_COMMAND } from "src/commands/list-channels"
import { groupedRooms } from "src/config/rooms"

import { defaultGroups, INVITE_COMMAND } from "./invite"

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
    <userId>    - Matrix user id @username:matrix.parity.io
    [<group>]   - (Optional) group(s) of rooms to invite user (space separated)
                Available groups: ${allRoomGroups}
                Default: ${defaultRoomGroups}
                To see all rooms & groups - write "${commandPrefix} invite list-rooms"

    Examples:
    - "${commandPrefix} invite @username:matrix.parity.io" - invite user to default ${allRoomGroups}
    - "${commandPrefix} invite @username:matrix.parity.io common opstooling" - custom groups

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
