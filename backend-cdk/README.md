# beePrompt Backend
## Requirements
事前に下記のインストールが必要です。  
- npm
- AWS CLI
- AWS CDK
- Docker Desktop  

Open AIとAnthropicのWebコンソールよりAPIキーを作成してください。
- Open AI APIキー
- Anthropic APIキー

## AWS CLI設定
AWS CLI未設定の場合は設定

```bash
$ aws configure
AWS Access Key ID: [AWSマネージメントコンソールより確認した値]
AWS Secret Access Key: [AWSマネージメントコンソールより確認した値]
Default region name: ap-northeast-1
```

## APIキーをシークレットマネージャーに登録
AWSマネージメントコンソールよりOpen AIとAnthropicのAPIキーをシークレットマネージャーに登録します。  
AWS Secret Manager > シークレット > その他のシークレットのタイプ

|キー|値|
|---|---|
|beePrompt-open-ai-secret|[OpenAI APIキー]|
|beePrompt-anthropic-secret|[Anthropic APIキー]|

## CDK
### Lambda Layer用Pythonパッケージ作成
イメージ取得
```bash
$ docker pull yayamura/aws-lambda-layer-python3-11
```

lambda_layer配下のcommon以外の各フォルダで下記を実行
```bash
$ docker run --platform linux/amd64 --rm -it -v `pwd`:/var/task yayamura/aws-lambda-layer-python3-11
```
container内
```bash
$ pip install -r requirements.txt -t ./python
exit
```

### CDKセットアップ
npm install
```bash
$ npm install
```

CDKブートストラップ

```bash
$ cdk bootstrap --all
```

.env.sampleを.envに改名してPROJECT_NAMEに任意のプロジェクト名を設定  
(USER_POOL_IDの方はあとで修正します)  
```
# .env
 :
PROJECT_NAME="[ProjectName]"
 :
```

### User Poolデプロイ・設定
User Pool関連のリソースをデプロイ
```bash
$ cdk deploy [ProjectName]-UserPool
```

デプロイ時にコンソール出力されるUserPoolIdとUserPoolWebClientIdをコピーして、.envとfrontend設定に記載
```
# .env
 :
USER_POOL_ID="[UserPoolId]"
 :
```
```typescript
// frontend/lib/environments.ts
 :
  aws_user_pools_id: "[UserPoolId]",
  aws_user_pools_web_client_id: "[UserPoolWebClientId]",
 :
```
adminユーザー作成
```bash
$ cd tools
$ chmod a+x ./create_admin_user.sh
$ ./create_admin_user.sh
$ cd ..
```

### その他のAWSリソースをデプロイ
```bash
$ cdk deploy [ProjectName]-AP
```

デプロイ時にコンソール出力されるWebSocketURLとAppSyncURLをfrontend設定に反映

```typescript
// frontend/lib/environments.ts
 :
  wssAp: "[AP.WebSocketURL]",
  appSync: "[AppSyncURL]",
 :
```

## フロントエンド構築
次はフロントエンド構築。frontend/README.mdを参照


## 番外
### Lambda単体ソース更新

レイヤーや権限等の設定を変えずにソースだけ更新可能です。CDKより高速です。

```bash
$ cd lambda
$ ./update_lambda_function.sh appsync/usage.py [ProjectName]
$ ./update_lambda_function.sh websocket/bdrk-websock.py [ProjectName] --region us-east-1
```

更新ソースと同階層にlambda_layer/common/python/common.pyのシンボリックリンクを配置しておくと、common.pyがレイヤーではなくソースとしてアップロードされます。(CDKでも同様)

共通処理の開発、動作確認に便利です。

※シンボリックリンクはWindows環境のGitで扱いが面倒なので.gitignore登録してあります。
