import { base64Decode, base64Encode } from "./helper.mjs";
import { logger, LogLevel } from "./logger.mjs";
import { V2Object, Vmess } from "./types.mjs";

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
            alterId: config.aid,
            host: config.host,
            id: config.id,
            network: config.net,
            path: config.path,
            tls: config.tls,
            type: config.type,
            security: config.security || "auto",
            skipCertVerify: config["skip-cert-verify"] ? true : false,
            sni: config.sni,
            remark: config.ps,
          } as V2Object;
        } catch (e: any) {
          logger.log(LogLevel.error, e.name);
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
        protocol: "vmess",
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
          wsSettings: {
            headers: {
              Host: account.host,
            },
            path: account.path,
          },
          tlsSettings: {
            allowInsecure: true,
            serverName: account.sni,
          },
        },
        tag: `proxy-${account.remark}`,
      };
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
      proxy.push(`    ws-opts: `);
      proxy.push(`      path: ${account.path}`);
      proxy.push(`      headers:`);
      proxy.push(`        Host: ${account.host}`);
    }

    return proxy.join("\n");
  }

  toBase64(account: V2Object) {
    let base64: string = "FvcK";
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

      base64 = base64Encode(JSON.stringify(vmess));
    }
    return `${account.vpn}://${base64}`;
  }
}

const converter = new Converter();
export { converter };
