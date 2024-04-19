import * as crypto from "crypto"

import axios from "axios"
import { LogService, MatrixClient, MessageEvent, MessageEventContent } from "matrix-bot-sdk"

import { adminApi } from "src/admin-api"
import config from "src/config/env"
import { CommandError, ensureEncryptedDmRoom, usernameToLocalpart, localpartToUserId } from "src/utils"

const moduleName = "AccountCommand"
export const ACCOUNT_COMMAND = "account"

export enum Command {
  Create = "create",
  SignIn = "sign-in",
  SignOut = "sign-out",
  List = "list",
  ListSessions = "list-sessions",
  AcceptInvitation = "accept-invitation",
}

type OAuth2Session = {
  id: string
  state: "ACTIVE" | "FINISHED"
  scope: string
  createdAt: string
  finishedAt: string
  lastActiveAt: string
}

export async function runAccountCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  args: string[],
  client: MatrixClient,
): Promise<void> {
  // Retrive and validate arguments
  const [, command, targetUsername, ...extraArgs] = args
  if (!Object.values(Command).includes(command as Command)) {
    throw new CommandError(`Invalid subcommand. Should be one of: ${Object.values(Command).join(", ")}`)
  }

  if (!config.MATRIX_AUTHENTICATION_SERVICE_GRAPHQL_URL) {
    throw new CommandError("MATRIX_AUTHENTICATION_SERVICE_GRAPHQL_URL is not configured")
  }

  // List bot accounts
  if (command === Command.List) {
    const users = await adminApi.getUserAccounts()
    const bots = users.filter((x) => x.user_type === "bot")
    const entries = bots
      .map((x) => {
        const createdAt = new Date(x.creation_ts).toISOString()
        return `${x.name}, ${x.displayname}, ${createdAt}`
      })
      .join("\n")
    await client.sendHtmlText(roomId, `Bot accounts (ID, Name, CreatedAt):<br/><br/><pre>${entries}</pre>`)
    return
  }

  // Make sure the username is provided
  if (!targetUsername) {
    throw new CommandError(`Missing username argument.`)
  }
  const userLocalpart = usernameToLocalpart(targetUsername)
  const userId = localpartToUserId(userLocalpart)

  // Create a new account
  if (command === Command.Create || command === Command.SignIn) {
    const user = await adminApi.getUserAccount(userId)
    if (command === Command.Create && user) {
      throw new CommandError(`User ${userId} already exists.`)
    } else if (command === Command.SignIn && !user) {
      throw new CommandError(`User ${userId} doesn't exist.`)
    }

    const dmRoomId = await ensureEncryptedDmRoom(client, event.sender)
    if (!dmRoomId) {
      await client.sendHtmlText(
        roomId,
        `Please ensure you accept the bot's invitation to the DM room first, then try submitting the command again.`,
      )
      return
    }

    const permanent = extraArgs[0] === "permanent"
    const userDetails = await getOrCreateUser(userLocalpart)

    if (command === Command.Create) {
      await adminApi.markUserAsBot(userId)
      await client.sendHtmlText(roomId, `Created a new account for user ${userId}.`)
    }

    const sessionDetails = await createOauth2Session(userDetails.id, permanent)
    const { accessToken, refreshToken, deviceId } = sessionDetails
    await client.sendHtmlText(
      dmRoomId,
      [
        `For the account with ID ${userId}, here are your token details:`,
        `Device ID: <code>${deviceId}</code>`,
        `Access token: <code>${accessToken}</code>`,
        refreshToken ? `Refresh token: <code>${refreshToken}</code>` : null,
      ]
        .filter(Boolean)
        .join("<br/>"),
    )
    await client.sendHtmlText(roomId, `Tokens were sent to ${event.sender} in the DM room.`)
  }

  // List active sessions
  if (command === Command.ListSessions) {
    const user = await adminApi.getUserAccount(userId)
    if (!user) {
      throw new CommandError(`User ${userId} doesn't exist.`)
    }
    const userDetails = await getOrCreateUser(userLocalpart)
    const sessions = await getOauth2Sessions(userDetails.id).then((xs) => xs.filter((x) => x.state === "ACTIVE"))
    if (!sessions.length) {
      await client.sendHtmlText(roomId, `No active sessions for the account ${userId}.`)
      return
    }
    const entries = sessions
      .map((x) => {
        const createdAt = new Date(x.createdAt).toISOString()
        const lastActiveAt = x.lastActiveAt ? new Date(x.createdAt).toISOString() : "N/A"
        const scope = x.scope || "N/A"
        return `${x.id}, ${createdAt}, ${lastActiveAt}, ${scope}`
      })
      .join("\n")
    await client.sendHtmlText(
      roomId,
      `Active sessions (ID, CreatedAt, LastActiveAt, Scope):<br/><br/><pre>${entries}</pre>`,
    )
  }

  // Sign out
  if (command === Command.SignOut) {
    const user = await adminApi.getUserAccount(userId)
    if (!user) {
      throw new CommandError(`User ${userId} doesn't exist.`)
    }
    const userDetails = await getOrCreateUser(userLocalpart)
    const sessions = await getOauth2Sessions(userDetails.id).then((xs) => xs.filter((x) => x.state === "ACTIVE"))

    if (!sessions.length) {
      await client.sendHtmlText(roomId, `No active sessions.`)
      return
    }

    const sessionId = extraArgs[0]
    if (!sessionId) {
      throw new CommandError(`Missing session ID argument.`)
    }
    const revokeAll = sessionId === "all"

    if (revokeAll) {
      let revokedSessionsCount = 0
      for (const session of sessions) {
        await endOauth2Session(session.id)
        revokedSessionsCount++
      }
      await client.sendHtmlText(roomId, `Revoked ${revokedSessionsCount} tokens for the account "${userId}".`)
    } else {
      const session = sessions.find((x) => x.id === sessionId)
      if (!session) {
        throw new CommandError(`Session with ID "${sessionId}" doesn't exist or is already revoked.`)
      }
      await endOauth2Session(session.id)
      await client.sendHtmlText(
        roomId,
        `Revoked the token with ID <code>${sessionId}</code> for the account "${userId}".`,
      )
    }
  }

  // Accept invitation
  if (command === Command.AcceptInvitation) {
    const targetRoomIdOrAlias = extraArgs[0]
    const useStandardAuth = extraArgs[1] === "standard-auth"
    if (!targetRoomIdOrAlias || !targetRoomIdOrAlias.includes(`:${config.MATRIX_SERVER_DOMAIN}`)) {
      const [, wrongHomeServer] = targetRoomIdOrAlias.split(":")
      throw new CommandError(
        `The provided room handle is not registered under ${config.MATRIX_SERVER_DOMAIN}, but ${wrongHomeServer}. \nMake sure that the room handle ends with ":${config.MATRIX_SERVER_DOMAIN}"`,
      )
    }

    let sessionId: string | null = null
    let accessToken: string | null = null

    if (useStandardAuth) {
      const loginResponse = await adminApi.loginUser(userId)
      if (loginResponse) {
        accessToken = loginResponse.access_token
      }
    } else {
      const userDetails = await getOrCreateUser(userLocalpart)
      const session = await createOauth2Session(userDetails.id, true)
      sessionId = session.sessionId
      accessToken = session.accessToken
    }

    if (!accessToken) {
      throw new CommandError(`Unable to retrieve the bot's access token.`)
    }

    const userClient = new MatrixClient(config.MATRIX_SERVER_URL, accessToken)

    try {
      await userClient.joinRoom(targetRoomIdOrAlias)
      await client.sendHtmlText(roomId, `Joined the room ${targetRoomIdOrAlias}.`)
    } catch (err) {
      if (err.body?.errcode === "M_FORBIDDEN") {
        await client.sendHtmlText(roomId, `Cannot join the room ${targetRoomIdOrAlias}. Please invite the bot first.`)
      } else {
        LogService.error(moduleName, err)
        await client.sendHtmlText(roomId, `Cannot join the room ${targetRoomIdOrAlias}. Error: ${err.message}`)
      }
    } finally {
      if (useStandardAuth) {
        await adminApi.logoutUser(accessToken)
      } else {
        await endOauth2Session(sessionId!)
      }
    }
  }
}

async function getOrCreateUser(username: string): Promise<{ id: string; username: string }> {
  type Response = {
    data: {
      addUser: {
        user: {
          id: string
          username: string
        }
      }
    } | null
  }
  try {
    const res = await makeGraphqlRequest<Response>(
      `
      mutation AddUser($input: AddUserInput!) {
        addUser(input: $input) {
          user {
            id
            username
          }
        }
      }
      `,
      { input: { username } },
    )
    if (!res.data) {
      throw new CommandError("Empty response")
    }
    return res.data.addUser.user
  } catch (err) {
    LogService.error(moduleName, err)
    throw new CommandError(`Unable to create a user: ${err.message}`)
  }
}

async function createOauth2Session(
  userId: string,
  permanent: boolean,
): Promise<{ sessionId: string; accessToken: string; refreshToken?: string; deviceId: string }> {
  type Response = {
    data: {
      createOauth2Session: {
        accessToken: string
        refreshToken?: string
        oauth2Session: {
          id: string
          scope: string
          state: "ACTIVE" | "FINISHED"
        }
      }
    } | null
  }
  const deviceId = generateDeviceId()
  const scope = getOAuth2SessionScope(deviceId)
  try {
    const res = await makeGraphqlRequest<Response>(
      `
      mutation CreateOauth2Session($input: CreateOAuth2SessionInput!) {
        createOauth2Session (input: $input) {
          accessToken
          refreshToken
          oauth2Session {
            id
            scope
            state
          }
        }
      }
      `,
      { input: { scope, userId, permanent } },
    )
    if (!res.data) {
      throw new CommandError("Empty response")
    }
    return {
      deviceId: deviceId,
      sessionId: res.data.createOauth2Session.oauth2Session.id,
      accessToken: res.data.createOauth2Session.accessToken,
      refreshToken: res.data.createOauth2Session.refreshToken,
    }
  } catch (err) {
    LogService.error(moduleName, err)
    throw new CommandError(`Unable to create an OAuth2 session: ${err.message}`)
  }
}

async function getOauth2Sessions(userId: string): Promise<OAuth2Session[]> {
  type Response = {
    data: {
      user: {
        id: string
        oauth2Sessions: {
          nodes: OAuth2Session[]
          pageInfo: {
            endCursor: string
            hasNextPage: boolean
          }
        }
      }
    } | null
  }
  try {
    let endCursor: string | null = null
    let hasNextPage = true
    let sessions: OAuth2Session[] = []

    while (hasNextPage) {
      const res: Response = await makeGraphqlRequest(
        `
        query GetUserOAuth2Sessions($userId: ID!, $endCursor: String) {
          user(id: $userId) {
            id
            oauth2Sessions(first: 100, after: $endCursor) {
              nodes {
                id
                state
                scope
                client {
                  clientId
                  clientName
                }
                user {
                  id
                  username
                }
                lastActiveAt
                createdAt
                finishedAt
              }
              pageInfo {
                endCursor
                hasNextPage
              }
            }
          }
        }
        `,
        { userId, endCursor },
      )
      if (!res.data) {
        hasNextPage = false
        endCursor = null
      } else {
        const { nodes, pageInfo } = res.data.user.oauth2Sessions
        sessions = sessions.concat(nodes)
        hasNextPage = pageInfo.hasNextPage
        endCursor = pageInfo.endCursor
      }
    }
    return sessions
  } catch (err) {
    LogService.error(moduleName, err)
    throw new CommandError(`Unable to load user's OAuth2 sessions.`)
  }
}

async function endOauth2Session(sessionId: string): Promise<void> {
  type Response = {
    data: {
      endOauth2Session: {
        oauth2Session: {
          is: string
          state: "ACTIVE" | "FINISHED"
        }
        status: string
      }
    } | null
  }
  try {
    const res = await makeGraphqlRequest<Response>(
      `
      mutation EndOAuth2Session($input: EndOAuth2SessionInput!) {
        endOauth2Session(input: $input) {
          oauth2Session {
            id
            state
          }
          status
        }
      }
    `,
      { input: { oauth2SessionId: sessionId } },
    )
    if (!res.data) {
      throw new CommandError("Empty response")
    }
  } catch (err) {
    LogService.error(moduleName, err)
    throw new CommandError(`Unable to end the OAuth2 session: ${err.message}`)
  }
}

async function makeGraphqlRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await axios.post(
    config.MATRIX_AUTHENTICATION_SERVICE_GRAPHQL_URL,
    { query, variables },
    { headers: { Authorization: `Bearer ${config.ACCESS_TOKEN}` } },
  )
  return response.data
}

function getOAuth2SessionScope(deviceId: string = "*"): string {
  return [
    `urn:matrix:org.matrix.msc2967.client:device:${deviceId}`,
    "urn:matrix:org.matrix.msc2967.client:api:*",
    "email",
  ].join(" ")
}

function generateDeviceId(length: number = 16): string {
  return (
    "device_" +
    crypto
      .randomBytes(Math.ceil(length / 2))
      .toString("hex")
      .slice(0, length)
  )
}
