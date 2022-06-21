const {
  getConfiguration,
} = require("opstooling-js-style/src/eslint/configuration")

const config = getConfiguration({ typescript: { rootDir: __dirname } })

config.rules["no-restricted-imports"] = ["off"]

module.exports = config
