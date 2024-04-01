import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as cognito from 'aws-cdk-lib/aws-cognito';

export interface CustomizedProps extends StackProps {
  stackName: string;
}

export class CdkUserPoolStackAP extends Stack {
  constructor(scope: Construct, id: string, props: CustomizedProps) {
    super(scope, id, props);

    //----------------------------Cognito User Pool 作成-----------------------------
    const userPool = new cognito.UserPool(this, 'userPool', {
      userPoolName: `${props.stackName}`,
      selfSignUpEnabled: true,
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      signInCaseSensitive: false,
      signInAliases: { username: true },
      autoVerify: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
      passwordPolicy: {
        minLength: 8,
      },
    });
    new CfnOutput(this, 'UserPoolIdOutput', {
      value: userPool.userPoolId,
      description: 'The ID of the user pool',
      exportName: `${props.stackName}-UserPool`,
    });

    const activeGroup = new cognito.CfnUserPoolGroup(this, 'active', {
      userPoolId: userPool.userPoolId,

      groupName: 'active',
      precedence: 3,
    });

    const adminGroup = new cognito.CfnUserPoolGroup(this, 'admin', {
      userPoolId: userPool.userPoolId,

      groupName: 'admin',
      precedence: 1,
    });
    const privilegedGroup = new cognito.CfnUserPoolGroup(this, 'privileged', {
      userPoolId: userPool.userPoolId,

      groupName: 'privileged',
      precedence: 2,
    });

    const webClient = userPool.addClient('webClient', {
      userPoolClientName: `${props.stackName}-WebClient`,
      authFlows: {
        custom: true,
        userSrp: true,
      },
    });
    new CfnOutput(this, 'UserPoolClientId', {
      value: webClient.userPoolClientId,
      description: 'User Pool Client ID',
      exportName: `${props.stackName}-UserPool-WebClientID`,
    });

    const client = userPool.addClient('client', {
      userPoolClientName: `${props.stackName}-client`,
      authFlows: {
        custom: true,
        userSrp: true,
      },
    });
  }
}
