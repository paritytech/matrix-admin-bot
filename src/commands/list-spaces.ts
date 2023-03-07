import { MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import { adminApi } from "src/admin-api"
import { canExecuteCommand, CommandError, sendMessage } from "src/utils"

export const LIST_SPACES_COMMAND = "list-spaces"

export async function runListSpacesCommand(
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
  const spaces = rooms.filter((x) => x.room_type === "m.space")
  if (!spaces.length) {
    return await sendMessage(client, roomId, "No spaces found")
  }

  // Building result CSV
  const csvHead = `id,name,alias`
  const csvBody = spaces
    .map((x) => {
      const alias = x.canonical_alias || "–"
      const name = x.name || "–"
      return `${x.room_id},${name},${alias}`
    })
    .join("\n")
  const html = `Spaces CSV:<br /><pre>${csvHead}\n${csvBody}</pre>`
  return await client.sendHtmlText(roomId, html)
}
