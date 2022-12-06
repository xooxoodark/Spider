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

    let repoText = await res.text();
    let configs: string[] = [];

    if (Base64.isValid(repoText)) {
      configs = base64Decode(repoText).match(/(.+:\/\/.+)/gim) || [];
    } else {
      try {
        res = await fetch(`http://127.0.0.1:25500/sub?target=v2ray&url=${url}`);
        let subText = await res.text();

        if (Base64.isValid(subText)) {
          configs = base64Decode(subText).match(/(.+:\/\/.+)/gim) || [];
        } else {
          throw new Error(subText);
        }
      } catch (e) {
        try {
          configs = JSON.parse(repoText);
        } catch (e: any) {
          configs = repoText.match(/(.+:\/\/.+)/gim) || [];
        }
      }
    }

    if (!configs.length) {
      return {
        error: false,
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
