import readline from "readline";
let index = 0;
let verbose = false;
const spinners = ["-", "\\", "|", "/"];

export function setVerbose(newVerbose: boolean) {
  verbose = newVerbose;
}

export function log(...data: any[]) {
  if (verbose) {
    console.log(...data);
    return;
  }

  // when no message is provided, just increment the spinner
  if (!data.length) {
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(` ${spinners[index++ % 4]}`);
    return;
  }

  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(
    ` ${spinners[index++ % 4]} ${(typeof data[0] === "string"
      ? data[0]
      : JSON.stringify(data)
    )
      .replace(/[\t\r\n ]+/g, " ")
      .substr(0, process.stdout.columns - 8)}`
  );
}
