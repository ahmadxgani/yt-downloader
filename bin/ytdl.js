#!/usr/bin/env node
const path = require("path")
const envFile = path.join(process.env.HOME, "env.json")
const Fs = require("fs")

if (!Fs.existsSync(envFile)) Fs.writeFileSync(envFile, JSON.stringify({ baseDir: "downloads" }))

const config = require(envFile)

if (process.argv.length === 4 && process.argv[2] === "--setDir") {
    config.baseDir = process.argv[3]
    Fs.writeFileSync(envFile, JSON.stringify(config))
} else {
    const { start } = require("../src/index")
    start()
}
