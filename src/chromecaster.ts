import { program } from "commander";
import getPort from "get-port";
import * as chromecast from "./chromecast.js";
import * as video from "./video.js";
import * as server from "./server.js";
import * as subtitles from "./subtitles.js";

program
  .name("chromecaster")
  .version("0.0.1")
  .description("Play any video on your Chromecast")
  .option("-c, --chromecast <name>", "Name of target Chromecast on the network")
  .option("-s, --subtitles <path to .srt-file>", "Subtitles to show")
  .argument("<path to video file>", "Video to play")
  .action(async (videoPath) => {
    const options = program.opts();
    console.log(`Movie path: ${videoPath}`);
    console.log(`Options: ${JSON.stringify(options)}`);

    Promise.all([
      chromecast.initialize(options.chromecast),
      getPort(),
      video.initialize(videoPath),
      subtitles.initialize(options.subtitles),
    ]).then(
      async ([myChromecast, finalPort, finalVideoPath, finalSubtitlePath]) => {
        await server.initialize(finalPort, finalVideoPath, finalSubtitlePath);
        console.log(
          await chromecast.startMovie(
            myChromecast,
            finalPort,
            finalVideoPath,
            finalSubtitlePath
          )
        );
      }
    );
  });

program.parse(process.argv);
