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

  fill(account: any, format: "clash" | "v2ray" | "surfboard" | "sing-box" | "v2object", mode: "sni" | "cdn") {
    const sni = this.sni;
    const cdn = this.cdn;

    if (format == "clash") {
      if (mode == "sni") {
        if (account.match(/Host:.*/)) {
          account = account.replace(account.match(/Host:.*/)[0], `Host: ${sni}`);
        }
        account = account.replace(account.match(/servername:.*/)[0], `servername: ${sni}`);
      } else {
        account = account.replace(account.match(/server:.*/)[0], `server: ${cdn}`);
      }
    } else if (format == "v2ray") {
      if (account.protocol == "vmess") {
        if (mode == "sni") {
          if (account.streamSettings.wsSettings) {
            account.streamSettings.wsSettings.headers.Host = sni;
          }
          account.streamSettings.tlsSettings.serverName = sni;
        } else {
          account.settings.vnext[0].address = cdn;
        }
      } else if (account.protocol == "trojan") {
        if (mode == "sni") {
          if (account.streamSettings.wsSettings) {
            account.streamSettings.wsSettings.headers.Host = sni;
          }
          account.streamSettings.tlsSettings.serverName = sni;
        } else {
          account.settings.servers[0].address = cdn;
        }
      }
    } else if (format == "surfboard") {
      if (mode == "sni") {
        if (account.match(/ws-headers=Host:.*/)) {
          account = account.replace(account.match(/ws-headers=Host:.*/)[0], `ws-headers=Host:${sni}`);
        }
        account = account.replace(account.match(/(sni=((.*?)|($)))(,|$)/)[1], `sni=${sni}`);
      } else {
        account = account.replace(
          account.match(
            /(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gm
          )[0],
          `${cdn}`
        );
      }
    } else if (format == "sing-box") {
      // Both vmess and trojan have the same format
      if (account.type.match(/(vmess|trojan)/)) {
        if (mode == "sni") {
          if (account.transport?.headers) {
            account.transport.headers.Host = sni;
          }
          account.tls.server_name = sni;
        } else {
          account.server = cdn;
        }
      }
    } else if (format == "v2object") {
      if (mode == "sni") {
        if (account.network == "ws") {
          account.host = sni;
        }
        account.sni = sni;
      } else {
        account.address = cdn;
      }
    }

    return account;
  }
}

export { Bugs };
