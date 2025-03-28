// import * as pulumi from "@pulumi/pulumi";
// import * as openstack from "@pulumi/openstack";

// const config = new pulumi.Config();
// const network = config.requireSecret("networkId");
// const privateSubnet = config.requireSecret("privateSubnetId");
// const coreNetwork = config.requireSecret("coreNetwork");
// const databaseSubnet = config.requireSecret("databaseSubnet");

// const env = "test";
// const project = "mycar";
// const app = "mongodb";
// const resourceName = `${env}-${project}-${app}`;

// const baseTags = [
//     project,
//     "ManagedByPulumi",
// ];

// // Cloud-init configuration for initial setup
// const userData = `#cloud-config
// users:
//     - name: mycar
//       lock_passwd: false
//       shell: /bin/bash
//       passwd: $1$rounds$OB2YAZpq3Czayyokvig9k1c #Co0aewei?R0daish
//       sudo: ['ALL=(ALL) NOPASSWD:ALL']
//       ssh_authorized_keys:
//          - "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDRmNvccFQRoGPdAVcsdFF8yzfSXltBBItC0umwYBepBD5LHLD+otqoXDV2dq1HXNdbDp90TxXooI17qZRvmPfD/5AZn+e0s2QIn8OiasdAq6wFOZYwZHaM5bsswnHJZN9p8Qh/RUmk0sovBF2e5ruFJ0mLOPuREHymCtXwhoI9zxeOsNO1PUzVbc1/ZTTjwUgPSGiAagKEjg7bCoGFkVAtNt6I2TRLVYHZV8qPoMcfaf0wrznYUhoX20IMcaJh0Ktpuiw8tLO9p3qMY44NFwhouX1RSjCkz1nLYIfCJZBHZkaOq9C/9S7gqfd5Fl9uYf/vw2tdoHQ4XsOwj6CoxA2B Generated-by-Nova"
//     - name: root
//       shell: /bin/bash
//       passwd: $1$rounds$OB2YAZpq3Czayyokvig9k1c #Co0aewei?R0daish
//       lock_passwd: true

// repo_update: true
// repo_upgrade: all
// `;

// const sshKeyName = "stage-mycar";
// const imageId = "dc476378-fc5b-48b1-a3c3-6f8828754f94"; // Ubuntu 22.04

// const mongoNodes = [
//     {
//         Name: `${resourceName}-1`,
//         private_ip: "10.129.2.77",
//         key: sshKeyName,
//         image: imageId,
//         flavor: "d1.ram4cpu2",
//         volume_root: 10,
//         volume_type: "ceph-ssd",
//     },
//     {
//         Name: `${resourceName}-2`,
//         private_ip: "10.129.2.78",
//         key: sshKeyName,
//         image: imageId,
//         flavor: "d1.ram4cpu2",
//         volume_root: 10,
//         volume_type: "ceph-ssd",
//     },
//     {
//         Name: `${resourceName}-3`,
//         private_ip: "10.129.2.79",
//         key: sshKeyName,
//         image: imageId,
//         flavor: "d1.ram4cpu2",
//         volume_root: 10,
//         volume_type: "ceph-ssd",
//     },
// ];

// const mongoSgRules = {
//     ingress: [
//         {
//             name: "SSH ingress",
//             cidr: ["10.80.21.0/24", "10.80.22.0/24", "10.80.23.0/24", "10.80.20.5/32", "10.129.1.0/24"],
//             protocol: "tcp",
//             from_port: 22,
//             to_port: 22,
//         },
//         {
//             name: "mongodb ports",
//             cidr: ["10.80.21.0/24", "10.80.22.0/24", "10.80.23.0/24", "10.80.20.5/32", "10.129.1.0/24","10.129.2.0/24"],
//             protocol: "tcp",
//             from_port: 27017,
//             to_port: 27017,
//         },
//     ],
//     egress: [
//         {
//             name: "ALL egress",
//             cidr: ["0.0.0.0/0"],
//             protocol: "any",
//             from_port: -1,
//             to_port: -1,
//         }
//     ],
// };


// // Create security groups
// const mongoSecurityGroup = new openstack.networking.SecGroup(resourceName, {
//     description: "Stage Mycar MongoDB SG",
//     deleteDefaultRules: true,
//     tags: baseTags,
// });


// // Create security group rules
// Object.entries(mongoSgRules).forEach(([direction, rules]) => {
//     rules.forEach(rule => {
//         rule.cidr.forEach((cidr, index) => {
//             const text = `${resourceName}-${rule.name.replace(" ", "-")}-${index + 1}`;
//             new openstack.networking.SecGroupRule(text, {
//                 description: text,
//                 ethertype: "IPv4",
//                 direction,
//                 portRangeMin: rule.from_port !== -1 ? rule.from_port : undefined,
//                 portRangeMax: rule.to_port !== -1 ? rule.to_port : undefined,
//                 protocol: rule.protocol !== "any" ? rule.protocol : undefined,
//                 remoteIpPrefix: cidr,
//                 securityGroupId: mongoSecurityGroup.id,
//             });
//         });
//     });
// });


// // Create instances and volumes
// mongoNodes.forEach(vm => {
//     const port = new openstack.networking.Port(vm.Name, {
//         name: vm.Name,
//         adminStateUp: true,
//         fixedIps: [{
//             ipAddress: vm.private_ip,
//             subnetId: databaseSubnet,
//         }],
//         networkId: coreNetwork,
//         securityGroupIds: [mongoSecurityGroup.id],
//         tags: baseTags,
//     });

//     const node = new openstack.compute.Instance(vm.Name, {
//         name: vm.Name,
//         keyPair: vm.key,
//         flavorName: vm.flavor,
//         userData,
//         networks: [{
//             port: port.id,
//         }],
//         blockDevices: [{
//             uuid: vm.image,
//             sourceType: "image",
//             volumeSize: vm.volume_root,
//             destinationType: "volume",
//             volumeType: vm.volume_type,
//             deleteOnTermination: true,
//         }],
//         tags: baseTags,
//     });
// });