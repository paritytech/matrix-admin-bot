import {
  AutojoinRoomsMixin,
  LogService,
  MatrixClient,
  RichConsoleLogger,
  RustSdkCryptoStorageProvider,
  SimpleFsStorageProvider,
} from "matrix-bot-sdk"
import * as crypto from "crypto"
import * as path from "path"
import * as fs from "fs"

import Bot from "./bot"
import config from "./config/env"

const moduleName = "index"

/* TODO: replace with https://github.com/paritytech/opstooling-js/blob/master/src/logger.ts */
LogService.setLogger(new RichConsoleLogger())

LogService.setLevel(config.LOG_LEVEL)

// Print something so we know the bot is working
LogService.info(moduleName, "Bot starting...")

// This is the startup closure where we give ourselves an async context
void (async () => {
  // Prepare the storage
  const storagePath = getBotStoragePath()

  // Prepare the storage system for the bot
  const storage = new SimpleFsStorageProvider(path.join(storagePath, "bot.json"))
  const cryptoStorage = new RustSdkCryptoStorageProvider(path.join(storagePath, "crypto"), 0)

  // Now create the client
  const client = new MatrixClient(config.MATRIX_SERVER_URL, config.ACCESS_TOKEN, storage, cryptoStorage)

  // Enable E2EE
  const joinedRooms = await client.getJoinedRooms()
  await client.crypto.prepare(joinedRooms)
  client.on("room.failed_decryption", async (roomId: string, event: any, e: Error) => {
    LogService.error("index", `Failed to decrypt ${roomId} ${event.event_id} because `, e)
  })

  // Setup the autojoin mixin (if enabled)
  AutojoinRoomsMixin.setupOnClient(client)

  // Prepare the command handler
  const commands = new Bot(client)
  await commands.start()

  LogService.info(moduleName, "Starting sync...")
  await client.start() // This blocks until the bot is stopped
})().catch((e) => {
  LogService.error(moduleName, e)
  // process.exit(1)
  setInterval(() => {}, 1e5)
})

function getBotStoragePath() {
  const storagePath = path.resolve(process.cwd(), config.DATA_PATH)
  const hash = crypto.createHash("md5")
  const accessTokenHash = hash.update(config.ACCESS_TOKEN).digest("hex")
  const botStoragePath = path.join(storagePath, "bot-" + accessTokenHash)
  if (!fs.existsSync(botStoragePath)) {
    LogService.info(moduleName, `Creating storage directory at ${botStoragePath}`)
    fs.mkdirSync(botStoragePath, { recursive: true })
  }
  return botStoragePath
}
