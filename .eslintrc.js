const {
  getConfiguration,
} = require("opstooling-js-style/src/eslint/configuration")

const config = getConfiguration({ typescript: { rootDir: __dirname } })

/*
  tsc doesn't translate paths relative to tsconfig.baseUrl to relative paths on
  the build directory for compiled modules
  (https://github.com/microsoft/TypeScript/issues/35351), thus relative imports
  are required for this project because a requirement dictates that it needs to
  be compiled for production as opposed to directly run from e.g. ts-node
*/
config.rules["no-restricted-imports"] = ["off"]

module.exports = config
