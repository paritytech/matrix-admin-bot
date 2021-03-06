import {
  LogService,
  MatrixClient,
  MatrixProfileInfo,
  MessageEvent,
  UserID,
} from "matrix-bot-sdk"

import { runHelpCommand } from "./commands/help"
import { runInviteCommand } from "./commands/invite"
import { CommandError } from "./utils"

/* The prefix required to trigger the bot. The bot will also respond
   to being pinged directly. */
export const commandPrefix = "!adminbot"

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
      const profile: MatrixProfileInfo = await this.client.getUserProfile(
        this.userId,
      )

      if (profile?.displayname) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.displayName = profile.displayname
      }
    } catch (e) {
      // Non-fatal error - we'll just log it and move on.
      LogService.warn("CommandHandler", e)
    }
  }

  private async onMessage(roomId: string, ev: any) {
    const event = new MessageEvent(ev)
    if (event.isRedacted) return // Ignore redacted events that come through
    if (event.sender === this.userId) return // Ignore ourselves
    if (event.messageType !== "m.text") return // Ignore non-text messages

    /* Ensure that the event is a command before going on. We allow people to ping
           the bot as well as using our COMMAND_PREFIX. */
    const prefixes = [
      commandPrefix,
      `${this.localpart}:`,
      `${this.displayName}:`,
      `${this.userId}:`,
    ]
    const prefixUsed = prefixes.find((p) => {
      return event.textBody.startsWith(p)
    })
    if (!prefixUsed) return // Not a command (as far as we're concerned)

    // Check to see what the arguments were to the command
    const args = event.textBody
      .substring(prefixUsed.length)
      .trim()
      .split(" ")
      .filter((arg) => {
        return arg.trim().length !== 0
      })

    LogService.info(`Got a new command: ${args[0]}`)

    // Try and figure out what command the user ran, defaulting to help
    try {
      if (args[0] === "invite") {
        return await runInviteCommand(roomId, event, args, this.client)
      } else {
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
      LogService.error("CommandHandler", e)

      // Tell the user there was a problem
      return await this.client.replyNotice(roomId, ev, replyMessage)
    }
  }
}
