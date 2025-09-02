import htmlEscape from "escape-html"
import { MatrixClient, MessageEvent, MessageEventContent, RichReply } from "matrix-bot-sdk"

import { ACCOUNT_COMMAND, Command as AccountSubcommand } from "src/commands/account"
import { BULK_INVITE_COMMAND } from "src/commands/bulk-invite"
import { DEACTIVATE_USER_COMMAND } from "src/commands/deactivate-user"
import { DELETE_ROOM_COMMAND } from "src/commands/delete-room"
import { defaultGroups, INVITE_COMMAND } from "src/commands/invite"
import {
  LIST_NEW_JOINERS_COMMAND,
  LIST_NEW_JOINERS_DEFAULT_LIMIT,
  LIST_NEW_JOINERS_MAX_LIMIT,
  LIST_NEW_JOINERS_MIN_LIMIT,
} from "src/commands/list-new-joiners"
import { LIST_ROOMS_COMMAND } from "src/commands/list-rooms"
import { LIST_SPACES_COMMAND } from "src/commands/list-spaces"
import { PROMOTE_COMMAND } from "src/commands/promote"
import { SPACE_COMMAND } from "src/commands/space"
import { Command as WelcomeMessageSubcommand, WELCOME_MESSAGE_COMMAND } from "src/commands/welcome-message"
import config from "src/config/env"
import { groupedRooms } from "src/config/rooms"
import { commandPrefix } from "src/constants"

import { INVITE_ROOM } from "./invite-room"

export async function runHelpCommand(
  roomId: string,
  event: MessageEvent<MessageEventContent>,
  client: MatrixClient,
): Promise<string> {
  const allRoomGroups = groupedRooms.map((group) => group.groupName).join(", ")
  const defaultRoomGroups = defaultGroups.join(", ")
  const help = `
${commandPrefix} ${LIST_ROOMS_COMMAND} [<group>]
    Show the list of available groups & rooms
    [<group>]   - (Optional) group(s) of rooms to invite user (space separated)
                Available groups: ${allRoomGroups}

--------------------------------------------------

${commandPrefix} ${LIST_SPACES_COMMAND}
    Show the list of all rooms and spaces on the current server in CSV format

--------------------------------------------------

${commandPrefix} ${LIST_NEW_JOINERS_COMMAND} [<number>]
    Show the last registered users on the server.
    [<number>]  - (Optional) how many users to list. Default: ${LIST_NEW_JOINERS_DEFAULT_LIMIT}, Min: ${LIST_NEW_JOINERS_MIN_LIMIT}, Max: ${LIST_NEW_JOINERS_MAX_LIMIT}

--------------------------------------------------

${commandPrefix} ${SPACE_COMMAND} <spaceId> [list | add | remove] [<roomId>]
    A command for managing spacess. See examples below.
    <spaceId>    - Matrix room id or alias for the space
    <roomId>     - Matrix room id or alias

    Examples:
    - "${commandPrefix} ${SPACE_COMMAND} !abcd:${config.MATRIX_SERVER_DOMAIN} list" – List all rooms in the "!abcd:..." space
    - "${commandPrefix} ${SPACE_COMMAND} !abcd:${config.MATRIX_SERVER_DOMAIN} add !efgh:${config.MATRIX_SERVER_DOMAIN}" – Add the "!efgh:..." room to the "!abcd:..." space
    - "${commandPrefix} ${SPACE_COMMAND} !abcd:${config.MATRIX_SERVER_DOMAIN} remove !efgh:${config.MATRIX_SERVER_DOMAIN}" – Remove the "!efgh:..." room from the "!abcd:..." space

--------------------------------------------------

${commandPrefix} ${INVITE_COMMAND} <userId> [<group> | <roomId>]
    Invite user to a group of rooms.
    <userId>    - Matrix user id @username:${config.MATRIX_SERVER_DOMAIN}
    [<group>]   - (Optional) group(s) of rooms to invite user (space separated)
                Available groups: ${allRoomGroups}
                Default: ${defaultRoomGroups}
                To see all rooms & groups - write "${commandPrefix} invite list-rooms"
    [<roomId>]  - (Optional) Matrix room id or alias

    Examples:
    - "${commandPrefix} ${INVITE_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN}" - invite user to default ${allRoomGroups}
    - "${commandPrefix} ${INVITE_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN} common opstooling" - custom groups
    - "${commandPrefix} ${INVITE_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN} !MzyrIlxGUHXYwtRGrO:${config.MATRIX_SERVER_DOMAIN}" - invite user to a particular room
    - "${commandPrefix} ${INVITE_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN} #general:${config.MATRIX_SERVER_DOMAIN}" - invite user to a particular room

--------------------------------------------------

${commandPrefix} ${BULK_INVITE_COMMAND} <roomId>
    Invite all members of the current server to a given room.
    Disabled, banned, and non Google SSO users will be ignored.
    <roomId>    - Matrix room id or alias

    Examples:
    - "${commandPrefix} ${BULK_INVITE_COMMAND} !MzyrIlxGUHXYwtRGrO:${config.MATRIX_SERVER_DOMAIN}"
    - "${commandPrefix} ${BULK_INVITE_COMMAND} #general:${config.MATRIX_SERVER_DOMAIN}"

--------------------------------------------------

${commandPrefix} ${INVITE_ROOM} <fromRoomId> <targetRoomId>
    Invite all members from the room specified by <fromRoomId> to the room specified by <targetRoomId>.
    Disabled, banned, and non Google SSO users will be ignored.
    <fromRoomId>      - Matrix room id or alias to invite users from
    <targetRoomId>    - Matrix room id or alias to invite users to

    Examples:
    - "${commandPrefix} ${INVITE_ROOM} !abcd1:${config.MATRIX_SERVER_DOMAIN} !efgh2:${config.MATRIX_SERVER_DOMAIN}"
    - "${commandPrefix} ${INVITE_ROOM} #room1:${config.MATRIX_SERVER_DOMAIN} #room2:${config.MATRIX_SERVER_DOMAIN}"

--------------------------------------------------

${commandPrefix} ${PROMOTE_COMMAND} <userId> <roomId> <powerLevel>
    Assign a specific power level to the user in the room.
    <userId>     - Matrix user id @username:${config.MATRIX_SERVER_DOMAIN}
    <roomId>     - Matrix room id or alias
    <powerLewel> - Ddesired power level for the user as a number or alias:
                   - Number (0-100)
                   - Aliases:
                     - default: 0
                     - moderator: 50
                     - admin: 100

    Examples:
    - "${commandPrefix} ${PROMOTE_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN} !MzyrIlxGUHXYwtRGrO:${config.MATRIX_SERVER_DOMAIN} 99" - promote the user to level 99
    - "${commandPrefix} ${PROMOTE_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN} #roomAlias:${config.MATRIX_SERVER_DOMAIN} moderator" - promote the user to moderator level (50)

--------------------------------------------------

${commandPrefix} ${DELETE_ROOM_COMMAND} <roomId>
    Kick all room members and completely delete the room.
    <roomId>     - Matrix room id or alias

    Example:
    - "${commandPrefix} ${DELETE_ROOM_COMMAND} !MzyrIlxGUHXYwtRGrO:${config.MATRIX_SERVER_DOMAIN}" - delete the room
    - "${commandPrefix} ${DELETE_ROOM_COMMAND} #roomAlias:${config.MATRIX_SERVER_DOMAIN}" - delete the room

--------------------------------------------------

${commandPrefix} ${DEACTIVATE_USER_COMMAND} <userId> [recover]
    Deactivate a user's account. It removes active access tokens, resets the password, and deletes third-party IDs (to prevent the user requesting a password reset).
    Messages sent by the user will still be visible by anyone that was in the room when these messages were sent, but hidden from users joining the room afterwards.

    <userId>     - Matrix user id @username:${config.MATRIX_SERVER_DOMAIN}
    [recover]    - (Optional) flag for user account activation. The bot will provide a new random user password.

    Examples:
    - "${commandPrefix} ${DEACTIVATE_USER_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN}" - deactivate the user
    - "${commandPrefix} ${DEACTIVATE_USER_COMMAND} @username:${config.MATRIX_SERVER_DOMAIN} recover" - activate user with password reset

--------------------------------------------------

${commandPrefix} ${ACCOUNT_COMMAND} ${AccountSubcommand.List}
    Lists all bot accounts on the server.

${commandPrefix} ${ACCOUNT_COMMAND} ${AccountSubcommand.Create} <userId>
    Creates a bot account

    <userId>     - Matrix user id @username:${config.MATRIX_SERVER_DOMAIN} or just username

${commandPrefix} ${ACCOUNT_COMMAND} ${AccountSubcommand.SignIn} <userId> <permanent | refreshable> [deviceId]
    Creates a new OAuth2 session. An access and refresh tokens, and device ID will be sent to a requester in the E2EE DM chat.

    <userId>                    - Matrix user id @username:${config.MATRIX_SERVER_DOMAIN} or just username
    <permanent | refreshable>   - Flag defining the token type
    [deviceId]                  - (Optional) flag for creating a session for a specific device

${commandPrefix} ${ACCOUNT_COMMAND} ${AccountSubcommand.ListSessions} <userId>
    List all active OAuth2 sessions in the format: ID, CreatedAt, LastActiveAt.

${commandPrefix} ${ACCOUNT_COMMAND} ${AccountSubcommand.SignOut} <userId> <sessionId | all>
    List all active OAuth2 sessions in the format: ID, CreatedAt, LastActiveAt.

    <sessionId>  - ID of the session to sign out. Use "all" to deactivate all active sessions.

${commandPrefix} ${ACCOUNT_COMMAND} ${AccountSubcommand.AcceptInvitation} <userId> <roomId> [standard-auth]
    Accept an invitation to a room on behalf of the bot. The bot must be invited to the room first.
    When the "standard-auth" flag is set, the bot will use the standard authentication flow. Otherwise,
    the bot will utilize Matrix Authentication Service.

--------------------------------------------------

${commandPrefix} ${WELCOME_MESSAGE_COMMAND} ${WelcomeMessageSubcommand.Show}
    Show the welcome message the bot can send to a user

${commandPrefix} ${WELCOME_MESSAGE_COMMAND} ${WelcomeMessageSubcommand.Send} <userId>
    Send the welcome message to a user in DM

--------------------------------------------------

${commandPrefix} help
    This menu
`

  const text = `Help menu:\n${help}`
  const html = `<b>Help menu:</b><br /><pre><code>${htmlEscape(help)}</code></pre>`

  // Note that we're using the raw event, not the parsed one!
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const reply = RichReply.createFor(roomId, event, text, html)
  reply.msgtype = "m.notice" // Bots should always use notices
  return await client.sendMessage(roomId, reply)
}
