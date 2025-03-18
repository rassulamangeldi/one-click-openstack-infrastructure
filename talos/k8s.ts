import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import { baseVars, resourceName } from "./vars";

export interface K8SArgs {
    providerConfig: k8s.ProviderArgs;
    fluxInfraCustomEnvs?: { [key: string]: pulumi.Input<string> };
}

export class K8S extends pulumi.ComponentResource {

    constructor(name: string, args: K8SArgs, opts?: pulumi.ComponentResourceOptions) {
        super("local:k8s", name, {}, opts);

        const config = new pulumi.Config();

        /**
         * Kubernetes provider
         */
        const kubernetesProvider = new k8s.Provider("kubernetesProvider", {
            ...args.providerConfig
        });
        
        /**
         *  Cilium Helm 
         */
        const ciliumHelmChart = new k8s.helm.v3.Release("ciliumHelmChart", {
            chart: "cilium",
            version: "1.15.6",
            namespace: "kube-system",
            name: "cilium",
            repositoryOpts: { repo: "https://helm.cilium.io/" },
            values: {
              l2announcements: { enabled: true },
              cgroup: {
                autoMount: { enabled: false },
                hostRoot: "/sys/fs/cgroup"
              },
              debug: { enabled: false },
              rollOutCiliumPods: true,
              k8sServiceHost: "localhost",
              k8sServicePort: "7445",
              kubeProxyReplacement: "true",
              resources: {
                requests: {
                  cpu: "100m",
                  memory: "256Mi"
                }
              },
              operator: { enabled: true, rollOutPods: true },
              ipam: { mode: "kubernetes" },
              securityContext: { privileged: true },
              hubble: { enabled: false },
              prometheus: {
                enabled: false,
                serviceMonitor: { enabled: false }
              }
            }
        }, { provider: kubernetesProvider, parent: this });
        
        /**
         *  Flux Helm (GitOps)
         */
        const fluxHelmChart = new k8s.helm.v3.Release("fluxHelmChart", {
            chart: "flux2",
            version: "2.14.0",
            namespace: "flux-system",
            name: "flux",
            repositoryOpts: { repo: "https://fluxcd-community.github.io/helm-charts" },
            values: {
                installCRDs: true,
                helmController: { create: true, labels: { managedBy: "pulumi" } },
                imageAutomationController: { create: false },
                imageReflectionController: { create: false },
                kustomizeController: { create: true, labels: { managedBy: "pulumi" } },
                notificationController: { create: true, labels: { managedBy: "pulumi" } },
                sourceController: { create: true, labels: { managedBy: "pulumi" } },
                policies: { create: false },
                watchAllNamespaces: true
            },
            createNamespace: true
        }, { provider: kubernetesProvider, parent: this });
        
        /**
         *  Kubernetes Secret with gitlab token (TODO)
         */
        
        /**
         *  Flux Sync Helm (TODO)
         *   - GitRepository
         *   - Kustomization
         */
    }
}