import { LogService, MatrixClient, MatrixProfileInfo, MessageEvent, UserID } from "matrix-bot-sdk"

import { LIST_ROOMS_COMMAND, runListRoomsCommand } from "src/commands/list-rooms"
import { commandPrefix } from "src/constants"

import { DEACTIVATE_USER_COMMAND, runDeactivateUserCommand } from "./commands/deactivate-user"
import { DELETE_ROOM_COMMAND, runDeleteRoomCommand } from "./commands/delete-room"
import { runHelpCommand } from "./commands/help"
import { INVITE_COMMAND, runInviteCommand } from "./commands/invite"
import { PROMOTE_COMMAND, runPromoteCommand } from "./commands/promote"
import { CommandError } from "./utils"

/* This is the maximum allowed time between time on matrix server
   and time when bot caught event */
const MAX_TIMEOUT_MS = 4000

const moduleName = "CommandHandler"

// This is where all of our commands will be handled
export default class Bot {
  /* Just some variables so we can cache the bot's display name and ID
     for command matching later. */
  private displayName!: string
  private userId!: string
  private localpart!: string

  constructor(private client: MatrixClient) {}

  public async start(): Promise<void> {
    // Populate the variables above (async)
    await this.prepareProfile()

    // Set up the event handler
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.client.on("room.message", this.onMessage.bind(this))
  }

  private async prepareProfile() {
    this.userId = await this.client.getUserId()
    this.localpart = new UserID(this.userId).localpart

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const profile: MatrixProfileInfo = await this.client.getUserProfile(this.userId)

      if (profile?.displayname) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.displayName = profile.displayname
      }
    } catch (e) {
      // Non-fatal error - we'll just log it and move on.
      LogService.warn(moduleName, e)
    }
  }

  // disable eslint here due to poorly typed matrix bot sdk
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private async onMessage(roomId: string, ev: any) {
    const event = new MessageEvent(ev)
    if (event.isRedacted) return // Ignore redacted events that come through
    if (event.sender === this.userId) return // Ignore ourselves
    if (event.messageType !== "m.text") return // Ignore non-text messages

    /* Ensure that the event is a command before going on. We allow people to ping
           the bot as well as using our COMMAND_PREFIX. */
    const prefixes = [commandPrefix, `${this.localpart}:`, `${this.displayName}:`, `${this.userId}:`]
    const prefixUsed = prefixes.find((p) => event.textBody.startsWith(p))
    if (!prefixUsed) return // Not a command (as far as we're concerned)

    // Ignore old messages, which may have sent when bot wasn't online
    const delay = Date.now() - event.timestamp
    if (delay > MAX_TIMEOUT_MS) {
      LogService.info(moduleName, `Skip message by timeout (${delay}ms delay): ` + JSON.stringify(event))
      return
    }

    LogService.debug(moduleName, event)

    // Check to see what the arguments were to the command
    const args = event.textBody
      .substring(prefixUsed.length)
      .trim()
      .split(" ")
      .filter((arg) => arg.trim().length !== 0)

    LogService.info(moduleName, `Got a new command: ${args.toString()}`)

    // Try and figure out what command the user ran, defaulting to help
    try {
      const [command] = args
      switch (command) {
        case INVITE_COMMAND:
          return await runInviteCommand(roomId, event, args, this.client)
        case LIST_ROOMS_COMMAND:
          return await runListRoomsCommand(roomId, event, this.client, args[1])
        case PROMOTE_COMMAND:
          return await runPromoteCommand(roomId, event, args, this.client, this.userId)
        case DELETE_ROOM_COMMAND:
          return await runDeleteRoomCommand(roomId, event, args, this.client)
        case DEACTIVATE_USER_COMMAND:
          return await runDeactivateUserCommand(roomId, event, args, this.client)
        default:
          return await runHelpCommand(roomId, event, this.client)
      }
    } catch (e) {
      let replyMessage: string = "There was an error processing your command"

      if (e instanceof CommandError) {
        replyMessage = e.message
      } else if (typeof e?.body?.error === "string") {
        replyMessage = e.body.error as string
      }

      // Log the error
      LogService.error(moduleName, e)

      // Tell the user there was a problem
      return await this.client.replyNotice(roomId, ev, replyMessage)
    }
  }
}
