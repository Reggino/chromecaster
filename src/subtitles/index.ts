// @ts-ignore
import srt2vtt from "srt-to-vtt";
import { createReadStream, createWriteStream } from "fs";
import { tmpdir } from "os";
import { sep } from "path";

export async function initialize(
  subtitlesPath?: string
): Promise<string | null> {
  if (!subtitlesPath) {
    return Promise.resolve(null);
  }
  const destinationFilename = `${tmpdir()}${sep}chromecaster.vtt`;
  return new Promise((resolve, reject) => {
    createReadStream(subtitlesPath)
      .pipe(srt2vtt())
      .pipe(createWriteStream(destinationFilename))
      .on("finish", () => {
        resolve(destinationFilename);
      })
      .on("error", reject);
  });
}
