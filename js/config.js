/**
 * config.js - ゲーム定数・設定値
 *
 * マジックナンバーを排除し、ゲーム全体の設定を一元管理する。
 * 値を変更するだけでゲームの挙動を調整可能。
 */

// セルの状態
export const CELL = {
  EMPTY: 0,
  BLACK: 1,
  WHITE: 2,
};

// レイヤー（高さ）の数 — 動的に変更可能
export let LAYER_COUNT = 3;

/** レイヤー数を変更 */
export function setLayerCount(n) {
  LAYER_COUNT = n;
}

// 選択可能なレイヤー数
export const LAYER_SIZES = [
  { count: 3, label: '3層' },
  { count: 5, label: '5層' },
];

export const DEFAULT_LAYER_COUNT = 3;

// 選択可能なボードサイズ
export const BOARD_SIZES = [
  { size: 6,  label: '6×6',  difficulty: '初級' },
  { size: 8,  label: '8×8',  difficulty: '中級' },
];

// デフォルトのボードサイズ
export const DEFAULT_BOARD_SIZE = 8;

// 3D空間での26方向ベクトル（dx, dy, dz の全組み合わせから原点を除外）
export const DIRECTIONS_26 = (() => {
  const dirs = [];
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (dx || dy || dz) dirs.push([dx, dy, dz]);
  return dirs;
})();

/** レイヤー数に応じた重みを動的に生成（低い層ほど高い） */
export function getLayerWeights(layerCount) {
  const weights = [];
  for (let i = 0; i < layerCount; i++) {
    weights.push(Math.max(2, 10 - i * 2));
  }
  return weights;
}

// 後方互換
export const LAYER_WEIGHTS = [10, 6, 2];

// --- 描画関連 ---

export const RENDER = {
  BOARD_3D_MAX_PX: { 6: 280, 8: 320, 10: 340 },
  FLAT_VIEW_MAX_PX: 280,
  LAYER_GAP_PX: 80,
  PERSPECTIVE_PX: 900,
};

// --- ドラッグ操作 ---

export const DRAG = {
  SENSITIVITY_X: 0.5,
  SENSITIVITY_Y: 0.4,
  MIN_ROT_X: -80,
  MAX_ROT_X: 10,
  INITIAL_ROT_X: -35,
  INITIAL_ROT_Y: 30,
};

// --- タイミング ---

export const TIMING = {
  CPU_DELAY_MS: 400,
  GAMEOVER_DELAY_MS: 300,
  CONFETTI_LIFETIME_MS: 6000,
  CONFETTI_COUNT: 80,
  ONLINE_POLL_MS: 1500,
};
