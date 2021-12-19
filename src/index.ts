import { promises as fsPromises } from "fs";
import { tmpdir } from "os";
import { parse, sep } from "path";
import { program } from "commander";
import MediaInfoFactory from "mediainfo.js";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
const ffmpeg = createFFmpeg({ log: true });

import {
  MediaInfo,
  ReadChunkFunc,
  ResultObject,
} from "mediainfo.js/dist/types";

program
  .version("0.0.1")
  .description("Play any video on your Chromecast")
  .argument("<path to video file>", "Video to play")
  .argument("[path to subtitles file]", "Subtitles to show")
  .action(async (videoPath, subtitlesPath) => {
    console.log(`Movie path: ${videoPath}`);
    console.log(`Subtitles path: ${subtitlesPath || "(none)"}`);
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
      console.log("- not a video format, exiting");
      process.exit(1);
    }
    console.log(`Detected valid extension (${parsedPath.ext})`);
    let fileHandle: fsPromises.FileHandle | undefined;
    let fileSize: number;
    let mediainfo: MediaInfo | undefined;

    fileHandle = await fsPromises.open(videoPath, "r");
    fileSize = (await fileHandle.stat()).size;
    // { format: 'object', coverData: true }
    mediainfo = (await MediaInfoFactory()) as MediaInfo;
    const readChunk: ReadChunkFunc = async (size, offset) => {
      const buffer = new Uint8Array(size);
      await (fileHandle as fsPromises.FileHandle).read(buffer, 0, size, offset);
      return buffer;
    };
    const result = (await mediainfo.analyzeData(
      () => fileSize,
      readChunk
    )) as ResultObject;
    if (!result) {
      throw new Error("Mediainfo analysis failed: unsupported video");
    }
    console.log(
      "Mediainfo tracks: ",
      JSON.stringify(result.media.track, null, "\t")
    );
    fileHandle && (await fileHandle.close());
    mediainfo && mediainfo.close();
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
    console.log(`- general: ${inputGformat} -> ${outputGformat}`);

    // # test video codec
    const inputVcodecProfile = videoTrack.Format_Profile;
    if (inputVcodecProfile) {
      console.log(`- input video profile: ${inputVcodecProfile}`);
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
    console.log(`- video: ${inputVcodec} -> ${outputVcodec}`);

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
    console.log(`- audio: ${inputAcodec} -> ${outputAcodec}`);

    const sourceIsPlayable =
      outputVcodec === "copy" &&
      outputAcodec === "copy" &&
      outputGformat === "ok";
    if (sourceIsPlayable) {
      console.log("- file should be playable by Chromecast!");
      return;
    } else console.log(`- video length: ${generalTrack.Duration}`);
    if (outputGformat === "ok") {
      outputGformat = lcExtension;
    }

    const destinationFilename = `${tmpdir()}${sep}chromecastcast.${outputGformat}`;
    console.log(`Loading FFMPEG`);
    await ffmpeg.load();
    console.log(`Starting ffmpeg`);
    ffmpeg.FS("writeFile", parsedPath.base, await fetchFile(videoPath));
    await ffmpeg.run(
      "-loglevel",
      "error",
      "-stats",
      "-i",
      parsedPath.base,
      "-map",
      "0",
      "-scodec",
      "copy",
      "-vcodec",
      outputVcodec,
      "-acodec",
      outputAcodec,
      ...ffmpegArgs,
      `chromecastcast.${outputGformat}`
    );
    await fsPromises.writeFile(
      destinationFilename,
      ffmpeg.FS("readFile", `chromecastcast.${outputGformat}`)
    );
    console.log("Waiting?");
  });

program.parse(process.argv);
