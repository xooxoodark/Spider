import { spawn } from "child_process";
import { ConnectServer, Country } from "./types.mjs";
import { sleep } from "./helper.mjs";
import { SocksProxyAgent } from "socks-proxy-agent";
import fetch from "node-fetch";
import { readFileSync, writeFileSync } from "fs";
import { path } from "../index.js";
import { isIPv4 } from "is-ip";

class Connect {
  connectionNumber = 1;
  countries: Country[] = JSON.parse(readFileSync("./countries.json").toString());

  private async _connect(config: string, port: number): Promise<ConnectServer> {
    let error: string = "";
    let cc: string = "";
    let cn: string = "";
    let ip: string = "";
    let region: string = "";

    const singBox = spawn("./bin/sing-box", ["run", "-c", `${config}`]);

    singBox.stderr.on("data", (res: any) => {
      const message = res.toString();
      // console.log(res.toString());
      if (message.match(/error:.+/)) {
        error = message.match(/error:(.+)/)[1];
      }
    });

    await sleep(500);

    try {
      await fetch("http://ipapi.co/json", {
        agent: new SocksProxyAgent(
          {
            hostname: "0.0.0.0",
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
            ip = "";
            region = "World";

            // Change value above if data is present
            if (data.country_code) {
              cc = data.country_code;

              for (const country of this.countries) {
                if (country.code == cc) {
                  region = country.region;
                  break;
                }
              }
            }
            if (data.country_name) cn = data.country_name;
            if (data.ip) {
              if (isIPv4(data.ip)) ip = data.ip;
            }
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
      singBox.kill();

      singBox.on("close", () => {
        resolve(0);
      });
    });

    return {
      error,
      cc,
      cn,
      ip,
      region,
    };
  }

  async connect(account: any): Promise<ConnectServer> {
    const port = this.calculatePort();
    const savePath = `${path}/resources/config/sing-box/test-${port}.json`;
    let boxConfig = JSON.parse(readFileSync("./resources/config/sing-box/config.json").toString());

    boxConfig.inbounds[0].listen_port = port;
    boxConfig.outbounds.push(account);
    boxConfig.outbounds[3].outbounds.push(account.tag);

    writeFileSync(savePath, JSON.stringify(boxConfig, null, 2));

    this.connectionNumber++;
    if (this.connectionNumber > 750) {
      this.connectionNumber = 1;
    }
    return await this._connect(savePath, port);
  }

  calculatePort(): number {
    return this.connectionNumber + 10000;
  }
}

const connect = new Connect();
export { connect, Connect };
