# beePrompt
セルフホストの手順を整えた生成AIチャットツールです。  
OpenAI GPT、Anthropic Claudeの各モデルと同時にチャットすることができます。  
GPT4やClaude3-Opusを1000円未満から利用可能です。  


![beePrompt-capture](https://github.com/beeskynet/beePrompt/assets/24839015/c5095472-5bf8-4e98-be63-a52a2cd2587f)

## セットアップの事前に必要なこと
- OpenAIとAnthropic、AWSのアカウント  
- 各アカウントそれぞれについてクレジットカード登録
- OpenAIのクレジット購入($5より)  
  Anthropicは2024/4時点で$5の無料クレジットが利用できます。  


## セルフホスト環境構築
バックエンド(backend-cdk)、フロントエンド(frontend)の順番でセットアップしてください。  
それぞれのディレクトリ直下にREADME.md配置しています。  


## 利用サービスの課金について
本アプリはセルフホストした場合、本アプリ自体は無料で利用することができますが、  
本アプリが利用しているOpenAI、Anthropic、AWSの従量課金が発生します。  


OpenAIとAnthropicは前払いクレジット方式、AWSは後払いになります。  



AWSについてはLambda, DynamoDBを利用することにより課金額を抑えています。  
本アプリをひとりで使っている分にはほとんど無料枠で収まるかもしれません。  

