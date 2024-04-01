#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkChatgptCloneStackAP } from '../lib/cdk_chatgpt_clone_stack_ap';
import { CdkUserPoolStackAP } from '../lib/cdk_user_pool_stack_ap';
//import { CdkOIDCStackAP } from '../lib/cdk_oidc_stack_ap';
const dotenv = require('dotenv').config();

const projectName = process.env.PROJECT_NAME || '';
const app = new cdk.App();
{
  const stackName: string = projectName + '-UserPool';
  const region: string = 'ap-northeast-1';
  new CdkUserPoolStackAP(app, stackName, {
    stackName,
    env: {
      region: region,
    },
  });
}
//メイン機能東京リージョン用リソース作成
{
  const stackName: string = projectName + '-AP';
  const region: string = 'ap-northeast-1';
  new CdkChatgptCloneStackAP(app, stackName, {
    stackName,
    dbTableName: process.env.DB_TABLE_NAME || '',
    env: {
      region: region,
    },
  });
}
