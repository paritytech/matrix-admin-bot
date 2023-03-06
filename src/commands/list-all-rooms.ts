import { MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import { adminApi } from "src/admin-api"
import { canExecuteCommand, CommandError, sendMessage } from "src/utils"

export const LIST_ALL_ROOMS_COMMAND = "list-all-rooms"

export async function runListAllRoomsCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  client: MatrixClient,
): Promise<string> {
  // Ensure the user can execute the command
  const canExecute = await canExecuteCommand(event.sender, roomId)
  if (!canExecute) {
    throw new CommandError(`Access denied`)
  }

  // Fetching rooms
  await sendMessage(client, roomId, "Downloading all rooms...")
  const rooms = await adminApi.getRooms()
  if (!rooms.length) {
    return await sendMessage(client, roomId, "No rooms found")
  }

  // Building result CSV
  const csvHead = `id,name,alias,type,members,encryption,public`
  const csvBody = rooms
    .map((x) => {
      const alias = x.canonical_alias || "–"
      const name = x.name || "–"
      const type = x.room_type === "m.space" ? "space" : "room"
      const members = x.joined_members || 0
      const encryption = String(Boolean(x.encryption))
      const isPublic = String(x.public)
      return `${x.room_id},${name},${alias},${type},${members},${encryption},${isPublic}`
    })
    .join("\n")
  const html = `Rooms CSV:<br /><pre>${csvHead}\n${csvBody}</pre>`
  return await client.sendHtmlText(roomId, html)
}
