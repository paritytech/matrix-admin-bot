import { LogService, MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import config from "src/config/env"
import { CommandError, ensureDmRoom } from "src/utils"

const moduleName = "WelcomeMessageCommand"
export const WELCOME_MESSAGE_COMMAND = "welcome-message"

const WELCOME_MESSAGE = Buffer.from(config.WELCOME_MESSAGE_BASE64, "base64").toString("utf-8")

export enum Command {
  Show = "show",
  Send = "send",
}

export async function runWelcomeMessageCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
): Promise<void> {
  const [, command, targetUserId] = args
  if (!Object.values(Command).includes(command as Command)) {
    throw new CommandError(`Invalid subcommand. Should be one of: ${Object.values(Command).join(", ")}`)
  }

  if (!WELCOME_MESSAGE) {
    throw new CommandError("Welcome message is not configured")
  }

  // Show the welcome message
  if (command === Command.Show) {
    await client.sendHtmlText(roomId, WELCOME_MESSAGE)
    return
  }

  // Send the welcome message to a user in DM
  if (command === Command.Send) {
    if (!targetUserId) {
      throw new CommandError("Missing user ID argument")
    }
    if (!targetUserId.includes(`:${config.MATRIX_SERVER_DOMAIN}`)) {
      const [, wrongHomeServer] = targetUserId.split(":")
      throw new CommandError(
        `The provided user handle is not registered under ${config.MATRIX_SERVER_DOMAIN}, but ${wrongHomeServer}. \nMake sure that the user handle ends with ":${config.MATRIX_SERVER_DOMAIN}"`,
      )
    }
    const dmRoomId = await ensureDmRoom(client, targetUserId)
    await client.sendHtmlText(dmRoomId, WELCOME_MESSAGE)
    LogService.info(moduleName, `Welcome message was sent to ${targetUserId} in DM`)
    await client.sendHtmlText(roomId, `Welcome message was sent to ${targetUserId} in DM`)
    return
  }
}
