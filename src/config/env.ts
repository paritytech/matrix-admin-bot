import "dotenv/config"

import environmentSchema from "./env.schema"
import { Environment } from "./env.types"

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
