# note記事自動生成アプリ｜舞台スタッフの学校

## ファイル構成
```
note-generator/
├── index.html        # フロントエンド（スマホ対応UI）
├── vercel.json       # Vercel設定
├── api/
│   └── generate.js  # サーバーサイド（APIキー管理）
└── README.md
```

## デプロイ手順

### 1. GitHubにリポジトリを作成
1. github.com → 「New repository」
2. リポジトリ名: `note-generator`（なんでもOK）
3. Publicで作成

### 2. ファイルをアップロード
```bash
git clone https://github.com/あなたのユーザー名/note-generator.git
# このフォルダの中身を全部コピーして
git add .
git commit -m "initial commit"
git push origin main
```

### 3. Vercelにデプロイ
1. vercel.com にGitHubでログイン
2. 「Add New Project」
3. GitHubのnote-generatorリポジトリを選択
4. 「Environment Variables」に以下を追加:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-xxxxx...`（あなたのAPIキー）
5. 「Deploy」ボタンを押す

### 4. 完了
`https://note-generator-xxx.vercel.app` のようなURLが発行されます。
スマホのホーム画面に追加すればアプリのように使えます。
