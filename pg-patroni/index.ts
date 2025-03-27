import * as pulumi from "@pulumi/pulumi";
import * as openstack from "@pulumi/openstack";
import * as postgresql from "@pulumi/postgresql";
import { dbs } from "./dbs";

const config = new pulumi.Config();
const network = config.requireSecret("networkId");
const privateSubnet = config.requireSecret("privateSubnetId");
const coreNetwork = config.requireSecret("coreNetwork");
const databaseSubnet = config.requireSecret("databaseSubnet");

const env = "test";
const project = "devopsdays";
const app = "pg";
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
      passwd: $6$rounds=4096$/leE0G5uziQ19nF7$2nZX2q7HJ8MB443UiVUPV5YlRXd6SSppEATUMPlGfn7Rog4u0De3icwyskjl/k0HdNK4x7gGoqSnQGGTjBKtC/ #test
      sudo: ['ALL=(ALL) NOPASSWD:ALL']
      ssh_authorized_keys:
         - "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC1bS0S7A/ttdbyFDq8vmRybNPNp9UQ/zyH5oUS6N2FYhQMJ12+MNhWli2OL/NI2Gxz+G29Gn8Inyzy5PuZlQFu95bMbYtKx/yTGi+rVGoxxET+WDLcNz7Pr+jCerwQox4SJk7xuKsjt73cnSc3ZoAy4HxudKgCdsm3/D9xmvNiaxfmKl+BmhKvuJdr2LuSXldhh0VDhlGDOw8kDl+8tkeszdR7rtdUmFsDiB517f2kcQDcMK0hwMyGS/ck1D+fBcuYmLXWH3EhRe1S5rjc6aE5Fyx9jEb+zkh/f41StiL9YvsVG36SlZOiiXPsxxLH82j5k6d3VSUFW5BEJh+IiVmUdHmOkPVCDp2aCgv1sa/vWb24yO9xEnpye8LtXBdPaP+rqM5g1b3b2tWOzOa8WY3WmBE1fdIGLISuNXKm6nkHRk/6Rq2zxmro8ONcOKpso5Eo/hkJHkDhr4lPmS/g+rUQ6PgrIb36eXaBD3GMQvisnf+yNNdk6Vc2J+Jxh2oSQJsGI6lqhu16R5uot2BPS32tMl/UrEgi7UQDnfXETXMNqdhz+BGWMcCKEwDin48LPreMyzJl+NZEGQMK6tINzVMzLOGgHa9vRgEoYWrtg5hZzNbPU3cU7udPTuSuH2mSCvIDptcLw2K8CEGBFDUjlRTyOQp53odVfl//NJjk/HqKDw=="
    - name: root
      shell: /bin/bash
      passwd: $6$rounds=4096$/leE0G5uziQ19nF7$2nZX2q7HJ8MB443UiVUPV5YlRXd6SSppEATUMPlGfn7Rog4u0De3icwyskjl/k0HdNK4x7gGoqSnQGGTjBKtC/ #test
      lock_passwd: false

repo_update: true
repo_upgrade: all
`;

const sshKeyName = "stage-mycar-ps";
const imageId = "2a35ff85-34ac-481f-8c2e-77a39429a7b9"; // Ubuntu 24.04
const vip = "10.129.2.70/32";

const postgresqlIps = [
    "10.129.2.71/32",
    "10.129.2.72/32",
    "10.129.2.73/32",
];

const etcdIps = [
    "10.129.2.74/32",
    "10.129.2.75/32",
    "10.129.2.76/32",
];

const pgNodes = [
    {
        Name: `${resourceName}-1`,
        private_ip: "10.129.2.71",
        key: sshKeyName,
        image: imageId,
        flavor: "d1.ram4cpu2",
        volume_root: 10,
        volume_type: "ceph-ssd",
        data_volume_size: 10,
        data_volume_type: "ceph-ssd",
    },
    {
        Name: `${resourceName}-2`,
        private_ip: "10.129.2.72",
        key: sshKeyName,
        image: imageId,
        flavor: "d1.ram4cpu2",
        volume_root: 10,
        volume_type: "ceph-ssd",
        data_volume_size: 10,
        data_volume_type: "ceph-ssd",
    },
    {
        Name: `${resourceName}-3`,
        private_ip: "10.129.2.73",
        key: sshKeyName,
        image: imageId,
        flavor: "d1.ram4cpu2",
        volume_root: 10,
        volume_type: "ceph-ssd",
        data_volume_size: 10,
        data_volume_type: "ceph-ssd",
    },
];

const etcdNodes = [
    {
        Name: `${resourceName}-etcd-1`,
        private_ip: "10.129.2.74",
        key: sshKeyName,
        image: imageId,
        flavor: "d1.ram4cpu2",
        volume_root: 10,
        volume_type: "ceph-ssd",
        data_volume_size: 10,
        data_volume_type: "ceph-ssd",
    },
    {
        Name: `${resourceName}-etcd-2`,
        private_ip: "10.129.2.75",
        key: sshKeyName,
        image: imageId,
        flavor: "d1.ram4cpu2",
        volume_root: 10,
        volume_type: "ceph-ssd",
        data_volume_size: 10,
        data_volume_type: "ceph-ssd",
    },
    {
        Name: `${resourceName}-etcd-3`,
        private_ip: "10.129.2.76",
        key: sshKeyName,
        image: imageId,
        flavor: "d1.ram4cpu2",
        volume_root: 10,
        volume_type: "ceph-ssd",
        data_volume_size: 10,
        data_volume_type: "ceph-ssd",
    },
];

const pgSgRules = {
    ingress: [
        {
            name: "SSH ingress",
            cidr: ["10.80.21.0/24", "10.80.22.0/24", "10.80.23.0/24", "10.80.20.5/32", "10.129.2.0/24", "10.129.1.0/24"],
            protocol: "tcp",
            from_port: 22,
            to_port: 22,
        },
        {
            name: "self true tcp",
            cidr: postgresqlIps,
            protocol: "tcp",
            from_port: -1,
            to_port: -1,
        },
        {
            name: "self true udp",
            cidr: postgresqlIps,
            protocol: "udp",
            from_port: -1,
            to_port: -1,
        },
        {
            name: "self true any",
            cidr: postgresqlIps,
            protocol: "any",
            from_port: -1,
            to_port: -1,
        },
        {
            name: "ingress WRITE-endpoint",
            cidr: ["0.0.0.0/0"],
            protocol: "tcp",
            from_port: 15432,
            to_port: 15432,
        },
        {
            name: "ingress READ-endpoint",
            cidr: ["0.0.0.0/0"],
            protocol: "tcp",
            from_port: 25432,
            to_port: 25432,
        },
        {
            name: "ingress Patroni metrics",
            cidr: ["0.0.0.0/0"],
            protocol: "tcp",
            from_port: 8008,
            to_port: 8008,
        },
        {
            name: "ingress pgbouncer port",
            cidr: ["0.0.0.0/0"],
            protocol: "tcp",
            from_port: 6432,
            to_port: 6432,
        },
        {
            name: "ingress WRITE-endpoint postgres direct",
            cidr: ["0.0.0.0/0"],
            protocol: "tcp",
            from_port: 35432,
            to_port: 35432,
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

const etcdSgRules = {
    ingress: [
        {
            name: "SSH ingress",
            cidr: ["10.80.21.0/24", "10.80.22.0/24", "10.80.23.0/24", "10.80.20.5/32", "10.129.1.0/24"],
            protocol: "tcp",
            from_port: 22,
            to_port: 22,
        },
        {
            name: "self true tcp",
            cidr: etcdIps,
            protocol: "tcp",
            from_port: -1,
            to_port: -1,
        },
        {
            name: "self true udp",
            cidr: etcdIps,
            protocol: "udp",
            from_port: -1,
            to_port: -1,
        },
        {
            name: "self true any",
            cidr: etcdIps,
            protocol: "any",
            from_port: -1,
            to_port: -1,
        },
        {
            name: "ETCD Client Port",
            cidr: postgresqlIps,
            protocol: "tcp",
            from_port: 2379,
            to_port: 2379,
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
const pgSecurityGroup = new openstack.networking.SecGroup(resourceName, {
    description: "Test Mycar PostgreSQL SG",
    deleteDefaultRules: true,
    tags: baseTags,
});

const etcdSecurityGroup = new openstack.networking.SecGroup(`${resourceName}-etcd`, {
    description: "Test Mycar PostgreSQL ETCD SG",
    deleteDefaultRules: true,
    tags: baseTags,
});

// Create security group rules
Object.entries(pgSgRules).forEach(([direction, rules]) => {
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
                securityGroupId: pgSecurityGroup.id,
            });
        });
    });
});

Object.entries(etcdSgRules).forEach(([direction, rules]) => {
    rules.forEach(rule => {
        rule.cidr.forEach((cidr, index) => {
            const text = `${resourceName}-etcd-${rule.name.replace(" ", "-")}-${index + 1}`;
            new openstack.networking.SecGroupRule(text, {
                description: text,
                ethertype: "IPv4",
                direction,
                portRangeMin: rule.from_port !== -1 ? rule.from_port : undefined,
                portRangeMax: rule.to_port !== -1 ? rule.to_port : undefined,
                protocol: rule.protocol !== "any" ? rule.protocol : undefined,
                remoteIpPrefix: cidr,
                securityGroupId: etcdSecurityGroup.id,
            });
        });
    });
});

// Create instances and volumes
pgNodes.forEach(vm => {
    const port = new openstack.networking.Port(vm.Name, {
        name: vm.Name,
        adminStateUp: true,
        fixedIps: [{
            ipAddress: vm.private_ip,
            subnetId: databaseSubnet,
        }],
        networkId: coreNetwork,
        securityGroupIds: [pgSecurityGroup.id],
        allowedAddressPairs: [{ ipAddress: vip }],
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

    const dataVolume = new openstack.blockstorage.Volume(`${vm.Name}-data-volume`, {
        description: `${resourceName} data volume`,
        region: "kz-ala-1",
        size: vm.data_volume_size,
        volumeType: vm.data_volume_type,
    });

    new openstack.compute.VolumeAttach(`${vm.Name}-data-volume-attach`, {
        instanceId: node.id,
        volumeId: dataVolume.id,
    });
});

etcdNodes.forEach(vm => {
    const port = new openstack.networking.Port(vm.Name, {
        name: vm.Name,
        adminStateUp: true,
        fixedIps: [{
            ipAddress: vm.private_ip,
            subnetId: databaseSubnet,
        }],
        networkId: coreNetwork,
        securityGroupIds: [etcdSecurityGroup.id],
        allowedAddressPairs: [{ ipAddress: vip }],
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

    const dataVolume = new openstack.blockstorage.Volume(`${vm.Name}-data-volume`, {
        description: `${resourceName} etcd data volume`,
        region: "kz-ala-1",
        size: vm.data_volume_size,
        volumeType: vm.data_volume_type,
    });

    new openstack.compute.VolumeAttach(`${vm.Name}-data-volume-attach`, {
        instanceId: node.id,
        volumeId: dataVolume.id,
    });
});

// const cfg = new pulumi.Config();
// const masterUser = cfg.require("master_user");
// const masterPassword = cfg.require("master_password");

// const testPostgreProvider = new postgresql.Provider("test-mycar-postgresql-v14.14", {
// 	host: "10.129.2.70",
// 	database: "postgres",
// 	username: masterUser,
// 	password: masterPassword,
// 	port: 35432,
// 	superuser: true,
// 	sslmode: "disable",
// });

// dbs.forEach(db => {
// 	const roleName = db.name;

// 	const dbRole = new postgresql.Role(roleName, {
// 		name: roleName,
// 		login: true,
// 		skipReassignOwned: true,
// 		encryptedPassword: true,
// 		password: db.password,
// 	}, { provider: testPostgreProvider });

// 	const database = new postgresql.Database(db.name, {
// 		name: db.name,
// 		allowConnections: true,
// 		connectionLimit: -1,
// 		lcCollate: "C",
// 		owner: roleName,
// 		template: "template0",
// 	}, { provider: testPostgreProvider, dependsOn: [dbRole] });

// 	const chownPublicSchema = new postgresql.Schema(`${db.name}_public`, {
// 		name: "public",
// 		database: db.name,
// 		owner: roleName,
// 	}, { provider: testPostgreProvider, dependsOn: [database] });

// 	new postgresql.Grant(`${db.name}_revoke_public`, {
// 		database: db.name,
// 		objectType: "schema",
// 		privileges: [],
// 		role: "public",
// 		schema: "public",
// 	}, { provider: testPostgreProvider, dependsOn: [chownPublicSchema] });
// });