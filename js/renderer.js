/**
 * renderer.js - 描画処理
 *
 * DOM操作を一元管理。ゲームロジックには依存しない。
 * - 3Dビュー（レイヤー積み重ね表示）
 * - フラットビュー（選択レイヤーの2D表示）
 * - スコア・情報テキスト更新
 * - レイヤータブ
 */

import { CELL, RENDER } from './config.js';
import { i18n } from './i18n.js';

export class Renderer {
  /**
   * @param {object}   callbacks
   * @param {Function} callbacks.onCellClick    - (x, y) => void
   * @param {Function} callbacks.onLayerSelect  - (z) => void
   */
  constructor(callbacks) {
    this.callbacks = callbacks;

    // DOM要素のキャッシュ
    this.els = {
      scene: document.getElementById('scene'),
      flatView: document.getElementById('flat-view'),
      layerTabs: document.getElementById('layer-tabs'),
      scoreB: document.getElementById('sc-b'),
      scoreW: document.getElementById('sc-w'),
      info: document.getElementById('info'),
      subtitle: document.getElementById('subtitle'),
    };
  }

  // ───────────────────────────────────
  //  メイン描画
  // ───────────────────────────────────

  /**
   * 全体を再描画
   * @param {object} state - 描画に必要な状態
   * @param {import('./board.js').Board} state.board
   * @param {number}   state.turn
   * @param {boolean}  state.gameOver
   * @param {boolean}  state.isCpuThinking
   * @param {number}   state.viewLayer
   * @param {Array}    state.validMoves
   * @param {{ black: number, white: number }} state.pieces
   */
  render(state) {
    this._updateScore(state.pieces);
    this._updateInfo(state);
    this._renderLayerTabs(state.viewLayer, state.board.sizeZ);
    this._renderFlatView(state);
    this._render3DView(state);
  }

  /** サブタイトルを更新 */
  updateSubtitle(sizeX, layerCount, subtitleText) {
    this.els.subtitle.textContent = subtitleText || `${sizeX}x${sizeX} ${layerCount} layers`;
  }

  // ───────────────────────────────────
  //  スコア・情報
  // ───────────────────────────────────

  _updateScore(pieces) {
    this.els.scoreB.textContent = pieces.black;
    this.els.scoreW.textContent = pieces.white;
  }

  _updateInfo(state) {
    const { gameOver, pieces, turn, isCpuThinking, validMoves } = state;
    const el = this.els.info;

    if (gameOver) {
      const { black: b, white: w } = pieces;
      if (b > w) el.textContent = i18n.t('gameOverBlack', b, w);
      else if (w > b) el.textContent = i18n.t('gameOverWhite', b, w);
      else el.textContent = i18n.t('gameOverDraw', b, w);
    } else if (isCpuThinking) {
      el.textContent = i18n.t('cpuThinking');
    } else {
      el.textContent =
        turn === CELL.BLACK
          ? i18n.t('blackTurn', validMoves.length)
          : i18n.t('whiteTurn', validMoves.length);
    }
  }

  // ───────────────────────────────────
  //  レイヤータブ
  // ───────────────────────────────────

  _renderLayerTabs(viewLayer, layerCount) {
    const cont = this.els.layerTabs;
    cont.innerHTML = '';

    for (let z = layerCount - 1; z >= 0; z--) {
      const btn = document.createElement('button');
      btn.className = 'layer-tab' + (z === viewLayer ? ' active' : '');
      btn.textContent = `L${z + 1}`;
      btn.onclick = () => this.callbacks.onLayerSelect(z);
      cont.appendChild(btn);
    }
  }

  // ───────────────────────────────────
  //  フラットビュー（2D）
  // ───────────────────────────────────

  _renderFlatView(state) {
    const { board, viewLayer, validMoves, isCpuThinking } = state;
    const cont = this.els.flatView;
    cont.innerHTML = '';

    const z = viewLayer;
    for (let y = 0; y < board.sizeY; y++) {
      for (let x = 0; x < board.sizeX; x++) {
        const cell = this._createFlatCell(board, x, y, z, validMoves, isCpuThinking);
        cont.appendChild(cell);
      }
    }
  }

  _createFlatCell(board, x, y, z, validMoves, isCpuThinking) {
    const cell = document.createElement('div');
    cell.className = 'fcell';

    // 石の表示
    const value = board.grid[z][y][x];
    if (value !== CELL.EMPTY) {
      const disc = document.createElement('div');
      disc.className = 'fd ' + (value === CELL.BLACK ? 'b' : 'w');
      cell.appendChild(disc);
    }

    // ヒント表示
    const move = validMoves.find((m) => m.x === x && m.y === y);
    if (move && move.z === z && !isCpuThinking) {
      cell.classList.add('hint');
    }

    // スタック高さ表示（L1表示時のみ）
    const stackH = board.getStackHeight(x, y);
    if (stackH > 1 && z === 0) {
      const badge = document.createElement('span');
      badge.className = 'stack-num';
      badge.textContent = stackH;
      cell.appendChild(badge);
    }

    cell.onclick = () => {
      if (!isCpuThinking) this.callbacks.onCellClick(x, y);
    };

    return cell;
  }

  // ───────────────────────────────────
  //  3Dビュー
  // ───────────────────────────────────

  _render3DView(state) {
    const { board, viewLayer, validMoves, isCpuThinking } = state;
    const scene = this.els.scene;
    scene.innerHTML = '';

    const configMax = RENDER.BOARD_3D_MAX_PX[board.sizeX] || 320;
    const maxPx = Math.min(configMax, window.innerWidth * 0.7);
    const cellPx = Math.floor(maxPx / board.sizeX);
    const boardPx = cellPx * board.sizeX;
    const halfPx = boardPx / 2;
    const layerCount = board.sizeZ;
    const baseOffset = (-(layerCount - 1) * RENDER.LAYER_GAP_PX) / 2;

    for (let z = 0; z < layerCount; z++) {
      const layer = this._create3DLayer(
        board,
        z,
        viewLayer,
        validMoves,
        isCpuThinking,
        boardPx,
        halfPx,
        baseOffset,
      );
      scene.appendChild(layer);
    }
  }

  _create3DLayer(board, z, viewLayer, validMoves, isCpuThinking, boardPx, halfPx, baseOffset) {
    const isActive = z === viewLayer;
    const layer = document.createElement('div');
    layer.className = 'layer3d' + (isActive ? ' active-layer' : '');

    // サイズとポジション
    layer.style.width = boardPx + 'px';
    layer.style.height = boardPx + 'px';
    layer.style.marginLeft = -halfPx + 'px';
    layer.style.marginTop = -halfPx + 'px';
    layer.style.gridTemplateColumns = `repeat(${board.sizeX}, 1fr)`;
    layer.style.transform = `translateZ(${baseOffset + z * RENDER.LAYER_GAP_PX}px)`;
    layer.style.background = `rgba(20,60,40,${0.88 - z * 0.1})`;
    layer.style.border = isActive
      ? '2px solid rgba(100,200,255,0.5)'
      : '1px solid rgba(255,255,255,0.1)';

    // レイヤーラベル
    const label = document.createElement('div');
    label.className = 'layer-label';
    label.textContent = `L${z + 1}`;
    layer.appendChild(label);

    // セル
    for (let y = 0; y < board.sizeY; y++) {
      for (let x = 0; x < board.sizeX; x++) {
        const cell = this._create3DCell(board, x, y, z, validMoves, isCpuThinking);
        layer.appendChild(cell);
      }
    }

    return layer;
  }

  _create3DCell(board, x, y, z, validMoves, isCpuThinking) {
    const cell = document.createElement('div');
    cell.className = 'lcell';

    const value = board.grid[z][y][x];
    if (value !== CELL.EMPTY) {
      const disc = document.createElement('div');
      disc.className = 'd3 ' + (value === CELL.BLACK ? 'b' : 'w');
      cell.appendChild(disc);
    }

    const move = validMoves.find((m) => m.x === x && m.y === y && m.z === z);
    if (move && !isCpuThinking) {
      cell.classList.add('hint');
    }

    cell.onclick = () => {
      if (!isCpuThinking) this.callbacks.onCellClick(x, y);
    };

    return cell;
  }

  // ───────────────────────────────────
  //  フラットビューのサイズ更新
  // ───────────────────────────────────

  updateFlatViewSize(sizeX) {
    const maxPx = Math.min(RENDER.FLAT_VIEW_MAX_PX, window.innerWidth * 0.85);
    const cellPx = Math.floor(maxPx / sizeX);
    const totalPx = cellPx * sizeX;
    const fv = this.els.flatView;
    fv.style.gridTemplateColumns = `repeat(${sizeX}, 1fr)`;
    fv.style.width = totalPx + 'px';
    fv.style.height = totalPx + 'px';
  }

  /** 3Dシーンの回転を更新 */
  updateSceneRotation(rotX, rotY) {
    this.els.scene.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  }

  /** ボードの点滅エフェクト */
  setBoardFlash(enabled) {
    this.els.scene.classList.toggle('board-flash', enabled);
  }
}
