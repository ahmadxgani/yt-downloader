const axios = require("axios").default;
const cheerio = require("cheerio");
const download = require("download");
const Fs = require("fs");
const { Listr } = require("listr2");
const path = require("path");
const config = require(path.join(process.env.HOME, "env.json"));

const singleRegex = new RegExp(
  /(?:http(?:s|):\/\/|)(?:(?:www\.|)youtube(?:\-nocookie|)\.com\/(?:shorts\/)?(?:watch\?.*(?:|\&)v=|embed\/|v\/)|youtu\.be\/)([-_0-9A-Za-z]{11})/
);
const playlistRegex = new RegExp(
  /^(?:http(?:s|):\/\/|)(?:(?:www\.|)youtube\.com\/playlist\?list=)([-_0-9A-Za-z]{34})$/
);

const informationTask = async (ctx, task) => {
  ctx.type = await task.prompt({
    type: "Select",
    message: "which one ( playlist / single video )",
    choices: ["playlist", "single"],
  });
  ctx.input = await task.prompt([
    {
      type: "Input",
      name: "youtube link",
      message: `Please paste the youtube ${
        ctx.type === "single" ? "video" : "playlist"
      } link`,
      validate: (response) => {
        if (
          ctx.type === "single"
            ? !singleRegex.test(response)
            : !playlistRegex.test(response)
        )
          return false;
        return true;
      },
    },
    {
      type: "Input",
      initial: "downloads",
      name: "folder download",
      message:
        "Please type your directory that will be saved file of the download",
    },
    {
      type: "Select",
      name: "resolution",
      message: "choose video resolution",
      choices: ["1080p", "720p", "480p", "360p", "240p", "144p"],
    },
    {
      type: "Select",
      name: "default resolution",
      message:
        "select the default resolution if the resolution you choose is not available",
      choices: ["Highest resolution", "Lowest resolution"],
    },
  ]);
};

const output = [
  "youtube link",
  "folder download",
  "resolution",
  "default resolution",
];
const tasks = new Listr(
  [
    {
      title: "Getting information",
      task: informationTask,
    },
    {
      title: "Confirmation",
      task: async (ctx, task) => {
        ctx.isConfirm = await task.prompt([
          {
            type: "Toggle",
            message: `${output[0]}: ${ctx.input[output[0]]}\n  ${
              output[1]
            }: "${path.join(
              process.env.HOME,
              config.baseDir,
              ctx.input[output[1]]
            )}"\n  ${output[2]}: ${ctx.input[output[2]]}\n  ${output[3]}: ${
              ctx.input[output[3]]
            }\n\n  is the information above correct?`,
            initial: false,
          },
        ]);
      },
    },
    {
      enabled: (ctx) => !ctx.isConfirm,
      task: informationTask,
    },
    {
      title: "Downloading video",
      task: async (ctx, task) => {
        try {
          task.title = "Please wait a moment";
          task.output = "processing...";
          if (ctx.type === "single") {
            const v_id = singleRegex.exec(ctx.input[output[0]])[1];
            ctx.linkVideos = [
              await getSingleVid({
                v_id,
                href: `/youtube/${v_id}`,
                defaultResolution: ctx.input[output[3]],
                resolution: ctx.input[output[2]],
              }),
            ];
            throw ctx.linkVideos;
          } else {
            ctx.linkVideos = await ytPlaylistDl(
              ctx.input[output[0]],
              ctx.input[output[3]],
              ctx.input[output[2]]
            );
            if (!ctx.linkVideos.length) throw "Playlist url are not supported";
          }
        } catch (e) {
          throw e;
        }
      },
    },
    {
      task: async (ctx, task) => {
        task.title = `save video to "${path.join(
          process.env.HOME,
          config.baseDir,
          ctx.input[output[1]]
        )}" folder`;
        task.output = `total videos: ${ctx.linkVideos.length}`;
        await downloads(ctx.linkVideos, ctx.input[output[1]]);
        // ctx.log = await downloads(ctx.linkVideos, ctx.input[output[1]])
      },
      options: {
        persistentOutput: true,
      },
    },
  ],
  { exitOnError: false }
);

exports.start = async () => {
  try {
    await tasks.run();
    // const ctx = await tasks.run()
    // Fs.writeFileSync(path.join(process.env.HOME, "failedLink.json"), JSON.stringify(ctx.log))
    // const failedVideo = ctx.log.filter((val) => val.isFailed)
    // if (failedVideo.length) console.log(`Done with ${failedVideo.length} failed file, you can visit the log on "${path.join(process.env.HOME, "failedLink.json")}" or retry download with command "ytdl --retry"`)
  } catch (e) {
    console.error(e);
  }
};
exports.retry = async () => {
  try {
    const isNeedToRetry = Fs.existsSync(
      path.join(process.env.HOME, "failedLink.json")
    );
    if (!isNeedToRetry) throw new Error("No videos fail to download again");
    const log = require(path.join(process.env.HOME, "failedLink.json"));
    if (!log.length) throw new Error("You not have history download");
    const failVideos = log.filter((val) => val.isFailed);
    if (!failVideos.length) throw new Error("No videos fail to download again");
    failVideos.map(async (failVideo) => {
      const dirName = path.join(failVideo.fullPath, "..");
      const arr = failVideo.fullPath.split("/");
      const fileName = arr[arr.length - 1];
      // hapus item yg gagal jika file berhasil / sudah selesai di download dan di simpan ( belum terlaksana )
      await downloads(failVideo.link, failVideo.fullPath);
      // await save(dirName, fileName, failVideo.fullPath, failVideo.link)
    });
  } catch (e) {
    console.log(e.message);
  }
};

const ytPlaylistDl = async (link, defaultResolution, resolution) => {
  try {
    const res = await axios({
      url: `https://api.youtubemultidownloader.com/playlist?url=${encodeURIComponent(
        link
      )}&nextPageToken=`,
      method: "GET",
      headers: {
        Host: "api.youtubemultidownloader.com",
        "User-Agent":
          "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        Origin: "https://youtubemultidownloader.net",
        Connection: "keep-alive",
        Referer: "https://youtubemultidownloader.net/",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
      },
    });
    const promiseArr = res.data.items.map((val) => {
      return new Promise((resolve, reject) => {
        getSingleVid({ v_id: val.id, defaultResolution, resolution })
          .then(resolve)
          .catch(reject);
      });
    });
    return await Promise.all(promiseArr);
  } catch {
    throw new Error("Request time out");
  }
};

const getSingleVid = ({ v_id, defaultResolution, resolution }) => {
  return new Promise((resolve, reject) => {
    axios({
      url: "https://www.y2mate.com/mates/analyze/ajax",
      method: "POST",
      headers: {
        Host: "www.y2mate.com",
        "User-Agent":
          "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://www.y2mate.com",
        "Alt-Used": "www.y2mate.com",
        Referer: "https://www.y2mate.com/en68",
        Connection: "keep-alive",
        Cookie: "PHPSESSID=lsbkrjfu99f613h39md06l3r93",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        TE: "Trailers",
      },
      data: `url=${encodeURI(
        `https://youtube.com/watch?v=${v_id}`
      )}&q_auto=1&ajax=1`,
    })
      .then((res) => {
        const $ = cheerio.load(res.data.result);
        const script = $("script").last().html();
        const _id = /var k__id = "(.*?)";/.exec(script)[1];
        const tr = $("div#mp4 table tbody tr");
        const result = tr.get().length;
        const resArr = [];
        const fileName = $("div.thumbnail.cover div b").text();
        tr.toArray().find((val, i) => {
          if (i < result - 2)
            resArr.push(
              $(val).find("td").last().find("a").attr("data-fquality")
            );
        });
        const fquality = chooseResolution(
          defaultResolution,
          resolution,
          resArr
        );
        tr.each((i) => {
          if (i < result - 2) {
            const data = new URLSearchParams(
              Object.entries({
                type: "youtube",
                _id,
                v_id,
                ajax: "1",
                token: "",
                ftype: "mp4",
                fquality,
              })
            );
            axios({
              url: "https://www.y2mate.com/mates/convert",
              method: "POST",
              headers: {
                Host: "www.y2mate.com",
                "User-Agent":
                  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
                Accept: "*/*",
                "Accept-Language": "en-US,en;q=0.5",
                "Content-Type":
                  "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                Origin: "https://www.y2mate.com",
                Referer: `https://www.y2mate.com/youtube/${v_id}`,
                Connection: "keep-alive",
                Cookie: "PHPSESSID=lsbkrjfu99f613h39md06l3r93",
                Pragma: "no-cache",
                "Cache-Control": "no-cache",
                TE: "Trailers",
              },
              data,
            }).then((res) => {
              const $ = cheerio.load(res.data.result);
              const downloadLink = $("div a").attr("href");
              resolve({ downloadLink, fileName });
            });
          }
        });
      })
      .catch(reject);
  });
};

const downloads = async (videos, dirName) => {
  dirName = path.join(process.env.HOME, config.baseDir, dirName);
  await Promise.all(
    videos.map((video) => {
      const fileName = video.fileName.replace(/\//g, " of ");
      const output = path.join(dirName, fileName);
      if (video.downloadLink) {
        download(video.downloadLink, output);
      }
    })
  );
  console.log("video downloaded");

  // const log = videos.map(async (video) => {
  //   const fileName = video.fileName.replace(/\//g, " of ")
  //   const output = path.join(dirName, fileName)
  //   try {

  //     await save(dirName, fileName, output, video.downloadLink)
  //     return {
  //       link: video.downloadLink,
  //       fullPath: output,
  //       isFailed: false,
  //     }
  //   } catch {
  //     console.log(`video with "${fileName}" name failed to save`)
  //     return {
  //       link: video.downloadLink,
  //       fullPath: output,
  //       isFailed: true,
  //     }
  //   }
  // })
  // return Promise.all(log)
};

const save = async (dirName, fileName, output, downloadLink) => {
  try {
    const response = (
      await axios({
        url: downloadLink,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          Connection: "keep-alive",
          Referer: "https://www.y2mate.com/",
          "Upgrade-Insecure-Requests": 1,
        },
        responseType: "stream",
      })
    ).data;

    if (!Fs.existsSync(dirName)) {
      Fs.mkdirSync(dirName, { recursive: true });
    }

    response.pipe(Fs.createWriteStream(output));
    response.on("end", () => {
      console.log(`video with name "${fileName}" has been saved successfully`);
    });
  } catch (e) {
    console.log(e.message);
  }
};

const chooseResolution = (
  defaultResolution,
  resolution,
  availableResolution
) => {
  const isAvailable = availableResolution.find((val) =>
    new RegExp(resolution.slice(0, resolution.length - 1)).test(val)
  );
  const defaultRes =
    defaultResolution === "Highest resolution"
      ? availableResolution[0]
      : availableResolution[availableResolution.length - 1];

  return isAvailable || defaultRes;
};
