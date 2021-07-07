#!/usr/bin/env node
const Fs = require("fs")
const config = require("../env.json")

if (process.argv.length === 4 && process.argv[2] === "--setDir") {
    config.baseDir = process.argv[3]
    Fs.chmod("../env.json", "777", () => {})
    Fs.writeFileSync("../env.json", JSON.stringify(config))
} else {
    const { start } = require("../src/index")
    start()
}
