# beePrompt Frontend

## Requirements
事前に下記のインストールと設定が必要です。  
- npm
- AWS CLI
- amplify

## Setup
1. npm install
    ```bash
    $ npm install
    ```
1. amplify設定
    ```bash
    $ amplify init
    ? Enter a name for the project beePrompt
    ? Initialize the project with the above configuration? No
     :
    ? Distribution Directory Path: out
     :
    ```
    ```bash
    $ amplify add hosting
    ✔ Select the plugin module to execute · Hosting with Amplify Console (Managed hosting with custom domains, Continuous deployment)
    ? Choose a type Manual deployment
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


## デプロイ
```bash
$ amplify publish --yes
```


