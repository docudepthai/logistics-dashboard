#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LogisticsStack } from '../lib/stack.js';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'eu-central-1',
};

new LogisticsStack(app, 'TurkishLogisticsBot', {
  env,
  description: 'Turkish Logistics WhatsApp Message Aggregator',
});

app.synth();
