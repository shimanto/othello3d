/**
 * main.js - ゲームフロー制御（エントリーポイント）
 *
 * GameState でゲーム状態を一元管理し、
 * Board / CpuPlayer / Renderer / Effects / InputHandler を統合する。
 * i18n / オンライン対戦 / レイヤー数選択に対応。
 */

import { CELL, DEFAULT_BOARD_SIZE, DEFAULT_LAYER_COUNT, setLayerCount, TIMING } from './config.js';
import { Board } from './board.js';
import { CpuPlayer } from './cpu.js';
import { Renderer } from './renderer.js';
import { Effects } from './effects.js';
import { InputHandler } from './input.js';
import { i18n, LANGUAGES } from './i18n.js';

// ═══════════════════════════════════════
//  ゲーム状態
// ═══════════════════════════════════════

class GameState {
  constructor() {
    this.boardSize = DEFAULT_BOARD_SIZE;
    this.layerCount = DEFAULT_LAYER_COUNT;
    this.mode = 'pvp'; // 'pvp' | 'pvc' | 'online'
    this.turn = CELL.BLACK;
    this.gameOver = false;
    this.viewLayer = 0;
    this.board = null;

    // オンライン対戦用（アクティブゲーム - フォアグラウンド時）
    this.playerId = this._getOrCreatePlayerId();
    this.roomId = null;
    this.myColor = null; // 'black' | 'white'
    this.onlinePollTimer = null; // ゲーム中のポーリング
    this.queueId = null;

    // オンライン対戦バックグラウンド状態
    this.onlineRoomId = null;
    this.onlineMyColor = null;
    this.onlineBoard = null;
    this.onlineTurn = null;
    this.onlineGameOver = false;
    this.onlineBoardSize = null;
    this.onlineLayerCount = null;
    this.onlineViewLayer = 0;

    // 待機状態（モード切替でも保持）
    this.waitingType = null; // 'queue' | 'room' | null
    this.waitingRoomId = null;
    this.waitingQueueId = null;
    this.waitingPollTimer = null;
    this.waitingBoardSize = null;
    this.waitingLayerCount = null;

    // スタンプ
    this.lastStampTs = 0;
  }

  get isCpuThinking() {
    return this.mode === 'pvc' && this.turn === CELL.WHITE && !this.gameOver;
  }

  get isMyTurn() {
    if (this.mode !== 'online') return true;
    if (!this.roomId) return true;
    const myCell = this.myColor === 'black' ? CELL.BLACK : CELL.WHITE;
    return this.turn === myCell;
  }

  _getOrCreatePlayerId() {
    let id = localStorage.getItem('othello3d_playerId');
    if (!id) {
      id = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('othello3d_playerId', id);
    }
    return id;
  }
}

// ═══════════════════════════════════════
//  チャレンジャーメッセージ
// ═══════════════════════════════════════

const CHALLENGER_MESSAGES = [
  '挑戦者現る！',
  '新たな刺客が…！',
  '強者の気配がする…',
  '宿敵、降臨。',
  '逃げるなら今のうち！',
  '嵐の予感…！',
  '猛者が待ち構えている！',
  '運命の対局、始まる。',
  '次の相手はお前だ！',
  'オセロの神が降臨！',
  '戦いの鐘が鳴る…',
  '勝負師が参上！',
  '伝説の一局が始まる！',
  '最強を決めよう！',
  '盤上の王者は誰だ？',
  '腕に覚えはあるか？',
  '白黒つけようぜ！',
  '決戦の刻…！',
  '手加減なしで行くぞ！',
  '全力でかかってこい！',
];

// ═══════════════════════════════════════
//  ゲームコントローラー
// ═══════════════════════════════════════

class Game {
  constructor() {
    this.state = new GameState();
    this.cpu = new CpuPlayer();
    this.effects = new Effects();

    this.renderer = new Renderer({
      onCellClick: (x, y) => this.handleCellClick(x, y),
      onLayerSelect: (z) => this.handleLayerSelect(z),
    });

    this.input = new InputHandler(document.getElementById('scene-wrap'), (rotX, rotY) =>
      this.renderer.updateSceneRotation(rotX, rotY),
    );

    this._bindButtons();
    this._bindResize();
    this._applyLang();
    this.init();
    this._checkDirectLink();
    this._startQueueCountPoll();
  }

  // ───────────────────────────────────
  //  初期化・設定
  // ───────────────────────────────────

  init() {
    const s = this.state;

    this.effects.closeOverlay();
    this.renderer.setBoardFlash(false);

    // オンラインパネルは待機中でなければ非表示
    if (!s.waitingType) {
      this._hideOnlineUI();
    }

    setLayerCount(s.layerCount);
    s.board = new Board(s.boardSize, s.boardSize);
    s.board.setupInitialPieces();
    s.turn = CELL.BLACK;
    s.gameOver = false;
    s.viewLayer = 0;

    this.renderer.updateSubtitle(
      s.boardSize,
      s.layerCount,
      i18n.t('subtitle', s.boardSize, s.layerCount),
    );
    this.renderer.updateFlatViewSize(s.boardSize);
    this._render();
  }

  setMode(mode) {
    const s = this.state;
    const hasActiveOnlineGame = s.onlineRoomId && !s.onlineGameOver;

    s.mode = mode;
    document.getElementById('btnPvP').classList.toggle('active', mode === 'pvp');
    document.getElementById('btnPvC').classList.toggle('active', mode === 'pvc');
    document
      .getElementById('btnOnline')
      .classList.toggle('active', mode === 'online' || !!s.waitingType || hasActiveOnlineGame);

    if (mode === 'online') {
      if (hasActiveOnlineGame) {
        // バックグラウンドのオンラインゲームをフォアグラウンドに復元
        this._restoreOnlineGame();
        return;
      }
      // 待機中ならパネルにwaitingを表示、そうでなければactionsを表示
      this._showOnlineUI();
      if (s.waitingType) {
        document.getElementById('online-actions').style.display = 'none';
        document.getElementById('online-waiting').style.display = 'flex';
      }
      return;
    }

    // PvP/PvCに切替：オンラインゲーム中ならボード状態を退避
    if (hasActiveOnlineGame && s.roomId) {
      this._saveOnlineGame();
    }
    this._hideOnlineUI();
    this.init();
  }

  setSize(size) {
    this.state.boardSize = size;
    document.getElementById('btnS6').classList.toggle('active', size === 6);
    document.getElementById('btnS8').classList.toggle('active', size === 8);
    this.init();
  }

  setLayers(count) {
    this.state.layerCount = count;
    document.getElementById('btnL3').classList.toggle('active', count === 3);
    document.getElementById('btnL5').classList.toggle('active', count === 5);
    this.init();
  }

  // ───────────────────────────────────
  //  言語切替
  // ───────────────────────────────────

  changeLang(lang) {
    i18n.setLang(lang);
    localStorage.setItem('othello3d_lang', lang);
    this._applyLang();
    this._render();
  }

  _applyLang() {
    const saved = localStorage.getItem('othello3d_lang');
    if (saved) i18n.setLang(saved);

    document.getElementById('title').textContent = i18n.t('title');
    document.getElementById('boardSizeLabel').textContent = i18n.t('boardSize');
    document.getElementById('layerLabel').textContent = i18n.t('layers');
    document.getElementById('btnPvP').innerHTML = i18n.t('pvp');
    document.getElementById('btnPvC').innerHTML = i18n.t('pvc');
    document.getElementById('btnOnline').innerHTML = i18n.t('online');
    // 待機中/対戦中ならクラスを再適用（innerHTMLでクラスがリセットされるため）
    if (this.state.waitingType) {
      this._setOnlineWaiting(true);
    }
    if (this.state.onlineRoomId && !this.state.onlineGameOver) {
      this._setOnlinePlaying(true);
    }
    document.getElementById('btnReset').textContent = i18n.t('reset');
    document.getElementById('go-restart').textContent = i18n.t('playAgain');
    document.getElementById('panelTitle').textContent = i18n.t('layerView');
    document.getElementById('panelHint').textContent = i18n.t('clickToPlace');
    document.getElementById('legendText').innerHTML = i18n.t('rules', this.state.layerCount);

    const torusLink = document.getElementById('torusLink');
    if (torusLink) torusLink.textContent = i18n.t('torusLink');

    // オンラインパネルのボタン
    const btnMatch = document.getElementById('btnMatchmaking');
    if (btnMatch) btnMatch.textContent = i18n.t('matching');
    const btnCreate = document.getElementById('btnCreateRoom');
    if (btnCreate) btnCreate.textContent = i18n.t('createRoomBtn');
    const btnJoin = document.getElementById('btnJoinRoom');
    if (btnJoin) btnJoin.textContent = i18n.t('joinBtn');
    const codeInput = document.getElementById('roomCodeInput');
    if (codeInput) codeInput.placeholder = i18n.t('enterCodePlaceholder');

    // 言語プルダウン
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
      langSelect.innerHTML = '';
      for (const lang of LANGUAGES) {
        const opt = document.createElement('option');
        opt.value = lang.code;
        opt.textContent = lang.label;
        opt.selected = lang.code === i18n.currentLang;
        langSelect.appendChild(opt);
      }
    }

    const s = this.state;
    this.renderer.updateSubtitle(
      s.boardSize,
      s.layerCount,
      i18n.t('subtitle', s.boardSize, s.layerCount),
    );
  }

  // ───────────────────────────────────
  //  ユーザー操作
  // ───────────────────────────────────

  handleCellClick(x, y) {
    const s = this.state;
    if (s.gameOver || s.isCpuThinking) return;
    if (s.mode === 'online' && !s.isMyTurn) return;

    const placed = s.board.placePiece(x, y, s.turn);
    if (!placed) return;

    this._advanceTurn();

    if (s.mode === 'online') {
      this._sendMove();
    }
  }

  handleLayerSelect(z) {
    this.state.viewLayer = z;
    this._render();
  }

  // ───────────────────────────────────
  //  ターン進行
  // ───────────────────────────────────

  _advanceTurn() {
    const s = this.state;
    const opponent = s.turn === CELL.BLACK ? CELL.WHITE : CELL.BLACK;

    if (s.board.getValidMoves(s.board.grid, opponent).length > 0) {
      s.turn = opponent;
    } else if (s.board.getValidMoves(s.board.grid, s.turn).length === 0) {
      s.gameOver = true;
    }

    this._render();

    if (s.gameOver) {
      setTimeout(() => this._onGameOver(), TIMING.GAMEOVER_DELAY_MS);
      return;
    }

    if (s.isCpuThinking) {
      setTimeout(() => this._doCpuMove(), TIMING.CPU_DELAY_MS);
    }
  }

  _doCpuMove() {
    const s = this.state;
    if (s.gameOver || s.turn !== CELL.WHITE) return;

    const move = this.cpu.selectMove(s.board);
    if (!move) return;

    this.cpu.applyMove(s.board, move);
    this._advanceTurn();
  }

  _onGameOver() {
    const pieces = this.state.board.countPieces();
    this.renderer.setBoardFlash(true);
    this.effects.showGameOver(pieces);
  }

  // ───────────────────────────────────
  //  描画
  // ───────────────────────────────────

  _render() {
    const s = this.state;
    const isOnlineWaiting = s.mode === 'online' && !s.isMyTurn && !s.gameOver;

    this.renderer.render({
      board: s.board,
      turn: s.turn,
      gameOver: s.gameOver,
      isCpuThinking: s.isCpuThinking || isOnlineWaiting,
      viewLayer: s.viewLayer,
      validMoves: s.gameOver ? [] : s.board.getValidMoves(s.board.grid, s.turn),
      pieces: s.board.countPieces(),
    });

    // オンラインモードの情報表示を上書き
    if (s.mode === 'online' && s.roomId && !s.gameOver) {
      const el = document.getElementById('info');
      if (s.isMyTurn) {
        el.textContent = i18n.t('yourTurn');
      } else {
        el.textContent = i18n.t('opponentTurn');
      }
    }
  }

  // ───────────────────────────────────
  //  オンライン対戦
  // ───────────────────────────────────

  _showOnlineUI() {
    document.getElementById('online-panel').style.display = 'flex';
  }

  _hideOnlineUI() {
    document.getElementById('online-panel').style.display = 'none';
    const waitEl = document.getElementById('online-waiting');
    if (waitEl) waitEl.style.display = 'none';
    // 待機中でなければオレンジ点滅も消す
    if (!this.state.waitingType) {
      this._setOnlineWaiting(false);
    }
  }

  _saveOnlineGame() {
    const s = this.state;
    s.onlineBoard = s.board;
    s.onlineTurn = s.turn;
    s.onlineGameOver = s.gameOver;
    s.onlineViewLayer = s.viewLayer;
    // roomId, myColor, onlineRoomId はそのまま保持
  }

  _restoreOnlineGame() {
    const s = this.state;
    this._hideOnlineUI();
    this.effects.closeOverlay();
    this.renderer.setBoardFlash(false);

    s.mode = 'online';
    s.roomId = s.onlineRoomId;
    s.myColor = s.onlineMyColor;
    s.board = s.onlineBoard;
    s.turn = s.onlineTurn;
    s.gameOver = s.onlineGameOver;
    s.viewLayer = s.onlineViewLayer;
    s.boardSize = s.onlineBoardSize;
    s.layerCount = s.onlineLayerCount;

    setLayerCount(s.layerCount);
    document.getElementById('btnS6').classList.toggle('active', s.boardSize === 6);
    document.getElementById('btnS8').classList.toggle('active', s.boardSize === 8);
    document.getElementById('btnL3').classList.toggle('active', s.layerCount === 3);
    document.getElementById('btnL5').classList.toggle('active', s.layerCount === 5);
    this.renderer.updateSubtitle(
      s.boardSize,
      s.layerCount,
      i18n.t('subtitle', s.boardSize, s.layerCount),
    );
    this.renderer.updateFlatViewSize(s.boardSize);
    this._showStampChat();
    this._render();
  }

  async joinQueue() {
    const s = this.state;
    document.getElementById('online-waiting').style.display = 'flex';
    document.getElementById('online-actions').style.display = 'none';
    document.getElementById('waitingText').textContent = i18n.t('waiting');
    this._setOnlineWaiting(true);

    // 待機設定を記録
    s.waitingBoardSize = s.boardSize;
    s.waitingLayerCount = s.layerCount;

    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: s.playerId,
          boardSize: s.boardSize,
          layerCount: s.layerCount,
        }),
      });
      const data = await res.json();

      if (data.status === 'matched') {
        this._onMatched(data.roomId, data.color, s.boardSize, s.layerCount);
      } else {
        s.waitingType = 'queue';
        s.waitingQueueId = data.queueId;
        this._startWaitingPoll();
      }
    } catch (e) {
      console.error('Queue error:', e);
      document.getElementById('waitingText').textContent = 'Error connecting...';
    }
  }

  cancelQueue() {
    const s = this.state;
    this._stopWaitingPoll();
    this._setOnlineWaiting(false);
    if (s.waitingQueueId) {
      fetch(`/api/queue?queueId=${s.waitingQueueId}`, { method: 'DELETE' }).catch(() => {});
    }
    s.waitingType = null;
    s.waitingQueueId = null;
    s.waitingRoomId = null;
    document.getElementById('online-waiting').style.display = 'none';
    document.getElementById('online-actions').style.display = 'flex';
  }

  async createRoom() {
    const s = this.state;
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: s.playerId,
          boardSize: s.boardSize,
          layerCount: s.layerCount,
        }),
      });
      const data = await res.json();

      s.waitingType = 'room';
      s.waitingRoomId = data.roomId;
      s.waitingBoardSize = s.boardSize;
      s.waitingLayerCount = s.layerCount;

      document.getElementById('online-actions').style.display = 'none';
      document.getElementById('online-waiting').style.display = 'flex';
      this._setOnlineWaiting(true);

      const directUrl = `${window.location.origin}${window.location.pathname}?room=${data.roomId}`;
      document.getElementById('waitingText').innerHTML =
        `${i18n.t('roomCode')}: <strong>${data.roomId}</strong><br>${i18n.t('waitingForOpponent')}`;

      // コードコピーボタン
      const copyBtn = document.getElementById('copyCodeBtn');
      if (copyBtn) {
        copyBtn.style.display = 'inline-block';
        copyBtn.textContent = i18n.t('shareCode');
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(data.roomId);
          copyBtn.textContent = i18n.t('copied');
          setTimeout(() => {
            copyBtn.textContent = i18n.t('shareCode');
          }, 1500);
        };
      }

      // URLコピーボタン
      const copyUrlBtn = document.getElementById('copyUrlBtn');
      if (copyUrlBtn) {
        copyUrlBtn.style.display = 'inline-block';
        copyUrlBtn.onclick = () => {
          navigator.clipboard.writeText(directUrl);
          copyUrlBtn.textContent = i18n.t('copied');
          setTimeout(() => {
            copyUrlBtn.textContent = i18n.t('copyUrl');
          }, 1500);
        };
      }

      this._startWaitingPoll();
    } catch (e) {
      console.error('Create room error:', e);
    }
  }

  async joinRoom() {
    const s = this.state;
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!code) return;

    try {
      const res = await fetch(`/api/room/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', playerId: s.playerId }),
      });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      this._onMatched(code, data.color);
    } catch (e) {
      console.error('Join room error:', e);
    }
  }

  _onMatched(roomId, color, matchBoardSize, matchLayerCount) {
    const s = this.state;

    // 待機状態をクリア
    this._stopWaitingPoll();
    s.waitingType = null;
    s.waitingQueueId = null;
    s.waitingRoomId = null;
    this._setOnlineWaiting(false);

    // マッチしたゲームの設定を適用
    const bs = matchBoardSize || s.waitingBoardSize || s.boardSize;
    const lc = matchLayerCount || s.waitingLayerCount || s.layerCount;
    s.boardSize = bs;
    s.layerCount = lc;

    s.roomId = roomId;
    s.myColor = color;
    s.mode = 'online';

    // バックグラウンド状態にも保存
    s.onlineRoomId = roomId;
    s.onlineMyColor = color;
    s.onlineBoardSize = bs;
    s.onlineLayerCount = lc;

    // UI更新
    document.getElementById('online-panel').style.display = 'none';
    document.getElementById('online-waiting').style.display = 'none';
    const copyUrlBtn = document.getElementById('copyUrlBtn');
    if (copyUrlBtn) copyUrlBtn.style.display = 'none';
    const copyBtn = document.getElementById('copyCodeBtn');
    if (copyBtn) copyBtn.style.display = 'none';

    document.getElementById('btnPvP').classList.remove('active');
    document.getElementById('btnPvC').classList.remove('active');
    document.getElementById('btnOnline').classList.add('active');
    document.getElementById('btnOnline').classList.remove('online-waiting');
    this._setOnlinePlaying(true);
    this._showStampChat();
    document.getElementById('btnS6').classList.toggle('active', bs === 6);
    document.getElementById('btnS8').classList.toggle('active', bs === 8);
    document.getElementById('btnL3').classList.toggle('active', lc === 3);
    document.getElementById('btnL5').classList.toggle('active', lc === 5);

    // ゲーム初期化
    setLayerCount(lc);
    s.board = new Board(bs, bs);
    s.board.setupInitialPieces();
    s.turn = CELL.BLACK;
    s.gameOver = false;
    s.viewLayer = 0;

    // バックグラウンド状態にも保存
    s.onlineBoard = s.board;
    s.onlineTurn = s.turn;
    s.onlineGameOver = false;
    s.onlineViewLayer = 0;

    this.renderer.updateSubtitle(bs, lc, i18n.t('subtitle', bs, lc));
    this.renderer.updateFlatViewSize(bs);
    this._render();

    // ゲーム中ポーリング開始（手番・スタンプの受信）
    this._startGamePoll();
  }

  // ─── 待機ポーリング（マッチング/部屋待ち。モード切替で維持） ───

  _startWaitingPoll() {
    this._stopWaitingPoll();
    const s = this.state;

    if (s.waitingType === 'queue') {
      s.waitingPollTimer = setInterval(async () => {
        try {
          const res = await fetch(`/api/queue?queueId=${s.waitingQueueId}&playerId=${s.playerId}`);
          const data = await res.json();
          if (data.status === 'matched') {
            this._onMatched(data.roomId, data.color, s.waitingBoardSize, s.waitingLayerCount);
          }
        } catch (e) {
          console.error('Queue poll error:', e);
        }
      }, TIMING.ONLINE_POLL_MS);
    } else if (s.waitingType === 'room') {
      s.waitingPollTimer = setInterval(async () => {
        try {
          const res = await fetch(`/api/room/${s.waitingRoomId}?playerId=${s.playerId}`);
          const data = await res.json();
          if (data.white && data.white.id) {
            this._onMatched(s.waitingRoomId, 'black', s.waitingBoardSize, s.waitingLayerCount);
          }
        } catch (e) {
          console.error('Room poll error:', e);
        }
      }, TIMING.ONLINE_POLL_MS);
    }
  }

  _stopWaitingPoll() {
    const s = this.state;
    if (s.waitingPollTimer) {
      clearInterval(s.waitingPollTimer);
      s.waitingPollTimer = null;
    }
  }

  // ─── ゲーム中ポーリング（オンライン対戦中の手番待ち） ───

  _startGamePoll() {
    this._stopGamePoll();
    const s = this.state;
    s.onlinePollTimer = setInterval(async () => {
      try {
        const roomId = s.onlineRoomId;
        const myColor = s.onlineMyColor;
        if (!roomId) return;

        const res = await fetch(`/api/room/${roomId}?playerId=${s.playerId}`);
        const data = await res.json();

        this._checkStamp(data);
        if (data.board && data.lastMove) {
          const myTurnCell = myColor === 'black' ? CELL.BLACK : CELL.WHITE;
          if (data.turn === myTurnCell || data.gameOver) {
            // バックグラウンド状態を更新
            s.onlineBoard.grid = data.board;
            s.onlineTurn = data.turn;
            s.onlineGameOver = data.gameOver;

            // フォアグラウンドがオンラインモードなら描画も更新
            if (s.mode === 'online' && s.roomId === roomId) {
              s.board.grid = data.board;
              s.turn = data.turn;
              s.gameOver = data.gameOver;
              this._render();
            }

            if (data.gameOver) {
              this._stopGamePoll();
              this._setOnlinePlaying(false);
              this._hideStampChat();
              s.onlineRoomId = null;
              if (s.mode === 'online' && s.roomId === roomId) {
                setTimeout(() => this._onGameOver(), TIMING.GAMEOVER_DELAY_MS);
              }
            }
          }
        }
      } catch (e) {
        console.error('Game poll error:', e);
      }
    }, TIMING.ONLINE_POLL_MS);
  }

  _stopGamePoll() {
    const s = this.state;
    if (s.onlinePollTimer) {
      clearInterval(s.onlinePollTimer);
      s.onlinePollTimer = null;
    }
  }

  async _sendMove() {
    const s = this.state;
    if (!s.roomId) return;

    // バックグラウンド状態も同期
    s.onlineTurn = s.turn;
    s.onlineGameOver = s.gameOver;
    s.onlineViewLayer = s.viewLayer;

    try {
      await fetch(`/api/room/${s.roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          playerId: s.playerId,
          board: s.board.grid,
          turn: s.turn,
          gameOver: s.gameOver,
          lastMove: { ts: Date.now() },
        }),
      });

      if (s.gameOver) {
        this._stopGamePoll();
        this._setOnlinePlaying(false);
        this._hideStampChat();
        s.onlineRoomId = null;
      }
    } catch (e) {
      console.error('Send move error:', e);
    }
  }

  // ───────────────────────────────────
  //  UIボタン
  // ───────────────────────────────────

  // ───────────────────────────────────
  //  ダイレクトリンク
  // ───────────────────────────────────

  _checkDirectLink() {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      // URLパラメータからルームに自動参加
      this.setMode('online');
      setTimeout(() => this._autoJoinRoom(roomCode), 300);
    }
  }

  async _autoJoinRoom(code) {
    const s = this.state;
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', playerId: s.playerId }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        // URLパラメータをクリア
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }
      window.history.replaceState({}, '', window.location.pathname);
      this._onMatched(code, data.color);
    } catch (e) {
      console.error('Auto join error:', e);
    }
  }

  _setOnlineWaiting(waiting) {
    const btn = document.getElementById('btnOnline');
    if (btn) btn.classList.toggle('online-waiting', waiting);
  }

  _setOnlinePlaying(playing) {
    const btn = document.getElementById('btnOnline');
    if (btn) btn.classList.toggle('online-playing', playing);
  }

  _showStampChat() {
    const ad = document.getElementById('stamp-ad');
    const display = document.getElementById('stamp-display');
    const buttons = document.getElementById('stamp-buttons');
    if (ad) ad.style.display = 'none';
    if (display) display.style.display = 'flex';
    if (buttons) buttons.style.display = 'flex';
  }

  _hideStampChat() {
    const ad = document.getElementById('stamp-ad');
    const display = document.getElementById('stamp-display');
    const buttons = document.getElementById('stamp-buttons');
    if (ad) ad.style.display = 'block';
    if (display) display.style.display = 'none';
    if (buttons) buttons.style.display = 'none';
  }

  async sendStamp(stamp) {
    const s = this.state;
    const roomId = s.onlineRoomId || s.roomId;
    if (!roomId) return;
    this._displayStamp(stamp, true);
    try {
      await fetch(`/api/room/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stamp', playerId: s.playerId, stamp }),
      });
    } catch (e) {
      console.error('Stamp error:', e);
    }
  }

  _displayStamp(stamp, isMine) {
    const display = document.getElementById('stamp-display');
    if (!display) return;
    display.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'stamp-msg';
    span.textContent = stamp;
    span.style.color = isMine ? '#8cf' : '#f0a030';
    display.appendChild(span);
    setTimeout(() => {
      if (display.contains(span)) display.removeChild(span);
    }, 2500);
  }

  _checkStamp(data) {
    const s = this.state;
    if (data.lastStamp && data.lastStamp.from !== s.playerId && data.lastStamp.ts > s.lastStampTs) {
      s.lastStampTs = data.lastStamp.ts;
      this._displayStamp(data.lastStamp.stamp, false);

      // 他タブ表示中なら赤白点滅で通知
      if (s.mode !== 'online') {
        this._flashStampNotify();
      }
    }
  }

  _flashStampNotify() {
    const btn = document.getElementById('btnOnline');
    if (!btn) return;
    btn.classList.remove('stamp-notify');
    // reflow to restart animation
    void btn.offsetWidth;
    btn.classList.add('stamp-notify');
    setTimeout(() => btn.classList.remove('stamp-notify'), 2000);
  }

  // ───────────────────────────────────
  //  キュー監視＆チャレンジャーメッセージ
  // ───────────────────────────────────

  _startQueueCountPoll() {
    this._lastQueueCount = 0;
    this._queueCountTimer = setInterval(() => this._pollQueueCount(), 5000);
  }

  async _pollQueueCount() {
    // 自分が待機中なら不要
    if (this.state.waitingType) return;
    try {
      const res = await fetch('/api/queue?count=1');
      const data = await res.json();
      if (data.count > 0) {
        // 新しい挑戦者が来た、または定期的にメッセージ更新
        if (data.count !== this._lastQueueCount || Math.random() < 0.3) {
          this._showChallengerMessage(data.count);
        }
      } else if (this._lastQueueCount > 0) {
        // 待機者がいなくなった→通常表示に戻す
        this._hideChallengerMessage();
      }
      this._lastQueueCount = data.count;
    } catch {
      // ignore
    }
  }

  _showChallengerMessage(count) {
    const ad = document.getElementById('stamp-ad');
    const chat = document.getElementById('stamp-chat');
    if (!ad) return;

    const msg = CHALLENGER_MESSAGES[Math.floor(Math.random() * CHALLENGER_MESSAGES.length)];
    const countText = count > 1 ? `<div class="challenger-count">${count}人が待機中</div>` : '';
    ad.style.display = 'block';
    ad.innerHTML = `<div class="challenger-msg">${msg}</div>${countText}<button class="quick-match-btn" onclick="gameQuickMatch()">⚔️ 対戦する</button>`;

    // チャットエリアを目立たせる
    if (chat) {
      chat.classList.remove('challenger-alert');
      void chat.offsetWidth;
      chat.classList.add('challenger-alert');
    }
  }

  _hideChallengerMessage() {
    const ad = document.getElementById('stamp-ad');
    const chat = document.getElementById('stamp-chat');
    if (ad) {
      ad.innerHTML = '3D Othello';
    }
    if (chat) {
      chat.classList.remove('challenger-alert');
    }
  }

  async quickMatch() {
    const s = this.state;
    // オンラインモードに切り替えてマッチング開始
    s.mode = 'online';
    document.getElementById('btnPvP').classList.remove('active');
    document.getElementById('btnPvC').classList.remove('active');
    document.getElementById('btnOnline').classList.add('active');
    this._showOnlineUI();
    this.joinQueue();
  }

  _bindButtons() {
    window.gameSetMode = (m) => this.setMode(m);
    window.gameSetSize = (n) => this.setSize(n);
    window.gameSetLayers = (n) => this.setLayers(n);
    window.gameInit = () => this.init();
    window.gameCloseOverlay = () => {
      this.effects.closeOverlay();
      this.renderer.setBoardFlash(false);
    };
    window.gameChangeLang = (lang) => this.changeLang(lang);
    window.gameJoinQueue = () => this.joinQueue();
    window.gameCancelQueue = () => this.cancelQueue();
    window.gameCreateRoom = () => this.createRoom();
    window.gameJoinRoom = () => this.joinRoom();
    window.gameSendStamp = (stamp) => this.sendStamp(stamp);
    window.gameQuickMatch = () => this.quickMatch();
  }

  _bindResize() {
    let timer;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.renderer.updateFlatViewSize(this.state.boardSize);
        this._render();
      }, 150);
    });
  }
}

// ═══════════════════════════════════════
//  起動
// ═══════════════════════════════════════
new Game();
