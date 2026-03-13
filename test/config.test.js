/**
 * config.test.js - 設定値の整合性テスト
 *
 * テスト対象:
 *   - CELL 定数の一意性
 *   - DIRECTIONS_26 の方向数と内容
 *   - BOARD_SIZES の整合性
 *   - LAYER_WEIGHTS のレイヤー数との一致
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CELL,
  LAYER_COUNT,
  BOARD_SIZES,
  DEFAULT_BOARD_SIZE,
  DIRECTIONS_26,
  LAYER_WEIGHTS,
} from '../js/config.js';

describe('Config: CELL 定数', () => {
  it('3つの状態（EMPTY, BLACK, WHITE）が定義されている', () => {
    assert.ok('EMPTY' in CELL);
    assert.ok('BLACK' in CELL);
    assert.ok('WHITE' in CELL);
  });

  it('各値はすべて異なる', () => {
    const values = [CELL.EMPTY, CELL.BLACK, CELL.WHITE];
    const unique = new Set(values);
    assert.equal(unique.size, 3);
  });
});

describe('Config: DIRECTIONS_26', () => {
  it('26方向が定義されている', () => {
    assert.equal(DIRECTIONS_26.length, 26);
  });

  it('原点(0,0,0)は含まれない', () => {
    const hasOrigin = DIRECTIONS_26.some(([dx, dy, dz]) => dx === 0 && dy === 0 && dz === 0);
    assert.equal(hasOrigin, false);
  });

  it('各方向は [-1,0,1] の組み合わせ', () => {
    for (const [dx, dy, dz] of DIRECTIONS_26) {
      assert.ok([-1, 0, 1].includes(dx), `dx=${dx}`);
      assert.ok([-1, 0, 1].includes(dy), `dy=${dy}`);
      assert.ok([-1, 0, 1].includes(dz), `dz=${dz}`);
    }
  });

  it('重複する方向がない', () => {
    const keys = DIRECTIONS_26.map((d) => d.join(','));
    const unique = new Set(keys);
    assert.equal(unique.size, 26);
  });
});

describe('Config: BOARD_SIZES', () => {
  it('2つのサイズが定義されている', () => {
    assert.equal(BOARD_SIZES.length, 2);
  });

  it('各エントリに size, label, difficulty がある', () => {
    for (const entry of BOARD_SIZES) {
      assert.ok('size' in entry);
      assert.ok('label' in entry);
      assert.ok('difficulty' in entry);
    }
  });

  it('サイズは偶数である（オセロは偶数ボードが前提）', () => {
    for (const entry of BOARD_SIZES) {
      assert.equal(entry.size % 2, 0, `${entry.size} は偶数であるべき`);
    }
  });

  it('デフォルトサイズが BOARD_SIZES に含まれる', () => {
    const found = BOARD_SIZES.some((e) => e.size === DEFAULT_BOARD_SIZE);
    assert.ok(found);
  });
});

describe('Config: LAYER_WEIGHTS', () => {
  it('レイヤー数と同じ要素数', () => {
    assert.equal(LAYER_WEIGHTS.length, LAYER_COUNT);
  });

  it('低い層ほど重みが大きい（降順）', () => {
    for (let i = 0; i < LAYER_WEIGHTS.length - 1; i++) {
      assert.ok(
        LAYER_WEIGHTS[i] >= LAYER_WEIGHTS[i + 1],
        `LAYER_WEIGHTS[${i}]=${LAYER_WEIGHTS[i]} >= LAYER_WEIGHTS[${i + 1}]=${LAYER_WEIGHTS[i + 1]}`,
      );
    }
  });
});
