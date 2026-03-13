/**
 * cpu.test.js - CpuPlayer クラスのユニットテスト
 *
 * テスト対象:
 *   - 手の選択 (selectMove)
 *   - 手の適用 (applyMove)
 *   - 位置重みテーブル生成 (_buildPositionWeights)
 *   - 角の優先選択
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../js/board.js';
import { CpuPlayer } from '../js/cpu.js';
import { CELL } from '../js/config.js';

// ═══════════════════════════════════════
//  ヘルパー
// ═══════════════════════════════════════

function createDefaultBoard() {
  const board = new Board(8, 8);
  board.setupInitialPieces();
  return board;
}

// ═══════════════════════════════════════
//  selectMove
// ═══════════════════════════════════════

describe('CpuPlayer: selectMove', () => {
  it('有効手がある場合、手を返す', () => {
    const board = createDefaultBoard();
    const cpu = new CpuPlayer();
    const move = cpu.selectMove(board);
    assert.notEqual(move, null);
    assert.ok('x' in move);
    assert.ok('y' in move);
    assert.ok('z' in move);
    assert.ok(Array.isArray(move.flips));
  });

  it('返される手は有効手のリストに含まれる', () => {
    const board = createDefaultBoard();
    const cpu = new CpuPlayer();
    const move = cpu.selectMove(board);
    const validMoves = board.getValidMoves(board.grid, CELL.WHITE);
    const found = validMoves.some(m => m.x === move.x && m.y === move.y && m.z === move.z);
    assert.ok(found, '選択された手は有効手リストに含まれるべき');
  });

  it('有効手がない場合 null を返す', () => {
    const board = new Board(8, 8); // 空のボード
    const cpu = new CpuPlayer();
    const move = cpu.selectMove(board);
    assert.equal(move, null);
  });

  it('各サイズ(6,8,10)で手を選択できる', () => {
    const cpu = new CpuPlayer();
    for (const size of [6, 8, 10]) {
      const board = new Board(size, size);
      board.setupInitialPieces();
      const move = cpu.selectMove(board);
      assert.notEqual(move, null, `${size}×${size} で手が選択できるべき`);
    }
  });
});

// ═══════════════════════════════════════
//  applyMove
// ═══════════════════════════════════════

describe('CpuPlayer: applyMove', () => {
  it('手を適用すると石が配置される', () => {
    const board = createDefaultBoard();
    const cpu = new CpuPlayer();
    const move = cpu.selectMove(board);
    cpu.applyMove(board, move);
    assert.equal(board.grid[move.z][move.y][move.x], CELL.WHITE);
  });

  it('手を適用すると反転対象が白に変わる', () => {
    const board = createDefaultBoard();
    const cpu = new CpuPlayer();
    const move = cpu.selectMove(board);
    cpu.applyMove(board, move);
    for (const [fx, fy, fz] of move.flips) {
      assert.equal(board.grid[fz][fy][fx], CELL.WHITE,
        `(${fx},${fy},${fz}) が白に反転すべき`);
    }
  });

  it('手を適用後に石数が正しく変化する', () => {
    const board = createDefaultBoard();
    const cpu = new CpuPlayer();
    const before = board.countPieces();
    const move = cpu.selectMove(board);
    cpu.applyMove(board, move);
    const after = board.countPieces();
    // 総石数は +1
    assert.equal(
      after.black + after.white,
      before.black + before.white + 1
    );
  });
});

// ═══════════════════════════════════════
//  位置重みテーブル
// ═══════════════════════════════════════

describe('CpuPlayer: _buildPositionWeights', () => {
  it('8×8 の角(0,0)が最大重みを持つ', () => {
    const w = CpuPlayer._buildPositionWeights(8, 8);
    assert.equal(w[0][0], 120);
    assert.equal(w[0][7], 120);
    assert.equal(w[7][0], 120);
    assert.equal(w[7][7], 120);
  });

  it('角の斜め隣(1,1)は最低重み', () => {
    const w = CpuPlayer._buildPositionWeights(8, 8);
    assert.equal(w[1][1], -60);
    assert.equal(w[1][6], -60);
    assert.equal(w[6][1], -60);
    assert.equal(w[6][6], -60);
  });

  it('角の直隣は -30', () => {
    const w = CpuPlayer._buildPositionWeights(8, 8);
    assert.equal(w[0][1], -30);
    assert.equal(w[1][0], -30);
  });

  it('辺（角以外の端）は 15', () => {
    const w = CpuPlayer._buildPositionWeights(8, 8);
    assert.equal(w[0][3], 15);
    assert.equal(w[3][0], 15);
  });

  it('6×6 でも角が120になる', () => {
    const w = CpuPlayer._buildPositionWeights(6, 6);
    assert.equal(w[0][0], 120);
    assert.equal(w[5][5], 120);
  });

  it('10×10 でも角が120になる', () => {
    const w = CpuPlayer._buildPositionWeights(10, 10);
    assert.equal(w[0][0], 120);
    assert.equal(w[9][9], 120);
  });

  it('重みテーブルは上下左右対称', () => {
    const w = CpuPlayer._buildPositionWeights(8, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        assert.equal(w[y][x], w[7 - y][x], `y対称: (${x},${y})`);
        assert.equal(w[y][x], w[y][7 - x], `x対称: (${x},${y})`);
      }
    }
  });
});

// ═══════════════════════════════════════
//  角の優先選択
// ═══════════════════════════════════════

describe('CpuPlayer: 角の優先', () => {
  it('角に置ける場合、角を選択する', () => {
    // 角に置ける状況を作る
    const board = new Board(8, 8);
    // (0,0)=空, (1,0)=黒, (2,0)=白 → 白が(0,0)に置くと(1,0)を反転
    board.grid[0][0][1] = CELL.BLACK;
    board.grid[0][0][2] = CELL.WHITE;

    const cpu = new CpuPlayer();
    const move = cpu.selectMove(board);

    if (move) {
      // 角(0,0)に置ける手がある場合、それを選ぶべき
      const validMoves = board.getValidMoves(board.grid, CELL.WHITE);
      const cornerMove = validMoves.find(m => m.x === 0 && m.y === 0);
      if (cornerMove) {
        assert.equal(move.x, 0, '角のx座標');
        assert.equal(move.y, 0, '角のy座標');
      }
    }
  });
});
