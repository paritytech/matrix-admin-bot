import "dotenv/config"
import Joi from "joi"
import { LogLevel } from "matrix-bot-sdk"

import { GroupOfRooms } from "src/config/rooms"

export interface Environment {
  CI: boolean
  NODE_ENV: string
  MATRIX_SERVER_URL: string
  ACCESS_TOKEN: string
  DATA_PATH: string
  LOG_LEVEL: LogLevel
  INVITE_ROOMS_LIST: GroupOfRooms[]
}

const JoiJSON = Joi.extend({
  type: "array",
  base: Joi.array(),
  coerce: {
    from: "string",
    method: (value: string) => {
      if (value[0] !== "[" && !/^\s*(\[)/.test(value)) {
        return { value }
      }
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
  DATA_PATH: Joi.string().default("storage"),
  MATRIX_SERVER_URL: Joi.string().default("https://matrix.parity.io"),
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
})

const { value, error } = environmentSchema.validate(process.env, { stripUnknown: true })

if (error) {
  throw Error(
    `Misconfigured environment variables!
    ${error?.details?.[0].message || error.message}`,
  )
}

export default value as Environment
