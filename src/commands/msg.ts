import * as csv from "@fast-csv/parse"
import htmlEscape from "escape-html"
import * as fs from "fs"
import {
  MatrixClient,
  MatrixProfileInfo,
  MessageEvent,
  MessageEventContent,
} from "matrix-bot-sdk"
import * as path from "path"

type LinkData = {
  first_name: string
  last_name: string
  element_id: string
  link: string
}

export async function runDmCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  client: MatrixClient,
): Promise<void> {
  const data: LinkData[] = []

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  fs.createReadStream(
    path.resolve(__dirname, "..", "config", "recepients_list.csv"),
  )
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    .pipe(csv.parse({ headers: true }))
    .on("error", (error: any) => {
      return console.error(error)
    })
    .on("data", (row: LinkData) => {
      row.element_id = parseElementId(row.element_id)
      data.push(row)
    })
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    .on("end", async () => {
      for (const user of data) {
        const userId = user.element_id
        const matrixInfo = (await client
          .getUserProfile(userId)
          .catch(console.error)) as MatrixProfileInfo | null

        if (matrixInfo?.displayname) {
          console.log(
            `Found user ${matrixInfo.displayname}, index: ${data.indexOf(
              user,
            )}`,
          )
          const directRoomWithUser = await getOrCreateDirectRoomId(
            client,
            userId,
          )

          directRoomWithUser &&
            console.log(`Direct room is ${directRoomWithUser}`)

          if (directRoomWithUser != null) {
            const { text, html } = getMessageTemplate(
              matrixInfo.displayname,
              user.link,
            )

            await client
              .sendMessage(directRoomWithUser, {
                msgtype: "m.text",
                body: text,
                format: "org.matrix.custom.html",
                formatted_body: html,
              })
              .catch((e) => {
                console.error(e)
                console.log(`Couldn't send a message to ${user.element_id}`)
              })
          }
        } else {
          console.log(`${user.element_id} wasn't found`)
        }
      }
      await sendMessage(client, roomId, "dun")
    })
}

async function getOrCreateDirectRoomId(
  client: MatrixClient,
  userId: string,
): Promise<string | null> {
  const newRoom = await createDMRoom(client, userId).catch((e) => {
    console.error(e)
    return null
  })

  if (newRoom) {
    return newRoom
  }

  throw new Error(`Couldn't create or find a direct room. Exiting`)
}

function parseElementId(elementId: string) {
  let [username, matrixServer] = elementId.split(
    /(:matrix\.parity\.io|matrix\.org)/,
  )

  if (!username.startsWith("@")) {
    username = `@${username}`
  }

  if (!matrixServer) {
    matrixServer = ":matrix.parity.io"
  }

  return `${username}${matrixServer}`
}

async function createDMRoom(
  client: MatrixClient,
  userId: string,
): Promise<string> {
  console.log(`Creating new direct message room with: ${userId}`)
  return await client.createRoom({
    preset: "trusted_private_chat",
    invite: [userId],
    is_direct: true,
  })
}

function sendMessage(
  client: MatrixClient,
  roomId: string,
  message: string,
): Promise<string> {
  return client.sendMessage(roomId, { body: message, msgtype: "m.text" })
}

function getMessageTemplate(
  name: string,
  link: string,
): { text: string; html: string } {
  const message = `
<p>Hi ${name},</p>
<p>
As outlined in our <a href="https://matrix.to/#/!MNNdgVPLqzMqdZKYZv:matrix.parity.io/$16615150643705kHRJR:matrix.parity.io?via=matrix.parity.io">Parity Announcement post</a> 
today, we’re making it more convenient for you to participate in the survey by directly sharing with you 
this personalized link: ${link}
</p>
<p>
Please complete by <strong>Friday 02 September 2022, 11:30pm CEST</strong>. 
</p>
If you have already completed the survey, <strong>thank you!</strong>          
          `
  const text = `${htmlEscape(message)}`
  const html = `${message}`

  return { text, html }
}
