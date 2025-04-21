import { K8S } from "./k8s";
import { Talos } from "./talos";
import * as vars from "./vars";
import * as openstack from "@pulumi/openstack";
import * as kubernetes from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import { WaitForTalos } from "./wait";
import * as fs from "fs";

const resourceName = `${vars.env}-${vars.project}-${vars.app}`

const masterNodes = [
  { nameSuffix: "1", privateIp: "10.129.1.110" },
  { nameSuffix: "2", privateIp: "10.129.1.111" },
  { nameSuffix: "3", privateIp: "10.129.1.112" },
].map(({ nameSuffix, privateIp }) => ({
  name: `${resourceName}01--master-${nameSuffix}`,
  privateIp,
  image: vars.talosImage,
  flavor: vars.flavorMaster,
  volumeRoot: vars.volumeSizeMaster,
  volumeType: vars.defaultVolumeType,
}));

const workerNodes = [
  // App Workers
  ...[
    { nameSuffix: "1", privateIp: "10.129.1.120" },
    { nameSuffix: "2", privateIp: "10.129.1.121" },
    { nameSuffix: "3", privateIp: "10.129.1.122" },
  ].map(({ nameSuffix, privateIp }) => ({
    name: `${resourceName}-02-worker-${nameSuffix}`,
    privateIp,
    image: vars.talosImage,
    flavor: vars.flavorWorker,
    volumeRoot: vars.volumeSizeWorker,
    volumeType: vars.defaultVolumeType,
    group: "app",
  })),

  // System Workers
  ...[
    { nameSuffix: "1", privateIp: "10.129.1.130" },
    { nameSuffix: "2", privateIp: "10.129.1.131" },
    { nameSuffix: "3", privateIp: "10.129.1.132" },
  ].map(({ nameSuffix, privateIp }) => ({
    name: `${resourceName}-03-system-worker-${nameSuffix}`,
    privateIp,
    image: vars.talosImage,
    flavor: vars.flavorWorkerSystem,
    volumeRoot: vars.volumeSizeWorkerSystem,
    volumeType: vars.defaultVolumeType,
    group: "system",
  })),

// Infra Workers
...[
  { nameSuffix: "1", privateIp: "10.129.1.133" },
  { nameSuffix: "2", privateIp: "10.129.1.134" },
  { nameSuffix: "3", privateIp: "10.129.1.135" },
].map(({ nameSuffix, privateIp }) => ({
  name: `${resourceName}-04-infra-worker-${nameSuffix}`,
  privateIp,
  image: vars.talosImage,
  flavor: vars.flavorWorkerInfra,
  volumeRoot: vars.volumeSizeWorkerInfra,
  volumeType: vars.defaultVolumeType,
  group: "infra",
})),
];

const masterAndWorkerCidrs = [
  ...masterNodes.map(node => `${node.privateIp}/32`),
  ...workerNodes.map(node => `${node.privateIp}/32`),
];

const masterSgRules = {
  ingress: [
    {
      name: "self true tcp",
      cidr: masterAndWorkerCidrs,
      protocol: "tcp",
      fromPort: -1,
      toPort: -1,
    },
    {
      name: "self true udp",
      cidr: masterAndWorkerCidrs,
      protocol: "udp",
      fromPort: -1,
      toPort: -1,
    },
    {
      name: "self true any",
      cidr: masterAndWorkerCidrs,
      protocol: "any",
      fromPort: -1,
      toPort: -1,
    },
    {
      name: "talos api",
      cidr: ["0.0.0.0/0"],
      protocol: "tcp",
      fromPort: 50000,
      toPort: 50000,
    },
    {
      name: "kube api all",
      cidr: ["0.0.0.0/0"],
      protocol: "tcp",
      fromPort: 6443,
      toPort: 6443,
    },
  ],
  egress: [
    {
      name: "Allowed All Egress",
      cidr: ["0.0.0.0/0"],
      protocol: "any",
      fromPort: -1,
      toPort: -1
    }
  ]
}

const workerSgRules = {
  ingress: [
    {
      name: "self true tcp",
      cidr: masterAndWorkerCidrs,
      protocol: "tcp",
      fromPort: -1,
      toPort: -1,
    },
    {
      name: "self true udp",
      cidr: masterAndWorkerCidrs,
      protocol: "udp",
      fromPort: -1,
      toPort: -1,
    },
    {
      name: "self true any",
      cidr: masterAndWorkerCidrs,
      protocol: "any",
      fromPort: -1,
      toPort: -1,
    },
    {
      name: "nodeport",
      cidr: ["0.0.0.0/0"],
      protocol: "tcp",
      fromPort: 30000,
      toPort: 32767,
    },
    {
      name: "talos api",
      cidr: ["0.0.0.0/0"],
      protocol: "tcp",
      fromPort: 50000,
      toPort: 50000,
    },
    {
      name: "http",
      cidr: ["0.0.0.0/0"],
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
    },
    {
      name: "https",
      cidr: ["0.0.0.0/0"],
      protocol: "tcp",
      fromPort: 443,
      toPort: 443,
    },
    {
      name: "openstack cinder",
      cidr: ["0.0.0.0/0"],
      protocol: "udp",
      fromPort: 8472,
      toPort: 8472,
    },
  ],
  egress: [
    {
      name: "Allowed All Egress",
      cidr: ["0.0.0.0/0"],
      protocol: "any",
      fromPort: -1,
      toPort: -1
    }
  ]
}


// Talos Virtual Machines Installation
const talos_instances = new K8S(`${resourceName}-k8s`, {
  masterNodes: masterNodes,
  workerNodes: workerNodes,
  masterSgRules: masterSgRules,
  workerSgRules: workerSgRules
});

// Talos Configuration
const talos = new Talos(`${resourceName}-talos`, {
  masterNodes: masterNodes,
  workerNodes: workerNodes
}, { dependsOn: talos_instances });

export const talosconfig = talos.talosconfig();
export const kubeconfig = talos.kubeconfig();

// Base Helm Charts Installation
const kubernetesProvider = new kubernetes.Provider("kubernetesProvider", {
  // enableServerSideApply: true,
  kubeconfig: kubeconfig.kubeconfigRaw
});

const waitForTalos = new WaitForTalos("waitForTalos", {
  kubeconfigRaw: kubeconfig.kubeconfigRaw,
}, { dependsOn: [talos] });


const kubeconfigContent = kubeconfig.kubeconfigRaw.apply(content => {
  return content;
});

const kubeconfigFile = kubeconfigContent.apply(content => new pulumi.asset.StringAsset(content));

const stableK8sProvider = new kubernetes.Provider("stableK8sProvider", {
  kubeconfig: kubeconfigContent,
}, { dependsOn: [talos] });

// Установка Cilium Helm чарта (CNI)
const ciliumHelmChart = new kubernetes.helm.v3.Release("ciliumHelmChart", {
  chart: "cilium",
  version: "1.15.6",
  namespace: "kube-system",
  name: "cilium",
  repositoryOpts: {
      repo: "https://helm.cilium.io/",
  },
  values: {
    l2announcements: {
      enabled: true
    },
    cgroup: {
      autoMount: {
        enabled: false
      },
      hostRoot: "/sys/fs/cgroup"
    },
    debug: {
      enabled: false
    },
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
    operator: {
      enabled: true,
      rollOutPods: true
    },
    ipam: {
      mode: "kubernetes"
    },
    securityContext: {
      privileged: true
    },
    hubble: {
      enabled: false
    },
    prometheus: {
      enabled: false,
      serviceMonitor: {
        enabled: false
      }
    }
  }
}, { provider: stableK8sProvider, dependsOn: [waitForTalos] });

// -----------------------------
// Flux GitOps Bootstrap
// -----------------------------

const config = new pulumi.Config();
const fluxGithubToken = config.requireSecret("fluxGithubToken");

const fluxHelmChart = new kubernetes.helm.v3.Release("fluxHelmChart", {
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
}, { provider: stableK8sProvider, dependsOn: [waitForTalos] });

const fluxRepoSecret = new kubernetes.core.v1.Secret("fluxRepoSecret", {
  immutable: true,
  type: "Opaque",
  metadata: {
    name: "flux-github-repo-creds",
    namespace: "flux-system",
    labels: { managedBy: "pulumi" }
  },
  stringData: {
    password: fluxGithubToken,
    username: "Z2l0" // base64 for "git"
  }
}, { provider: stableK8sProvider, dependsOn: [fluxHelmChart] });

const fluxSyncHelmChart = new kubernetes.helm.v3.Release("fluxSyncHelmChart", {
  chart: "flux2-sync",
  version: "1.10.0",
  namespace: "flux-system",
  name: "flux-sync-github",
  repositoryOpts: { repo: "https://fluxcd-community.github.io/helm-charts" },
  values: {
    gitRepository: {
      spec: {
        labels: { managedBy: "pulumi" },
        url: "https://github.com/rassulamangeldi/one-click-openstack-infrastructure.git",
        secretRef: { name: fluxRepoSecret.metadata.name },
        interval: "1m0s",
        timeout: "60s",
        ref: { branch: "master" }
      }
    },
    kustomization: {
      spec: {
        labels: { managedBy: "pulumi" },
        force: false,
        interval: "10m0s",
        path: `./flux`,
        prune: true
      }
    }
  }
}, { provider: stableK8sProvider, dependsOn: [fluxRepoSecret] });


workerNodes.forEach((worker) => {
  const taints = vars.taintsByGroup[worker.group];
  const labels = vars.labelsByGroup[worker.group] || {};

  // Taints
  if (taints && taints.length > 0) {
    new kubernetes.core.v1.NodePatch(
      `${worker.name}-taint-patch`,
      {
        metadata: {
          name: worker.name,
        },
        spec: {
          taints,
        },
      },
      {
        provider: stableK8sProvider, dependsOn: [waitForTalos],
      }
    );
  }

  // Labels
  new kubernetes.core.v1.NodePatch(
    `${worker.name}-label-patch`,
    {
      metadata: {
        name: worker.name,
        labels: labels,
      },
    },
    {
      provider: stableK8sProvider, dependsOn: [waitForTalos],
   }
  );
});


/**
 * Create Internal Load Balancer
 */
// const lbInternalOctavia = new openstack.loadbalancer.LoadBalancer("lb-internal", {
//   name: `${resourceName}-internal`,
//   adminStateUp: true,
//   description: `Internal LB for ${resourceName}`,
//   vipAddress: vars.controlPlaneVip,
//   vipNetworkId: vars.coreNetwork,
//   vipSubnetId: vars.privateSubnet,
//   tags: vars.baseTags
// });

// const listenerHttpInternal = new openstack.loadbalancer.Listener("http-listener-internal", {
//   name: `${resourceName}-http-listener-internal`,
//   loadbalancerId: lbInternalOctavia.id,
//   protocol: "TCP",
//   protocolPort: 80,
//   adminStateUp: true,
//   allowedCidrs: ["0.0.0.0/0"],
//   tags: vars.baseTags
// });

// const listenerHttpsInternal = new openstack.loadbalancer.Listener("https-listener-internal", {
//   name: `${resourceName}-https-listener-internal`,
//   loadbalancerId: lbInternalOctavia.id,
//   protocol: "TCP",
//   protocolPort: 443,
//   adminStateUp: true,
//   allowedCidrs: ["0.0.0.0/0"],
//   tags: vars.baseTags
// });

// const listenerPsqlInternal = new openstack.loadbalancer.Listener("psql-listener-internal", {
//   name: `${resourceName}-psql-listener-internal`,
//   loadbalancerId: lbInternalOctavia.id,
//   protocol: "TCP",
//   protocolPort: 5432,
//   adminStateUp: true,
//   allowedCidrs: ["0.0.0.0/0"],
//   tags: vars.baseTags
// });

// const pool80Internal = new openstack.loadbalancer.Pool("http-pool-internal", {
//   name: "http-pool-internal",
//   listenerId: listenerHttpInternal.id,
//   protocol: "TCP",
//   lbMethod: "ROUND_ROBIN",
//   adminStateUp: true,
// });

// const pool443Internal = new openstack.loadbalancer.Pool("https-pool-internal", {
//   name: "https-pool-internal",
//   listenerId: listenerHttpsInternal.id,
//   protocol: "TCP",
//   lbMethod: "ROUND_ROBIN",
//   adminStateUp: true,
// });

// const pool5432Internal = new openstack.loadbalancer.Pool("psql-pool-internal", {
//   name: "psql-pool-internal",
//   listenerId: listenerPsqlInternal.id,
//   protocol: "TCP",
//   lbMethod: "ROUND_ROBIN",
//   adminStateUp: true,
// });

// const httpMembersInternal = new openstack.loadbalancer.Members("http-members-internal", {
//   poolId: pool80Internal.id,
//   members: workerNodes.map(node => {
//     return {
//       address: node.privateIp,
//       protocolPort: 31080,
//       subnetId: vars.privateSubnet,
//       adminStateUp: true,
//     }
//   })
// });

// const httpsMembersInternal = new openstack.loadbalancer.Members("https-members-internal", {
//   poolId: pool443Internal.id,
//   members: workerNodes.map(node => {
//     return {
//       address: node.privateIp,
//       protocolPort: 31443,
//       subnetId: vars.privateSubnet,
//       adminStateUp: true,
//     }
//   })
// });

// const psqlMembersInternal = new openstack.loadbalancer.Members("psql-members-internal", {
//   poolId: pool5432Internal.id,
//   members: workerNodes.map(node => {
//     return {
//       address: node.privateIp,
//       protocolPort: 31432,
//       subnetId: vars.privateSubnet,
//       adminStateUp: true,
//     }
//   })
// });
