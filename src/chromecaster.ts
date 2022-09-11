import { program } from "commander";
import getPort from "get-port";
import { parse } from "path";
import * as chromecast from "./chromecast.js";
import * as video from "./video.js";
import * as server from "./server.js";
import * as subtitles from "./subtitles.js";
import { log, setVerbose } from "./logger";

program
  .name("chromecaster")
  .version("0.0.1")
  .description("Play any video on your Chromecast")
  .option("-c, --chromecast <name>", "name of target Chromecast on the network")
  .option("-s, --subtitles <path to .srt-file>", "subtitles to show")
  .option("--stereo", "Force stereo (may fix audio)")
  .option("-v, --verbose", "show debug information")
  .argument("<path to video file>", "video to play")
  .action((videoPath) => {
    const options = program.opts();
    console.log(`Playing ${videoPath}`);
    if (Object.keys(options).length) {
      console.log(`Options: ${JSON.stringify(options)}\n`);
    }

    if (options.verbose) {
      setVerbose(true);
    }

    Promise.all([
      chromecast.initialize(options.chromecast),
      getPort(),
      video.initialize(videoPath, options.stereo),
      subtitles.initialize(options.subtitles),
    ])
      .then(
        async ([
          myChromecast,
          finalPort,
          finalVideoPath,
          finalSubtitlePath,
        ]) => {
          await server.initialize(finalPort, finalVideoPath, finalSubtitlePath);
          log(
            await chromecast.startMovie(
              myChromecast,
              parse(videoPath).name,
              finalPort,
              finalVideoPath
            )
          );
        }
      )
      .catch((e) => {
        console.log("\n");
        if (options.verbose) {
          throw e;
        }
        console.log(`${e.message}\n`);
        process.exit(1);
      });
  });

program.parse(process.argv);
