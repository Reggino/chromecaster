import { parse, sep } from "path";
import {
  chmodSync,
  createWriteStream,
  existsSync,
  renameSync,
  unlinkSync,
} from "fs";
import { arch, platform, tmpdir } from "os";
import { spawn } from "child_process";
import { createGunzip } from "zlib";
import axios from "axios";
import { log } from "./logger";

export type Track = {
  "@type":
    | "General"
    | "Video"
    | "Audio"
    | "Text"
    | "Image"
    | "Chapters"
    | "Menu";
  // Endless more properties:
  // https://github.com/MediaArea/MediaInfoLib/tree/master/Source/Resource/Text/Stream
} & Record<string, unknown>;

interface ResultObject {
  "@ref": string;
  media: {
    track: Track[];
  };
}

async function download(url: string, toPath: string) {
  if (existsSync(toPath)) {
    log(`${toPath} already exists. Skipping download`);
    return;
  }
  log(`Downloading ${url} to ${toPath}`);
  await axios
    .request({
      method: "GET",
      responseType: "stream",
      url,
    })
    .then(
      (response) =>
        new Promise<void>((resolve, reject) => {
          let rs = response.data;
          if (url.endsWith(".gz")) {
            rs = rs.pipe(createGunzip());
          }
          // use a tmp file so an interrupted download will not leave a broken file
          rs.pipe(createWriteStream(`${toPath}.tmp`))
            .on("error", reject)
            .on("finish", () => {
              renameSync(`${toPath}.tmp`, toPath);
              resolve();
            });
        })
    );
  chmodSync(toPath, 0o755);
  log(`Copy complete to ${toPath}`);
}

export async function initialize(videoPath: string) {
  const parsedPath = parse(videoPath);
  const lcExtension = parsedPath.ext.substr(1).toLowerCase();
  if (
    [
      "mkv",
      "avi",
      "mp4",
      "3gp",
      "mov",
      "mpg",
      "mpeg",
      "qt",
      "wmv",
      "m2ts",
      "flv",
      "webm",
      "m4v",
    ].indexOf(lcExtension) === -1
  ) {
    log("- not a video format, exiting");
    process.exit(1);
  }
  log(`Detected valid extension (${parsedPath.ext})`);

  // installing mediainfo
  const pathToMediainfo = `${tmpdir()}${sep}chromecaster.mediainfo${
    platform() === "win32" ? ".exe" : ""
  }`;
  await download(
    `https://raw.githubusercontent.com/Aldrian/mediainfo-static/master/bin/${platform()}/${arch()}/mediainfo${
      platform() === "win32" ? ".exe" : ""
    }`,
    pathToMediainfo
  );

  const result = await new Promise<ResultObject>((resolve, reject) => {
    const mediainfoProcess = spawn(pathToMediainfo, [
      "--Output=JSON",
      videoPath,
    ]);
    let output: string[] = [];
    mediainfoProcess.stdout.on("data", (data) => {
      output.push(data);
    });
    mediainfoProcess.stderr.on("data", reject);
    mediainfoProcess.on("close", (code) => {
      if (code) {
        reject(new Error(`mediainfo process exited with code ${code}`));
        return;
      }
      resolve(JSON.parse(output.join("")));
    });
  });

  if (!result) {
    throw new Error("Mediainfo analysis failed: unsupported video");
  }
  log("Mediainfo tracks: ", JSON.stringify(result.media.track, null, "\t"));
  const generalTrack = result.media.track.find(
    (track) => track["@type"] === "General"
  );
  const videoTrack = result.media.track.find(
    (track) => track["@type"] === "Video"
  );
  const audioTrack = result.media.track.find(
    (track) => track["@type"] === "Audio"
  );
  if (!generalTrack) {
    throw new Error(
      "Could not find 'General'-track in Mediainfo: unsupported video"
    );
  }
  if (!videoTrack) {
    throw new Error(
      "Could not find 'Video'-track in Mediainfo: unsupported video"
    );
  }
  if (!audioTrack) {
    throw new Error(
      "Could not find 'Audio'-track in Mediainfo: unsupported audio in file"
    );
  }
  const inputGformat = generalTrack.Format as string;
  let outputGformat: string | null = null;
  if (["MPEG-4", "Matroska", "WebM"].indexOf(inputGformat) >= 0) {
    outputGformat = "ok";
  }
  if (["BDAV", "AVI", "Flash Video", "DivX"].indexOf(inputGformat) >= 0) {
    outputGformat = "mkv";
  }
  if (!outputGformat) {
    throw new Error(`Unsupported format: ${inputGformat}`);
  }
  log(`- general: ${inputGformat} -> ${outputGformat}`);

  // # test video codec
  const inputVcodecProfile = videoTrack.Format_Profile;
  if (inputVcodecProfile) {
    log(`- input video profile: ${inputVcodecProfile}`);
  }
  const inputVcodec = videoTrack.Format as string;
  let ffmpegArgs: string[] = [];

  let outputVcodec: string | null = null;
  if (["AVC", "VP8"].indexOf(inputVcodec) >= 0) {
    outputVcodec = "copy";
  }
  if (
    ["MPEG-4 Visual", "xvid", "MPEG Video", "HEVC"].indexOf(inputVcodec) >= 0
  ) {
    outputVcodec = "h264";
    ffmpegArgs.push(
      "-preset",
      "fast",
      "-profile:v",
      "high",
      "-level",
      "4.1",
      "-crf",
      "17",
      "-pix_fmt",
      "yuv420p"
    );
  }
  if (!outputVcodec) {
    throw new Error(`Unsupported video codec: ${inputVcodec}`);
  }
  log(`- video: ${inputVcodec} -> ${outputVcodec}`);

  // # test audio codec
  const inputAcodec = audioTrack.Format as string;
  let outputAcodec: string | null = null;
  const inputAchannels = parseInt(audioTrack.Channels as string, 10);
  if (!isNaN(inputAchannels) && inputAchannels > 2) {
    outputAcodec = "libvorbis";
    ffmpegArgs.push("-ac", "2");
  } else {
    if (
      ["AAC", "MPEG Audio", "Vorbis", "Ogg", "Opus"].indexOf(inputAcodec) >= 0
    ) {
      outputAcodec = "copy";
    }
    if (
      ["AC-3", "DTS", "E-AC-3", "MLP FBA", "PCM", "TrueHD", "FLAC"].indexOf(
        inputAcodec
      ) >= 0
    ) {
      outputAcodec = "libvorbis";
    }
  }
  if (!outputAcodec) {
    throw new Error(`Unsupported audio codec: ${outputAcodec}`);
  }
  log(`- audio: ${inputAcodec} -> ${outputAcodec}`);

  const sourceIsPlayable =
    outputVcodec === "copy" &&
    outputAcodec === "copy" &&
    outputGformat === "ok";
  if (sourceIsPlayable) {
    log("- file should be playable by Chromecast!");
    return videoPath;
  } else log(`- video length: ${generalTrack.Duration}`);
  if (outputGformat === "ok") {
    // mkv can stream while transcoding
    outputGformat = "mkv";
  }

  const destinationFilename = `${tmpdir()}${sep}chromecaster.${outputGformat}`;
  try {
    unlinkSync(destinationFilename);
  } catch {}

  // "installing" ffmpeg
  // https://github.com/vercel/pkg/issues/960
  const pathToFfmpeg = `${tmpdir()}${sep}${
    platform() === "win32" ? "chromecaster.ffmpeg.exe" : "chromecaster.ffmpeg"
  }`;
  await download(
    `https://github.com/eugeneware/ffmpeg-static/releases/download/b4.4/${platform()}-${arch()}.gz`,
    pathToFfmpeg
  );

  const ffmpegProcess = spawn(pathToFfmpeg, [
    "-loglevel",
    "error",
    "-stats",
    "-i",
    videoPath,
    "-map",
    "0",
    "-scodec",
    "copy",
    "-vcodec",
    outputVcodec,
    "-acodec",
    outputAcodec,
    ...ffmpegArgs,
    destinationFilename,
  ]);

  ffmpegProcess.stdout.on("data", (data) => {
    log(`ffmpeg stdout: ${data}`);
  });

  ffmpegProcess.stderr.on("data", (data) => {
    log(`ffmpeg: ${data}`);
  });

  ffmpegProcess.on("close", (code) => {
    if (code) {
      log(`ffmpeg process exited with code ${code}`);
      process.exit(code);
    }
  });

  return new Promise<string>((resolve, reject) => {
    log("Giving ffmpeg 5 second head start before streaming...");
    setTimeout(() => {
      log("FFmpeg stream probably readly, continue");
      resolve(destinationFilename);
    }, 5000);
  });
}
