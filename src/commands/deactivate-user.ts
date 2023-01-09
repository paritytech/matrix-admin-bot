import htmlEscape from "escape-html"
import { LogService, MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import { adminApi } from "src/admin-api"
import { UserAccountResponse } from "src/admin-api/types"
import config from "src/config/env"
import { commandPrefix } from "src/constants"
import { canExecuteCommand, CommandError, generatePassword, sendMessage, TemporaryState } from "src/utils"

const moduleName = "DeactivateUserCommand"
export const DEACTIVATE_USER_COMMAND = "deactivate-user"
const CONFIRMATION_FLAG = "confirm"
const CONFIRMATION_DELAY_MINUTES = 2

type State = {
  userId: string
  userDisplayName: string | null
  recover: boolean
}
const tempState = new TemporaryState<State>({ ttl: 1e3 * 60 * CONFIRMATION_DELAY_MINUTES })

export async function runDeactivateUserCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
): Promise<void> {
  // 0. Perform user (de)activation (after confirmation)
  if (args[1] === CONFIRMATION_FLAG) {
    const request = tempState.get(event.sender)
    if (!request) {
      throw new CommandError(
        `There is nothing to confirm. It is possible that your user deactivation request has expired. Please run the command for deactivating the user again.`,
      )
    }
    await sendMessage(
      client,
      roomId,
      `Beginning the process of ${request.recover ? "" : "de"}activating the user "${
        request.userDisplayName || request.userId
      }"...`,
    )
    tempState.delete(event.sender)
    const password = generatePassword()
    try {
      if (request.recover) {
        await adminApi.activateUser(request.userId, password)
      } else {
        await adminApi.deactivateUser(request.userId)
      }
    } catch (e) {
      LogService.error(moduleName, e)
      throw new CommandError(`Unable to ${request.recover ? "" : "de"}activate the user. An error has occurred.`)
    }
    await sendMessage(
      client,
      roomId,
      `Done! The user "${request.userDisplayName || request.userId}" has been successfully ${
        request.recover ? "" : "de"
      }activated.`,
    )
    if (request.recover) {
      const html = `New user's password: <code>${password}</code>`
      await client.sendHtmlText(roomId, html)
    }
    return
  }

  // 1. Retrive and validate arguments
  const [, targetUserId, recoverArg] = args
  if (!event.sender.includes(`:${config.MATRIX_SERVER_DOMAIN}`)) {
    throw new CommandError(`Access denied.`)
  }
  if (!targetUserId || !targetUserId.includes(`:${config.MATRIX_SERVER_DOMAIN}`)) {
    const [, wrongHomeServer] = targetUserId.split(":")
    throw new CommandError(
      `The provided user handle is not registered under ${config.MATRIX_SERVER_DOMAIN}, but ${wrongHomeServer}. \nMake sure that the user handle ends with ":${config.MATRIX_SERVER_DOMAIN}"`,
    )
  }
  const recover = recoverArg === "recover"

  // 2. Ensure the user can execute the command
  const canExecute = await canExecuteCommand(event.sender, roomId)
  if (!canExecute) {
    throw new CommandError(`Access denied`)
  }

  // 3. Retrieve user details
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
  if (!recover && user.deactivated) {
    throw new CommandError(`User is already deactivated. Command rejected.`)
  }
  if (recover && !user.deactivated) {
    throw new CommandError(`User is already activated. Command rejected.`)
  }

  // 4. Prompt the user if they're sure to deactivate the user
  tempState.set(event.sender, { userId: targetUserId, userDisplayName: user.displayname, recover })
  const command = `${commandPrefix} ${DEACTIVATE_USER_COMMAND} ${CONFIRMATION_FLAG}`
  const html = `Are you sure you want to ${recover ? "" : "de"}activate the user "${
    user.displayname || targetUserId
  }"?<br />To proceed with the ${
    recover ? "" : "de"
  }activation, please reply with the following command within ${CONFIRMATION_DELAY_MINUTES} minute${
    CONFIRMATION_DELAY_MINUTES > 1 ? "s" : ""
  }:<br /><code>${htmlEscape(command)}</code>`
  await client.sendHtmlText(roomId, html)
}
