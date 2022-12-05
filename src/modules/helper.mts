import { logger, LogLevel } from "./logger.mjs";
import { parse, UrlWithParsedQuery } from "url";
import { decode, encode } from "js-base64";
import findProcess from "find-process";
import { V2Object } from "./types.mjs";

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

function duplicateFilter(accounts: V2Object[]): V2Object[] {
  let address: string;
  let port: number;
  let path: string;
  let id: string;

  for (const i in accounts) {
    address = accounts[i].address;
    port = accounts[i].port;
    path = accounts[i].path;
    id = accounts[i].id;

    for (let j = parseInt(i) + 1; j < accounts.length; j++) {
      if (address == accounts[j].address) {
        if (port == accounts[j].port) {
          if (path == accounts[j].path) {
            if (id == accounts[j].id) {
              console.log("Duplicate account removed!");
              accounts.splice(j, 1);
              return duplicateFilter(accounts);
            }
          }
        }
      }
    }
  }

  return accounts;
}

export { sleep, base64Decode, base64Encode, urlParser, isSingBoxRunning, duplicateFilter };
