# beePrompt Backend
## Requirements
事前に下記のセットアップが必要です。  
- Node.js(npm)  
    本項執筆時点の動作確認バージョン: v20.12.1  
- AWS CLI  
    本項執筆時点の動作確認バージョン: 2.15.35/Python 3.11.8  
- AWS CDK   
    本項執筆時点の動作確認バージョン: 2.135.0
- Docker Desktop or podman

Open AIとAnthropicのWebコンソールよりAPIキーを作成してください。
- Open AI APIキー
- Anthropic APIキー

### 事前セットアップ参考
自身で環境を用意できる方は飛ばしてください。  

- Node.js  
    https://nodejs.org/en/download/  
    上記URLよりインスートーラーをダウンロード、インストールしてください。  
    バージョンは本項執筆時点でv20.12.1(x64)での動作確認を行っています。  
    すでにインストール済みの場合、バージョンが古いと動かない可能性があります。  
    その際は アンインストール → 再インストール してください。  
    もちろんnodenv/nvm等のバージョン管理ツールを利用しても構いません。  
  
- AWS CLI(コマンドラインインターフェース)  
    https://dev.classmethod.jp/articles/install-aws-cli-on-the-windows-11-terminal-at-hand-and-execute-aws-cli-commands/  
    上記記事を参考にインストールし`aws configure`まで行ってください。  

- AWS CDK
    ```
    $ npm install -g aws-cdk
    ```

- Docker Desktop
    cdk bootstrap --all

## CDK
### Lambda Layer用Pythonパッケージ作成
イメージ取得
```bash
$ docker pull yayamura/aws-lambda-layer-python3-11
```

lambda_layer配下のcommon以外の各フォルダで下記を実行
```bash
$ docker run --platform linux/amd64 --rm -it -v .:/var/task yayamura/aws-lambda-layer-python3-11
```
- ※ podmanの場合、`--privileged`オプションを付けます。また相対パスが効かない模様。  
    ```bash
    $ podman run --platform linux/amd64 --rm -it -v `pwd`:/var/task yayamura/aws-lambda-layer-python3-11
    ```

container内
```bash
$ pip install -r requirements.txt -t ./python
$ exit
```

### CDKセットアップ
backend-cdk配下でnpm install
```bash
$ npm install
```

CDKブートストラップ  
.env.sampleを.envに改名してPROJECT_NAMEに任意のプロジェクト名を設定  
```
# .env
 :
PROJECT_NAME=[プロジェクト名(英数記号)]
 :
```

```bash
$ cdk bootstrap --all
```


### APIキーの設定
環境変数(.env)かAWSシークレットマネージャーのどちらか一方にOpenAIとAnthropicのAPIキーを設定します。  
(AWSシークレットマネージャーはAWSの課金が発生します)  

- 環境変数
    ```
    # .env
     :
    OPENAI_API_KEY=[OpenAI APIキー]
    ANTHROPIC_API_KEY=[Anthropic APIキー]
     :
    ```

- AWSシークレットマネージャー  
    AWSマネージメントコンソールよりOpen AIとAnthropicのAPIキーをシークレットマネージャーに登録します。  
    AWS Secret Manager > シークレット > その他のシークレットのタイプ

    |キー|値|
    |---|---|
    |beePrompt-open-ai-secret|[OpenAI APIキー]|
    |beePrompt-anthropic-secret|[Anthropic APIキー]|

### User Poolデプロイ・設定
User Pool関連のリソースをデプロイ
```bash
$ cdk deploy [ProjectName]-UserPool
```

デプロイ時にコンソール出力されるUserPoolIdとUserPoolWebClientIdをコピーして、.envとfrontend設定に記載
```
# .env
 :
USER_POOL_ID=[UserPoolIdの値]
 :
```
```typescript
// frontend/lib/environments.ts
 :
  aws_user_pools_id: "[UserPoolIdの値]",
  aws_user_pools_web_client_id: "[UserPoolWebClientIdの値]",
 :
```
adminユーザー作成
- Mac/Linux
    ```bash
    $ cd tools
    $ chmod a+x ./create_admin_user.sh
    $ ./create_admin_user.sh
    $ cd ..
    ```
- Windows
    ```bat
    > cd tools
    > ./create_admin_user.bat
    > cd ..
    ```

### その他のAWSリソースをデプロイ
```bash
$ cdk deploy [ProjectName]-AP
```

デプロイ時にコンソール出力されるWebSocketURLとAppSyncURLをfrontend設定に反映

```typescript
// frontend/lib/environments.ts
 :
  wssAp: "[WebSocketURLの値]",
  appSync: "[AppSyncURLの値]",
 :
```

## フロントエンド構築
次はフロントエンド構築です。frontend/README.mdを参照


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

