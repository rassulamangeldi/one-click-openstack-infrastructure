import * as pulumi from "@pulumi/pulumi";
import { execSync } from "child_process";
const fs = require("fs");
const tmp = require("tmp");

class WaitForTalosProvider implements pulumi.dynamic.ResourceProvider {
  async create(inputs: any) {
    const kubeconfigRaw = inputs.kubeconfigRaw;

    const tmpFile = tmp.fileSync();
    fs.writeFileSync(tmpFile.name, kubeconfigRaw);

    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      try {
        execSync(`kubectl --kubeconfig=${tmpFile.name} get namespaces`, {
          encoding: "utf-8",
          stdio: "pipe"
        });
        console.log(`[WaitForTalos] Kubernetes API is now accessible.`);
        return { id: "ready", outs: {} };
      } catch (e) {
        console.log(`[WaitForTalos] API not ready yet, retrying... (${i + 1}/${maxRetries})`);
      }

      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    }

    throw new Error("Kubernetes API not ready after retries.");
  }
}

export class WaitForTalos extends pulumi.dynamic.Resource {
  constructor(
    name: string,
    args: { kubeconfigRaw: pulumi.Input<string> },
    opts?: pulumi.CustomResourceOptions
  ) {
    super(new WaitForTalosProvider(), name, args, opts);
  }
}
