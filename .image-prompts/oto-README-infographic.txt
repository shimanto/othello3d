A vertical 9:16 portrait infographic poster titled "3D Othello — Docs", clean diagrammatic flat-design Japanese style, NO characters.

=== STYLE ===
Modern flat-design Japanese infographic. Bold 2px outlines, flat color fills, no gradients. Color palette: light teal/aqua (#5DDFD5) primary accent, white background, light gray (#F2F4F6) section panels, dark slate (#1F2937) text and outlines. Smartphone-readable Japanese typography, accurate Japanese characters.

=== LAYOUT (top to bottom, 9:16 vertical column) ===

[Header — 12%]
- Big bold title: 「3D Othello — 立体オセロ」
- Subtitle: 「重力 + 26 方向反転 + 複数レイヤー の戦略型ボードゲーム」
- A small isometric 3D Othello board icon on the right (stacked layers of black and white discs).

[Section 1 — "ゲームモード (Game Modes)", ~22%]
- A 2×2 grid of mode cards, each with an icon, mode name, and backend requirement:
  - 👥 PvP (Local) — 同じデバイスで 2 人対戦 — Backend: ❌ 不要
  - 🤖 PvC (CPU) — Minimax AI 対戦 — Backend: ❌ 不要
  - 🌐 Online Match — ランダムマッチング — Backend: ✅ 必要
  - 🔑 Private Room — ルームコード対戦 — Backend: ✅ 必要

[Section 2 — "アーキテクチャ (Architecture)", ~26%]
- A horizontal split diagram with 2 panels:
  Left panel: 🎨 「Frontend (GitHub Pages)」
    - index.html / js/main.js / js/board.js (3D) / js/cpu.js (AI) / js/renderer.js
    - Pure JavaScript, ES Modules, フレームワーク不使用
  ←→ HTTP Polling / CORS ←→
  Right panel: ☁️ 「Backend (Cloudflare Workers + KV)」
    - /api/queue — マッチング
    - /api/room — ルーム作成
    - /api/room/:id — 対戦同期
    - Cloudflare KV — ゲーム状態永続化

[Section 3 — "Cloudflare KV 学習教材 (KV as Learning Material)", ~24%]
- A 3-row table:
  | Key Pattern | 用途 | TTL |
  | `queue:{type}:{size}:{layers}` | マッチング待機キュー | 300 秒 |
  | `room:{roomId}` | ゲームルーム状態 | なし |
  | `player-room:{playerId}` | マッチング通知 | 300 秒 |
- Below: 4 small chip pills for KV operations:
  - get() / put() / delete() / list()
- A box on the right with Cloudflare 無料枠:
  - Workers: 100,000 リクエスト/日
  - KV Reads: 100,000 / 日
  - KV Writes: 1,000 / 日
  - KV Storage: 1 GB

[Footer — ~16%]
- Three info pills:
  - 🎮 Play: shimanto.github.io/othello3d/
  - 📚 Docs: othello3d-docs.pages.dev
  - 🔗 GitHub: shimanto/othello3d
- Tiny subtitle: 「Self-hosting 可 / GitHub Pages + Cloudflare Workers KV / 無料枠で完結」

=== TECHNICAL CONSTRAINTS ===
- Aspect ratio: 9:16 vertical portrait, NOT landscape.
- All Japanese text accurate, smartphone-readable.
- Style must match the project's overview manga (teal flat design).
