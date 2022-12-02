export type Region = "Asia" | "Europe" | "Africa" | "Oceania" | "Americas";

export interface V2Object {
  vpn: string;
  address: string;
  port: number;
  alterId: number;
  host: string;
  id: string;
  network: string;
  path: string;
  tls: string;
  type: string;
  security: string;
  skipCertVerify: boolean;
  sni: string;
  flow?: string;
  level?: string;
  method?: string;
  ota?: boolean;
  remark: string;
  cdn?: boolean;
  cc?: string;
  error?: string;
  countryName?: string;
}

export interface Vmess {
  scy: string;
  add: string;
  aid: number;
  host: string;
  id: string;
  net: string;
  path: string;
  port: number;
  ps: string;
  tls: string;
  type: string;
  security: string;
  "skip-cert-verify": boolean;
  sni: string;
  cdn: boolean;
}

export interface Trojan {
  address: string;
  port: number;
  id: string;
  security: string;
  host: string;
  type: string;
  sni: string;
  remark: string;
  path: string;
  cdn: boolean;
  allowInsecure: boolean;
}

export interface Country {
  name: string;
  code: string;
  region: Region;
}

export interface ConnectServer {
  error?: string;
  cc: string;
  cn: string;
  mode?: "sni" | "cdn";
}

export interface Data {
  url: string;
  filename: string;
}
