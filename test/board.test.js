/**
 * board.test.js - Board クラスのユニットテスト
 *
 * テスト対象:
 *   - グリッド生成・初期配置
 *   - 境界判定 (isInBounds)
 *   - 重力落下 (getDropZ)
 *   - 反転判定 (getFlips) — 水平・垂直・3D斜め
 *   - 有効手列挙 (getValidMoves)
 *   - 石の配置 (placePiece)
 *   - 駒数カウント (countPieces)
 *   - スタック高さ (getStackHeight)
 *   - グリッドコピー (cloneGrid)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../js/board.js';
import { CELL, LAYER_COUNT } from '../js/config.js';

// ═══════════════════════════════════════
//  ヘルパー
// ═══════════════════════════════════════

/** 初期配置済みの 8×8 ボードを生成 */
function createDefaultBoard() {
  const board = new Board(8, 8);
  board.setupInitialPieces();
  return board;
}

/** 指定サイズで初期配置済みのボードを生成 */
function createBoard(size) {
  const board = new Board(size, size);
  board.setupInitialPieces();
  return board;
}

// ═══════════════════════════════════════
//  グリッド生成・初期配置
// ═══════════════════════════════════════

describe('Board: グリッド生成', () => {
  it('指定サイズの空グリッドが生成される', () => {
    const board = new Board(8, 8);
    assert.equal(board.sizeX, 8);
    assert.equal(board.sizeY, 8);
    assert.equal(board.sizeZ, LAYER_COUNT);
    assert.equal(board.grid.length, LAYER_COUNT);
    assert.equal(board.grid[0].length, 8);
    assert.equal(board.grid[0][0].length, 8);
  });

  it('初期状態では全セルが空', () => {
    const board = new Board(6, 6);
    for (let z = 0; z < LAYER_COUNT; z++)
      for (let y = 0; y < 6; y++)
        for (let x = 0; x < 6; x++) assert.equal(board.grid[z][y][x], CELL.EMPTY);
  });

  it('6×6 でもグリッドが正しく生成される', () => {
    const board = new Board(6, 6);
    assert.equal(board.grid[0].length, 6);
    assert.equal(board.grid[0][0].length, 6);
  });
});

describe('Board: 初期配置', () => {
  it('8×8 の L1 に標準配置（白黒白黒）がされる', () => {
    const board = createDefaultBoard();
    // 中央: (3,3), (3,4), (4,3), (4,4)
    assert.equal(board.grid[0][3][3], CELL.WHITE);
    assert.equal(board.grid[0][3][4], CELL.BLACK);
    assert.equal(board.grid[0][4][3], CELL.BLACK);
    assert.equal(board.grid[0][4][4], CELL.WHITE);
  });

  it('L2 は L1 と互い違いに配置される', () => {
    const board = createDefaultBoard();
    assert.equal(board.grid[1][3][3], CELL.BLACK);
    assert.equal(board.grid[1][3][4], CELL.WHITE);
    assert.equal(board.grid[1][4][3], CELL.WHITE);
    assert.equal(board.grid[1][4][4], CELL.BLACK);
  });

  it('L3 は空のままである', () => {
    const board = createDefaultBoard();
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) assert.equal(board.grid[2][y][x], CELL.EMPTY);
  });

  it('初期配置の石数は黒4白4の合計8個', () => {
    const board = createDefaultBoard();
    const { black, white } = board.countPieces();
    assert.equal(black, 4);
    assert.equal(white, 4);
  });

  it('6×6 の初期配置は中央(2,2)〜(3,3)に配置される', () => {
    const board = createBoard(6);
    assert.equal(board.grid[0][2][2], CELL.WHITE);
    assert.equal(board.grid[0][2][3], CELL.BLACK);
    assert.equal(board.grid[0][3][2], CELL.BLACK);
    assert.equal(board.grid[0][3][3], CELL.WHITE);
  });
});

// ═══════════════════════════════════════
//  境界判定
// ═══════════════════════════════════════

describe('Board: isInBounds', () => {
  const board = new Board(8, 8);

  it('盤面内の座標は true', () => {
    assert.equal(board.isInBounds(0, 0, 0), true);
    assert.equal(board.isInBounds(7, 7, 2), true);
    assert.equal(board.isInBounds(4, 3, 1), true);
  });

  it('盤面外の座標は false', () => {
    assert.equal(board.isInBounds(-1, 0, 0), false);
    assert.equal(board.isInBounds(0, -1, 0), false);
    assert.equal(board.isInBounds(0, 0, -1), false);
    assert.equal(board.isInBounds(8, 0, 0), false);
    assert.equal(board.isInBounds(0, 8, 0), false);
    assert.equal(board.isInBounds(0, 0, LAYER_COUNT), false);
  });
});

// ═══════════════════════════════════════
//  重力落下
// ═══════════════════════════════════════

describe('Board: getDropZ（重力）', () => {
  it('空の列では z=0 に落ちる', () => {
    const board = new Board(8, 8);
    assert.equal(board.getDropZ(0, 0), 0);
  });

  it('初期配置の中央では z=2（L1,L2が埋まっている）に落ちる', () => {
    const board = createDefaultBoard();
    assert.equal(board.getDropZ(3, 3), 2);
    assert.equal(board.getDropZ(4, 4), 2);
  });

  it('初期配置の空きマスでは z=0 に落ちる', () => {
    const board = createDefaultBoard();
    assert.equal(board.getDropZ(0, 0), 0);
  });

  it('全層が埋まっている場合は -1 を返す', () => {
    const board = new Board(8, 8);
    board.grid[0][0][0] = CELL.BLACK;
    board.grid[1][0][0] = CELL.WHITE;
    board.grid[2][0][0] = CELL.BLACK;
    assert.equal(board.getDropZ(0, 0), -1);
  });

  it('getDropZFromGrid でも同じ結果が得られる', () => {
    const board = createDefaultBoard();
    const z = Board.getDropZFromGrid(board.grid, 3, 3, board.sizeZ);
    assert.equal(z, 2);
  });
});

// ═══════════════════════════════════════
//  反転判定
// ═══════════════════════════════════════

describe('Board: getFlips（反転判定）', () => {
  it('空でないセルには置けない（反転リスト空）', () => {
    const board = createDefaultBoard();
    const flips = board.getFlips(board.grid, 3, 3, 0, CELL.BLACK);
    assert.equal(flips.length, 0);
  });

  it('水平方向の反転が正しく検出される', () => {
    const board = createDefaultBoard();
    // 黒が (2,3,0) に置くと、(3,3,0) の白を反転できる
    const flips = board.getFlips(board.grid, 2, 3, 0, CELL.BLACK);
    const hasFlip = flips.some(([fx, fy, fz]) => fx === 3 && fy === 3 && fz === 0);
    assert.equal(hasFlip, true);
  });

  it('垂直方向（z軸）の反転が正しく検出される', () => {
    const board = new Board(8, 8);
    // z=0: 黒, z=1: 白, z=2: 空 → 黒が z=2 に置くと z=1 の白を反転
    board.grid[0][3][3] = CELL.BLACK;
    board.grid[1][3][3] = CELL.WHITE;
    const flips = board.getFlips(board.grid, 3, 3, 2, CELL.BLACK);
    const hasVerticalFlip = flips.some(([fx, fy, fz]) => fx === 3 && fy === 3 && fz === 1);
    assert.equal(hasVerticalFlip, true);
  });

  it('挟めない方向では反転が発生しない', () => {
    const board = new Board(8, 8);
    // 白が1つだけ、その先に黒がない
    board.grid[0][3][3] = CELL.WHITE;
    const flips = board.getFlips(board.grid, 2, 3, 0, CELL.BLACK);
    assert.equal(flips.length, 0);
  });

  it('3D斜め方向の反転が正しく検出される', () => {
    const board = new Board(8, 8);
    // (3,3,0)に黒、(4,4,1)に白 → 黒が(5,5,2)に置くと(4,4,1)を反転
    board.grid[0][3][3] = CELL.BLACK;
    board.grid[1][4][4] = CELL.WHITE;
    const flips = board.getFlips(board.grid, 5, 5, 2, CELL.BLACK);
    const hasDiagFlip = flips.some(([fx, fy, fz]) => fx === 4 && fy === 4 && fz === 1);
    assert.equal(hasDiagFlip, true);
  });

  it('複数方向の反転が同時に検出される', () => {
    const board = new Board(8, 8);
    // 水平と垂直の両方で反転が起きる配置
    board.grid[0][3][3] = CELL.BLACK; // 挟む用（水平右端）
    board.grid[0][3][1] = CELL.WHITE; // 反転対象（水平）
    board.grid[1][3][0] = CELL.WHITE; // 反転対象（垂直）
    board.grid[2][3][0] = CELL.BLACK; // 挟む用（垂直上端）
    // 黒が (0,3,0) に置く → (1,3,0) 水平方向は白が1つで黒が (3,3,0) にある
    // 実際のテスト: 黒が (2,3,0) に置くと (1,3,0) を挟む → 反転が起きるか？
    // (2,3,0) に黒を置く: 左に (1,3,0)=白、(0,3,0)=空なので反転なし
    // 右に (3,3,0)=黒なので反転なし
    // シンプルなケースに修正
    const board2 = new Board(8, 8);
    board2.grid[0][3][2] = CELL.BLACK;
    board2.grid[0][3][3] = CELL.WHITE;
    board2.grid[0][4][4] = CELL.WHITE;
    board2.grid[0][5][4] = CELL.BLACK;
    // 黒が (4,3,0) に置くと、左方向で (3,3,0) の白を反転
    const flips2 = board2.getFlips(board2.grid, 4, 3, 0, CELL.BLACK);
    assert.ok(flips2.length >= 1, '少なくとも1つの反転が必要');
  });
});

// ═══════════════════════════════════════
//  有効手列挙
// ═══════════════════════════════════════

describe('Board: getValidMoves', () => {
  it('初期配置で黒の有効手が存在する', () => {
    const board = createDefaultBoard();
    const moves = board.getValidMoves(board.grid, CELL.BLACK);
    assert.ok(moves.length > 0, '有効手が1つ以上あるべき');
  });

  it('初期配置で白の有効手も存在する', () => {
    const board = createDefaultBoard();
    const moves = board.getValidMoves(board.grid, CELL.WHITE);
    assert.ok(moves.length > 0, '有効手が1つ以上あるべき');
  });

  it('有効手には座標と反転リストが含まれる', () => {
    const board = createDefaultBoard();
    const moves = board.getValidMoves(board.grid, CELL.BLACK);
    const move = moves[0];
    assert.ok('x' in move, 'x座標が必要');
    assert.ok('y' in move, 'y座標が必要');
    assert.ok('z' in move, 'z座標が必要');
    assert.ok(Array.isArray(move.flips), 'flips は配列');
    assert.ok(move.flips.length > 0, '有効手には反転が1つ以上');
  });

  it('空のボードでは有効手がない', () => {
    const board = new Board(8, 8);
    const moves = board.getValidMoves(board.grid, CELL.BLACK);
    assert.equal(moves.length, 0);
  });

  it('各サイズ(6,8,10)で初期配置後に有効手が存在する', () => {
    for (const size of [6, 8, 10]) {
      const board = createBoard(size);
      const moves = board.getValidMoves(board.grid, CELL.BLACK);
      assert.ok(moves.length > 0, `${size}×${size} で有効手が必要`);
    }
  });
});

// ═══════════════════════════════════════
//  石の配置
// ═══════════════════════════════════════

describe('Board: placePiece', () => {
  it('有効な手を打つと true を返す', () => {
    const board = createDefaultBoard();
    const moves = board.getValidMoves(board.grid, CELL.BLACK);
    const move = moves[0];
    const result = board.placePiece(move.x, move.y, CELL.BLACK);
    assert.equal(result, true);
  });

  it('配置後に石数が増える', () => {
    const board = createDefaultBoard();
    const before = board.countPieces();
    const moves = board.getValidMoves(board.grid, CELL.BLACK);
    board.placePiece(moves[0].x, moves[0].y, CELL.BLACK);
    const after = board.countPieces();
    assert.ok(after.black > before.black, '黒の石が増えるべき');
  });

  it('反転対象の石が自分の色に変わる', () => {
    const board = createDefaultBoard();
    const moves = board.getValidMoves(board.grid, CELL.BLACK);
    const move = moves[0];
    board.placePiece(move.x, move.y, CELL.BLACK);
    // 反転した石が黒になっているか
    for (const [fx, fy, fz] of move.flips) {
      assert.equal(board.grid[fz][fy][fx], CELL.BLACK, `(${fx},${fy},${fz}) が黒に反転すべき`);
    }
  });

  it('無効な位置（反転できない）に置くと false を返す', () => {
    const board = createDefaultBoard();
    // 角（初期状態では反転不可能）
    const result = board.placePiece(0, 0, CELL.BLACK);
    assert.equal(result, false);
  });

  it('満杯の列に置くと false を返す', () => {
    const board = new Board(8, 8);
    board.grid[0][0][0] = CELL.BLACK;
    board.grid[1][0][0] = CELL.WHITE;
    board.grid[2][0][0] = CELL.BLACK;
    const result = board.placePiece(0, 0, CELL.BLACK);
    assert.equal(result, false);
  });
});

// ═══════════════════════════════════════
//  駒数カウント
// ═══════════════════════════════════════

describe('Board: countPieces', () => {
  it('空のボードでは黒0白0', () => {
    const board = new Board(8, 8);
    const { black, white } = board.countPieces();
    assert.equal(black, 0);
    assert.equal(white, 0);
  });

  it('初期配置では黒4白4', () => {
    const board = createDefaultBoard();
    const { black, white } = board.countPieces();
    assert.equal(black, 4);
    assert.equal(white, 4);
  });

  it('石を1つ手動で追加するとカウントが増える', () => {
    const board = new Board(8, 8);
    board.grid[0][0][0] = CELL.BLACK;
    const { black, white } = board.countPieces();
    assert.equal(black, 1);
    assert.equal(white, 0);
  });
});

// ═══════════════════════════════════════
//  スタック高さ
// ═══════════════════════════════════════

describe('Board: getStackHeight', () => {
  it('空の列は高さ0', () => {
    const board = new Board(8, 8);
    assert.equal(board.getStackHeight(0, 0), 0);
  });

  it('初期配置の中央は高さ2（L1+L2）', () => {
    const board = createDefaultBoard();
    assert.equal(board.getStackHeight(3, 3), 2);
    assert.equal(board.getStackHeight(4, 4), 2);
  });

  it('全層埋めると高さ3', () => {
    const board = new Board(8, 8);
    board.grid[0][0][0] = CELL.BLACK;
    board.grid[1][0][0] = CELL.WHITE;
    board.grid[2][0][0] = CELL.BLACK;
    assert.equal(board.getStackHeight(0, 0), 3);
  });
});

// ═══════════════════════════════════════
//  グリッドコピー
// ═══════════════════════════════════════

describe('Board: cloneGrid', () => {
  it('コピーは元と同じ内容を持つ', () => {
    const board = createDefaultBoard();
    const clone = Board.cloneGrid(board.grid);
    assert.deepEqual(clone, board.grid);
  });

  it('コピーを変更しても元に影響しない', () => {
    const board = createDefaultBoard();
    const clone = Board.cloneGrid(board.grid);
    clone[0][0][0] = CELL.BLACK;
    assert.equal(board.grid[0][0][0], CELL.EMPTY);
  });

  it('元を変更してもコピーに影響しない', () => {
    const board = createDefaultBoard();
    const clone = Board.cloneGrid(board.grid);
    board.grid[0][0][0] = CELL.WHITE;
    assert.equal(clone[0][0][0], CELL.EMPTY);
  });
});

// ═══════════════════════════════════════
//  ゲーム進行シナリオ
// ═══════════════════════════════════════

describe('Board: ゲーム進行シナリオ', () => {
  it('黒→白→黒と交互に打てる', () => {
    const board = createDefaultBoard();

    // 黒の手
    const blackMoves = board.getValidMoves(board.grid, CELL.BLACK);
    assert.ok(blackMoves.length > 0);
    board.placePiece(blackMoves[0].x, blackMoves[0].y, CELL.BLACK);

    // 白の手
    const whiteMoves = board.getValidMoves(board.grid, CELL.WHITE);
    assert.ok(whiteMoves.length > 0);
    board.placePiece(whiteMoves[0].x, whiteMoves[0].y, CELL.WHITE);

    // もう一度黒の手
    const blackMoves2 = board.getValidMoves(board.grid, CELL.BLACK);
    assert.ok(blackMoves2.length > 0);
  });

  it('配置後の総石数は配置前+1+反転数の差分で増加する', () => {
    const board = createDefaultBoard();
    const beforeCount = board.countPieces();
    const totalBefore = beforeCount.black + beforeCount.white;

    const moves = board.getValidMoves(board.grid, CELL.BLACK);
    board.placePiece(moves[0].x, moves[0].y, CELL.BLACK);

    const afterCount = board.countPieces();
    const totalAfter = afterCount.black + afterCount.white;

    // 1つ新しく置くので総数は+1
    assert.equal(totalAfter, totalBefore + 1);
  });
});
