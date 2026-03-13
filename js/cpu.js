/**
 * cpu.js - CPU思考ロジック
 *
 * 位置の重み付け評価 + 1手先読みで手を選択する。
 * ボードサイズに応じて重みテーブルを動的生成。
 */

import { CELL, getLayerWeights } from './config.js';
import { Board } from './board.js';

export class CpuPlayer {
  /**
   * 最善手を選択して返す
   * @param {Board} board
   * @returns {{ x, y, z, flips } | null}
   */
  selectMove(board) {
    const moves = board.getValidMoves(board.grid, CELL.WHITE);
    if (moves.length === 0) return null;

    const posWeights = CpuPlayer._buildPositionWeights(board.sizeX, board.sizeY);

    let best = null;
    let bestScore = -Infinity;

    for (const move of moves) {
      const score = this._evaluateMove(board, move, posWeights);
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }

    return best;
  }

  /**
   * 石を配置して反転を実行（board を直接操作）
   * @param {Board} board
   * @param {{ x, y, z, flips }} move
   */
  applyMove(board, move) {
    board.grid[move.z][move.y][move.x] = CELL.WHITE;
    for (const [fx, fy, fz] of move.flips) {
      board.grid[fz][fy][fx] = CELL.WHITE;
    }
  }

  /**
   * 1手の評価値を計算（位置重み + 層重み + 反転数 - 相手の最善応手）
   */
  _evaluateMove(board, move, posWeights) {
    const lw = getLayerWeights(board.sizeZ);
    const layerWeight = lw[move.z] || 0;
    let score = posWeights[move.y][move.x] + layerWeight + move.flips.length * 2;

    // 1手先読み: 相手の最善応手を減点
    const simGrid = Board.cloneGrid(board.grid);
    simGrid[move.z][move.y][move.x] = CELL.WHITE;
    for (const [fx, fy, fz] of move.flips) {
      simGrid[fz][fy][fx] = CELL.WHITE;
    }

    const opponentMoves = board.getValidMoves(simGrid, CELL.BLACK);
    if (opponentMoves.length > 0) {
      const opponentBest = Math.max(
        ...opponentMoves.map(
          (om) => posWeights[om.y][om.x] + (lw[om.z] || 0) + om.flips.length * 2,
        ),
      );
      score -= opponentBest * 0.6;
    } else {
      score += 30; // 相手パスは有利
    }

    return score;
  }

  /**
   * ボードサイズに応じた位置重みテーブルを動的生成
   * 角 > 辺 > 内側の順に高評価。角の隣は低評価（危険マス）。
   */
  static _buildPositionWeights(sizeX, sizeY) {
    const weights = Array.from({ length: sizeY }, () => Array(sizeX).fill(0));

    for (let y = 0; y < sizeY; y++) {
      for (let x = 0; x < sizeX; x++) {
        const distY = Math.min(y, sizeY - 1 - y);
        const distX = Math.min(x, sizeX - 1 - x);

        if (distY === 0 && distX === 0) {
          weights[y][x] = 120;
        } // 角
        else if (distY === 1 && distX === 1) {
          weights[y][x] = -60;
        } // 角の斜め隣（最危険）
        else if ((distY === 0 && distX === 1) || (distY === 1 && distX === 0)) {
          weights[y][x] = -30;
        } // 角の直隣
        else if (distY === 0 || distX === 0) {
          weights[y][x] = 15;
        } // 辺
        else if (distY === 1 || distX === 1) {
          weights[y][x] = -5;
        } // 辺の内側隣
        else {
          weights[y][x] = Math.max(0, 3 - Math.abs(distY - distX));
        }
      }
    }

    return weights;
  }
}
