import { MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import { groupedRooms } from "src/config/rooms"
import { sendMessage, CommandError, canExecuteCommand } from "src/utils"

export const LIST_ROOMS_COMMAND = "list-rooms"

export async function runListRoomsCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  client: MatrixClient,
  inputGroup?: string,
): Promise<string> {
  // Ensure the user can execute the command
  const canExecute = await canExecuteCommand(event.sender, roomId)
  if (!canExecute) {
    throw new CommandError(`Access denied`)
  }

  // use all groups unless provided group as inputGroup
  const neededGroups = inputGroup ? groupedRooms.filter((g) => g.groupName === inputGroup) : groupedRooms
  // outputs a list of room names per group
  const rooms = neededGroups.map((group) => {
    const roomsList = group.list.map((room) => `- ${room.name}`).join("\n")

    return group.groupName + ":\n" + roomsList + "\n"
  })

  return await sendMessage(client, roomId, rooms.join("\n"))
}
