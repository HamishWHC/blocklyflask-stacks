#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {BlocklyFlaskFrontendStack} from "../lib/blocklyflask-frontend-stack";

const app = new cdk.App();

let frontendConfig = app.node.tryGetContext("FrontendConfig")
new BlocklyFlaskFrontendStack(app, 'BlocklyFlaskFrontend', {
    env: {account:"319320589528", region: "ap-southeast-2"},
    frontendGitHubConfig: frontendConfig.GitHubRepoConfig,
    cdnAliases: frontendConfig.CDNAliases,
    hostedZoneDomain: frontendConfig.HostedZoneDomain,
    cdnCertArn: frontendConfig.CDNCertARN
});
