import { spawn } from "child_process";
import { ConnectServer } from "./types.mjs";
import { sleep } from "./helper.mjs";
import { SocksProxyAgent } from "socks-proxy-agent";
import fetch from "node-fetch";
import { readFileSync, writeFileSync } from "fs";
import { path } from "../index.js";

class Connect {
  connectionNumber = 1;

  private async _connect(config: string, port: number): Promise<ConnectServer> {
    let error: string = "";
    let cc: string = "";
    let cn: string = "";

    const v2ray = spawn("./bin/v2ray", ["run", "-c", `${config}`]);

    v2ray.stdout.on("data", (res: any) => {
      // console.log(res.toString());
      if (res.toString().match(/(context deadline exceeded|timeout)/i)) {
        error = "No Internet!";
      } else if (res.toString().match(/error:(.+)/i)) {
        error = res.toString().match(/error:(.+)/i)[1];
      }
    });

    await sleep(500);

    try {
      await fetch("http://ipapi.co/json", {
        agent: new SocksProxyAgent(
          {
            hostname: "127.0.0.1",
            port: port,
            protocol: "socks5",
            tls: {
              rejectUnauthorized: false,
            },
          },
          {
            timeout: 10000,
          }
        ),
      }).then(async (res) => {
        if (res.status == 200) {
          const data = JSON.parse(await res.text());
          if (data.error) {
            error = data.error;
          } else {
            cc = "XX"; // Default country code
            cn = "Other"; // Default country name
            // Change value above if data is present
            if (data.country_code) cc = data.country_code;
            if (data.country_name) cn = data.country_name;
          }
        }
      });
    } catch (e: any) {
      // console.log(e.message);
      if ((e.message as string).match(/(aborted|socket hang up)/)) {
        error = "Timeout!";
      } else {
        error = e.message;
      }
    }

    await new Promise((resolve) => {
      v2ray.kill();

      v2ray.on("close", () => {
        resolve(0);
      });
    });

    return {
      error,
      cc,
      cn,
    };
  }

  async connect(account: any): Promise<ConnectServer> {
    const port = this.calculatePort();
    const savePath = `${path}/resources/config/v2ray/test-${port}.json`;
    let v2rayConfig = JSON.parse(readFileSync("./resources/config/v2ray/config.json").toString());

    v2rayConfig.inbounds[0].port = port + 1; // tproxy port
    v2rayConfig.inbounds[1].port = port + 2; // socks port
    v2rayConfig.routing.rules[0].port = port + 3; // dns port
    v2rayConfig.outbounds.push(account);

    writeFileSync(savePath, JSON.stringify(v2rayConfig, null, 2));

    this.connectionNumber++;
    if (this.connectionNumber > 50) {
      this.connectionNumber = 1;
    }
    return await this._connect(savePath, v2rayConfig.inbounds[1].port);
  }

  calculatePort(): number {
    return this.connectionNumber * 3 + 10000;
  }
}

const connect = new Connect();
export { connect, Connect };
