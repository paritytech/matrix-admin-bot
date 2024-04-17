import "dotenv/config"
import Joi from "joi"
import { LogLevel } from "matrix-bot-sdk"

import { GroupOfRooms } from "src/config/rooms"

export interface Environment {
  CI: boolean
  NODE_ENV: string
  MATRIX_SERVER_URL: string
  MATRIX_SERVER_DOMAIN: string
  MATRIX_AUTHENTICATION_SERVICE_GRAPHQL_URL: string
  ACCESS_TOKEN: string
  ADMIN_ROOM_ID: string
  DATA_PATH: string
  LOG_LEVEL: LogLevel
  INVITE_ROOMS_LIST: GroupOfRooms[]
  USER_AUTH_PROVIDER: string
  WELCOME_MESSAGE_BASE64: string
}

/* By default, Joi expects all .env parameters as string
   In case we pass JSON, that should be converted to Object/Array explicitly */
const JoiJSON = Joi.extend({
  type: "array",
  base: Joi.array(),
  coerce: {
    from: "string",
    method: (value: string) => {
      /* check if the given string starts with array bracket [ "1", "2", ... ]
         otherwise return raw value */
      if (value[0] !== "[" && !/^\s*(\[)/.test(value)) {
        return { value }
      }
      // parse string as JSON format
      try {
        return { value: JSON.parse(value) as GroupOfRooms[] }
      } catch (error) {
        return { errors: [error] }
      }
    },
  },
}) as Joi.Root

const environmentSchema = Joi.object<Environment>({
  NODE_ENV: Joi.string(),
  CI: Joi.boolean().default(false),
  LOG_LEVEL: Joi.string().default(LogLevel.INFO),
  ACCESS_TOKEN: Joi.string().required(),
  ADMIN_ROOM_ID: Joi.string().required(),
  DATA_PATH: Joi.string().default("storage"),
  MATRIX_SERVER_URL: Joi.string().default("https://m.parity.io"),
  MATRIX_AUTHENTICATION_SERVICE_GRAPHQL_URL: Joi.string().default(""),
  MATRIX_SERVER_DOMAIN: Joi.string().default("parity.io"),
  INVITE_ROOMS_LIST: JoiJSON.array()
    .items(
      Joi.object<GroupOfRooms>({
        default: Joi.boolean().required(),
        list: Joi.array().min(1).required(),
        groupName: Joi.string().min(1).required(),
      }),
    )
    .min(1)
    .required(),
  USER_AUTH_PROVIDER: Joi.string().required(),
  WELCOME_MESSAGE_BASE64: Joi.string().default(""),
})

const { value, error } = environmentSchema.validate(process.env, { stripUnknown: true })

if (error) {
  throw Error(
    `Misconfigured environment variables!
    ${error?.details?.[0].message || error.message}`,
  )
}

export default value as Environment
