import {
  AutojoinRoomsMixin,
  LogLevel,
  LogService,
  MatrixClient,
  RichConsoleLogger,
  SimpleFsStorageProvider,
} from "matrix-bot-sdk"
import * as path from "path"

import Bot from "./bot"
import config from "./config/env"

/* First things first: let's make the logs a bit prettier.
   TODO: replace with https://github.com/paritytech/opstooling-js/blob/master/src/logger.ts */
LogService.setLogger(new RichConsoleLogger())

LogService.setLevel(LogLevel.DEBUG)

// Print something so we know the bot is working
LogService.info("index", "Bot starting...")

// This is the startup closure where we give ourselves an async context
void (async () => {
  // Prepare the storage system for the bot
  const storage = new SimpleFsStorageProvider(
    path.join(config.DATA_PATH, "bot.json"),
  )

  // Now create the client
  const client = new MatrixClient(
    config.MATRIX_SERVER_URL,
    config.ACCESS_TOKEN,
    storage,
  )

  // Setup the autojoin mixin (if enabled)
  AutojoinRoomsMixin.setupOnClient(client)

  // Prepare the command handler
  const commands = new Bot(client)
  await commands.start()

  LogService.info("index", "Starting sync...")
  await client.start() // This blocks until the bot is stopped
})()
