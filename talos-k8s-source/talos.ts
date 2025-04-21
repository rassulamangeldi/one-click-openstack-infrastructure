import * as pulumi from "@pulumi/pulumi";
import * as talos from "@pulumiverse/talos";
import * as vars from "./vars";

export interface TalosArgs {
    masterNodes: pulumi.Input<any>;
    workerNodes: pulumi.Input<any>;
}

export class Talos extends pulumi.ComponentResource {

    resourceName: string;
    secrets: talos.machine.Secrets;
    clientConfiguration: pulumi.Output<talos.client.GetConfigurationResult>;
    // masterConfigOutput: talos.machine.GetConfigurationResult;
    // workerConfigOutput: talos.machine.GetConfigurationResult;
    masterConfigApply: talos.machine.ConfigurationApply | undefined;
    workerConfigApply: talos.machine.ConfigurationApply | undefined;
    masterConfigurationApplyResources: talos.machine.ConfigurationApply[];
    workerConfigurationApplyResources: talos.machine.ConfigurationApply[];
    kubeconfigOutput: pulumi.Output<talos.cluster.GetKubeconfigResult>;

    public talosconfig(): pulumi.Output<string> {
        return this.clientConfiguration.talosConfig;
    }

    public kubeconfig(): pulumi.Output<talos.cluster.GetKubeconfigResult>{
        return this.kubeconfigOutput;
    }

    constructor(name: string, args: TalosArgs, opts?: pulumi.ComponentResourceOptions) {
        super("talos", name, {}, opts);

        this.resourceName = `${vars.env}-${vars.project}-${vars.app}`;

        this.secrets = new talos.machine.Secrets(`secrets`, {}, { parent: this });

        this.clientConfiguration = this.secrets.clientConfiguration.caCertificate.apply(caCert => {
            return this.secrets.clientConfiguration.clientCertificate.apply(clientCert => {
                return this.secrets.clientConfiguration.clientKey.apply(clientKey => {
                    return talos.client.getConfiguration({
                        clusterName: vars.clusterName,
                        clientConfiguration: {
                            caCertificate: caCert,
                            clientCertificate: clientCert,
                            clientKey: clientKey,
                        },
                        endpoints: args.masterNodes.map((node: { privateIp: any; }) => node.privateIp),
                    }, { parent: this });
                });
            });
        });
        
        const masterConfigOutput = talos.machine.getConfigurationOutput({
            clusterName: vars.clusterName,
            machineType: "controlplane",
            clusterEndpoint: vars.clusterEndpoint,
            machineSecrets: this.secrets.machineSecrets,
            talosVersion: vars.talosVersion,
            kubernetesVersion: vars.kubernetesVersion,
            docs: false,
            examples: false,
            configPatches: [vars.defaultConfigTemplate]
        }, { parent: this });
        
        const workerConfigOutput = talos.machine.getConfigurationOutput({
          clusterName: vars.clusterName,
          machineType: "worker",
          clusterEndpoint: vars.clusterEndpoint,
          machineSecrets: this.secrets.machineSecrets,
          talosVersion: vars.talosVersion,
          kubernetesVersion: vars.kubernetesVersion,
          docs: false,
          examples: false,
          configPatches: [vars.defaultConfigTemplate]
        }, { parent: this });
        
        this.masterConfigurationApplyResources = [];
        for (var node of args.masterNodes) {
        
            this.masterConfigApply = new talos.machine.ConfigurationApply(node.name, {
                clientConfiguration: this.secrets.clientConfiguration,
                machineConfigurationInput: masterConfigOutput.machineConfiguration,
                node: node.privateIp,
                configPatches: [
                    vars.masterConfigTemplate,
                    vars.containerdPatch,
                    vars.disableAdmissionControlPatch
                ]
            // }, { dependsOn: k8s.masterInstances() });
            }, { parent: this });
            this.masterConfigurationApplyResources.push(this.masterConfigApply);
        }
        
        this.workerConfigurationApplyResources = [];
        for (var node of args.workerNodes) {
        
            const workerConfigApply = new talos.machine.ConfigurationApply(node.name, {
                clientConfiguration: this.secrets.clientConfiguration,
                machineConfigurationInput: workerConfigOutput.machineConfiguration,
                node: node.privateIp,
                configPatches: [
                    vars.containerdPatch
                ]
            // }, { dependsOn: k8s.workerInstances() });
            }, { parent: this });
            this.workerConfigurationApplyResources.push(workerConfigApply);
        }
        
        new talos.machine.Bootstrap(`bootstrap`, {
            node: args.masterNodes[0].privateIp,
            clientConfiguration: this.secrets.clientConfiguration,
        }, { dependsOn: this.masterConfigurationApplyResources , parent: this });
        
        this.kubeconfigOutput = talos.cluster.getKubeconfigOutput({
            clientConfiguration: this.secrets.clientConfiguration,
            node: args.masterNodes[0].privateIp,
        }, { parent: this });
        
    }
}

export const placeholder = true;
