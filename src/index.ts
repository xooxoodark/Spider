export const acceptedType: string[] = ["vmess", "trojan"];
export const path: string = process.cwd();

import { exec } from "child_process";
import { countryCodeEmoji } from "country-code-emoji";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { exit } from "process";
import { Bugs } from "./modules/bugs.mjs";
import { connect } from "./modules/connect.mjs";
import { converter } from "./modules/converter.mjs";
import { duplicateFilter, isSingBoxRunning, sleep } from "./modules/helper.mjs";
import { logger, LogLevel } from "./modules/logger.mjs";
import { Scraper } from "./modules/scraper.mjs";
import { speedtest } from "./modules/speedtest.mjs";
import { bot } from "./modules/tg.mjs";
import { ConnectServer, Data, V2Object } from "./modules/types.mjs";
import { writer } from "./modules/writer.mjs";

const { url, filename } = JSON.parse(process.argv[2]) as Data;
const modes: string[] = ["cdn", "sni"];
const maxConcurrentTest = 30;

// Kill all v2ray process
exec("pkill sing-box");

(async () => {
  // Scavenge accounts withour fill the bugs
  const accounts: V2Object[] = await (async () => {
    let accounts: V2Object[] = [];
    if (!url) {
      if (!existsSync("./resources/database")) {
        logger.log(LogLevel.error, "Result not found!");
        exit(0);
      }

      const resultFiles = readdirSync("./resources/database");
      for (const files of resultFiles) {
        if (files.match(".json")) {
          accounts.push(...(JSON.parse(readFileSync(`./resources/database/${files}`).toString()) as V2Object[]));
        }
      }

      return accounts;
    }

    await Scraper.scrape(url).then((res) => {
      if (res.error) exit(1);

      let vmessCount = 0;
      let trojanCount = 0;
      for (const account of res.result) {
        if (account.startsWith("vmess")) {
          accounts.push(converter.toObject("Vmess", account));
          vmessCount++;
        } else if (account.startsWith("trojan")) {
          accounts.push(converter.toObject("Trojan", account));
          trojanCount++;
        }
      }
      console.log(`Total: Vmess -> ${vmessCount}`);
      console.log(`Total: Trojan -> ${trojanCount}`);
    });
    return accounts;
  })();

  // Test the result
  logger.log(LogLevel.info, "Start the test!");
  let connectedAccounts = await (async () => {
    const bugs = new Bugs();
    const result: V2Object[] = [];

    let isCompleteScan: boolean = false;

    for (const i in accounts) {
      let account = accounts[i];
      if (account.error) continue;
      new Promise(async (resolve) => {
        const connectResult: ConnectServer[] = [];
        const onTest: string[] = [];
        for (const mode of modes) {
          // Filter account
          if (mode == "cdn") {
            if (!account.host) continue;
          } else {
            account.tls = "tls";

            if (account.port == 80) {
              account.port = 443;
            }
          }

          onTest.push(mode);
          new Promise((resolve) => {
            connect
              .connect(bugs.fill(converter.toSingBox(account), "sing-box", mode as "sni" | "cdn"))
              .then((res: ConnectServer) =>
                connectResult.push({
                  ...res,
                  mode: mode as "sni" | "cdn",
                })
              )
              .finally(() => resolve(onTest.shift()));
          });
        }

        do {
          await sleep(500);
        } while (onTest[0]);

        // rhis 'connect' variable is different from teh first one
        for (const connect of connectResult) {
          const mode = connect.mode?.toUpperCase();
          if (connect.error || !connect.cc || !connect.cn) {
            logger.log(LogLevel.error, `[${account.vpn}] ${account.remark}: ${mode} -> ${connect.error}`);
          } else {
            const countryFlag = connect.cc == "XX" ? "🇺🇳" : countryCodeEmoji(connect.cc);

            logger.log(
              LogLevel.success,
              `[${account.vpn}] ${result.length} -> ${account.remark}: ${mode} -> ${countryFlag}`
            );

            result.push({
              ...account,
              cc: connect.cc,
              countryName: connect.cn,
              region: connect.region,
              cdn: connect.mode == "cdn",
              remark: `${result.length + 1} ⌜クモ⌟ ${mode} -> ${countryFlag}`, // my watermark (remark) lol
            });
          }
        }

        if (parseInt(i) + 1 >= accounts.length) isCompleteScan = true;
        resolve(0);
      });

      let isStuck = false;
      const timeout = setTimeout(() => (isStuck = true), 60000);
      while ((await isSingBoxRunning()) > maxConcurrentTest) {
        logger.log(LogLevel.info, "Max concurrent reached!");
        await sleep(10000);

        if (isStuck) {
          exec("pkill sing-box");
          break;
        }
      }

      if (result.length >= 15) break; // Test purpose
      clearTimeout(timeout);
    }

    do {
      await sleep(1000);

      if (isCompleteScan) {
        await sleep(10000);
        break;
      }
    } while (await isSingBoxRunning());
    return result;
  })();

  // Filter duplicate
  connectedAccounts = duplicateFilter(connectedAccounts);

  // If the url is valid url, save the result to ./resources
  if (url) {
    if (!existsSync("./resources/database")) mkdirSync("./resources/database");
    writeFileSync(`./resources/database/${filename}.json`, JSON.stringify(connectedAccounts, null, 2));

    let message = `=====SCAN RESULT=====\n`;
    message += `Source: ${url}\n`;
    message += `Found: <code>${connectedAccounts.length}</code>`;
    await bot.bot.api.sendMessage("732796378", message, {
      disable_web_page_preview: true,
      parse_mode: "HTML",
    });
    exit(0);
  }

  // Speedtest
  try {
    logger.log(LogLevel.info, "Start speedtest...");
    await speedtest.start(connectedAccounts);
    const speedtestResult = JSON.parse(readFileSync("./out.json").toString());

    const speedFilter = (accounts: V2Object[]) => {
      for (const res of speedtestResult.nodes) {
        if (parseInt(res.max_speed) < 1000000) {
          for (const i in connectedAccounts) {
            if (connectedAccounts[i].remark == res.remarks) {
              logger.log(LogLevel.info, "Removed low/dead server!");
              connectedAccounts.splice(parseInt(i), 1);
              speedFilter(connectedAccounts);
            }
          }
        }
      }

      return accounts;
    };

    connectedAccounts = speedFilter(connectedAccounts);
  } catch (e: any) {
    logger.log(LogLevel.error, e.message);
  }

  // Write result
  // writer.write(connectedAccounts);

  // Send sample to channel
  // await bot.send(connectedAccounts[Math.floor(Math.random() * connectedAccounts.length)], connectedAccounts.length);

  console.log("Process complete!");
  exit(0);
})();
