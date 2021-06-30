const axios = require("axios").default
const cheerio = require("cheerio")
const readline = require("readline")
const fs = require("fs")
const path = require("path")

const dirName = "My tutorial playlist/tutorial figma"
const savedVideo = path.join(process.env.HOME, dirName)

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

rl.question("Please paste the link you want to download: ", async (answer) => {
    const result = await ytPlaylistDl(answer)
    await download(result)
    rl.close()
})

const ytPlaylistDl = async (link) => {
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
        const listLinkDl = []
        const video_id = []
        $("div div.thumbnail").each((_, el) => {
            const href = $(el).find("a").eq(1)
            const code = href.attr("href").split("/")
            const v_id = code[code.length - 1]
            video_id.push({ v_id, href: href.attr("href"), fileName: href.text() })
        })
        const promiseArr = video_id.map(({ v_id, href, fileName }) => {
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
                        "Referer": `https://www.y2mate.com/en68${href}`,
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
                    const result = $("div#mp4 table tbody tr").get().length
                    $("div#mp4 table tbody tr").each((i, el) => {
                        if (i < (result - 2)) {
                            const fquality = $(el).find("td a").last().attr("data-fquality")
                            const data = new URLSearchParams(Object.entries({
                                type: "youtube",
                                _id,
                                v_id,
                                ajax: "1",
                                token: "",
                                ftype: "mp4",
                                fquality
                            }))
                            const ingfo = $(el).first().text()
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
                                    "Referer": `https://www.y2mate.com/en68${href}`,
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
                                if (!downloadLink.startsWith("https://app.y2mate.com/download")) listLinkDl.push({ downloadLink, fileName })
                                resolve("done")
                            })
                        }
                    })
                }).catch(reject)
            })
        })
        return Promise.all(promiseArr).then(() => listLinkDl).catch((e) => e)
    } catch (e) {
        console.log(e)
        throw new Error("Request time out")
    }
}

const download = (videos) => {
    return videos.map(async video => {
        const fileName = path.join(savedVideo, video.fileName)
        const response = (await axios({
            url: video.downloadLink,
            method: "GET",
            headers: {
                "Connection": "keep-alive"
            },
            responseType: "stream"
        })).data
        
        if (!fs.existsSync(savedVideo)){
            fs.mkdirSync(savedVideo);
        }

        response.pipe(fs.createWriteStream(fileName))
        response.on("end", () => {
            console.log(`video with name ${video.fileName} successfully downloaded`)
        })
    })
}
