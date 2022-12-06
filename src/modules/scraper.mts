import { base64Decode } from "./helper.mjs";
import { acceptedType } from "../index.js";
import { logger, LogLevel } from "./logger.mjs";
import { Base64 } from "js-base64";
import fetch from "node-fetch";

type ScraperType = {
  error?: boolean;
  result: string[];
};

class Scraper {
  static async scrape(url: string): Promise<ScraperType> {
    const result: string[] = [];
    process.stdout.write("Scraping... ");
    let res = await fetch(url, {
      method: "GET",
      follow: 1,
    });

    if (res.status != 200) {
      console.log("\n");
      logger.log(LogLevel.error, res.statusText);

      return {
        error: true,
        result: [],
      };
    }

    let text = await res.text();
    let configs: string[];

    if (Base64.isValid(text)) {
      configs = base64Decode(text).match(/(.+:\/\/.+)/gim) || [];
    } else {
      res = await fetch(`http://127.0.0.1:25500/sub?target=v2ray&url=${url}`);
      text = await res.text();
      if (Base64.isValid(text)) {
        configs = base64Decode(text).match(/(.+:\/\/.+)/gim) || [];
      } else {
        try {
          configs = JSON.parse(text);
        } catch (e: any) {
          configs = text.match(/(.+:\/\/.+)/gim) || [];
        }
      }
    }

    if (!configs.length) {
      return {
        error: true,
        result: [],
      };
    }
    for (const config of configs) {
      if (!config) continue;
      if (!acceptedType.includes((config.match(/(.+):\/\//) || [])[1])) continue;

      result.push(config);
    }

    process.stdout.write("done!.\n");
    return {
      error: false,
      result,
    };
  }
}

export { Scraper };
