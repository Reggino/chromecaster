import { program } from "commander";
import * as chromecast from "./chromecast";
import * as video from "./video";
import * as server from "./server";
import getPort from "get-port";

program
  .version("0.0.1")
  .description("Play any video on your Chromecast")
  .option("-c, --chromecast <name>", "Name of target Chromecast on the network")
  .argument("<path to video file>", "Video to play")
  .argument("[path to subtitles file]", "Subtitles to show")
  .action(async (videoPath, subtitlesPath) => {
    const options = program.opts();
    console.log(`Movie path: ${videoPath}`);
    console.log(`Subtitles path: ${subtitlesPath || "(none)"}`);
    console.log(`Options: ${JSON.stringify(options)}`);

    const port = await getPort();
    await server.initialize(port);
    const myChromecast = await chromecast.initialize(options.chromecast);
    video.initialize(videoPath);
  });

program.parse(process.argv);
