import { base64Decode } from "./helper.mjs";
import { acceptedType } from "../index.js";
import { logger, LogLevel } from "./logger.mjs";
import isBase64 from "is-base64";
import fetch from "node-fetch";

type ScraperType = {
  error?: boolean;
  result: string[];
};

class Scraper {
  static async scrape(url: string): Promise<ScraperType> {
    const result: string[] = [];
    process.stdout.write("Scraping... ");
    const res = await fetch(url, {
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

    const text = await res.text();
    let configs: string[];

    if (isBase64(text)) {
      configs = base64Decode(text).match(/(.+:\/\/.+)/gim) || [];
    } else {
      try {
        configs = JSON.parse(text);
      } catch (e: any) {
        configs = text.match(/(.+:\/\/.+)/gim) || [];
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
