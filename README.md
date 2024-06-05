# beePrompt

セルフホストの手順を整えた生成 AI チャットツールです。  
OpenAI GPT、Anthropic Claude、Cohere Command の各モデルと同時にチャットすることができます。  
GPT4 や Claude3-Opus を 1000 円未満から利用可能です。CommandR+は 1 日（24 時間）あたり最大 10,000 リクエスト、毎秒最大 20 リクエストまで無料プラン利用可能です。

![beePrompt-capture](https://github.com/beeskynet/beePrompt/assets/24839015/c5095472-5bf8-4e98-be63-a52a2cd2587f)

## セットアップの事前に必要なこと

- OpenAI と Anthropic、AWS のアカウント
- 各アカウントそれぞれについてクレジットカード登録
- OpenAI のクレジット購入($5 より)  
  Anthropic は 2024/4 時点で$5 の無料クレジットが利用できます。  
  Cohere は 2024/6 時点で無料プランが非商用利用できます。

## セルフホスト環境構築

バックエンド(backend-cdk)、フロントエンド(frontend)の順番でセットアップしてください。  
それぞれのディレクトリ直下に README.md 配置しています。

## 利用サービスの課金について

本アプリはセルフホストした場合、本アプリ自体は無料で利用することができますが、  
本アプリが利用している OpenAI、Anthropic、AWS の従量課金が発生します。
Cohere は利用状況次第無料で利用できます。

OpenAI と Anthropic は前払いクレジット方式、AWS は後払いになります。

AWS については Lambda, DynamoDB を利用することにより課金額を抑えています。  
本アプリをひとりで使っている分にはほとんど無料枠で収まるかもしれません。
