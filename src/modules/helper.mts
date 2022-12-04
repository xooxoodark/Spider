import { logger, LogLevel } from "./logger.mjs";
import { parse, UrlWithParsedQuery } from "url";
import { decode, encode } from "js-base64";
import findProcess from "find-process";

async function sleep(ms: number) {
  return await new Promise((resolve) => {
    setTimeout(() => {
      resolve(0);
    }, ms);
  });
}

function base64Decode(text: string): string {
  try {
    return decode(text);
  } catch (e: any) {
    logger.log(LogLevel.error, e.name);
  }

  return "";
}

function base64Encode(text: string): string {
  try {
    return encode(text);
  } catch (e: any) {
    logger.log(LogLevel.error, e.name);
  }

  return "";
}

function urlParser(url: string): UrlWithParsedQuery {
  return parse(url, true);
}

async function isSingBoxRunning(): Promise<number> {
  const list = await findProcess("name", "sing-box");
  return list.length;
}

export { sleep, base64Decode, base64Encode, urlParser, isSingBoxRunning };
