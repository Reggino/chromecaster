import { program } from "commander";
import * as chromecast from "./chromecast";
import * as video from "./video";
program
  .version("0.0.1")
  .description("Play any video on your Chromecast")
  .option("-c, --chromecast <name>", "Name of target Chromecast on the network")
  .argument("<path to video file>", "Video to play")
  .argument("[path to subtitles file]", "Subtitles to show")
  .action(async (videoPath, subtitlesPath) => {
    const options = program.opts();
    console.log(options);

    console.log(`Movie path: ${videoPath}`);
    console.log(`Subtitles path: ${subtitlesPath || "(none)"}`);
    const myChromecast = await chromecast.initialize(options.chromecast);
    console.log(myChromecast);
    // video.initialize(videoPath);
  });

program.parse(process.argv);
