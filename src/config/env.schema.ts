import Joi from "joi"

import { Environment } from "./env.types"

export default Joi.object<Environment>({
  NODE_ENV: Joi.string(),
  CI: Joi.boolean().default(false),
  LOG_LEVEL: Joi.string().default("info"),
  ACCESS_TOKEN: Joi.string().required(),
  DATA_PATH: Joi.string().default("storage"),
  MATRIX_SERVER_URL: Joi.string().default("https://matrix.org"),
})
