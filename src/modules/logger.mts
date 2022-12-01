import chalk from "chalk";

export enum LogLevel {
  success = "Success",
  error = "Error",
}

class Logger {
  private wrap(tag: string): string {
    let result: Array<string> = [" "];

    if (tag.length > 10) throw logger.log(LogLevel.error, "Only 7 character accepted!");
    for (let i = 1; i < 10; i++) {
      if (tag[i - 1]) {
        result[i] = tag[i - 1];
        continue;
      } else {
        result[i] = " ";
      }
    }

    return result.join("");
  }

  log(logLevel: LogLevel, message: string) {
    switch (logLevel) {
      case LogLevel.error:
        console.log(`${chalk.red.bold(this.wrap("Error"))}: ${message}`);
        break;
      case LogLevel.success:
        console.log(`${chalk.green.bold(this.wrap("Success"))}: ${message}`);
        break;
      default:
        break;
    }
  }
}

const logger = new Logger();
export { logger };
