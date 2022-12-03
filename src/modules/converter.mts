import { URLSearchParams } from "url";
import { base64Decode, base64Encode, urlParser } from "./helper.mjs";
import { logger, LogLevel } from "./logger.mjs";
import { Trojan, V2Object, Vmess } from "./types.mjs";

type ConvertFrom = "Vmess" | "Trojan" | "SS";

class Converter {
  toObject(from: ConvertFrom, configUrl: string): V2Object {
    let url, config;

    switch (from) {
      case "Vmess":
        url = configUrl as string;
        config = url.replace("vmess://", "");

        try {
          config = JSON.parse(base64Decode(config)) as Vmess;

          return {
            vpn: "vmess",
            address: config.add,
            port: config.port,
            alterId: config.aid || 0,
            host: config.host,
            id: config.id,
            network: config.net,
            path: config.path,
            tls: config.tls,
            type: config.type,
            security: config.security || "auto",
            skipCertVerify: config["skip-cert-verify"] ? true : false,
            sni: config.sni || config.host,
            remark: config.ps,
          } as V2Object;
        } catch (e: any) {
          logger.log(LogLevel.error, e.message);
          return { error: e.name } as V2Object;
        }
      case "Trojan":
        url = urlParser(configUrl);
        try {
          return {
            vpn: "trojan",
            address: url.hostname,
            port: parseInt(url.port || "443"),
            host: url.query.host,
            id: url.auth,
            network: url.query.type || "tcp",
            path: url.query.path,
            skipCertVerify: true,
            tls: url.query.security || true,
            sni: url.query.sni || url.query.host,
            flow: url.query.flow || "",
            level: url.query.level || 8,
            method: url.query.method || "chacha20-poly1305",
            ota: url.query.ota ? true : false,
            remark: url.hash?.replace("#", ""),
          } as V2Object;
        } catch (e: any) {
          logger.log(LogLevel.error, e.message);
          return { error: e.name } as V2Object;
        }
      default:
        return { error: "Convert Error" } as V2Object;
    }
  }

  toV2ray(account: V2Object) {
    let proxy: any = {};
    if (account.vpn == "vmess") {
      proxy = {
        mux: {
          concurrency: 8,
          enabled: false,
        },
        protocol: account.vpn,
        settings: {
          vnext: [
            {
              address: account.address,
              port: parseInt(`${account.port}` || "443"),
              users: [
                {
                  alterId: parseInt(`${account.alterId}` || "0"),
                  encryption: "",
                  flow: "",
                  id: account.id,
                  level: 8,
                  security: "auto",
                },
              ],
            },
          ],
        },
        streamSettings: {
          network: account.network,
          security: account.tls,
          tlsSettings: {
            allowInsecure: true,
            serverName: account.sni || account.host,
          },
        },
        tag: `proxy-${account.remark}`,
      };

      if (account.network == "ws") {
        proxy.streamSettings.wsSettings = {
          headers: {
            Host: account.host,
          },
          path: account.path,
        };
      }
    } else if (account.vpn == "trojan") {
      proxy = {
        mux: {
          concurrency: 8,
          enabled: false,
        },
        protocol: account.vpn,
        settings: {
          servers: [
            {
              address: account.address,
              flow: account.flow ? account.flow : "",
              level: parseInt(account.level || "8"),
              method: account.method ? account.method : "chacha20-poly1305",
              ota: account.ota,
              password: account.id,
              port: account.port,
            },
          ],
        },
        streamSettings: {
          network: account.network || "tcp",
          security: account.tls,
          tlsSettings: {
            allowInsecure: true,
            serverName: account.sni || account.host,
          },
        },
        tag: `proxy-${account.remark}`,
      };

      if (account.network == "ws") {
        proxy.streamSettings.wsSettings = {
          headers: {
            Host: account.host,
          },
          path: account.path,
        };
      }
    }

    return proxy;
  }

  toClash(account: V2Object) {
    const proxy: string[] = [];
    if (account.vpn == "vmess") {
      proxy.push(`  - name: '${account.remark}'`);
      proxy.push(`    server: ${account.address}`);
      proxy.push(`    type: ${account.vpn}`);
      proxy.push(`    port: ${account.port}`);
      proxy.push(`    uuid: ${account.id}`);
      proxy.push(`    alterId: ${account.alterId}`);
      proxy.push(`    cipher: auto`);
      proxy.push(`    tls: ${account.tls ? true : false}`);
      proxy.push(`    udp: true`);
      proxy.push(`    skip-cert-verify: ${account.skipCertVerify}`);
      proxy.push(`    network: ${account.network}`);
      proxy.push(`    servername: ${account.sni || account.host}`);
      if (account.network == "ws") {
        proxy.push(`    ws-opts: `);
        proxy.push(`      path: ${account.path}`);
        proxy.push(`      headers:`);
        proxy.push(`        Host: ${account.host}`);
      }
    } else if (account.vpn == "trojan") {
      proxy.push(`  - name: '${account.remark}'`);
      proxy.push(`    server: ${account.address}`);
      proxy.push(`    type: ${account.vpn}`);
      proxy.push(`    port: ${account.port}`);
      proxy.push(`    password: ${account.id}`);
      proxy.push(`    udp: true`);
      proxy.push(`    skip-cert-verify: ${account.skipCertVerify}`);
      proxy.push(`    network: ${account.network}`);
      proxy.push(`    servername: ${account.sni || account.host}`);
      if (account.network == "ws") {
        proxy.push(`    ws-opts: `);
        proxy.push(`      path: ${account.path}`);
        proxy.push(`      headers:`);
        proxy.push(`        Host: ${account.host}`);
      }
    }

    return proxy.join("\n");
  }

  toSurfboard(account: V2Object) {
    let config: string[] = [];
    if (account.vpn == "vmess") {
      config.push(`${account.remark} = vmess`);
      config.push(`${account.address}`);
      config.push(`${account.port}`);
      config.push(`username=${account.id}`);
      config.push(`udp-relay=true`);
      config.push(`tls=${account.tls ? true : false}`);
      config.push(`skip-cert-verify=${account.skipCertVerify}`);
      config.push(`sni=${account.sni || account.host}`);

      if (account.network == "ws") {
        config.push(`ws=true`);
        config.push(`ws-path=${account.path}`);
        config.push(`ws-headers=Host:${account.host}`);
      }
    } else if (account.vpn == "trojan") {
      config.push(`${account.remark} = trojan`);
      config.push(`${account.address}`);
      config.push(`${account.port}`);
      config.push(`password=${account.id}`);
      config.push(`udp-relay=true`);
      config.push(`skip-cert-verify=${account.skipCertVerify}`);
      config.push(`sni=${account.sni || account.host}`);

      if (account.network == "ws") {
        config.push(`ws=true`);
        config.push(`ws-path=${account.path}`);
        config.push(`ws-headers=Host:${account.host}`);
      }
    }

    return config.join(", ");
  }

  toUrl(account: V2Object) {
    if (account.vpn == "vmess") {
      let vmess: Vmess = {
        add: account.address,
        aid: account.alterId,
        host: account.host,
        id: account.id,
        net: account.network,
        path: account.path,
        port: account.port,
        ps: account.remark,
        tls: account.tls,
        type: account.type,
        security: account.security || "auto",
        "skip-cert-verify": account.skipCertVerify,
        sni: account.sni,
        cdn: account.cdn ? true : false,
        scy: "",
      };

      return `${account.vpn}://${base64Encode(JSON.stringify(vmess))}`;
    } else if (account.vpn == "trojan") {
      let trojan: Trojan = {
        security: account.tls ? "tls" : "",
      } as Trojan;
      if (account.type) trojan.type = account.type;
      if (account.path) trojan.path = account.path;
      if (account.host) trojan.host = account.host;
      if (account.tls) trojan.sni = account.sni || account.host;

      return `${account.vpn}://${account.id}@${account.address}:${account.port}?${new URLSearchParams(
        trojan as any
      ).toString()}#${encodeURIComponent(account.remark)}`;
    }
  }
}

const converter = new Converter();
export { converter };
