import { MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import { adminApi } from "src/admin-api"
import { canExecuteCommand, CommandError, sendMessage } from "src/utils"

export const LIST_NEW_JOINERS_COMMAND = "list-new-joiners"
export const LIST_NEW_JOINERS_DEFAULT_LIMIT = 10
export const LIST_NEW_JOINERS_MIN_LIMIT = 1
export const LIST_NEW_JOINERS_MAX_LIMIT = 100

export async function runListNewJoinersCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  client: MatrixClient,
  args: string[],
): Promise<string> {
  // Ensure the user can execute the command
  const canExecute = await canExecuteCommand(event.sender, roomId)
  if (!canExecute) {
    throw new CommandError(`Access denied`)
  }

  // Parse optional limit argument
  const limitArg = args?.[1]
  let limit = LIST_NEW_JOINERS_DEFAULT_LIMIT
  if (limitArg !== undefined) {
    const parsed = Number(limitArg)
    if (!Number.isFinite(parsed)) {
      throw new CommandError(
        `Invalid limit. Provide a number between ${LIST_NEW_JOINERS_MIN_LIMIT} and ${LIST_NEW_JOINERS_MAX_LIMIT}.`,
      )
    }
    const floored = Math.floor(parsed)
    limit = Math.min(LIST_NEW_JOINERS_MAX_LIMIT, Math.max(LIST_NEW_JOINERS_MIN_LIMIT, floored))
  }

  const users = await adminApi.getNewUserAccounts(limit)
  console.log("new joiners", JSON.stringify(users))
  const filtered = users.filter((u) => !u.is_guest && !u.deactivated)

  if (!filtered.length) {
    return await sendMessage(client, roomId, "No users found")
  }

  const lines = filtered
    .map((u) => {
      const createdAt = new Date(u.creation_ts).toISOString()
      return `${u.name}, ${u.displayname ?? ""}, ${createdAt}`
    })
    .join("\n")

  return await client.sendHtmlText(roomId, `New joiners (Name, Displayname, CreatedAt):<br/><br/><pre>${lines}</pre>`)
}
