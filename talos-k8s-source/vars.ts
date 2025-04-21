import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import exp = require("constants");

/**
 * Base Variables
 */
export const env = "test"
export const project = "devoopsdays"
export const app = "talos"
export const baseTags = [project, "ManagedByPulumi"]


/**
 * Openstack Network Variables
 */

const config = new pulumi.Config();
export const network = config.requireSecret("networkId");
export const privateSubnet = config.requireSecret("privateSubnetId");
export const coreNetwork = config.requireSecret("coreNetwork");
export const databaseSubnet = config.requireSecret("databaseSubnet");


export const controlPlaneVip = "10.129.1.109"
export const controlPlanePort = "6443"


/**
 * Openstack Instance Variables
 */
export const talosImage = "98e15242-321d-4dbe-b3fd-4220723c1404"

export const flavorMaster = "d1.ram4cpu2"
export const flavorWorker = "d1.ram4cpu2"
export const flavorWorkerSystem = "d1.ram4cpu2"
export const flavorWorkerInfra = "d1.ram4cpu2"

export const volumeSizeWorker = 50
export const volumeSizeWorkerSystem = 50
export const volumeSizeWorkerInfra = 20
export const volumeSizeMaster = 30

export const defaultVolumeType = "ceph-ssd"


/**
 * Kubernetes Variables
 */
export const taintsByGroup: Record<string, k8s.types.input.core.v1.Taint[]> = {
  app: [],
  system: [
    {
      key: "role",
      value: "monitoring",
      effect: "NoSchedule",
    },
  ],
  infra: [
    {
      key: "role",
      value: "infra",
      effect: "NoSchedule",
    },
  ],
};

export const labelsByGroup: Record<string, { [key: string]: string }> = {
  app: {
    "node-role.kubernetes.io/app": "app",
    "role": "app",
  },
  system: {
    "node-role.kubernetes.io/monitoring": "monitoring",
    "role": "monitoring",
  },
  infra: {
    "node-role.kubernetes.io/infra": "infra",
    "role": "infra"
  },
};


/**
 * Talos Variables
 */
export const talosVersion = "v1.8.4"
export const kubernetesVersion = "1.30.1"
export const clusterName = `${env}-${project}`
export const clusterEndpoint = `https://${controlPlaneVip}:${controlPlanePort}`
const machineInstallDiskdevice = "/stage/vda"
const machineInstallImage = "ghcr.io/siderolabs/installer:v1.8.4"
const certApproverManifest = "https://raw.githubusercontent.com/alex1989hu/kubelet-serving-cert-approver/v0.8.4/deploy/standalone-install.yaml"

// Default Talos Template
export var defaultConfigTemplate = `
machine:
  certSANs: []
  kubelet:
    extraArgs:
      rotate-server-certificates: true
    defaultRuntimeSeccompProfileEnabled: true
    disableManifestsDirectory: true

  network:
    nameservers: ["1.1.1.1", "8.8.8.8"]
    disableSearchDomain: true

  install:
    disk: ${machineInstallDiskdevice}
    image: ${machineInstallImage}
    wipe: false

  time:
    disabled: false

  sysctls:
    fs.inotify.max_queued_events: "65536"
    fs.inotify.max_user_watches: "524288"
    net.core.rmem_max: "2500000"
    net.core.wmem_max: "2500000"

  features:
    rbac: true
    stableHostname: true
    apidCheckExtKeyUsage: true
    diskQuotaSupport: true
    kubePrism:
      enabled: true
      port: 7445

cluster:
  controlPlane:
    endpoint: ${clusterEndpoint}
  clusterName: ${clusterName}
  network:
    cni:
      name: none
    dnsDomain: cluster.local
  proxy:
    disabled: true
  discovery:
    enabled: true
    registries:
      kubernetes:
        disabled: false
      service:
        disabled: true
  extraManifests: [${certApproverManifest}]
  allowSchedulingOnControlPlanes: false
`;

// Control Plane Talos Template
export var masterConfigTemplate = `
machine:

  features:
    kubernetesTalosAPIAccess:
      enabled: true
      allowedRoles:
        - os:admin
      allowedKubernetesNamespaces:
        - system-upgrade

  network:
    interfaces:
    - interface: eth0
      dhcp: true
      vip:
        ip: ${controlPlaneVip}

cluster:

  apiServer:
    certSANs:
      - ${clusterEndpoint}
    disablePodSecurityPolicy: true
    auditPolicy:
      apiVersion: audit.k8s.io/v1
      kind: Policy
      rules:
        - level: Metadata
    extraArgs:
      oidc-issuer-url: "https://login.microsoftonline.com/f3e5de36-65f8-4044-9114-f7029c2e8ab0/v2.0"
      oidc-client-id: "67f2e618-7018-44e9-9eee-afa21e4a884d"
      oidc-username-claim: "email"
      oidc-groups-claim: "groups"
  controllerManager:
    extraArgs:
      bind-address: 0.0.0.0
      terminated-pod-gc-threshold: 1000

  scheduler:
    extraArgs:
      bind-address: 0.0.0.0

  etcd:
    extraArgs:
      listen-metrics-urls: http://0.0.0.0:2381
`;

// Worker Talos Template
export var workerConfigTemplate = ``;

// Talos Additional Patches
export const containerdPatch = `
machine:
  files:
    - op: create
      path: /etc/cri/conf.d/20-customization.part
      content: |-
        [plugins."io.containerd.grpc.v1.cri"]
          enable_unprivileged_ports = true
          enable_unprivileged_icmp = true
        [plugins."io.containerd.grpc.v1.cri".containerd]
          discard_unpacked_layers = false
        [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
          discard_unpacked_layers = false
`;

export const disableAdmissionControlPatch = `
- op: remove
  path: /cluster/apiServer/admissionControl
`;
