import { MatrixClient } from "matrix-bot-sdk"

export class CommandError extends Error {}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function sendMessage(client: MatrixClient, roomId: string, message: string): Promise<string> {
  return client.sendMessage(roomId, { body: message, msgtype: "m.notice" })
}
