export const acceptedType: string[] = ["vmess", "trojan"];
export const path: string = process.cwd();

import { exec } from "child_process";
import { countryCodeEmoji } from "country-code-emoji";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { exit } from "process";
import { Bugs } from "./modules/bugs.mjs";
import { connect } from "./modules/connect.mjs";
import { converter } from "./modules/converter.mjs";
import { isSingBoxRunning, sleep } from "./modules/helper.mjs";
import { logger, LogLevel } from "./modules/logger.mjs";
import { Scraper } from "./modules/scraper.mjs";
import { bot } from "./modules/tg.mjs";
import { ConnectServer, Country, Data, Region, V2Object } from "./modules/types.mjs";

const countries: Country[] = JSON.parse(readFileSync("./countries.json").toString());
const bugBundles: string[] = readdirSync("./resources/bugs");
const { url, filename } = JSON.parse(process.argv[2]) as Data;
const modes: string[] = ["cdn", "sni"];
const maxConcurrentTest = 50;

// Kill all v2ray process
exec("pkill sing-box");

(async () => {
  // Scavenge accounts but doesn't fill the bugs
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
  const connectedAccounts = await (async () => {
    const bugs = new Bugs();
    const result: V2Object[] = [];

    let scannedAccount: any = {};
    let isCompleteScan: boolean = false;

    for (const i in accounts) {
      let account = accounts[i];
      if (account.error) continue;
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
              .connect(bugs.fill(converter.toSingBox(account), "Sing-Box", mode as "sni" | "cdn"))
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

            let server = account.address;
            if (mode == "CDN") server = account.host;

            // ID filter by hostname
            if (scannedAccount[server]) {
              if (!scannedAccount[server].includes(account.id)) scannedAccount[server].push(account.id);
            } else {
              scannedAccount[server] = [account.id];
            }
            // ID filter by IP address
            if (connect.ip) {
              if (connect.mode == "cdn") {
                account.host = connect.ip;
                account.sni = connect.ip;
              } else {
                account.address = connect.ip;
              }
              if (scannedAccount[connect.ip]) {
                if (!scannedAccount[connect.ip].includes(account.id)) scannedAccount[connect.ip].push(account.id);
              } else {
                scannedAccount[connect.ip] = [account.id];
              }
            }

            result.push({
              ...account,
              cc: connect.cc,
              countryName: connect.cn,
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

      // if (result.length > 15) break; // Test purpose
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

  process.stdout.write("Splitting result...");
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
  process.stdout.write("done\n");

  // Fill the bugs and write result
  process.stdout.write("Fill the bugs and write result...");
  if (!existsSync("./result")) mkdirSync("./result");
  if (!existsSync("./result/clash")) mkdirSync("./result/clash");
  if (!existsSync("./result/v2ray")) mkdirSync("./result/v2ray");
  if (!existsSync("./result/surfboard")) mkdirSync("./result/surfboard");
  if (!existsSync("./result/sing-box")) mkdirSync("./result/sing-box");
  for (let bugBundle of bugBundles) {
    bugBundle = bugBundle.replace(".json", "");
    if (bugBundle == "crawl") continue; // bug for test

    const proxyModes = ["select", "load-balance", "url-test", "fallback"];
    const bugs = new Bugs(bugBundle);

    // Entire result
    let remarks = [];
    let clashProxies = ["proxies:"];
    let proxyBoard = [];
    let boardConfig = readFileSync("./resources/config/surfboard/surfboard.conf").toString();
    let rayConfig = JSON.parse(readFileSync("./resources/config/v2ray/config.json").toString());
    let boxConfig = JSON.parse(readFileSync("./resources/config/sing-box/config.json").toString());
    for (const account of connectedAccounts) {
      remarks.push(account.remark);
      clashProxies.push(bugs.fill(converter.toClash(account), "Clash", account.cdn ? "cdn" : "sni"));
      rayConfig.outbounds.push(bugs.fill(converter.toV2ray(account), "V2ray", account.cdn ? "cdn" : "sni"));
      proxyBoard.push(bugs.fill(converter.toSurfboard(account), "Surfboard", account.cdn ? "cdn" : "sni"));
      boxConfig.outbounds.push(bugs.fill(converter.toSingBox(account), "Sing-Box", account.cdn ? "cdn" : "sni"));

      boxConfig.outbounds[3].outbounds.push(account.remark);
    }
    for (const mode of proxyModes) {
      let proxyMode = `${mode.toUpperCase()} = ${mode}`;
      for (const remark of remarks) {
        proxyMode += `,${remark}`;
      }

      boardConfig += `${proxyMode}\n`;
    }

    boardConfig = boardConfig.replace(/FILENAME_PLACEHOLDER/, `board-${bugBundle}.conf`);
    boardConfig = boardConfig.replace(/PROXIES_PLACEHOLDER/, proxyBoard.join("\n"));
    writeFileSync(`./result/sing-box/config-${bugBundle}.json`, JSON.stringify(boxConfig, null, 2));
    writeFileSync(`./result/v2ray/config-${bugBundle}.json`, JSON.stringify(rayConfig, null, 2));
    writeFileSync(`./result/clash/providers-${bugBundle}.yaml`, clashProxies.join("\n"));
    writeFileSync(`./result/surfboard/board-${bugBundle}.conf`, boardConfig);

    // Per country
    for (const country of Object.keys(proxiesByCountry)) {
      let remarks = [];
      clashProxies = ["proxies:"];
      proxyBoard = [];
      boardConfig = readFileSync("./resources/config/surfboard/surfboard.conf").toString();
      rayConfig = JSON.parse(readFileSync("./resources/config/v2ray/config.json").toString());
      boxConfig = JSON.parse(readFileSync("./resources/config/sing-box/config.json").toString());
      for (const account of proxiesByCountry[country]) {
        remarks.push(account.remark);
        clashProxies.push(bugs.fill(converter.toClash(account), "Clash", account.cdn ? "cdn" : "sni"));
        rayConfig.outbounds.push(bugs.fill(converter.toV2ray(account), "V2ray", account.cdn ? "cdn" : "sni"));
        proxyBoard.push(bugs.fill(converter.toSurfboard(account), "Surfboard", account.cdn ? "cdn" : "sni"));
        boxConfig.outbounds.push(bugs.fill(converter.toSingBox(account), "Sing-Box", account.cdn ? "cdn" : "sni"));

        boxConfig.outbounds[3].outbounds.push(account.remark);
      }
      for (const mode of proxyModes) {
        let proxyMode = `${mode.toUpperCase()} = ${mode}`;
        for (const remark of remarks) {
          proxyMode += `,${remark}`;
        }

        boardConfig += `${proxyMode}\n`;
      }

      boardConfig = boardConfig.replace(/FILENAME_PLACEHOLDER/, `board-${bugBundle}-${country}.conf`);
      boardConfig = boardConfig.replace(/PROXIES_PLACEHOLDER/, proxyBoard.join("\n"));
      writeFileSync(`./result/v2ray/config-${bugBundle}-${country}.json`, JSON.stringify(rayConfig, null, 2));
      writeFileSync(`./result/sing-box/config-${bugBundle}-${country}.json`, JSON.stringify(boxConfig, null, 2));
      writeFileSync(`./result/clash/providers-${bugBundle}-${country}.yaml`, clashProxies.join("\n"));
      writeFileSync(`./result/surfboard/board-${bugBundle}-${country}.conf`, boardConfig);
    }

    // Per region
    for (const region of Object.keys(proxiesByRegion)) {
      let remarks = [];
      clashProxies = ["proxies:"];
      proxyBoard = [];
      boardConfig = readFileSync("./resources/config/surfboard/surfboard.conf").toString();
      rayConfig = JSON.parse(readFileSync("./resources/config/v2ray/config.json").toString());
      boxConfig = JSON.parse(readFileSync("./resources/config/sing-box/config.json").toString());
      for (const account of proxiesByRegion[region as Region]) {
        remarks.push(account.remark);
        clashProxies.push(bugs.fill(converter.toClash(account), "Clash", account.cdn ? "cdn" : "sni"));
        rayConfig.outbounds.push(bugs.fill(converter.toV2ray(account), "V2ray", account.cdn ? "cdn" : "sni"));
        proxyBoard.push(bugs.fill(converter.toSurfboard(account), "Surfboard", account.cdn ? "cdn" : "sni"));
        boxConfig.outbounds.push(bugs.fill(converter.toSingBox(account), "Sing-Box", account.cdn ? "cdn" : "sni"));

        boxConfig.outbounds[3].outbounds.push(account.remark);
      }
      for (const mode of proxyModes) {
        let proxyMode = `${mode.toUpperCase()} = ${mode}`;
        for (const remark of remarks) {
          proxyMode += `,${remark}`;
        }

        boardConfig += `${proxyMode}\n`;
      }

      boardConfig = boardConfig.replace(/FILENAME_PLACEHOLDER/, `board-${bugBundle}-${region}.conf`);
      boardConfig = boardConfig.replace(/PROXIES_PLACEHOLDER/, proxyBoard.join("\n"));
      writeFileSync(`./result/v2ray/config-${bugBundle}-${region}.json`, JSON.stringify(rayConfig, null, 2));
      writeFileSync(`./result/sing-box/config-${bugBundle}-${region}.json`, JSON.stringify(boxConfig, null, 2));
      writeFileSync(`./result/clash/providers-${bugBundle}-${region}.yaml`, clashProxies.join("\n"));
      writeFileSync(`./result/surfboard/board-${bugBundle}-${region}.conf`, boardConfig);
    }
  }

  // Write the enitre raw result (withour edit except remark)
  writeFileSync(`./result/result.json`, JSON.stringify(connectedAccounts, null, 2));
  process.stdout.write("done\n");

  // Send one asian server to channel
  process.stdout.write("Send sample to channel...");
  if (proxiesByRegion["Asia"].length >= 1) {
    let connected = false;
    do {
      const account = proxiesByRegion["Asia"][Math.floor(Math.random() * proxiesByRegion["Asia"].length)];
      if (
        !(await connect.connect(new Bugs().fill(converter.toSingBox(account), "Sing-Box", account.cdn ? "cdn" : "sni")))
          .error
      ) {
        connected = true;
        await bot.send(account, connectedAccounts.length);
        break;
      }

      if (proxiesByRegion["Asia"].length == 1) break;
    } while (!connected);
  }
  process.stdout.write("done\n");

  process.stdout.write("Process complete!");
  exit(0);
})();
