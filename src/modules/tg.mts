import { readFileSync } from "fs";
import { Bot as TgBot, InlineKeyboard } from "grammy";
import { Country, Region, V2Object } from "./types.mjs";
import { countryCodeEmoji } from "country-code-emoji";
import { converter } from "./converter.mjs";

class Bot {
  bot = new TgBot(readFileSync("./bot_token").toString());

  private async make(account: V2Object, total: number) {
    let message: string = "---------------------------\n";
    message += "Akun Gratis | Free Accounts\n";
    message += "---------------------------\n";
    message += `Jumlah/Count: ${total} 🌾\n`;
    message += `Regional/Region: ${account.countryName} ${countryCodeEmoji(account.cc as string)}\n`;
    message += "---------------------------\n";
    message += "Info:\n";
    message += `Remark: <code>${account.remark}</code>\n`;
    message += `Address: <code>${account.address}</code>\n`;
    message += `Port: <code>${account.port}</code>\n`;
    message += `Network: <code>${account.network}</code>\n`;
    message += `Host: <code>${account.host}</code>\n`;
    message += `Path: <code>${account.path}</code>\n`;
    message += `TLS: <code>${account.tls ? true : false}</code>\n`;
    message += `Mode: <code>${account.cdn ? "CDN" : "SNI"}</code>\n`;
    message += `SNI: <code>${account.sni}</code>\n\n`;
    message += `⌜<code>${converter.toBase64(account)}</code>⌟\n\n`;
    message += `Config: <a href="https://github.com/dickymuliafiqri/Spider/tree/master/resources/config">Config Example</a>\n`;
    message += `Sub: <a href="https://github.com/dickymuliafiqri/Spider/tree/master/result">Subscription</a>\n`;
    message += `Join: @v2scrape\n\n`;
    message += `Contact: @d_fordlalatina`;

    return message;
  }

  async send(account: V2Object, total: number) {
    const message = await this.make(account, total);

    await this.bot.api.sendMessage("-1001509827144", message, {
      disable_web_page_preview: true,
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .url("❤️ Donate ❤️", "https://saweria.co/m0qa")
        .row()
        .url("Donators", "https://telegra.ph/Donations-11-05-4")
        .row(),
    });
  }
}

const bot = new Bot();
export { bot };
