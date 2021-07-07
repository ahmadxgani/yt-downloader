const axios = require("axios").default
const cheerio = require("cheerio")
const Fs = require("fs")
const { Listr } = require("listr2")
const path = require("path")
const config = require("../env.json")

const singleRegex = new RegExp(/(?:http(?:s|):\/\/|)(?:(?:www\.|)youtube(?:\-nocookie|)\.com\/(?:shorts\/)?(?:watch\?.*(?:|\&)v=|embed\/|v\/)|youtu\.be\/)([-_0-9A-Za-z]{11})/)
const playlistRegex = new RegExp(/^(?:http(?:s|):\/\/|)(?:(?:www\.|)youtube\.com\/playlist\?list=)([-_0-9A-Za-z]{34})$/);
const domain = new RegExp(/((redirector|r1---sn-npoeenlk)\.googlevideo\.com)|(dl(\d){0,3}.(dlmate|y2mate)(\d){0,2}.(xyz|com))/)

const informationTask = async (ctx, task) => {
    ctx.type = await task.prompt({
        type: "Select",
        message: "which one ( playlist / single video )",
        choices: [ "playlist", "single" ]
    })
    ctx.input = await task.prompt([
        {
            type: "Input",
            name: "youtube link",
            message: "Please paste the youtube playlist link",
            validate: (response) => {
                if (ctx.type === "single" ? !singleRegex.test(response) : !playlistRegex.test(response)) return false
                return true
            },
        },
        {
            type: "Input",
            initial: "downloads",
            name: "folder download",
            message: "Please type your directory that will be saved file of the download"
        },
        {
            type: "Select",
            name: "resolution",
            message: "choose video resolution",
            choices: [ "1080p", "720p", "480p", "360p", "240p", "144p" ]
        },
        {
            type: "Select",
            name: "default resolution",
            message: "select the default resolution if the resolution you choose is not available",
            choices: [ "Highest resolution", "Lowest resolution" ]
        }
    ])
}

const output = [ "youtube link", "folder download", "resolution", "default resolution" ]
const tasks = new Listr(
    [
        {
            title: "Getting information",
            task: informationTask
        },
        {
            title: "Confirmation",
            task: async (ctx, task) => {
                ctx.isConfirm = await task.prompt([{
                    type: "Toggle",
                    message: `${output[0]}: ${ctx.input[output[0]]}\n  ${output[1]}: "${path.join(process.env.HOME, config.baseDir, ctx.input[output[1]])}"\n  ${output[2]}: ${ctx.input[output[2]]}\n  ${output[3]}: ${ctx.input[output[3]]}\n\n  is the information above correct?`,
                    initial: false
                }])
            },
        },
        {
            enabled: (ctx) => !ctx.isConfirm,
            task: informationTask
        },
        {
            title: "Downloading video",
            task: async (ctx, task) => {
                try {
                    task.title = "Please wait a moment"
                    task.output = "processing..."
                    if (ctx.type === "single") {
                        const v_id = singleRegex.exec(ctx.input[output[0]])[1]
                        ctx.linkVideos = [await getSingleVid({
                            v_id,
                            href: `/youtube/${v_id}`,
                            defaultResolution: ctx.input[output[3]],
                            resolution: ctx.input[output[2]]
                        })]
                    } else {
                        ctx.linkVideos = await ytPlaylistDl(ctx.input[output[0]], ctx.input[output[3]], ctx.input[output[2]])
                        if (!ctx.linkVideos.length) throw "Playlist url are not supported"
                    }
                    task.title = "Downloading video"
                } catch (e) {
                    throw e
                }
            },
        },
        {
            task: async (ctx, task) => {
                task.title = `save video to "${path.join(process.env.HOME, config.baseDir, ctx.input[output[1]])}" folder`
                await download(ctx.linkVideos, ctx.input[output[1]])
                task.output = `total videos: ${ctx.linkVideos.length}`
            },
            options: {
                persistentOutput: true
            }
        },
    ],
    { exitOnError: false }
)

exports.start = async () => {
    try {
        await tasks.run()
    } catch (e) {
        console.error(e)
    }
}

const ytPlaylistDl = async (link, defaultResolution, resolution) => {
    try {
        const res = await axios({
            url: "https://www.y2mate.com/mates/en68/analyze/ajax",
            method: "POST",
            headers: {	
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.5",
                "Alt-Used": "www.y2mate.com",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Cookie": "PHPSESSID=lsbkrjfu99f613h39md06l3r93",
                "Host": "www.y2mate.com",
                "Origin": "https://www.y2mate.com",
                "Pragma": "no-cache",
                "Referer": "https://www.y2mate.com/en68",
                "TE": "Trailers",
                "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
                "X-Requested-With": "XMLHttpRequest",
            },
            data: `url=${encodeURIComponent(link)}&q_auto=0&ajax=1`
        })
        const $ = cheerio.load(res.data.result)
        const video_id = []
        $("div div.thumbnail").each((_, el) => {
            const href = $(el).find("a").eq(1)
            const code = href.attr("href").split("/")
            const v_id = code[code.length - 1]
            video_id.push({ v_id, href: href.attr("href") })
        })
        const promiseArr = video_id.map((args) => {
            return new Promise((resolve, reject) => {
                getSingleVid({ ...args, defaultResolution, resolution }).then(resolve).catch(reject)
            })
        })
        return await Promise.all(promiseArr)
    } catch (e) {
        console.log(e)
        throw new Error("Request time out")
    }
}

const getSingleVid = ({ v_id, href, defaultResolution, resolution }) => {
    return new Promise((resolve, reject) => {
        axios({
            url: "https://www.y2mate.com/mates/analyze/ajax",
            method: "POST",
            headers: {
                "Host": "www.y2mate.com",
                "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.5",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "Origin": "https://www.y2mate.com",
                "Alt-Used": "www.y2mate.com",
                "Referer": "https://www.y2mate.com/en68",
                "Connection": "keep-alive",
                "Cookie": "PHPSESSID=lsbkrjfu99f613h39md06l3r93",
                "Pragma": "no-cache",
                "Cache-Control": "no-cache",
                "TE": "Trailers"
            },
            data: `url=${encodeURI(`https://youtube.com/watch?v=${v_id}`)}&q_auto=1&ajax=1`
        }).then(res => {
            const $ = cheerio.load(res.data.result)
            const script = $("script").last().html()
            const _id = /var k__id = "(.*?)";/.exec(script)[1]
            const tr = $("div#mp4 table tbody tr")
            const result = tr.get().length
            const resArr = []
            const fileName = $("div.thumbnail.cover div b").text()
            tr.toArray().find((val, i) => {
                if (i < (result - 2)) resArr.push($(val).find("td").last().find("a").attr("data-fquality"))
            });
            const fquality = chooseResolution(defaultResolution, resolution, resArr)
            tr.each((i) => {
                if (i < (result - 2)) {
                    const data = new URLSearchParams(Object.entries({
                        type: "youtube",
                        _id,
                        v_id,
                        ajax: "1",
                        token: "",
                        ftype: "mp4",
                        fquality
                    }))
                    axios({
                        url: "https://www.y2mate.com/mates/convert",
                        method: "POST",
                        headers: {
                            "Host": "www.y2mate.com",
                            "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
                            "Accept": "*/*",
                            "Accept-Language": "en-US,en;q=0.5",
                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                            "X-Requested-With": "XMLHttpRequest",
                            "Origin": "https://www.y2mate.com",
                            "Referer": `https://www.y2mate.com${href}`,
                            "Connection": "keep-alive",
                            "Cookie": "PHPSESSID=lsbkrjfu99f613h39md06l3r93",
                            "Pragma": "no-cache",
                            "Cache-Control": "no-cache",
                            "TE": "Trailers"
                        },
                        data
                    }).then(res => {
                        const $ = cheerio.load(res.data.result)
                        const downloadLink = $("div a").attr("href")
                        resolve({ downloadLink, fileName })
                    })
                }
            })
        }).catch(reject)
    })
}

const download = (videos, dirName) => {
    dirName = path.join(process.env.HOME, config.baseDir, dirName)
    return videos.map(async video => {
        try {
            const fileName = path.join(dirName, video.fileName.replace(/\//g, " of "))
            const response = (await axios({
                url: video.downloadLink,
                method: "GET",
                headers: {
                    "Host": domain.exec(video.downloadLink)[0],
                    "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Connection": "keep-alive",
                    "Referer": "https://www.y2mate.com/",
                    "Upgrade-Insecure-Requests": 1
                },
                responseType: "stream"
            })).data
            
            if (!Fs.existsSync(path.join(dirName))) {
                Fs.mkdirSync(path.join(dirName), { recursive: true });
            }
    
            response.pipe(Fs.createWriteStream(fileName))
            response.on("end", () => {
                console.log(`video with name "${video.fileName.replace(/\//g, " of ")}" has been saved successfully`)
            })
        } catch {
            console.log(`video with "${video.fileName.replace(/\//g, " of ")}" name failed to save`)
        }
    })
}

const chooseResolution = (defaultResolution, resolution, availableResolution) => {
    const isAvailable = availableResolution.find(val => new RegExp(resolution.slice(0, resolution.length - 1)).test(val))
    const defaultRes = defaultResolution === "Highest resolution"
    ? availableResolution[0]
    : availableResolution[availableResolution.length - 1]

    return isAvailable || defaultRes
}