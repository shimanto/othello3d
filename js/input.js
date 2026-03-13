/**
 * input.js - ユーザー入力ハンドリング
 *
 * 3Dビューのドラッグ回転（マウス・タッチ対応）を管理。
 * 回転角度が変わるたびに onRotate コールバックを呼ぶ。
 */

import { DRAG } from './config.js';

export class InputHandler {
  /**
   * @param {HTMLElement} sceneWrap - ドラッグ対象の要素
   * @param {Function} onRotate - (rotX, rotY) => void
   */
  constructor(sceneWrap, onRotate) {
    this.onRotate = onRotate;
    this.rotX = DRAG.INITIAL_ROT_X;
    this.rotY = DRAG.INITIAL_ROT_Y;

    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;

    this._bindMouse(sceneWrap);
    this._bindTouch(sceneWrap);

    // 初期回転を適用
    this.onRotate(this.rotX, this.rotY);
  }

  /** 回転角度をリセット */
  reset() {
    this.rotX = DRAG.INITIAL_ROT_X;
    this.rotY = DRAG.INITIAL_ROT_Y;
    this.onRotate(this.rotX, this.rotY);
  }

  // ───────────────────────────────────
  //  内部: ドラッグ処理
  // ───────────────────────────────────

  _applyDelta(deltaX, deltaY) {
    this.rotY += deltaX * DRAG.SENSITIVITY_X;
    this.rotX += deltaY * DRAG.SENSITIVITY_Y;
    this.rotX = Math.max(DRAG.MIN_ROT_X, Math.min(DRAG.MAX_ROT_X, this.rotX));
    this.onRotate(this.rotX, this.rotY);
  }

  _bindMouse(el) {
    el.addEventListener('mousedown', (e) => {
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      this._applyDelta(e.clientX - this._lastX, e.clientY - this._lastY);
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this._dragging = false;
    });
  }

  _bindTouch(el) {
    el.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          this._dragging = true;
          this._lastX = e.touches[0].clientX;
          this._lastY = e.touches[0].clientY;
        }
      },
      { passive: true },
    );

    el.addEventListener(
      'touchmove',
      (e) => {
        if (!this._dragging || e.touches.length !== 1) return;
        e.preventDefault(); // スクロール防止
        this._applyDelta(e.touches[0].clientX - this._lastX, e.touches[0].clientY - this._lastY);
        this._lastX = e.touches[0].clientX;
        this._lastY = e.touches[0].clientY;
      },
      { passive: false },
    );

    window.addEventListener('touchend', () => {
      this._dragging = false;
    });
  }
}
