import bonjour from "bonjour";
import { networkInterfaces } from "os";
// @ts-ignore
import { Client, DefaultMediaReceiver } from "castv2-client";

interface IChromecast {
  ip: string;
  name: string;
  location: string;
  type: string;
}

export async function initialize(name?: string): Promise<IChromecast> {
  console.log("Looking for chromecasts");
  return new Promise((resolve, reject) => {
    const chromecasts: IChromecast[] = [];

    const timeout = setTimeout(() => {
      if (!chromecasts.length) {
        reject(new Error(`No chromecast found on the network`));
        return;
      }
      if (name) {
        const chromecast = chromecasts.find(
          (chromecast) => chromecast.name === name
        );
        if (chromecast) {
          resolve(chromecast);
          return;
        }
        reject(new Error(`Could not find chromecast: ${name}`));
        return;
      }
      if (chromecasts.length === 1) {
        resolve(chromecasts[0]);
      }
      reject(
        new Error(
          `Multiple chromecasts found. Please select ${chromecasts
            .map((chromecast) => `"${chromecast.name}"`)
            .join(" or ")} using -c argument.`
        )
      );
    }, 1000);

    bonjour().find({ type: "googlecast" }, (service) => {
      console.log(
        `Found chromecast: ${JSON.stringify(
          { ...service, rawTxt: undefined },
          null,
          "\t"
        )}`
      );
      const newChromecast = {
        ip: service.addresses[0],
        name: service.name,
        location: service.txt.fn,
        type: service.txt.md,
      };
      if (name === service.name) {
        clearTimeout(timeout);
        resolve(newChromecast);
        return;
      }
      chromecasts.push(newChromecast);
    });
  });
}

export async function startMovie(
  chromecast: IChromecast,
  localPort: number,
  videoPath: string,
  subtitlesPath: string | null
) {
  const nets = networkInterfaces();
  const localIpAddresses = Object.values(nets).reduce<string[]>(
    (prev, ips = []) => {
      ips.forEach((ip) => {
        if (
          ip.family === "IPv4" &&
          ip.internal === false &&
          !ip.address.startsWith("172.17.0")
        ) {
          prev.push(ip.address);
        }
      });
      return prev;
    },
    []
  );
  console.log(`Found local IP address: ${localIpAddresses.join(", ")}`);

  const chromecastIpNibbles = chromecast.ip.split(".") || [];
  const matchLength = localIpAddresses.map((ip) => {
    let nibblePointer = 0;
    const nibbles = ip.split(".");
    while (nibbles[nibblePointer] === chromecastIpNibbles[nibblePointer]) {
      nibblePointer++;
    }
    return nibblePointer;
  });
  const bestMatchIndex = matchLength.indexOf(Math.max(...matchLength));
  const localIpAddress = localIpAddresses[bestMatchIndex];
  console.log(`Best match for Chromecast: ${localIpAddress}`)

  return new Promise((resolve, reject) => {
    const client = new Client();
    client.connect(chromecast.ip, (err: Error) => {
      if (err) {
        reject(err);
        return;
      }
      console.log("Chomecast connected, launching DefaultMediaReceiver");
      client.launch(DefaultMediaReceiver, (err: Error, player: any) => {
        if (err) {
          reject(err);
          return;
        }
        console.log("Player launched, starting movie");

        const job = {
          // Here you can plug an URL to any mp4, webm, mp3 or jpg file with the proper contentType.
          contentId: `http://${localIpAddress}:${localPort}/video`,
          contentType: videoPath.match(/\.mp4$/i) ? "video/mp4" : "video/webm",
          streamType: "BUFFERED", // or LIVE
          // // Title and cover displayed while buffering
          metadata: {
            type: 0,
            metadataType: 0,
            title: videoPath.split(/[/\\]/).pop(),
          },
        };

        if (subtitlesPath) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          job.tracks = [
            {
              trackId: 1, // This is an unique ID, used to reference the track
              type: "TEXT", // Default Media Receiver currently only supports TEXT
              trackContentId: `http://${localIpAddress}:${localPort}/subtitles`, // the URL of the VTT (enabled CORS and the correct ContentType are required)
              trackContentType: "text/vtt", // Currently only VTT is supported
              name: "English", // a Name for humans
              language: "en-US", // the language
              subtype: "SUBTITLES", // should be SUBTITLES
            },
          ];
        }
        player.load(
          job,
          { autoplay: true, activeTrackIds: [1] },
          (err: Error, status: unknown) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(status);
          }
        );
      });
    });
  });
}
