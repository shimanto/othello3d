/**
 * board.js - 盤面ロジック
 *
 * 純粋なゲームロジックのみを担当。描画やUIに依存しない。
 * - 盤面の生成・初期配置
 * - 重力による落下位置の計算
 * - 反転判定（26方向）
 * - 有効手の列挙
 * - 石の配置と反転実行
 * - 駒数カウント
 */

import { CELL, LAYER_COUNT, DIRECTIONS_26 } from './config.js';

export class Board {
  /**
   * @param {number} sizeX - 横のマス数
   * @param {number} sizeY - 縦のマス数
   */
  constructor(sizeX, sizeY) {
    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.sizeZ = LAYER_COUNT;
    this.grid = this._createEmptyGrid();
  }

  /** 空の3Dグリッドを生成 */
  _createEmptyGrid() {
    return Array.from({ length: this.sizeZ }, () =>
      Array.from({ length: this.sizeY }, () => Array(this.sizeX).fill(CELL.EMPTY)),
    );
  }

  /** 中央に初期配置を設定（L1とL2で互い違い） */
  setupInitialPieces() {
    const cy = Math.floor(this.sizeY / 2);
    const cx = Math.floor(this.sizeX / 2);

    // L1: 標準配置
    this.grid[0][cy - 1][cx - 1] = CELL.WHITE;
    this.grid[0][cy - 1][cx] = CELL.BLACK;
    this.grid[0][cy][cx - 1] = CELL.BLACK;
    this.grid[0][cy][cx] = CELL.WHITE;

    // L2: L1と互い違い
    this.grid[1][cy - 1][cx - 1] = CELL.BLACK;
    this.grid[1][cy - 1][cx] = CELL.WHITE;
    this.grid[1][cy][cx - 1] = CELL.WHITE;
    this.grid[1][cy][cx] = CELL.BLACK;
  }

  /** 座標が盤面内かどうか */
  isInBounds(x, y, z) {
    return x >= 0 && x < this.sizeX && y >= 0 && y < this.sizeY && z >= 0 && z < this.sizeZ;
  }

  /** (x, y) に石を落としたときの z 座標を返す。満杯なら -1 */
  getDropZ(x, y) {
    return Board.getDropZFromGrid(this.grid, x, y, this.sizeZ);
  }

  /** 任意のグリッドに対する dropZ（CPU先読み用） */
  static getDropZFromGrid(grid, x, y, sizeZ) {
    for (let z = 0; z < sizeZ; z++) {
      if (grid[z][y][x] === CELL.EMPTY) return z;
    }
    return -1;
  }

  /**
   * (x, y, z) に player が置いたとき反転できる石の座標リストを返す
   * @param {number[][][]} grid - 判定対象のグリッド
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} player - CELL.BLACK or CELL.WHITE
   * @returns {Array<[number, number, number]>} 反転される石の [x, y, z] リスト
   */
  getFlips(grid, x, y, z, player) {
    if (grid[z][y][x] !== CELL.EMPTY) return [];

    const opponent = player === CELL.BLACK ? CELL.WHITE : CELL.BLACK;
    const allFlips = [];

    for (const [dx, dy, dz] of DIRECTIONS_26) {
      const lineFlips = [];
      let nx = x + dx,
        ny = y + dy,
        nz = z + dz;

      // 相手の石が続く限り追跡
      while (this.isInBounds(nx, ny, nz) && grid[nz][ny][nx] === opponent) {
        lineFlips.push([nx, ny, nz]);
        nx += dx;
        ny += dy;
        nz += dz;
      }

      // 自分の石で挟めていれば反転確定
      if (lineFlips.length > 0 && this.isInBounds(nx, ny, nz) && grid[nz][ny][nx] === player) {
        allFlips.push(...lineFlips);
      }
    }

    return allFlips;
  }

  /**
   * 指定プレイヤーの有効手を全列挙
   * @param {number[][][]} grid - 判定対象のグリッド
   * @param {number} player
   * @returns {Array<{x, y, z, flips}>}
   */
  getValidMoves(grid, player) {
    const moves = [];
    for (let x = 0; x < this.sizeX; x++) {
      for (let y = 0; y < this.sizeY; y++) {
        const z = Board.getDropZFromGrid(grid, x, y, this.sizeZ);
        if (z < 0) continue;

        const flips = this.getFlips(grid, x, y, z, player);
        if (flips.length > 0) {
          moves.push({ x, y, z, flips });
        }
      }
    }
    return moves;
  }

  /**
   * 石を配置して反転を実行
   * @returns {boolean} 配置できたかどうか
   */
  placePiece(x, y, player) {
    const z = this.getDropZ(x, y);
    if (z < 0) return false;

    const flips = this.getFlips(this.grid, x, y, z, player);
    if (flips.length === 0) return false;

    this.grid[z][y][x] = player;
    for (const [fx, fy, fz] of flips) {
      this.grid[fz][fy][fx] = player;
    }
    return true;
  }

  /** 黒・白の石数をカウント */
  countPieces() {
    let black = 0,
      white = 0;
    for (let z = 0; z < this.sizeZ; z++)
      for (let y = 0; y < this.sizeY; y++)
        for (let x = 0; x < this.sizeX; x++) {
          if (this.grid[z][y][x] === CELL.BLACK) black++;
          if (this.grid[z][y][x] === CELL.WHITE) white++;
        }
    return { black, white };
  }

  /** (x, y) の積み上げ高さを返す */
  getStackHeight(x, y) {
    let h = 0;
    for (let z = 0; z < this.sizeZ; z++) {
      if (this.grid[z][y][x] !== CELL.EMPTY) h = z + 1;
    }
    return h;
  }

  /** グリッドのディープコピー */
  static cloneGrid(grid) {
    return grid.map((layer) => layer.map((row) => [...row]));
  }
}
