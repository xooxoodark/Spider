import { spawn } from "child_process";
import { writeFileSync } from "fs";
import { Bugs } from "./bugs.mjs";
import { converter } from "./converter.mjs";
import { base64Encode } from "./helper.mjs";
import { V2Object } from "./types.mjs";

class Speedtest {
  speedtestPath = "./resources/config/litespeedtest";

  private prepare(accounts: V2Object[]) {
    const proxies = [];
    const bugs = new Bugs();

    for (const account of accounts) {
      proxies.push(converter.toUrl(bugs.fill(account, "v2object", account.cdn ? "cdn" : "sni")));
    }

    writeFileSync(`${this.speedtestPath}/base64`, base64Encode(proxies.join("\n")));
  }

  async start(accounts: V2Object[]) {
    console.log("Start speedtest...");
    this.prepare(accounts);

    await new Promise((resolve) => {
      const speedtest = spawn("./bin/lite", [
        "--config",
        `${this.speedtestPath}/config.json`,
        "--test",
        `${this.speedtestPath}/base64`,
      ]);

      speedtest.stderr.on("data", (data) => {
        console.log(data.toString());
      });

      speedtest.stdout.on("data", (data) => {
        console.log(data.toString());
      });

      speedtest.on("close", (code) => {
        resolve(code);
      });
    });
  }
}

const speedtest = new Speedtest();
export { speedtest };
