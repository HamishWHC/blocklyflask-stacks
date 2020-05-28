#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { BlocklyflaskStacksStack } from '../lib/blocklyflask-stacks-stack';

const app = new cdk.App();
new BlocklyflaskStacksStack(app, 'BlocklyflaskStacksStack');
