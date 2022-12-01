import { readFileSync } from "fs";

interface BugsObject {
  sni: Array<string>;
  cdn: Array<string>;
}

class Bugs {
  private _sni: Array<string> = [];
  private _cdn: Array<string> = [];
  private bugs: BugsObject;

  constructor(bundle: string = "crawl") {
    this.bugs = JSON.parse(readFileSync(`./resources/bugs/${bundle}.json`).toString());

    this._sni = this.bugs.sni;
    this._cdn = this.bugs.cdn;
  }

  get sni(): string {
    return this._sni[Math.floor(Math.random() * this._sni.length)];
  }

  get cdn(): string {
    return this._cdn[Math.floor(Math.random() * this._cdn.length)];
  }

  fill(account: any, format: "Clash" | "V2ray", mode: "sni" | "cdn") {
    const sni = this.sni;
    const cdn = this.cdn;
    if (format == "Clash") {
      if (mode == "sni") {
        return account
          .replace(account.match(/servername:.*/)[0], `servername: ${sni}`)
          .replace(account.match(/Host:.*/)[0], `Host: ${sni}`);
      } else {
        return account.replace(account.match(/server:.*/)[0], `server: ${cdn}`);
      }
    } else if (format == "V2ray") {
      if (mode == "sni") {
        account.streamSettings.wsSettings.headers.Host = sni;
        account.streamSettings.tlsSettings.serverName = sni;
      } else {
        account.settings.vnext[0].address = cdn;
      }

      return account;
    }
  }
}

export { Bugs };
