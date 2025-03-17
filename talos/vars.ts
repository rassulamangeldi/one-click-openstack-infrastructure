
export const baseVars        = { env: "dev", project: "mara", app: "talos-test" };
export const resourceName    = `${baseVars.env}-${baseVars.project}-${baseVars.app}`;

export const talosImage = "d29e279e-a72d-4e24-95c5-0c567ed667fe";

export const clusterName     = resourceName;
export const controlPlaneVip = "10.128.10.221";
export const clusterEndpoint = `https://${controlPlaneVip}:6443`;

export const talosDefaultTemplate = `
machine:
  certSANs: []
  kubelet:
    defaultRuntimeSeccompProfileEnabled: true
    disableManifestsDirectory: true

  network:
    nameservers: ["1.1.1.1", "8.8.8.8"]
    disableSearchDomain: true

  install:
    disk: "/dev/vda"
    image: "ghcr.io/siderolabs/installer:v1.7.4"
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
  extraManifests: []
  allowSchedulingOnControlPlanes: true
`;

export const talosMasterTemplate = `
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
    - deviceSelector:
        physical: true
      dhcp: true

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