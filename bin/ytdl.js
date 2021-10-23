#!/usr/bin/env node
const path = require("path")
const envFile = path.join(process.env.HOME, "env.json")
const Fs = require("fs")

if (!Fs.existsSync(envFile)) Fs.writeFileSync(envFile, JSON.stringify({ baseDir: "Downloads" }))

const { start, retry } = require("../src/index")

if (process.argv.length === 4 && process.argv[2] === "--setDir") {
  const config = require(envFile)
  config.baseDir = process.argv[3]
  Fs.writeFileSync(envFile, JSON.stringify(config))
} else if (process.argv.length === 3 && process.argv[2] === "--retry") {
  retry()
} else {
  start()
}
