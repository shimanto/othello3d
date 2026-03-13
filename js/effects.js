/**
 * effects.js - ゲーム終了演出
 *
 * - 結果オーバーレイ表示（勝利/敗北/引き分け）
 * - 紙吹雪アニメーション
 */

import { TIMING } from './config.js';

const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff78ae', '#a66cff', '#fff'];
const CONFETTI_SHAPES = ['circle', 'square', 'rect'];

export class Effects {
  constructor() {
    this.els = {
      overlay: document.getElementById('gameover-overlay'),
      result: document.getElementById('go-result'),
      discB: document.getElementById('go-disc-b'),
      discW: document.getElementById('go-disc-w'),
      countB: document.getElementById('go-bc'),
      countW: document.getElementById('go-wc'),
    };
  }

  /**
   * ゲーム終了オーバーレイを表示
   * @param {{ black: number, white: number }} pieces
   */
  showGameOver(pieces) {
    const { black, white } = pieces;
    const { result, discB, discW, countB, countW, overlay } = this.els;

    countB.textContent = black;
    countW.textContent = white;
    discB.classList.remove('winner');
    discW.classList.remove('winner');

    if (black > white) {
      result.textContent = '黒の勝利！';
      result.className = 'black-win';
      discB.classList.add('winner');
    } else if (white > black) {
      result.textContent = '白の勝利！';
      result.className = 'white-win';
      discW.classList.add('winner');
    } else {
      result.textContent = '引き分け！';
      result.className = 'draw';
    }

    overlay.classList.add('show');
    this._spawnConfetti();
  }

  /** オーバーレイを閉じる */
  closeOverlay() {
    this.els.overlay.classList.remove('show');
    document.querySelectorAll('.confetti').forEach((el) => el.remove());
  }

  /** 紙吹雪を生成 */
  _spawnConfetti() {
    for (let i = 0; i < TIMING.CONFETTI_COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'confetti';

      const shape = CONFETTI_SHAPES[Math.floor(Math.random() * CONFETTI_SHAPES.length)];
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const size = 6 + Math.random() * 10;

      el.style.left = Math.random() * 100 + 'vw';
      el.style.width = size + 'px';
      el.style.height = (shape === 'rect' ? size * 2.5 : size) + 'px';
      el.style.borderRadius = shape === 'circle' ? '50%' : '2px';
      el.style.background = color;
      el.style.animationDuration = 2 + Math.random() * 3 + 's';
      el.style.animationDelay = Math.random() * 1.5 + 's';

      document.body.appendChild(el);
      setTimeout(() => el.remove(), TIMING.CONFETTI_LIFETIME_MS);
    }
  }
}
