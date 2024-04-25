import {
  aws_iam,
  Stack,
  StackProps,
  aws_dynamodb,
  Duration,
  aws_appsync,
  CfnOutput,
  RemovalPolicy,
} from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketApi, WebSocketStage } from '@aws-cdk/aws-apigatewayv2-alpha';
import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { Runtime, LayerVersion, Function, Code } from 'aws-cdk-lib/aws-lambda';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as dotenv from 'dotenv';
dotenv.config();

import * as cognito from 'aws-cdk-lib/aws-cognito';
import path = require('path');

const userPoolId = process.env.USER_POOL_ID || '';
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

export interface CustomizedProps extends StackProps {
  dbTableName: string; // 既存のDBを使う場合
  stackName: string;
}

export class CdkChatgptCloneStackAP extends Stack {
  constructor(scope: Construct, id: string, props: CustomizedProps) {
    super(scope, id, props);

    //----------------------------DynamiDB 作成-----------------------------
    const table = new aws_dynamodb.TableV2(this, 'Table', {
      tableName: `${props.stackName}-db`,
      partitionKey: { name: 'pk', type: aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: aws_dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'pk-createdAt-index',
      partitionKey: { name: 'pk', type: aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: aws_dynamodb.AttributeType.STRING },
    });

    table.addGlobalSecondaryIndex({
      indexName: 'pk-updatedAt-index',
      partitionKey: { name: 'pk', type: aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'updatedAt', type: aws_dynamodb.AttributeType.STRING },
    });

    //----------------------------AppSync 作成-----------------------------
    const appSyncApi = new aws_appsync.GraphqlApi(this, 'Api', {
      name: `${props.stackName}-api`,
      definition: aws_appsync.Definition.fromFile(
        path.join(__dirname, '../schema/schema.graphql')
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: aws_appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            defaultAction: aws_appsync.UserPoolDefaultAction.ALLOW,
            userPool: cognito.UserPool.fromUserPoolId(
              this,
              'userPool',
              userPoolId
            ),
          },
        },
      },
      xrayEnabled: true,
    });
    new CfnOutput(this, 'AppSyncURL', {
      value: appSyncApi.graphqlUrl,
      exportName: `${props.stackName}-api-AppSyncURL`,
    });

    const dataSource = appSyncApi.addDynamoDbDataSource(
      'DynamoDataSource',
      table
    );

    //===================================== iam ロール作成 =====================================
    const logsActions = [
      'logs:CreateLogGroup',
      'logs:CreateLogStream',
      'logs:PutLogEvents',
    ];
    const dynamodbFullAccessRole = new aws_iam.Role(
      this,
      'dynamodbAccessRole',
      {
        roleName: `${props.stackName}-dynamodb-fullaccess`,
        assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      }
    );
    dynamodbFullAccessRole.addToPolicy(
      new aws_iam.PolicyStatement({
        resources: ['*'],
        actions: logsActions,
      })
    );
    dynamodbFullAccessRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess')
    );

    const dynamodbReadRole = new aws_iam.Role(this, 'dynamodbReadRole', {
      roleName: `${props.stackName}-dynamodb-read`,
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    dynamodbReadRole.addToPolicy(
      new aws_iam.PolicyStatement({
        resources: ['*'],
        actions: logsActions,
      })
    );
    dynamodbReadRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBReadOnlyAccess')
    );

    const cognitoReadRole = new aws_iam.Role(this, 'cognitoReadRole', {
      roleName: `${props.stackName}-cognito-read`,
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    cognitoReadRole.addToPolicy(
      new aws_iam.PolicyStatement({
        resources: ['*'],
        actions: logsActions,
      })
    );
    cognitoReadRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoReadOnly')
    );
    cognitoReadRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess')
    );

    const cognitoFullAccessRole = new aws_iam.Role(
      this,
      'cognitoFullAccessRole',
      {
        roleName: `${props.stackName}-cognito-full-access`,
        assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      }
    );
    cognitoFullAccessRole.addToPolicy(
      new aws_iam.PolicyStatement({
        resources: ['*'],
        actions: logsActions,
      })
    );
    cognitoFullAccessRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoPowerUser')
    );
    cognitoFullAccessRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess')
    );

    const MainLamdaRole = new aws_iam.Role(this, 'dynamodbFullAccessRole', {
      roleName: `${props.stackName}-main-lambda`,
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    //自定義のポリシーを追加する（デフオルトのEffectは"Allow"
    MainLamdaRole.addToPolicy(
      new aws_iam.PolicyStatement({
        //arn:aws:execute-api:[region]:[account-id:api-id]/[stage-name]/[HTTP-VERB]/[resource-path-specifier]
        resources: ['arn:aws:execute-api:ap-northeast-1:*:*'],
        actions: ['execute-api:*'], //InvokeとInvalidateCache
        //effect: aws_iam.Effect.ALLOW
      })
    );
    MainLamdaRole.addToPolicy(
      new aws_iam.PolicyStatement({
        resources: ['*'],
        actions: logsActions,
      })
    );

    //AWS 公式管理したポリシーを追加する
    MainLamdaRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess')
    );
    MainLamdaRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite')
    );

    //===================================== Lambda Layer 作成 =====================================
    const pytzLayer = new LayerVersion(this, 'pytz', {
      code: Code.fromAsset('lambda_layer/pytz'),
      compatibleRuntimes: [Runtime.PYTHON_3_11],
    });

    const openaiLayer = new LayerVersion(this, 'openai-proto-layer', {
      code: Code.fromAsset('lambda_layer/openai-proto-layer'),
      compatibleRuntimes: [Runtime.PYTHON_3_11],
    });

    const anthropicLayer = new LayerVersion(this, 'anthropic-layer', {
      code: Code.fromAsset('lambda_layer/anthropic'),
      compatibleRuntimes: [Runtime.PYTHON_3_11],
    });

    const pyjwtLayer = new LayerVersion(this, 'pyjwt', {
      code: Code.fromAsset('lambda_layer/pyjwt'),
      compatibleRuntimes: [Runtime.PYTHON_3_11],
    });

    const commonLayer = new LayerVersion(this, 'common', {
      code: Code.fromAsset('lambda_layer/common'),
      compatibleRuntimes: [Runtime.PYTHON_3_11],
    });
    //===================================== lambda 作成 =====================================
    const environment = {
      PROJECT_NAME: props.stackName,
      USER_POOL_ID: userPoolId,
      DB_TABLE_NAME: props.dbTableName,
      OPENAI_API_KEY: openaiApiKey,
      ANTHROPIC_API_KEY: anthropicApiKey,
    };
    const lambdas = [
      // AppSyncAPI
      {
        name: 'save-chat',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Mutation', fieldName: 'putChat' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: dynamodbFullAccessRole,
      },
      {
        name: 'add-balance',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Mutation', fieldName: 'addBalance' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: dynamodbFullAccessRole,
      },
      {
        name: 'chat-detail',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Query', fieldName: 'getChatDetail' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: dynamodbFullAccessRole,
      },
      {
        name: 'chat-id-list',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Query', fieldName: 'getChatIdList' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: dynamodbFullAccessRole,
      },
      {
        name: 'delete-chats',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Mutation', fieldName: 'deleteChats' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: dynamodbFullAccessRole,
      },
      {
        name: 'usage',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Query', fieldName: 'getUsage' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: dynamodbFullAccessRole,
      },
      {
        name: 'settings',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Query', fieldName: 'getSettings' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: dynamodbFullAccessRole,
      },
      {
        name: 'save-settings',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Mutation', fieldName: 'putSettings' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: dynamodbFullAccessRole,
      },
      {
        name: 'balances',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Query', fieldName: 'getBalances' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: dynamodbReadRole,
      },
      {
        name: 'privileged-users',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Query', fieldName: 'getPrivilegedUsers' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: cognitoReadRole,
      },
      {
        name: 'create-user',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Mutation', fieldName: 'createUser' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: cognitoFullAccessRole,
      },
      {
        name: 'delete-users',
        dir: 'appsync',
        appSyncRelolver: { typeName: 'Mutation', fieldName: 'deleteUsers' },
        layers: [pytzLayer, commonLayer],
        environment,
        role: cognitoFullAccessRole,
      },
      {
        name: 'websock',
        dir: 'websocket',
        layers: [
          openaiLayer,
          anthropicLayer,
          pytzLayer,
          pyjwtLayer,
          commonLayer,
        ],
        environment,
        role: MainLamdaRole,
        websock: true,
      },
    ];
    lambdas.map((lambdaParam) => {
      const lambdaName = lambdaParam.name;
      const lambda = new Function(this, lambdaName + '-Lambda', {
        functionName: `${props.stackName}-${lambdaName}`,
        runtime: Runtime.PYTHON_3_11,
        code: Code.fromAsset(`lambda/${lambdaParam.dir}`),
        handler: `${lambdaName}.lambda_handler`,
        environment: lambdaParam.environment as { [key: string]: string },
        timeout: Duration.seconds(900),
        role: lambdaParam.role,
        layers: lambdaParam.layers,
        memorySize: lambdaName === 'websock' ? 10240 : 256,
      });
      if (lambdaParam.appSyncRelolver) {
        const lambdaDataSource = new aws_appsync.LambdaDataSource(
          this,
          lambdaName + '-DataSource',
          {
            api: appSyncApi,
            lambdaFunction: lambda,
            name: `${lambdaName}-datasource`,
          }
        );

        new aws_appsync.Resolver(this, lambdaName + '-Resolver', {
          api: appSyncApi,
          dataSource: lambdaDataSource,
          typeName: lambdaParam.appSyncRelolver.typeName,
          fieldName: lambdaParam.appSyncRelolver.fieldName,
        });
      }
      if (lambdaParam.websock) {
        // API Gateway WebSocket APIの作成
        table.grantReadWriteData(lambda); // dynamoへ読み書き許可
        const apiName = 'websocket-api';
        const webSocketApi = new WebSocketApi(this, apiName, {
          apiName: `${props.stackName}-${apiName}`,
        });
        // Lambda に紐付けます
        const route = webSocketApi.addRoute('$default', {
          integration: new WebSocketLambdaIntegration(
            `defaultIntegration`,
            lambda
          ),
        });

        new apigateway.CfnRouteResponse(this, lambdaName + '-response', {
          apiId: webSocketApi.apiId,
          routeId: route.routeId,
          routeResponseKey: '$default',
        });

        // stage作成とデプロイ
        const stage = new WebSocketStage(this, 'apiStage', {
          webSocketApi,
          stageName: 'dev',
          autoDeploy: true,
        });
        new CfnOutput(this, 'WebSocketURL', {
          value: stage.url,
          exportName: `${props.stackName}-${apiName}-WebSocketURL`,
        });
      }
    });
  }
}
