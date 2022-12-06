import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { Bugs } from "./bugs.mjs";
import { converter } from "./converter.mjs";
import { base64Encode } from "./helper.mjs";
import { V2Object } from "./types.mjs";

class Writer {
  private baseRemarks: string[] = [];
  private baseClashProxies: string[] = ["proxies:"];
  private baseProxyBoard: string[] = [];
  private baseBoardConfig: any = readFileSync("./resources/config/surfboard/surfboard.conf").toString();
  private baseRayConfig: any = JSON.parse(readFileSync("./resources/config/v2ray/config.json").toString());
  private baseBoxConfig: any = JSON.parse(readFileSync("./resources/config/sing-box/config.json").toString());
  private bugBundles: string[] = readdirSync("./resources/bugs");
  private proxyModes = ["select", "load-balance", "url-test", "fallback"];

  private formats: Array<{
    name: "clash" | "v2ray" | "surfboard" | "sing-box" | "base64";
    filename: string;
    format: string | null;
  }> = [
    {
      name: "clash",
      filename: "providers",
      format: "yaml",
    },
    {
      name: "v2ray",
      filename: "config",
      format: "json",
    },
    {
      name: "surfboard",
      filename: "board",
      format: "conf",
    },
    {
      name: "sing-box",
      filename: "config",
      format: "json",
    },
    {
      name: "base64",
      filename: "base64",
      format: null,
    },
  ];

  finalResult: any = {};

  constructor() {
    for (const format of [{ name: "" }, ...this.formats]) {
      if (!existsSync(`./result/${format.name}`)) mkdirSync(`./result/${format.name}`);
    }
  }

  private split(accounts: V2Object[]) {
    for (let bug of this.bugBundles) {
      bug = bug.replace(".json", "");
      if (bug.startsWith("crawl")) continue;
      const bugs = new Bugs(bug);

      for (const format of this.formats) {
        let savePath = `./result/${format.name}`;
        for (const account of accounts) {
          // Filter
          if (account.cdn) {
            if (!bugs.cdn) continue;
          } else {
            if (!bugs.sni) continue;
          }

          // Prepare split result
          let proxy: any = "";
          switch (format.name) {
            case "clash":
              proxy = bugs.fill(converter.toClash(account), format.name, account.cdn ? "cdn" : "sni");
              break;
            case "v2ray":
              proxy = bugs.fill(converter.toV2ray(account), format.name, account.cdn ? "cdn" : "sni");
              break;
            case "surfboard":
              proxy = bugs.fill(converter.toSurfboard(account), format.name, account.cdn ? "cdn" : "sni");
              break;
            case "sing-box":
              proxy = bugs.fill(converter.toSingBox(account), format.name, account.cdn ? "cdn" : "sni");
              break;
            case "base64":
              proxy = converter.toUrl(bugs.fill(account, "v2object", account.cdn ? "cdn" : "sni"));
              break;
          }

          // Split result
          for (const key of [null, account.cc, account.region]) {
            let filename = `${savePath}/${format.filename}-${bug}${key ? `-${key}` : ""}${
              format.format ? `.${format.format}` : ""
            }`;
            if (this.finalResult[filename]) this.finalResult[filename].push(proxy);
            else this.finalResult[filename] = [proxy];
          }
        }
      }
    }
  }

  write(accounts: V2Object[]) {
    this.split(accounts);

    for (const filename of Object.keys(this.finalResult)) {
      if (filename.match("clash")) {
        let clashConfig = structuredClone(this.baseClashProxies);
        clashConfig.push(...this.finalResult[filename]);
        writeFileSync(filename, clashConfig.join("\n"));
      } else if (filename.match("v2ray")) {
        let rayConfig = structuredClone(this.baseRayConfig);
        rayConfig.outbounds.push(...this.finalResult[filename]);
        writeFileSync(filename, JSON.stringify(rayConfig, null, 2));
      } else if (filename.match("surfboard")) {
        let boardConfig = structuredClone(this.baseBoardConfig);
        let remarks = structuredClone(this.baseRemarks);
        let proxyBoard = structuredClone(this.baseProxyBoard);
        for (const proxy of this.finalResult[filename]) {
          if (proxy.match(/^(.+?)=/)) {
            remarks.push(proxy.match(/^(.+?)=/)[1]);
            proxyBoard.push(proxy);
          }
        }

        boardConfig = boardConfig
          .replace("PROXIES_PLACEHOLDER", proxyBoard.join("\n"))
          .replace("FILENAME_PLACEHOLDER", (filename.match(/\/(.+)$/) || [])[1]);

        for (const proxyMode of this.proxyModes) {
          let mode = `${proxyMode.toUpperCase()} = ${proxyMode}`;

          for (const remark of remarks) {
            mode += `,${remark}`;
          }
          boardConfig += `\n${mode}`;
        }

        writeFileSync(filename, boardConfig);
      } else if (filename.match("sing-box")) {
        let boxConfig = structuredClone(this.baseBoxConfig);
        for (const proxy of this.finalResult[filename]) {
          boxConfig.outbounds[3].outbounds.push(proxy.tag);
          boxConfig.outbounds.push(proxy);
        }

        writeFileSync(filename, JSON.stringify(boxConfig, null, 2));
      } else if (filename.match("base64")) {
        let proxies = [...this.finalResult[filename]];

        writeFileSync(filename, base64Encode(proxies.join("\n")));
      }
    }
  }
}

const writer = new Writer();
export { writer };
