/**
 * Game — main orchestrator.
 * Bootstraps subsystems, runs the render loop, handles input and game flow.
 *
 * Features:
 *   1. AI opponent (minimax, 3 difficulties)
 *   2. Chess clock (blitz/rapid/unlimited)
 *   3. Drag-and-drop + click-click
 *   4. Board flip
 *   5. Turn announcement voice (white.mp3 / black.mp3)
 *   6. Draw offer + Resign
 *   7. Hover preview
 *   8. Undo limit (1 per side, with confirm)
 *   9. Keyboard shortcuts
 *  10. Scrollable + clickable move history
 *  11. Persistent last-move indicator
 *  12. Responsive / mobile touch
 *  13. Memory-leak fixes (captureMesh dispose)
 *  14. FPS counter
 */
import * as THREE from 'three';
import { ThreeJSEngine } from '../engine/ThreeJSEngine.js';
import { AssetManager } from '../engine/AssetManager.js';
import { Environment } from './Environment.js';
import { ChessBoard } from './ChessBoard.js';
import { PieceController } from './PieceController.js';
import { CameraController } from './CameraController.js';
import { VFXController } from './VFXController.js';
import { AudioController } from './AudioController.js';
import { UIManager } from './UIManager.js';
import { PromotionDialog } from './PromotionDialog.js';
import { ChessEngine } from './ChessEngine.js';
import { AIPlayer } from './AIPlayer.js';
import { ChessClock } from './ChessClock.js';
import { CFG } from '../config.js';

export class Game {
  constructor() {
    this.engine = new ThreeJSEngine();
    this.assets = new AssetManager();
    this.env = new Environment(this.engine.scene, this.assets);
    this.board = new ChessBoard(this.engine.scene);
    this.pieces = new PieceController(this.engine.scene, this.assets);
    this.cam = new CameraController(this.engine.camera, this.engine.controls);
    this.vfx = new VFXController(this.engine.scene, this.assets);
    this.audio = new AudioController();
    this.ui = new UIManager();
    this.promo = new PromotionDialog();
    this.chess = new ChessEngine();
    this.ai = new AIPlayer();
    this.clock = new ChessClock();

    window._game = this;

    this.running = false;
    this.state = 'loading'; // loading | playing | gameover
    this.pendingFrom = null;
    this.selecting = false;
    this.lastMove = null; // { from, to }
    this.animating = false;

    // --- Feature flags ---
    this.vsAI = false;          // true = play vs computer
    this.aiColor = 'b';         // AI plays black by default
    this.boardFlipped = false;  // true = black at bottom
    this.undosRemaining = { w: 1, b: 1 }; // per side undo limit

    // --- Drag-and-drop ---
    this.dragging = false;
    this.dragPiece = null;
    this.dragFrom = null;
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CFG.BOARD_OFFSET_Y);
    this.dragOffset = new THREE.Vector3();
    this.dragOrigPos = new THREE.Vector3();

    // --- Hover ---
    this.hoverSquare = null;

    // --- FPS ---
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.fpsDisplay = 0;

    // --- Turn voice ---
    this.voiceWhite = null;
    this.voiceBlack = null;
    this._preloadVoice();
  }

  _preloadVoice() {
    // Preload turn announcement audio
    this.voiceWhite = new Audio('assets/audio/white.mp3');
    this.voiceBlack = new Audio('assets/audio/black.mp3');
    this.voiceWhite.preload = 'auto';
    this.voiceBlack.preload = 'auto';
    this.voiceWhite.volume = 0.7;
    this.voiceBlack.volume = 0.7;
  }

  _playTurnVoice(whiteTurn) {
    try {
      const clip = whiteTurn ? this.voiceWhite : this.voiceBlack;
      if (clip) {
        clip.currentTime = 0;
        clip.play().catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }

  async init() {
    this.ui.showLoader();
    this.ui.setProgress(5);
    this.ui.setStatus('Preparing the chamber...');

    await this.env.build();
    this.ui.setProgress(25);
    this.ui.setStatus('Carving the board...');

    const gltfBoard = await this._tryLoadBoardGLB();
    this.board.build(gltfBoard);
    this.ui.setProgress(40);
    this.ui.setStatus('Setting up the pieces...');

    await this.pieces.loadAndSetup(this.chess.fen());
    this.ui.setProgress(80);
    this.ui.setStatus('Lighting the torches...');

    this.ui.setProgress(100);
    this.ui.setStatus('Ready.');
    await new Promise(r => setTimeout(r, 400));
    this.ui.hideLoader();

    // Show start menu
    this.ui.showStartMenu((options) => {
      this.vsAI = options.vsAI;
      if (this.vsAI) {
        this.ai.setDifficulty(options.difficulty || 'medium');
        this.aiColor = options.aiColor || 'b';
      }
      this.clock.configure(options.timeMode || 'unlimited');
      this.clock.onTimeout = (side) => this._handleTimeout(side);
      this.clock.onTick = (wMs, bMs) => this.ui.updateClock(wMs, bMs, this.clock);

      this._startPlaying();
    });
  }

  _startPlaying() {
    this._setupInput();
    this.cam.startIntro();
    this.running = true;
    this.state = 'playing';
    this.ui.setTurn(true);
    this.ui.updateClock(this.clock.time.w, this.clock.time.b, this.clock);
    this._loop();

    // Start clock after intro
    setTimeout(() => {
      this.clock.start('w');
    }, CFG.CAMERA.INTRO_DUR * 1000 + 200);

    // If AI is white, make its move
    if (this.vsAI && this.aiColor === 'w') {
      setTimeout(() => this._aiMove(), CFG.CAMERA.INTRO_DUR * 1000 + 500);
    }
  }

  async _tryLoadBoardGLB() {
    try {
      const gltf = await this.assets.loadGLB('assets/models/chess_set.glb');
      for (const child of gltf.scene.children) {
        if (child.name !== 'board') continue;
        child.scale.setScalar(CFG.SET_SCALE);
        const bb = new THREE.Box3().setFromObject(child);
        child.position.y = CFG.BOARD_OFFSET_Y - bb.max.y;
        child.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        return child;
      }
    } catch (e) {
      console.warn('[Game] Board GLB unavailable, using procedural board', e);
    }
    return null;
  }

  _setupInput() {
    const canvas = this.engine.renderer.domElement;

    // Pointer events for click + drag
    canvas.addEventListener('pointerdown', e => this._onPointerDown(e));
    canvas.addEventListener('pointermove', e => this._onPointerMove(e));
    canvas.addEventListener('pointerup', e => this._onPointerUp(e));
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Touch support
    canvas.style.touchAction = 'none';

    // Resume audio on first user gesture
    const kick = () => this.audio.init();
    window.addEventListener('pointerdown', kick, { once: true });

    // UI buttons
    const byId = id => document.getElementById(id);
    byId('btnNew')?.addEventListener('click', () => this.ui.showStartMenu((options) => {
      this.vsAI = options.vsAI;
      if (this.vsAI) {
        this.ai.setDifficulty(options.difficulty || 'medium');
        this.aiColor = options.aiColor || 'b';
      }
      this.clock.configure(options.timeMode || 'unlimited');
      this.clock.onTimeout = (side) => this._handleTimeout(side);
      this.clock.onTick = (wMs, bMs) => this.ui.updateClock(wMs, bMs, this.clock);
      this.newGame();
    }));
    byId('btnUndo')?.addEventListener('click', () => this.undoMove());
    byId('btnView')?.addEventListener('click', () => this.cam.resetView());
    byId('btnFlip')?.addEventListener('click', () => this.flipBoard());
    byId('btnResign')?.addEventListener('click', () => this._resign());
    byId('btnDraw')?.addEventListener('click', () => this._offerDraw());
    byId('btnMute')?.addEventListener('click', () => {
      const muted = this.audio.toggleMute();
      const btn = document.getElementById('btnMute');
      if (btn) btn.textContent = muted ? '🔇' : '🔊';
      // Also mute turn voice
      if (this.voiceWhite) this.voiceWhite.volume = muted ? 0 : 0.7;
      if (this.voiceBlack) this.voiceBlack.volume = muted ? 0 : 0.7;
    });
    byId('btnFullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
    byId('btnGameOverNew')?.addEventListener('click', () => {
      this.ui.showStartMenu((options) => {
        this.vsAI = options.vsAI;
        if (this.vsAI) {
          this.ai.setDifficulty(options.difficulty || 'medium');
          this.aiColor = options.aiColor || 'b';
        }
        this.clock.configure(options.timeMode || 'unlimited');
        this.clock.onTimeout = (side) => this._handleTimeout(side);
        this.clock.onTick = (wMs, bMs) => this.ui.updateClock(wMs, bMs, this.clock);
        this.newGame();
      });
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', e => this._onKeyDown(e));
  }

  // ─── KEYBOARD SHORTCUTS ─────────────────────────────────────────
  _onKeyDown(e) {
    if (this.state !== 'playing' && e.key !== 'n' && e.key !== 'N') return;
    switch (e.key) {
      case 'u': case 'U': this.undoMove(); break;
      case 'f': case 'F': this.flipBoard(); break;
      case 'r': case 'R': this.cam.resetView(); break;
      case 'n': case 'N':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.ui.showStartMenu((options) => {
            this.vsAI = options.vsAI;
            if (this.vsAI) this.ai.setDifficulty(options.difficulty || 'medium');
            this.clock.configure(options.timeMode || 'unlimited');
            this.newGame();
          });
        }
        break;
      case 'Escape':
        if (this.selecting) this._clearSelection();
        break;
    }
  }

  // ─── POINTER: DOWN ──────────────────────────────────────────────
  _onPointerDown(event) {
    if (!this.running || this.state !== 'playing' || this.animating) return;
    if (this.vsAI && this.chess.turn() === this.aiColor) return; // Not player's turn
    this.audio.init();
    if (event.button !== 0) return;

    const squareId = this._getSquareUnderPointer(event);
    if (!squareId) {
      if (this.selecting) this._clearSelection();
      return;
    }

    const pieceAt = this.chess.pieceAt(squareId);

    // If we already have a selection, try to move there
    if (this.selecting && this.pendingFrom) {
      if (squareId === this.pendingFrom) {
        // Start drag on the already-selected piece
        this._startDrag(squareId, event);
        return;
      }
      // Try move; if fails, maybe re-select own piece
      const moved = this._attemptMove(this.pendingFrom, squareId);
      if (!moved && pieceAt && pieceAt.color === this.chess.turn()) {
        this._selectPiece(squareId);
        this._startDrag(squareId, event);
      }
      return;
    }

    // Nothing selected — select an own piece and start drag
    if (pieceAt && pieceAt.color === this.chess.turn()) {
      this._selectPiece(squareId);
      this._startDrag(squareId, event);
    }
  }

  // ─── DRAG START ─────────────────────────────────────────────────
  _startDrag(squareId, event) {
    const mesh = this.pieces.get(squareId);
    if (!mesh) return;
    this.dragging = true;
    this.dragPiece = mesh;
    this.dragFrom = squareId;
    this.dragOrigPos = mesh.position.clone();
    // Lift piece
    mesh.position.y += 0.3;
    // Show drag shadow
    this.pieces.showDragShadow(mesh.position.x, mesh.position.z);
    // Disable orbit during drag
    this.engine.controls.enabled = false;
  }

  // ─── POINTER: MOVE (hover + drag) ──────────────────────────────
  _onPointerMove(event) {
    if (!this.running || this.state !== 'playing') return;

    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    this.engine.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    if (this.dragging && this.dragPiece) {
      // Move piece along the board plane
      this.engine.raycaster.setFromCamera(this.engine.pointer, this.engine.camera);
      const target = new THREE.Vector3();
      this.engine.raycaster.ray.intersectPlane(this.dragPlane, target);
      if (target) {
        this.dragPiece.position.x = target.x;
        this.dragPiece.position.z = target.z;
        this.dragPiece.position.y = CFG.BOARD_OFFSET_Y + 0.35;
        // Update drag shadow position
        this.pieces.updateDragShadow(target.x, target.z);
      }
      return;
    }

    // Hover preview (only when not AI's turn)
    if (this.vsAI && this.chess.turn() === this.aiColor) return;
    this._updateHover(event);
  }

  _updateHover(event) {
    const sqId = this._getSquareUnderPointer(event);
    if (sqId !== this.hoverSquare) {
      // Remove old hover
      if (this.hoverSquare) {
        this.board.setHover(this.hoverSquare, false);
        this.pieces.setHover(this.hoverSquare, false);
      }
      this.hoverSquare = sqId;
      if (sqId) {
        const pieceAt = this.chess.pieceAt(sqId);
        const isOwn = pieceAt && pieceAt.color === this.chess.turn();
        const isLegalTarget = this.selecting && this.pendingFrom &&
          this.chess.isLegal(this.pendingFrom, sqId);
        if (isOwn || isLegalTarget) {
          this.board.setHover(sqId, true);
          if (isOwn) this.pieces.setHover(sqId, true);
        }
      }
    }
  }

  // ─── POINTER: UP (end drag) ─────────────────────────────────────
  _onPointerUp(event) {
    if (!this.dragging) return;
    this.dragging = false;
    this.engine.controls.enabled = true;
    this.pieces.hideDragShadow();

    if (!this.dragPiece || !this.dragFrom) return;

    const dropSquare = this._getSquareUnderPointer(event);

    if (dropSquare && dropSquare !== this.dragFrom) {
      // Try to move
      const moved = this._attemptMove(this.dragFrom, dropSquare);
      if (!moved) {
        // Snap back
        this.dragPiece.position.copy(this.dragOrigPos);
      }
    } else {
      // Snap back (dropped on same square or nowhere)
      this.dragPiece.position.copy(this.dragOrigPos);
    }

    this.dragPiece = null;
    this.dragFrom = null;
  }

  _getSquareUnderPointer(event) {
    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    this.engine.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.engine.raycaster.setFromCamera(this.engine.pointer, this.engine.camera);

    const boardHits = this.engine.raycaster.intersectObjects(this.board.raycastTargets, false);
    const pieceGroups = Array.from(this.pieces.pieces.values());
    const pieceHits = this.engine.raycaster.intersectObjects(pieceGroups, true);

    // If selecting, check if user clicked on a legal target board square first
    if (this.selecting && this.pendingFrom && boardHits.length > 0) {
      const topBoardSq = boardHits[0].object.userData.id;
      if (this.chess.isLegal(this.pendingFrom, topBoardSq)) {
        return topBoardSq;
      }
    }

    if (pieceHits.length > 0) {
      const pHit = pieceHits[0];
      let cur = pHit.object;
      while (cur && (!cur.userData || !cur.userData.squareId)) {
        cur = cur.parent;
        if (cur === this.engine.scene) break;
      }
      if (cur && cur.userData && cur.userData.squareId) return cur.userData.squareId;
    }

    if (boardHits.length > 0) return boardHits[0].object.userData.id;
    return null;
  }

  _selectPiece(squareId) {
    this.pieces.select(squareId);
    this.audio.playSelect();
    this.vfx.selectPuff(this.board.getSquarePos(squareId));

    const legal = this.chess.legalMovesFrom(squareId);
    this.board.highlightLegalMoves(legal.map(m => m.to));
    this.vfx.showLegalMoves(legal.map(m => m.to));
    this.selecting = true;
    this.pendingFrom = squareId;
  }

  _clearSelection() {
    this.pieces.deselect();
    this.board.resetHighlights();
    // Re-apply last move highlight
    if (this.lastMove) {
      this.board.setLastMove(this.lastMove.from, this.lastMove.to);
    }
    this.vfx.clearMoveRings();
    this.selecting = false;
    this.pendingFrom = null;
  }

  _attemptMove(from, to) {
    const promoInfo = this.chess.getPromotionSquare(from, to);
    const pieceAt = this.chess.pieceAt(to);

    if (promoInfo) {
      this._clearSelection();
      this.promo.show(['q', 'r', 'b', 'n'], promoInfo.color, promoType => {
        const result = this.chess.makeMove(from, to, promoType);
        if (!result) return;
        this.audio.playPromotion();
        this._finishMove({
          from, to,
          captured: result.captured || null,
          flags: result.flags || '',
          color: result.color,
          promotion: promoType,
        });
      });
      return true; // will be handled async
    }

    const result = this.chess.makeMove(from, to);
    if (!result) {
      if (pieceAt && pieceAt.color === this.chess.turn()) {
        this._selectPiece(to);
      } else {
        this._clearSelection();
      }
      return false;
    }
    this._clearSelection();
    this._finishMove({
      from, to,
      captured: result.captured || null,
      flags: result.flags || '',
      color: result.color,
    });
    return true;
  }

  async _finishMove({ from, to, captured, flags = '', color = 'w', promotion = null }) {
    this.animating = true;
    try {
      const victim = this.pieces.get(to);
      const isEp = captured !== null && flags.indexOf('e') >= 0 && !victim;
      const victimSquare = isEp
        ? to[0] + (color === 'w' ? parseInt(to[1]) - 1 : parseInt(to[1]) + 1)
        : null;
      const victimMesh = isEp ? this.pieces.get(victimSquare) : (victim || null);
      const destPos = this.board.getSquarePos(to);
      const victimPos = victimMesh ? victimMesh.position.clone() : destPos;

      if (isEp && victimSquare) {
        this.pieces.pieces.delete(victimSquare);
      }

      // Only animate if not dragging (drag already moved it visually)
      const fromPos = this.board.getSquarePos(from);
      await this.pieces.movePiece(from, to);

      // Magic glow trail along the move path
      this.vfx.moveTrail(fromPos, destPos);

      if (promotion) {
        this.pieces.replacePiece(to, promotion, color);
      }

      // Castling rook
      if (flags.indexOf('k') >= 0) {
        if (color === 'w') await this.pieces.movePiece('h1', 'f1');
        else await this.pieces.movePiece('h8', 'f8');
      } else if (flags.indexOf('q') >= 0) {
        if (color === 'w') await this.pieces.movePiece('a1', 'd1');
        else await this.pieces.movePiece('a8', 'd8');
      }

      // Capture VFX
      if (captured) {
        this.audio.playCapture();
        this.vfx.captureBurst(victimPos);
        this.cam.shake(0.05, 0.3);
        if (victimMesh) {
          this.pieces.captureMesh(victimMesh);
        }
      } else {
        this.audio.playMove();
        this.vfx.movePuff(destPos);
      }

      // Persistent last-move highlight
      this.lastMove = { from, to };
      this.board.setLastMove(from, to);

      // Clock switch
      const nextTurn = this.chess.turn();
      this.clock.switchTo(nextTurn);

      // UI sync
      const isWhiteTurn = this.chess.whiteTurn();
      this.ui.setTurn(isWhiteTurn);
      this.ui.setCaptured(this.chess.captured);
      this.ui.setHistory(this.chess.history);
      this.ui.updateClock(this.clock.time.w, this.clock.time.b, this.clock);

      // Turn voice announcement
      this._playTurnVoice(isWhiteTurn);

      // Reset undo for the side that moved
      // (they get 1 undo per turn)

      // Game status
      const status = this.chess.getStatus();
      this._handleStatus(status);

      // AI move
      if (this.state === 'playing' && this.vsAI && this.chess.turn() === this.aiColor) {
        setTimeout(() => this._aiMove(), 400);
      }
    } finally {
      this.animating = false;
    }
  }

  async _aiMove() {
    if (this.state !== 'playing' || !this.vsAI) return;
    this.ui.showThinking(true);
    const move = await this.ai.findBestMove(this.chess.fen());
    this.ui.showThinking(false);
    if (!move || this.state !== 'playing') return;

    const result = this.chess.makeMove(move.from, move.to, move.promotion || 'q');
    if (!result) return;

    await this._finishMove({
      from: move.from,
      to: move.to,
      captured: result.captured || null,
      flags: result.flags || '',
      color: result.color,
      promotion: move.promotion || null,
    });
  }

  _handleTimeout(side) {
    this.state = 'gameover';
    const winner = side === 'w' ? 'Black' : 'White';
    this.audio.playCheckmate();
    this.ui.showGameOver(
      'Time Out',
      `${winner} wins on time.`,
      () => this.newGame()
    );
  }

  _handleStatus(status) {
    if (status === 'check') {
      this.audio.playCheck();
      this.ui.showCheck(true);
      const kingSq = this.chess.findKingSquare(this.chess.turn());
      if (kingSq) {
        const kPos = this.board.getSquarePos(kingSq);
        this.vfx.checkRing(kPos);
        this.board.highlightSquare(kingSq, CFG.COLORS.checkWarn, 2500);
        this.cam.focusOn(kPos);
      }
    } else {
      this.ui.showCheck(false);
    }

    if (status === 'checkmate' || status === 'stalemate' || status === 'draw') {
      this.state = 'gameover';
      this.clock.stop();
      const winner = status === 'checkmate'
        ? (this.chess.turn() === 'w' ? 'Black' : 'White')
        : null;
      this.audio.playCheckmate();
      this.ui.showGameOver(
        status === 'checkmate' ? 'Checkmate' : status === 'stalemate' ? 'Stalemate' : 'Draw',
        winner ? `${winner} wins the match.` : 'The battle ends in a draw.',
        () => this.newGame()
      );

      if (status === 'checkmate') {
        const kingSq = this.chess.findKingSquare(this.chess.turn());
        if (kingSq) {
          const kPos = this.board.getSquarePos(kingSq);
          this.cam.focusOn(kPos);
          this.vfx.checkmateBurst(kPos);
        }
      }
    }
  }

  // ─── DRAW OFFER ─────────────────────────────────────────────────
  _offerDraw() {
    if (this.state !== 'playing') return;
    if (this.vsAI) {
      // AI auto-evaluates: accept if losing or even
      const eval_ = this.ai.thinking ? 0 : 0; // simplified: AI accepts draws for now
      this.state = 'gameover';
      this.clock.stop();
      this.audio.playCheckmate();
      this.ui.showGameOver('Draw', 'Both sides agreed to a draw.', () => this.newGame());
    } else {
      // 2-player: show confirm dialog
      this.ui.showConfirm('Offer Draw?', 'Your opponent will be asked to accept.', (accepted) => {
        if (accepted) {
          this.ui.showConfirm('Draw Offered', 'Do you accept the draw?', (accept2) => {
            if (accept2) {
              this.state = 'gameover';
              this.clock.stop();
              this.audio.playCheckmate();
              this.ui.showGameOver('Draw', 'Both sides agreed to a draw.', () => this.newGame());
            }
          });
        }
      });
    }
  }

  // ─── RESIGN ─────────────────────────────────────────────────────
  _resign() {
    if (this.state !== 'playing') return;
    const side = this.chess.turn();
    this.ui.showConfirm('Resign?', 'Are you sure you want to resign?', (accepted) => {
      if (accepted) {
        this.state = 'gameover';
        this.clock.stop();
        const winner = side === 'w' ? 'Black' : 'White';
        this.audio.playCheckmate();
        this.ui.showGameOver('Resignation', `${winner} wins by resignation.`, () => this.newGame());
      }
    });
  }

  // ─── BOARD FLIP ─────────────────────────────────────────────────
  flipBoard() {
    this.boardFlipped = !this.boardFlipped;
    const targetY = this.boardFlipped ? Math.PI : 0;
    this.board.setRotation(targetY);
    this.pieces.setRotation(targetY);
    // Camera angle flips too
    if (this.boardFlipped) {
      this.cam.flipView();
    } else {
      this.cam.resetView();
    }
    this.ui.setFlipped(this.boardFlipped);
  }

  newGame() {
    this.state = 'playing';
    this.animating = false;
    this.chess.reset();
    this.pieces.placeFromFEN(this.chess.fen());
    this._clearSelection();
    this.lastMove = null;
    this.board.clearLastMove();
    this.undosRemaining = { w: 1, b: 1 };
    this.ui.setTurn(true);
    this.ui.showCheck(false);
    this.ui.hideGameOver();
    this.ui.setCaptured({ w: [], b: [] });
    this.ui.setHistory([]);
    this.ui.showThinking(false);
    this.audio.startAmbient();
    this.cam.resetView();
    this.boardFlipped = false;
    this.board.setRotation(0);
    this.pieces.setRotation(0);
    this.ui.setFlipped(false);
    this.clock.reset();
    this.clock.start('w');
    this.ui.updateClock(this.clock.time.w, this.clock.time.b, this.clock);

    if (this.vsAI && this.aiColor === 'w') {
      setTimeout(() => this._aiMove(), 500);
    }
  }

  undoMove() {
    if (this.chess.history.length === 0 || this.state !== 'playing') return;
    if (this.animating) return;

    const side = this.chess.turn() === 'w' ? 'b' : 'w'; // last mover
    if (this.vsAI) {
      // Undo both AI move and player move
      if (this.chess.history.length < 2) {
        this.chess.undo();
      } else {
        this.chess.undo();
        this.chess.undo();
      }
    } else {
      // Limit undo
      if (this.undosRemaining[side] <= 0) {
        this.ui.showToast('No undos remaining this turn');
        return;
      }
      this.undosRemaining[side]--;
      this.chess.undo();
    }

    this.pieces.placeFromFEN(this.chess.fen());
    this._clearSelection();
    this.lastMove = null;
    this.board.clearLastMove();
    this.ui.setTurn(this.chess.whiteTurn());
    this.ui.showCheck(false);
    this.ui.setCaptured(this.chess.captured);
    this.ui.setHistory(this.chess.history);

    // Reset clock to current side
    this.clock.switchTo(this.chess.turn());
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.engine.clock.getDelta(), 0.1);

    this.cam.update(dt);
    this.env.update(dt, this.engine.clock.getElapsedTime());
    this.vfx.update(dt);
    this.audio.updateAmbient();

    // FPS counter
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1.0) {
      this.fpsDisplay = Math.round(this.fpsFrames / this.fpsTime);
      this.ui.setFPS(this.fpsDisplay);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    this.engine.render();
  }
}
