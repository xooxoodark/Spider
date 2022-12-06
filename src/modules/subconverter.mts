import { spawn } from "child_process";

class SubConverter {
  async start() {
    await new Promise((resolve) => {
      spawn("./bin/subconverter/subconverter");
    });
  }
}

const subconverter = new SubConverter();
export { subconverter };
