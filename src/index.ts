export const acceptedType: string[] = ["vmess"];
export const path: string = process.cwd();

import { exec } from "child_process";
import { countryCodeEmoji } from "country-code-emoji";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { exit } from "process";
import { Bugs } from "./modules/bugs.mjs";
import { connect } from "./modules/connect.mjs";
import { converter } from "./modules/converter.mjs";
import { sleep } from "./modules/helper.mjs";
import { logger, LogLevel } from "./modules/logger.mjs";
import { Scraper } from "./modules/scraper.mjs";
import { bot } from "./modules/tg.mjs";
import { ConnectServer, Country, Region, V2Object } from "./modules/types.mjs";

const countries: Country[] = JSON.parse(readFileSync("./countries.json").toString());
const bugBundles: string[] = readdirSync("./resources/bugs");
const url: string = readFileSync("./source").toString();
const modes: string[] = ["cdn", "sni"];
const maxConcurrentTest = 100;

// Kill all v2ray process
exec("pkill v2ray");

(async () => {
  // Scavenge accounts but doesn't fill the bugs
  const accounts: V2Object[] = await (async () => {
    let accounts: V2Object[] = [];
    await Scraper.scrape(url).then((res) => {
      if (res.error) exit(1);

      for (const account of res.result) {
        if (account.startsWith("vmess")) {
          accounts.push(converter.toObject("Vmess", account));
        }
      }
    });
    return accounts;
  })();

  // Test the result
  const connectedAccounts = await (async () => {
    const bugs = new Bugs();
    const result: V2Object[] = [];
    const concurrentTest: string[] = [];

    let scannedAccount: any = {};

    for (let account of accounts) {
      concurrentTest.push(account.id);

      new Promise(async (resolve) => {
        const connectResult: ConnectServer[] = [];
        const onTest: string[] = [];
        for (const mode of modes) {
          // Filter account
          let server = account.address;
          if (mode == "cdn") {
            if (!account.host) continue;
            server = account.host;
          } else {
            account.tls = "tls";

            if (account.port == 80) {
              account.port = 443;
            }
          }
          if (scannedAccount[server]) {
            if (scannedAccount[server].includes(account.id)) break;
          }

          onTest.push(mode);
          new Promise((resolve) => {
            connect
              .connect(bugs.fill(converter.toV2ray(account), "V2ray", mode as "sni" | "cdn"))
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
            logger.log(LogLevel.error, `${account.remark}: ${mode} -> ${connect.error}`);
          } else {
            const countryFlag = connect.cc == "XX" ? "🇺🇳" : countryCodeEmoji(connect.cc);
            result.push({
              ...account,
              cc: connect.cc,
              countryName: connect.cn,
              cdn: connect.mode == "cdn",
              remark: `${result.length + 1} ⌜クモ⌟ ${mode} -> ${countryFlag}`, // my watermark (remark) lol
            });

            logger.log(LogLevel.success, `${result.length} ${account.remark}: ${mode} -> ${countryFlag}`);

            let server = account.address;
            if (mode == "CDN") server = account.host;

            // ID filter
            if (scannedAccount[server]) {
              if (!scannedAccount[server].includes(account.id)) scannedAccount[server].push(account.id);
            } else {
              scannedAccount[server] = [account.id];
            }
          }
        }

        resolve(concurrentTest.shift());
      });

      do {
        await sleep(1000);
      } while (concurrentTest.length > maxConcurrentTest);
    }

    let isTimeout = false;
    const timeout = setTimeout(() => {
      isTimeout = true;
    }, 300000);

    do {
      await sleep(1000);

      if (isTimeout) {
        clearTimeout(timeout);
        exec("pkill v2ray");
        break;
      }
    } while (concurrentTest[0]);

    return result;
  })();

  // Convert result to various format
  // But first, we split them by region and country
  const proxiesByRegion: {
    Asia: V2Object[];
    Europe: V2Object[];
    Africa: V2Object[];
    Oceania: V2Object[];
    Americas: V2Object[];
  } = {
    Asia: [],
    Europe: [],
    Africa: [],
    Oceania: [],
    Americas: [],
  };

  const proxiesByCountry: any = {};

  for (const account of connectedAccounts) {
    const cc = account.cc as string;
    if (proxiesByCountry[cc]) {
      proxiesByCountry[cc].push(account);
    } else {
      proxiesByCountry[cc] = [account];
    }

    for (const country of countries) {
      if (country.code == cc) {
        proxiesByRegion[country.region].push(account);
      }
    }
  }

  // Fill the bugs and write result
  if (!existsSync("./result")) mkdirSync("./result");
  if (!existsSync("./result/clash")) mkdirSync("./result/clash");
  if (!existsSync("./result/v2ray")) mkdirSync("./result/v2ray");
  for (let bugBundle of bugBundles) {
    bugBundle = bugBundle.replace(".json", "");
    if (bugBundle == "crawl") continue; // bug for test

    const bugs = new Bugs(bugBundle);

    // Entire result
    let clashProxies = ["proxies:"];
    let config = JSON.parse(readFileSync("./resources/config/v2ray/config.json").toString());
    for (const account of connectedAccounts) {
      clashProxies.push(bugs.fill(converter.toClash(account), "Clash", account.cdn ? "cdn" : "sni"));
      config.outbounds.push(bugs.fill(converter.toV2ray(account), "V2ray", account.cdn ? "cdn" : "sni"));
    }
    writeFileSync(`./result/v2ray/config-${bugBundle}.yaml`, JSON.stringify(config, null, 2));
    writeFileSync(`./result/clash/providers-${bugBundle}.yaml`, clashProxies.join("\n"));

    // Per country
    for (const country of Object.keys(proxiesByCountry)) {
      clashProxies = ["proxies:"];
      config = JSON.parse(readFileSync("./resources/config/v2ray/config.json").toString());
      for (const account of proxiesByCountry[country]) {
        clashProxies.push(bugs.fill(converter.toClash(account), "Clash", account.cdn ? "cdn" : "sni"));
        config.outbounds.push(bugs.fill(converter.toV2ray(account), "V2ray", account.cdn ? "cdn" : "sni"));
      }
      writeFileSync(`./result/v2ray/config-${bugBundle}-${country}.yaml`, JSON.stringify(config, null, 2));
      writeFileSync(`./result/clash/providers-${bugBundle}-${country}.yaml`, clashProxies.join("\n"));
    }

    // Per region
    for (const region of Object.keys(proxiesByRegion)) {
      clashProxies = ["proxies:"];
      config = JSON.parse(readFileSync("./resources/config/v2ray/config.json").toString());
      for (const account of proxiesByRegion[region as Region]) {
        clashProxies.push(bugs.fill(converter.toClash(account), "Clash", account.cdn ? "cdn" : "sni"));
        config.outbounds.push(bugs.fill(converter.toV2ray(account), "V2ray", account.cdn ? "cdn" : "sni"));
      }
      writeFileSync(`./result/v2ray/config-${bugBundle}-${region}.yaml`, JSON.stringify(config, null, 2));
      writeFileSync(`./result/clash/providers-${bugBundle}-${region}.yaml`, clashProxies.join("\n"));
    }
  }

  // Write the enitre raw result (withour edit except remark)
  writeFileSync(`./result/result.json`, JSON.stringify(connectedAccounts, null, 2));

  // Send one asian server to channel
  if (proxiesByRegion["Asia"].length >= 1) {
    let connected = false;
    do {
      const account = proxiesByRegion["Asia"][Math.floor(Math.random() * proxiesByRegion["Asia"].length)];
      if (
        !(await connect.connect(new Bugs().fill(converter.toV2ray(account), "V2ray", account.cdn ? "cdn" : "sni")))
          .error
      ) {
        connected = true;
        await bot.send(account, connectedAccounts.length);
        break;
      }

      if (proxiesByRegion["Asia"].length == 1) break;
    } while (!connected);
  }
})();
