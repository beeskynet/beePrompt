# beePrompt Frontend

## Requirements
事前に下記のインストールと設定が必要です。  
- Node.js(npm)  
    本項執筆時点の動作確認バージョン: v20.12.1 
- AWS CLI  
    本項執筆時点の動作確認バージョン: 2.15.35/Python 3.11.8
- amplify  
    本項執筆時点の動作確認バージョン: 12.10.3  
    インターネット上にデプロイする場合のみ。ローカルで開発実行するだけなら不要です。

### 事前セットアップ参考
自身で環境設定できる方は飛ばしてください。  

- amplify  
    - amplify用のIAMユーザー設定  
        AWS CLIの際と同様にAWSマネージメントコンソールでIAMユーザーを作成し、許可ポリシーに`AdministratorAccess-Amplify`を追加します。  
    - アクセスキーの作成  
       上記のIAMユーザーのアクセスキーを作成し、アクセスキーとシークレットの値を控えます。  
    - インストール  
        ```bash
        $ npm install -g @aws-amplify/cli
        ```
    - 初期設定  
        ```bash
        $ amplify configure
        ```
        - 表示に従い入力します。  
            region `ap-notheast-1`  
            accessKey `上記で控えたアクセスキーの値`  
            secret `上記で控えたシークレットの値`  

## Setup
1. npm install
    ```bash
    $ npm install
    ```

1. CDKによるbackend紐づけ
    lib/environments.example.tsをenvironments.tsに改名し、下記の箇所をbackendでの`cdk dploy xxx`の出力結果により編集
    ```typescript
      aws_user_pools_id: "ap-northeast-1_...",
      aws_user_pools_web_client_id: "...",
       :
      wss: "wss://...",
      appSync: "https://.../graphql",
    ```

## 開発実行
```bash
$ npm run dev
```

## ログイン
ターミナルで開発実行/デプロイすると出力されるURLをブラウザで開きます。  
- Username  
    `admin`
- Password  
    `beePrompt123`  
    ※初回パスワードです。  

## ポイント付与
右上の人型アイコン→`Management`よりユーザー管理画面を開きadminにポイント付与してください。  
本アプリを社内など複数名で利用する際に管理者が利用料を制御するための本アプリ内のポイントです。  
API利用ごとにOpenAIとAnthropicのAPI利用料(推計)1円に対して1ポイントが消費されます。  


## デプロイ
```bash
$ amplify init
```
- 表示に従って入力します。下記以外はデフォルトのままでOKです。  
    ? Enter a name for the project `beePrompt` ※ 任意  
    ? Initialize the project with the above configuration? `No`  
    　:  
    ? Distribution Directory Path: `out`  
    　:  
```bash
$ amplify add hosting
```
- 下記の通り選択します。  
    ✔ Select the plugin module to execute · `Hosting with Amplify Console (Managed hosting with custom domains, Continuous deployment)`  
    ? Choose a type `Manual deployment`


```bash
$ amplify publish --yes
```

