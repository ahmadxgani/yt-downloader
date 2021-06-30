const axios = require("axios").default
const cheerio = require("cheerio")
const readline = require("readline")

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

rl.question("Please paste the link you want to download: ", (answer) => {
    ytPlaylistDl(answer)
    rl.close()
})

const ytPlaylistDl = (link) => {
    axios({
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
        // data: "url=https%3A%2F%2Fwww.youtube.com%2Fplaylist%3Flist%3DPLkaFTR_oezJ4JfjsuyDfTTp4Cbff7Dbso&q_auto=0&ajax=1"
        data: `url=${encodeURI(link)}&q_auto=0&ajax=1`
    }).then((res) => {
        const $ = cheerio.load(res.data.result)
        $("div div.thumbnail").each((_, el) => {
            const href = $(el).find("a").attr("href")
            const code = href.split("/")
            const v_id = code[code.length - 1]
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
                    "Referer": `https://www.y2mate.com${href}`,
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
                            },
                            data
                        }).then(res => {
                            const $ = cheerio.load(res.data.result)
                            const download = $("div a").attr("href")
                            if (!download.startsWith("https://app.y2mate.com/download")) console.log(download)
                        })
                    }
                })
            }).catch(console.log)
        })
    }).catch(console.log)
}
