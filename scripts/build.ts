import { execFileSync } from "child_process";
import { log } from "../src/logger";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

log(`Starting TS compilation`);
execFileSync("./node_modules/.bin/tsc", { cwd: resolve(__dirname, "../") });

Promise.all(
  ["darwin", "linux", "win32"].map((platform) =>
    Promise.all(
      ["x64"].map((architecture) => {
        log(`Starting build ${platform}/${architecture}`);
        let outputFilename = "chromecaster";
        switch (platform) {
          case "win32":
            outputFilename += ".exe";
            break;

          case "darwin":
            outputFilename += "-macos";
            break;
        }
        try {
          log(
            execFileSync(
              resolve(__dirname, "../node_modules/.bin/pkg"),
              [
                "-c",
                resolve(__dirname, `build/${platform}/${architecture}.json`),
                "-o",
                resolve(__dirname, `../build/${outputFilename}`),
                resolve(__dirname, `../dist/chromecaster.js`),
              ],
              { cwd: resolve(__dirname, `build/${platform}/`) }
            ).toString()
          );
        } catch (e: any) {
          throw e.stdout.toString();
        }
      })
    )
  )
)
  .then(() => {
    log("Builds succesfull");
  })
  .catch((e) => {
    console.error("Installation failed!");
    console.error(e);
    process.exit(1);
  });
