import * as pulumi from "@pulumi/pulumi";

const stageConfig = new pulumi.Config();

export const dbs = [
    { name: "test1", password: "test1" },
    { name: "test2", password: "test2" },
];
