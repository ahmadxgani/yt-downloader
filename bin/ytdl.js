#!/usr/bin/env node
const Fs = require("fs")
const config = require("../env.json")
const path = require("path")
const envFile = path.join(process.env.HOME, "env.json")

if (process.argv.length === 4 && process.argv[2] === "--setDir") {
    config.baseDir = process.argv[3]
    Fs.writeFileSync(envFile, JSON.stringify(config))
} else {
    if (!Fs.existsSync(envFile)) Fs.writeFileSync(envFile, JSON.stringify({ baseDir: "downloads" }))
    const { start } = require("../src/index")
    start()
}
