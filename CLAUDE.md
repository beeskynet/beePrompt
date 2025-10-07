# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

beePromptは、OpenAI GPT、Anthropic Claude、Cohereと同時にチャットできるセルフホスト型の生成AIチャットアプリケーションです。企業向けのポイント管理機能を備え、API利用料を制御できます。

## Architecture

### Frontend
- **Tech Stack**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **Location**: `/frontend`
- **State Management**: Jotai
- **UI Components**: Material Tailwind + Custom components
- **Real-time**: WebSocket for streaming responses
- **Authentication**: AWS Amplify with Cognito

### Backend
- **Infrastructure**: AWS CDK + Serverless
- **Location**: `/backend-cdk`
- **Services**: Lambda (Python 3.11), DynamoDB, AppSync (GraphQL), API Gateway (WebSocket)
- **Lambda Layers**: Custom Python packages in `/backend-cdk/lambda_layer/`
- **Common utilities**: `/backend-cdk/lambda_layer/common/python/common.py`

## Common Commands

### Frontend Development
```bash
cd frontend
npm install
npm run dev    # Start development server at localhost:3000
npm run build  # Build for production
npm start      # Run production build locally
```

### Backend Development
```bash
cd backend-cdk
npm install
npm run build  # Compile TypeScript
cdk deploy [ProjectName]  # Deploy all resources
cdk deploy [ProjectName]-UserPool  # Deploy only UserPool
```

### Lambda Function Updates (Fast Update)
```bash
cd backend-cdk/lambda
./update_lambda_function.sh appsync/usage.py [ProjectName]
./update_lambda_function.sh websocket/bdrk-websock.py [ProjectName] --region us-east-1
```

### Testing
```bash
cd backend-cdk
npm test  # Run CDK tests
```

## Key Configuration Files

### Frontend
- `/frontend/lib/environments.ts` - AWS endpoints configuration (copy from environments.example.ts)
- `/frontend/next.config.js` - Next.js configuration

### Backend
- `/backend-cdk/.env` - Environment variables (copy from .env.sample)
  - PROJECT_NAME: Project identifier
  - USER_POOL_ID: Cognito User Pool ID (set after UserPool deployment)
  - OPENAI_API_KEY, ANTHROPIC_API_KEY, COHERE_API_KEY: API keys

## Development Workflow

1. **Backend changes**: Deploy CDK stack first if infrastructure changes are needed
2. **Lambda development**: Use update_lambda_function.sh for quick iterations
3. **Frontend changes**: Run dev server and test locally before deployment
4. **Database**: DynamoDB tables are created automatically by CDK

## Project Structure

```
beePrompt/
├── frontend/              # Next.js application
│   ├── app/              # App router pages
│   ├── components/       # React components
│   └── lib/              # Utilities and configuration
├── backend-cdk/          # AWS CDK infrastructure
│   ├── lambda/           # Lambda function source code
│   ├── lambda_layer/     # Python packages for Lambda layers
│   ├── lib/              # CDK stack definitions
│   └── tools/            # Utility scripts
├── ai-work/              # AI作業ログ保存場所
└── doc/                  # Project documentation
```

## Important Notes

1. **API Keys**: Store in either .env file or AWS Secrets Manager
2. **Initial Login**: Username: `admin`, Password: `beePrompt123` (change on first login)
3. **Point System**: Manage user points through Management interface (1 point ≈ 1円 API cost)
4. **Lambda Layers**: Run Docker commands to build Python packages before deployment
5. **WebSocket Endpoint**: US-East-1 region required for Bedrock integration

## AI Output Convention
コードに直接反映しない設計、検討、調査結果やQA回答場合は、`ai-work/yyyMMdd-HHmm_<タイトル>.md`形式でファイルを作成して保存してください。
yyyyMMdd-HHmmは新規作成時の日時です。(date '+%Y%m%d-%H%M')コマンドで取得してください。  

