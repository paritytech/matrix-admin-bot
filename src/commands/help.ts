import htmlEscape from "escape-html"
import {
  MatrixClient,
  MessageEvent,
  MessageEventContent,
  RichReply,
} from "matrix-bot-sdk"

import { commandPrefix } from "src/bot"
import { RoomGroups } from "src/config/rooms"

import { defaultGroup, roomsGroupSeparator } from "./invite"

export async function runHelpCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  client: MatrixClient,
) {
  const allRoomGroups = Object.keys(RoomGroups).join(roomsGroupSeparator)
  const defaultRoomGroups =
    Object.values(defaultGroup).join(roomsGroupSeparator)
  const help = `
${commandPrefix} invite <userId> [<group>]
    Invite user to a group of rooms.
    <userId>    - Matrix user id @username:matrix.parity.io
    [<group>]   - (Optional) group(s) of channels to invite user
                Available groups: ${allRoomGroups}
                Default: ${defaultRoomGroups}
                Groups with rooms are defined here: https://github.com/paritytech/matrix-admin-bot/tree/master/src/config/rooms.ts

    Examples:
    - "${commandPrefix} invite @username:matrix.parity.io" - invite user to default ${allRoomGroups}
    - "${commandPrefix} invite @username:matrix.parity.io common|opstooling" - custom groups

${commandPrefix} help
    This menu
        `

  const text = `Help menu:\n${help}`
  const html = `<b>Help menu:</b><br /><pre><code>${htmlEscape(
    help,
  )}</code></pre>`

  // Note that we're using the raw event, not the parsed one!
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const reply = RichReply.createFor(roomId, event, text, html)
  reply.msgtype = "m.notice" // Bots should always use notices
  return client.sendMessage(roomId, reply)
}
