import { promises as fsPromises } from "fs";
import { parse } from "path";
import { program } from "commander";
import MediaInfoFactory from "mediainfo.js";
import { MediaInfo, ReadChunkFunc } from "mediainfo.js/dist/types";

program
  .version("0.0.1")
  .description("Play any video on your Chromecast")
  .argument("<path to video file>", "Video to play")
  .argument("[path to subtitles file]", "Subtitles to show")
  .action(async (videoPath, subtitlesPath) => {
    console.log(`Movie path: ${videoPath}`);
    console.log(`Subtitles path: ${subtitlesPath || "(none)"}`);
    const parsedPath = parse(videoPath);
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
      ].indexOf(parsedPath.ext.substr(1).toLowerCase()) === -1
    ) {
      console.log("- not a video format, exiting");
      process.exit(1);
    }
    let fileHandle: fsPromises.FileHandle | undefined;
    let fileSize: number;
    let mediainfo: MediaInfo | undefined;
    try {
      fileHandle = await fsPromises.open(videoPath, "r");
      fileSize = (await fileHandle.stat()).size;
      // { format: 'object', coverData: true }
      mediainfo = (await MediaInfoFactory()) as MediaInfo;
      const readChunk: ReadChunkFunc = async (size, offset) => {
        const buffer = new Uint8Array(size);
        await (fileHandle as fsPromises.FileHandle).read(
          buffer,
          0,
          size,
          offset
        );
        return buffer;
      };
      const result = await mediainfo.analyzeData(() => fileSize, readChunk);
      // @ts-ignore
      console.log("Mediainfo analysis", result.media);
    } catch (err) {
      throw err;
    } finally {
      fileHandle && (await fileHandle.close());
      mediainfo && mediainfo.close();
    }
  });

program.parse(process.argv);
