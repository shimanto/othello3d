# 3D Othello

3D空間でプレイするオセロゲーム。重力・26方向反転・複数レイヤーによる立体的な戦略が楽しめます。

**[Play Online](https://shimanto.github.io/othello3d/)**

## Game Modes

| Mode | Description | Backend Required |
|------|-------------|-----------------|
| PvP (Local) | 同じデバイスで2人対戦 | No |
| PvC (CPU) | AI対戦（Minimax） | No |
| Online Match | ランダムマッチング対戦 | Yes |
| Private Room | ルームコードで友達と対戦 | Yes |

## Architecture

```
Frontend (GitHub Pages)          Backend (Cloudflare Workers + KV)
┌─────────────────────┐         ┌──────────────────────────────┐
│  index.html          │  fetch  │  /api/queue    - マッチング    │
│  js/main.js          │◄──────►│  /api/room     - ルーム作成    │
│  js/board.js (3D)    │  CORS   │  /api/room/:id - 対戦同期     │
│  js/cpu.js (AI)      │         │         │                      │
│  js/renderer.js      │         │         ▼                      │
│  circle/index.html   │         │    Cloudflare KV              │
└─────────────────────┘         │    (ゲーム状態永続化)           │
                                 └──────────────────────────────┘
```

- **Frontend**: Pure JavaScript (フレームワーク不使用)、ES Modules
- **Backend**: Cloudflare Pages Functions (Workers runtime)
- **State**: Cloudflare KV (Key-Value Store) でゲーム状態を管理
- **Communication**: HTTP Polling (WebSocket不使用)

## Cloudflare KV の学習ポイント

このプロジェクトは **Cloudflare KV を実践的に学ぶ** 教材としても活用できます。Cloudflare Workers + KV は**無料枠**で十分に動作します。

### KV で管理しているデータ

| Key Pattern | Purpose | TTL |
|---|---|---|
| `queue:{gameType}:{boardSize}:{layerCount}` | マッチング待機キュー | 300秒 |
| `room:{roomId}` | ゲームルーム状態 | なし |
| `player-room:{playerId}` | マッチング通知用 | 300秒 |

### 学べること

- **KV の基本操作**: `get()`, `put()`, `delete()`, `list()` — `functions/api/` のコードで実装を確認できます
- **TTL (有効期限)**: マッチング待機エントリに `expirationTtl: 300` を設定し、自動クリーンアップ
- **Key設計**: プレフィックスベースのキー設計 (`queue:`, `room:`, `player-room:`)
- **CORS設定**: クロスオリジン通信のヘッダー設定
- **Pages Functions**: ファイルベースルーティング (`functions/api/room/[id].js` → `/api/room/:id`)

### Cloudflare 無料枠

| Resource | Free Tier |
|---|---|
| Workers Requests | 100,000 / day |
| KV Reads | 100,000 / day |
| KV Writes | 1,000 / day |
| KV Storage | 1 GB |

個人プロジェクトやハンズオン教材として十分な量です。

## Self-Hosting Guide

### 1. Frontend (GitHub Pages)

1. このリポジトリをFork
2. Settings → Pages → Source を "GitHub Actions" に設定
3. `main` ブランチにpushすると自動デプロイ

### 2. Backend (Cloudflare Workers + KV)

#### 前提条件

- [Cloudflare アカウント](https://dash.cloudflare.com/sign-up) (無料)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

```bash
npm install -g wrangler
wrangler login
```

#### KV Namespace の作成

```bash
wrangler kv namespace create GAME_KV
```

出力されるIDを `wrangler.toml` にセット:

```toml
[[kv_namespaces]]
binding = "GAME_KV"
id = "<出力されたID>"
```

#### デプロイ

```bash
wrangler pages deploy .
```

デプロイ後に表示されるURL (例: `https://othello3d.pages.dev`) を控えてください。

#### Frontend の API 接続先を設定

`js/config.js` の `API_BASE` にCloudflare PagesのURLを設定:

```js
export const API_BASE = 'https://othello3d.pages.dev';
```

`circle/index.html` 内の `API_BASE` も同様に変更してください。

> **Note**: Cloudflare Pages にデプロイする場合（フロントエンドとバックエンドが同一オリジン）は、`API_BASE` は空文字のままでOKです。

## Variants

- **3D Othello** (`/`) — メイン。6x6/8x8ボード × 3/5レイヤー、26方向反転、重力
- **Torus Othello** (`/circle/`) — 端が繋がったトーラス面のオセロ

## Tech Stack

- HTML / CSS / JavaScript (ES Modules, no framework)
- Cloudflare Workers (Pages Functions)
- Cloudflare KV
- GitHub Pages + GitHub Actions

## Development

```bash
# ローカル開発（Cloudflare Pages + KV 込み）
wrangler pages dev .

# テスト
npm test

# Lint
npm run lint
```

## License

MIT
