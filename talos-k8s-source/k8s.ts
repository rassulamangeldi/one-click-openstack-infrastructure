import * as pulumi from "@pulumi/pulumi";
import * as openstack from "@pulumi/openstack";
import * as vars from "./vars";

export interface K8SArgs {
    masterNodes: pulumi.Input<any>;
    workerNodes: pulumi.Input<any>;
    masterSgRules: pulumi.Input<any>;
    workerSgRules: pulumi.Input<any>;
};

export class K8S extends pulumi.ComponentResource {

    resourceName: string;
    masterInstanceResources: openstack.compute.Instance[];
    workerInstanceResources: openstack.compute.Instance[];

    masterSecurityGroup: openstack.networking.SecGroup;
    workerSecurityGroup: openstack.networking.SecGroup;

    masterPort: openstack.networking.Port | undefined;
    masterInstance: openstack.compute.Instance | undefined;

    workerPort: openstack.networking.Port | undefined;
    workerInstance: openstack.compute.Instance | undefined;

    public masterInstances(): pulumi.Output<openstack.compute.Instance[]> {
        return pulumi.output(this.masterInstanceResources);
    }

    public workerInstances(): pulumi.Output<openstack.compute.Instance[]> {
        return pulumi.output(this.workerInstanceResources);
    }

    constructor(name: string, args: K8SArgs, opts?: pulumi.ComponentResourceOptions) {
        super("k8s", name, {}, opts);

        this.resourceName = `${vars.env}-${vars.project}-${vars.app}`;

        // Create Master Security Group and Rules
        this.masterSecurityGroup = new openstack.networking.SecGroup(`${this.resourceName}-masterSecurityGroup`, {
            description: `SG for Talos Master Nodes - ${this.resourceName}`,
            deleteDefaultRules: true,
            tags: vars.baseTags
        }, { parent: this });

        for (var rule of args.masterSgRules.ingress) {

            let i = 0;
            for (var cidr of rule.cidr) {
                new openstack.networking.SecGroupRule(
                    `${this.resourceName}-master-${rule.name.replace(/ /g, "-")}-${i+1}`, {
                        securityGroupId: this.masterSecurityGroup.id,
                        description: `${this.resourceName}-${rule.name.replace(" ", "-")}-${i+1}`,
                        direction: "ingress",
                        ethertype: "IPv4",
                        portRangeMin: rule.fromPort !== -1 ? rule.fromPort : undefined,
                        portRangeMax: rule.toPort !== -1 ? rule.toPort : undefined,
                        protocol: rule["protocol"] !== "any" ? rule["protocol"] : undefined,
                        remoteIpPrefix: cidr
                    }, { parent: this }
                );
                i++;
            }
        }
        
        for (var rule of args.masterSgRules.egress) {
        
          let i = 0;
          for (var cidr of rule.cidr) {
              new openstack.networking.SecGroupRule(
                  `${this.resourceName}-master-${rule.name.replace(/ /g, "-")}-${i+1}`, {
                      securityGroupId: this.masterSecurityGroup.id,
                      description: `${this.resourceName}-${rule.name.replace(" ", "-")}-${i+1}`,
                      direction: "egress",
                      ethertype: "IPv4",
                      portRangeMin: rule.fromPort !== -1 ? rule.fromPort : undefined,
                      portRangeMax: rule.toPort !== -1 ? rule.toPort : undefined,
                      protocol: rule["protocol"] !== "any" ? rule["protocol"] : undefined,
                      remoteIpPrefix: cidr
                  }, { parent: this }
              );
              i++;
          }
        }

        // Create Worker Security Group and Rules
        this.workerSecurityGroup = new openstack.networking.SecGroup(`${this.resourceName}-workerSecurityGroup`, {
            description: `SG for Talos Worker Nodes - ${this.resourceName}`,
            deleteDefaultRules: true,
            tags: vars.baseTags
        }, { parent: this });

        for (var rule of args.workerSgRules.ingress) {
        
            let i = 0;
            for (var cidr of rule.cidr) {
                new openstack.networking.SecGroupRule(
                    `${this.resourceName}-worker-${rule.name.replace(/ /g, "-")}-${i+1}`, {
                        securityGroupId: this.workerSecurityGroup.id,
                        description: `${this.resourceName}-${rule.name.replace(" ", "-")}-${i+1}`,
                        direction: "ingress",
                        ethertype: "IPv4",
                        portRangeMin: rule.fromPort !== -1 ? rule.fromPort : undefined,
                        portRangeMax: rule.toPort !== -1 ? rule.toPort : undefined,
                        protocol: rule["protocol"] !== "any" ? rule["protocol"] : undefined,
                        remoteIpPrefix: cidr
                    }, { parent: this }
                );
                i++;
            }
        }
        
        for (var rule of args.workerSgRules.egress) {
        
          let i = 0;
          for (var cidr of rule.cidr) {
              new openstack.networking.SecGroupRule(
                  `${this.resourceName}-worker-${rule.name.replace(/ /g, "-")}-${i+1}`, {
                      securityGroupId: this.workerSecurityGroup.id,
                      description: `${this.resourceName}-${rule.name.replace(" ", "-")}-${i+1}`,
                      direction: "egress",
                      ethertype: "IPv4",
                      portRangeMin: rule.fromPort !== -1 ? rule.fromPort : undefined,
                      portRangeMax: rule.toPort !== -1 ? rule.toPort : undefined,
                      protocol: rule["protocol"] !== "any" ? rule["protocol"] : undefined,
                      remoteIpPrefix: cidr
                  }, { parent: this }
              );
              i++;
          }
        }

        // Create Master Instances
        this.masterInstanceResources = [];
        for (var node of args.masterNodes) {
        
            this.masterPort = new openstack.networking.Port(node.name, {
                name: node.name,
                adminStateUp: true,
                networkId: vars.coreNetwork,
                fixedIps: [{ subnetId: vars.privateSubnet, ipAddress: node.privateIp }],
                securityGroupIds: [this.masterSecurityGroup.id],
                allowedAddressPairs: [{ ipAddress: vars.controlPlaneVip }],
                tags: vars.baseTags
            }, { parent: this });
        
            this.masterInstance = new openstack.compute.Instance(node.name, {
                name: node.name,
                flavorName: node.flavor,
                networks: [{ port: this.masterPort.id }],
                blockDevices: [
                    {
                        uuid: node.image,
                        sourceType: "image",
                        volumeSize: node.volumeRoot,
                        volumeType: node.volumeType,
                        destinationType: "volume",
                        deleteOnTermination: true
                    }
                ],
                tags: vars.baseTags
            }, { parent: this });
            this.masterInstanceResources.push(this.masterInstance);
        };

        // Create Worker Instances
        this.workerInstanceResources = [];
        for (var node of args.workerNodes) {
        
            this.workerPort = new openstack.networking.Port(node.name, {
                name: node.name,
                adminStateUp: true,
                networkId: vars.coreNetwork,
                fixedIps: [{ subnetId: vars.privateSubnet, ipAddress: node.privateIp }],
                securityGroupIds: [this.workerSecurityGroup.id],
                allowedAddressPairs: [
                    { ipAddress: vars.controlPlaneVip }
                ],
                tags: vars.baseTags
            }, { parent: this });
        
            this.workerInstance = new openstack.compute.Instance(node.name, {
                name: node.name,
                flavorName: node.flavor,
                networks: [{ port: this.workerPort.id }],
                blockDevices: [
                    {
                        uuid: node.image,
                        sourceType: "image",
                        volumeSize: node.volumeRoot,
                        volumeType: node.volumeType,
                        destinationType: "volume",
                        deleteOnTermination: true
                    }
                ],
                tags: vars.baseTags
            }, { parent: this });
            this.workerInstanceResources.push(this.workerInstance);
        };


    }
}
