import { LogService, MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import { adminApi } from "src/admin-api"
import { UserAccountResponse } from "src/admin-api/types"
import config from "src/config/env"
import { canExecuteCommand, CommandError } from "src/utils"

const moduleName = "RotateTokenCommand"
export const ACCOUNT_COMMAND = "account"

enum Command {
  LoginUser = "login",
  CreateDevice = "create-device",
}

export async function runAccountCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
): Promise<void> {
  // Ensure the user can execute the command
  const canExecute = await canExecuteCommand(event.sender, roomId)
  if (!canExecute) {
    throw new CommandError(`Access denied`)
  }

  // 1. Retrive and validate arguments
  const [, command, targetUserId, ...extraArgs] = args
  if (!event.sender.includes(`:${config.MATRIX_SERVER_DOMAIN}`)) {
    throw new CommandError(`Access denied.`)
  }
  if (!Object.values(Command).includes(command as Command)) {
    throw new CommandError(`Invalid subcommand. Should be one of: ${Object.values(Command).join(", ")}`)
  }
  if (!targetUserId || !targetUserId.includes(`:${config.MATRIX_SERVER_DOMAIN}`)) {
    const [, wrongHomeServer] = targetUserId.split(":")
    throw new CommandError(
      `The provided user handle is not registered under ${config.MATRIX_SERVER_DOMAIN}, but ${wrongHomeServer}. \nMake sure that the user handle ends with ":${config.MATRIX_SERVER_DOMAIN}"`,
    )
  }

  // 2. Retrieve user details
  let user: UserAccountResponse | null = null
  try {
    user = await adminApi.getUserAccount(targetUserId)
  } catch (e) {
    LogService.error(moduleName, e)
    throw new CommandError(`Unable to retrieve user account details.`)
  }
  if (!user) {
    throw new CommandError(`The user "${targetUserId}" cannot be found.`)
  }

  // 3.1 Generate an access token
  if (command === Command.LoginUser) {
    try {
      const response = await adminApi.loginUser(targetUserId)
      await client.sendHtmlText(
        roomId,
        `New access token for user "${targetUserId}": <code>${JSON.stringify(response)}</code>`,
      )
    } catch (err) {
      LogService.error(moduleName, err)
      throw new CommandError(`Unable to retrieve user access token.`)
    }
  }

  // 3.2 Create a new device
  if (command === Command.CreateDevice) {
    const deviceId = extraArgs[0]
    if (!deviceId) {
      throw new CommandError(`Missing device ID argument.`)
    }
    try {
      const response = await adminApi.createDevice(targetUserId, deviceId)
      await client.sendHtmlText(
        roomId,
        `Created a new device for user "${targetUserId}": <code>${JSON.stringify(response)}</code>`,
      )
    } catch (err) {
      LogService.error(moduleName, err)
      throw new CommandError(`Unable to retrieve user access token.`)
    }
  }
}
