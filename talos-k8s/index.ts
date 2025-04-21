import * as openstackInstance from "@okassov/pulumi-openstack-instance";
import * as talos from "@okassov/pulumi-talos-linux"
import * as pulumi from "@pulumi/pulumi";
import * as vars from "./vars"
// import * as kubernetes from "./k8s"
import { K8S } from "./k8s";

const masterNodes = [
    { name: `${vars.resourceName}-01-master-01`, ip: "10.129.1.221" },
    { name: `${vars.resourceName}-01-master-02`, ip: "10.129.1.222" },
    { name: `${vars.resourceName}-01-master-03`, ip: "10.129.1.223" }
];

const workerNodes = [
    { name: `${vars.resourceName}-02-worker-01`, ip: "10.129.1.224" },
    { name: `${vars.resourceName}-02-worker-02`, ip: "10.129.1.225" },
    { name: `${vars.resourceName}-02-worker-03`, ip: "10.129.1.226" }
];

const infraNodes = [
    { name: `${vars.resourceName}-03-infra-01`, ip: "10.129.1.227" },
    { name: `${vars.resourceName}-03-infra-02`, ip: "10.129.1.228" },
    { name: `${vars.resourceName}-03-infra-03`, ip: "10.129.1.229" }
];

const systemNodes = [
    { name: `${vars.resourceName}-04-system-01`, ip: "10.129.1.230" },
    { name: `${vars.resourceName}-04-system-02`, ip: "10.129.1.231" },
    { name: `${vars.resourceName}-04-system-03`, ip: "10.129.1.232" }
];

const config = new pulumi.Config();
const network = config.requireSecret("networkId");
const privateSubnet = config.requireSecret("privateSubnetId");
const coreNetwork = config.requireSecret("coreNetwork");
const databaseSubnet = config.requireSecret("databaseSubnet");

function createMasterPortConfig(ipAddress: string): any {
    return {
        networkId: network,
        adminStateUp: true,
        securityGroupIds: [masterSecGroup.secGroup.id],
        fixedIps: [{ subnetId: privateSubnet, ipAddress }],
        allowedAddressPairs: [{ ipAddress: vars.controlPlaneVip }]
    };
};

function createWorkerPortConfig(ipAddress: string): any {
    return {
        networkId: network,
        adminStateUp: true,
        securityGroupIds: [workerSecGroup.secGroup.id],
        fixedIps: [{ subnetId: privateSubnet, ipAddress }]
    };
};

const masterSecGroup = new openstackInstance.SecGroup(
    `${vars.resourceName}-talosMasterSg`, {
        name: `${vars.resourceName}-talosMasterSg`,
        allowSelfIPv4: true,
        allowEgressAllIPv4: true,
        rules: {
            ingress: [
                {
                    protocol: "tcp",
                    port: 6443,
                    remoteIpPrefix: ["0.0.0.0/0"]
                },
                {
                    protocol: "tcp",
                    port: 50000,
                    remoteIpPrefix: ["0.0.0.0/0"]
                },
            ]
        }
});

const workerSecGroup = new openstackInstance.SecGroup(
    `${vars.resourceName}-talosWorkerSg`, {
        name: `${vars.resourceName}-talosWorkerSg`,
        allowSelfIPv4: true,
        allowEgressAllIPv4: true,
        rules: {
            ingress: [
                {
                    protocol: "tcp",
                    portRangeMin: 30000,
                    portRangeMax: 32767,
                    remoteIpPrefix: ["0.0.0.0/0"]
                },
                {
                    protocol: "tcp",
                    port: 50000,
                    remoteIpPrefix: ["0.0.0.0/0"]
                },
            ]
        }
});

const talosMasterInstances = new openstackInstance.Instance(
    `${vars.resourceName}-talosMasterInstances`, {
        sharedConfig: {
            flavorName: "d1.ram4cpu2",
            blockDevices: [{ 
                uuid: vars.talosImage, 
                sourceType: "image", 
                volumeSize: 20, 
                destinationType: "volume", 
                volumeType: "ceph-ssd", 
                deleteOnTermination: true 
            }]
        },
        instanceConfig: masterNodes.map(node => ({
            name: node.name,
            portConfig: [createMasterPortConfig(node.ip)]
        }))
});

const talosWorkerInstances = new openstackInstance.Instance(
    `${vars.resourceName}-talosWorkerInstances`, {
        sharedConfig: {
            flavorName: "d1.ram4cpu2",
            blockDevices: [{ 
                uuid: vars.talosImage, 
                sourceType: "image", 
                volumeSize: 20, 
                destinationType: "volume", 
                volumeType: "ceph-ssd", 
                deleteOnTermination: true 
            }]
        },
        instanceConfig: workerNodes.map(node => ({
            name: node.name,
            portConfig: [createWorkerPortConfig(node.ip)]
        }))
});

const talosSystemInstances = new openstackInstance.Instance(
    `${vars.resourceName}-talosSystemInstances`, {
        sharedConfig: {
            flavorName: "d1.ram4cpu2",
            blockDevices: [{ 
                uuid: vars.talosImage, 
                sourceType: "image", 
                volumeSize: 20, 
                destinationType: "volume", 
                volumeType: "ceph-ssd", 
                deleteOnTermination: true 
            }]
        },
        instanceConfig: systemNodes.map(node => ({
            name: node.name,
            portConfig: [createWorkerPortConfig(node.ip)]
        }))
});

const talosInfraInstances = new openstackInstance.Instance(
    `${vars.resourceName}-talosInfraInstances`, {
        sharedConfig: {
            flavorName: "d1.ram4cpu2",
            blockDevices: [{ 
                uuid: vars.talosImage, 
                sourceType: "image", 
                volumeSize: 20, 
                destinationType: "volume", 
                volumeType: "ceph-ssd", 
                deleteOnTermination: true 
            }]
        },
        instanceConfig: infraNodes.map(node => ({
            name: node.name,
            portConfig: [createWorkerPortConfig(node.ip)]
        }))
});

const allWorkerNodes = [
    ...workerNodes,
    ...infraNodes,
    ...systemNodes
];

const talosCluster = new talos.Talos(`${vars.resourceName}-talosCluster`, {
    sharedConfig: {
        clusterName: vars.clusterName,
        clusterEndpoint: vars.clusterEndpoint,
        boostrapTimeout: "300s"
    },
    master: {
        config: {
            talosVersion: "v1.7.4",
            kubernetesVersion: "1.30.1",
            baseTemplate: [vars.talosDefaultTemplate],
            patches: [
                vars.talosMasterTemplate, 
                vars.disableAdmissionControlPatch, 
                vars.containerdPatch
            ]
        },
        nodes: masterNodes.map(node => node.ip)
    },
    worker: {
        config: {
            talosVersion: "v1.7.4",
            kubernetesVersion: "1.30.1",
            baseTemplate: [vars.talosDefaultTemplate],
            patches: [vars.containerdPatch]
        },
        nodes: allWorkerNodes.map(node => node.ip)
    },
}, { dependsOn: [talosMasterInstances] });

export const talosMasters = talosMasterInstances.createdPorts.map(port => port.allFixedIps[0]);
export const talosWorkers = talosWorkerInstances.createdPorts.map(port => port.allFixedIps[0]);
export const talosSystem = talosSystemInstances.createdPorts.map(port => port.allFixedIps[0]);
export const talosInfra = talosInfraInstances.createdPorts.map(port => port.allFixedIps[0]);
export const talosconfig  = talosCluster.talosconfig();
export const kubeconfig   = talosCluster.kubeconfig();

const kubernetesBoostrap = new K8S("kubernetesBoostrap", {
    providerConfig: {
        kubeconfig: kubeconfig.kubeconfigRaw,
        enableServerSideApply: true
    },
    fluxInfraCustomEnvs: {
        env: vars.baseVars.env,
        cluster_name: vars.resourceName,
        cluster_type: "talos"
    }
});