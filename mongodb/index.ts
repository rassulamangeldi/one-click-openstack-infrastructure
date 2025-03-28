import * as pulumi from "@pulumi/pulumi";
import * as openstack from "@pulumi/openstack";

const config = new pulumi.Config();
const network = config.requireSecret("networkId");
const privateSubnet = config.requireSecret("privateSubnetId");
const coreNetwork = config.requireSecret("coreNetwork");
const databaseSubnet = config.requireSecret("databaseSubnet");

const env = "test";
const project = "mycar";
const app = "mongodb";
const resourceName = `${env}-${project}-${app}`;

const baseTags = [
    project,
    "ManagedByPulumi",
];

// Cloud-init configuration for initial setup
const userData = `#cloud-config
users:
    - name: mycar
      lock_passwd: false
      shell: /bin/bash
      passwd: $6$rounds=4096$/leE0G5uziQ19nF7$2nZX2q7HJ8MB443UiVUPV5YlRXd6SSppEATUMPlGfn7Rog4u0De3icwyskjl/k0HdNK4x7gGoqSnQGGTjBKtC/
      sudo: ['ALL=(ALL) NOPASSWD:ALL']
      ssh_authorized_keys:
         - "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC1bS0S7A/ttdbyFDq8vmRybNPNp9UQ/zyH5oUS6N2FYhQMJ12+MNhWli2OL/NI2Gxz+G29Gn8Inyzy5PuZlQFu95bMbYtKx/yTGi+rVGoxxET+WDLcNz7Pr+jCerwQox4SJk7xuKsjt73cnSc3ZoAy4HxudKgCdsm3/D9xmvNiaxfmKl+BmhKvuJdr2LuSXldhh0VDhlGDOw8kDl+8tkeszdR7rtdUmFsDiB517f2kcQDcMK0hwMyGS/ck1D+fBcuYmLXWH3EhRe1S5rjc6aE5Fyx9jEb+zkh/f41StiL9YvsVG36SlZOiiXPsxxLH82j5k6d3VSUFW5BEJh+IiVmUdHmOkPVCDp2aCgv1sa/vWb24yO9xEnpye8LtXBdPaP+rqM5g1b3b2tWOzOa8WY3WmBE1fdIGLISuNXKm6nkHRk/6Rq2zxmro8ONcOKpso5Eo/hkJHkDhr4lPmS/g+rUQ6PgrIb36eXaBD3GMQvisnf+yNNdk6Vc2J+Jxh2oSQJsGI6lqhu16R5uot2BPS32tMl/UrEgi7UQDnfXETXMNqdhz+BGWMcCKEwDin48LPreMyzJl+NZEGQMK6tINzVMzLOGgHa9vRgEoYWrtg5hZzNbPU3cU7udPTuSuH2mSCvIDptcLw2K8CEGBFDUjlRTyOQp53odVfl//NJjk/HqKDw=="
    - name: root
      shell: /bin/bash
      passwd: $6$rounds=4096$/leE0G5uziQ19nF7$2nZX2q7HJ8MB443UiVUPV5YlRXd6SSppEATUMPlGfn7Rog4u0De3icwyskjl/k0HdNK4x7gGoqSnQGGTjBKtC/
      lock_passwd: false

repo_update: true
repo_upgrade: all
`;

const sshKeyName = "stage-mycar";
const imageId = "dc476378-fc5b-48b1-a3c3-6f8828754f94"; // Ubuntu 22.04

const mongoNodes = [
    {
        Name: `${resourceName}-1`,
        private_ip: "10.129.2.77",
        key: sshKeyName,
        image: imageId,
        flavor: "d1.ram4cpu2",
        volume_root: 10,
        volume_type: "ceph-ssd",
    },
    {
        Name: `${resourceName}-2`,
        private_ip: "10.129.2.78",
        key: sshKeyName,
        image: imageId,
        flavor: "d1.ram4cpu2",
        volume_root: 10,
        volume_type: "ceph-ssd",
    },
    {
        Name: `${resourceName}-3`,
        private_ip: "10.129.2.79",
        key: sshKeyName,
        image: imageId,
        flavor: "d1.ram4cpu2",
        volume_root: 10,
        volume_type: "ceph-ssd",
    },
];

const mongoSgRules = {
    ingress: [
        {
            name: "SSH ingress",
            cidr: ["10.80.21.0/24", "10.80.22.0/24", "10.80.23.0/24", "10.80.20.5/32", "10.129.1.0/24"],
            protocol: "tcp",
            from_port: 22,
            to_port: 22,
        },
        {
            name: "mongodb ports",
            cidr: ["10.80.21.0/24", "10.80.22.0/24", "10.80.23.0/24", "10.80.20.5/32", "10.129.1.0/24","10.129.2.0/24"],
            protocol: "tcp",
            from_port: 27017,
            to_port: 27017,
        },
    ],
    egress: [
        {
            name: "ALL egress",
            cidr: ["0.0.0.0/0"],
            protocol: "any",
            from_port: -1,
            to_port: -1,
        }
    ],
};


// Create security groups
const mongoSecurityGroup = new openstack.networking.SecGroup(resourceName, {
    description: "Stage Mycar MongoDB SG",
    deleteDefaultRules: true,
    tags: baseTags,
});


// Create security group rules
Object.entries(mongoSgRules).forEach(([direction, rules]) => {
    rules.forEach(rule => {
        rule.cidr.forEach((cidr, index) => {
            const text = `${resourceName}-${rule.name.replace(" ", "-")}-${index + 1}`;
            new openstack.networking.SecGroupRule(text, {
                description: text,
                ethertype: "IPv4",
                direction,
                portRangeMin: rule.from_port !== -1 ? rule.from_port : undefined,
                portRangeMax: rule.to_port !== -1 ? rule.to_port : undefined,
                protocol: rule.protocol !== "any" ? rule.protocol : undefined,
                remoteIpPrefix: cidr,
                securityGroupId: mongoSecurityGroup.id,
            });
        });
    });
});


// Create instances and volumes
mongoNodes.forEach(vm => {
    const port = new openstack.networking.Port(vm.Name, {
        name: vm.Name,
        adminStateUp: true,
        fixedIps: [{
            ipAddress: vm.private_ip,
            subnetId: databaseSubnet,
        }],
        networkId: coreNetwork,
        securityGroupIds: [mongoSecurityGroup.id],
        tags: baseTags,
    });

    const node = new openstack.compute.Instance(vm.Name, {
        name: vm.Name,
        keyPair: vm.key,
        flavorName: vm.flavor,
        userData,
        networks: [{
            port: port.id,
        }],
        blockDevices: [{
            uuid: vm.image,
            sourceType: "image",
            volumeSize: vm.volume_root,
            destinationType: "volume",
            volumeType: vm.volume_type,
            deleteOnTermination: true,
        }],
        tags: baseTags,
    });
});