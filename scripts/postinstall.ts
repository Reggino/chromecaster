import { resolve } from "path";
import { arch, platform } from "os";
import {
  chmodSync,
  createWriteStream,
  existsSync,
  renameSync,
  mkdirSync,
} from "fs";
import { log } from "../src/logger";
import axios from "axios";
import { createGunzip } from "zlib";

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
            .on("drain", log)
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

log("Preparing cross-platform ffmpeg binaries");

Promise.all(
  ["darwin", "linux", "win32"].map((platform) =>
    Promise.all(
      ["ia32", "x64"].map((architecture) => {
        const destinationPath = resolve(
          __dirname,
          `../node_modules/ffmpeg-static/bin/${platform}/${architecture}`
        );
        mkdirSync(destinationPath, { recursive: true });
        return download(
          `https://github.com/eugeneware/ffmpeg-static/releases/download/b4.4/${platform}-${arch}.gz`,
          resolve(
            destinationPath,
            `ffmpeg${platform === "win32" ? ".exe" : ""}`
          )
        );
      })
    )
  )
)
  .then(() => {
    log("Installation succesfull");
  })
  .catch((e) => {
    console.error("Installation failed!");
    console.error(e);
    process.exit(1);
  });
