import { base64Decode } from "./helper.mjs";
import { acceptedType } from "../index.js";
import { logger, LogLevel } from "./logger.mjs";
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
      logger.log(LogLevel.error, res.statusText);

      return {
        error: true,
        result: [],
      };
    }

    const text = await res.text();
    let configs: string[] = text.match(/(.+:\/\/.+)/gim) || [];
    if (!configs.length) {
      try {
        configs = base64Decode(text)?.split(/(\r)?\n/) || [];
      } catch (e: any) {
        logger.log(LogLevel.error, e.name);
        return {
          error: true,
          result: [],
        };
      }
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
