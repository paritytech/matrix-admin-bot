import "dotenv/config"
import Joi from "joi"

export interface Environment {
  CI: boolean
  NODE_ENV: string
  MATRIX_SERVER_URL: string
  ACCESS_TOKEN: string
  DATA_PATH: string
  LOG_LEVEL: string
}

const environmentSchema = Joi.object<Environment>({
  NODE_ENV: Joi.string(),
  CI: Joi.boolean().default(false),
  LOG_LEVEL: Joi.string().default("info"),
  ACCESS_TOKEN: Joi.string().required(),
  DATA_PATH: Joi.string().default("storage"),
  MATRIX_SERVER_URL: Joi.string().default("https://matrix.org"),
})

const { value, error } = environmentSchema.validate(process.env, {
  stripUnknown: true,
})

if (error?.details.length) {
  throw Error(
    `Misconfigured environment variables!
    ${error.details[0].message}`,
  )
}

export default value as Environment
