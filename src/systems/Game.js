/**
 * Game — main orchestrator.
 * Bootstraps subsystems, runs the render loop, handles input and game flow.
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

    window._game = this;

    this.running = false;
    this.state = 'loading'; // loading | playing | gameover
    this.pendingFrom = null;
    this.selecting = false;
    this.lastMove = null; // { from, to, captured }
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

    this._setupInput();
    this.cam.startIntro();
    this.running = true;
    this.state = 'playing';
    this.ui.setTurn(true);
    this._loop();
  }

  async _tryLoadBoardGLB() {
    try {
      const gltf = await this.assets.loadGLB('assets/models/chess_set.glb');
      for (const child of gltf.scene.children) {
        if (child.name !== 'board') continue;
        // Scale GLB (0.55 m board) up to playfield (8 u) and seat on the dais.
        child.scale.setScalar(CFG.SET_SCALE);
        const bb = new THREE.Box3().setFromObject(child);
        child.position.y = CFG.BOARD_OFFSET_Y - bb.max.y;
        child.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        console.log('[Game] GLB board seated, top y =', CFG.BOARD_OFFSET_Y);
        return child;
      }
    } catch (e) {
      console.warn('[Game] Board GLB unavailable, using procedural board', e);
    }
    return null;
  }

  _setupInput() {
    const canvas = this.engine.renderer.domElement;
    canvas.addEventListener('pointerdown', e => this._onPointerDown(e));
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Resume audio on first user gesture.
    const kick = () => this.audio.init();
    window.addEventListener('pointerdown', kick, { once: true });

    // UI buttons.
    const byId = id => document.getElementById(id);
    byId('btnNew')?.addEventListener('click', () => this.newGame());
    byId('btnUndo')?.addEventListener('click', () => this.undoMove());
    byId('btnView')?.addEventListener('click', () => this.cam.resetView());
    byId('btnGameOverNew')?.addEventListener('click', () => this.newGame());
  }

  _onPointerDown(event) {
    if (!this.running || this.state !== 'playing' || this.animating) return;
    this.audio.init();
    if (event.button !== 0) return;

    const squareId = this._getSquareUnderPointer(event);
    if (!squareId) {
      // Click on empty space — deselect.
      if (this.selecting) this._clearSelection();
      return;
    }

    const pieceAt = this.chess.pieceAt(squareId);

    if (this.selecting && this.pendingFrom) {
      if (squareId === this.pendingFrom) {
        // Clicked the same square — deselect.
        this._clearSelection();
        return;
      }
      this._attemptMove(this.pendingFrom, squareId);
      return;
    }

    // Nothing selected — select an own piece.
    if (pieceAt && pieceAt.color === this.chess.turn()) {
      this._selectPiece(squareId);
    }
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

    // If selecting, check if user clicked on a legal target board square first!
    if (this.selecting && this.pendingFrom && boardHits.length > 0) {
      const topBoardSq = boardHits[0].object.userData.id;
      if (this.chess.isLegal(this.pendingFrom, topBoardSq)) {
        return topBoardSq;
      }
    }

    if (pieceHits.length > 0) {
      const pHit = pieceHits[0];
      // Walk up from the hit mesh to find the group's userData.squareId.
      let cur = pHit.object;
      while (cur && (!cur.userData || !cur.userData.squareId)) {
        cur = cur.parent;
        if (cur === this.scene) break;
      }
      if (cur && cur.userData && cur.userData.squareId) return cur.userData.squareId;
    }

    // Fallback to board squares.
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
    this.vfx.clearMoveRings();
    this.selecting = false;
    this.pendingFrom = null;
  }

  _attemptMove(from, to) {
    // Detect promotion BEFORE committing (committing auto-promotes to queen).
    const promoInfo = this.chess.getPromotionSquare(from, to);
    const pieceAt = this.chess.pieceAt(to);

    if (promoInfo) {
      // Ask the player; commit inside the callback.
      this._clearSelection();
      this.promo.show(['q', 'r', 'b', 'n'], promoInfo.color, promoType => {
        const result = this.chess.makeMove(from, to, promoType);
        if (!result) { console.warn('[Game] promotion commit failed', from, to, promoType); return; }
        this.audio.playPromotion();
        this._finishMove({
          from, to,
          captured: result.captured || null,
          flags: result.flags || '',
          color: result.color,
          promotion: promoType,
        });
      });
      return;
    }

    const result = this.chess.makeMove(from, to);
    if (!result) {
      // Illegal target — reselect if clicking another own piece.
      if (pieceAt && pieceAt.color === this.chess.turn()) {
        this._selectPiece(to);
      } else {
        this._clearSelection();
      }
      return;
    }
    // Clear selection immediately so UI responds and user can't double-click.
    this._clearSelection();
    this._finishMove({
      from, to,
      captured: result.captured || null,
      flags: result.flags || '',
      color: result.color,
    });
  }

  async _finishMove({ from, to, captured, flags = '', color = 'w', promotion = null }) {
    this.animating = true;
    try {
      // En passant: the victim pawn is NOT on `to` — it sits on the adjacent
      // rank of `to` (white captures upward, black captures downward).
      const victim = this.pieces.get(to);
      const isEp = captured !== null && flags.indexOf('e') >= 0 && !victim;
      const victimSquare = isEp
        ? to[0] + (color === 'w' ? parseInt(to[1]) - 1 : parseInt(to[1]) + 1)
        : null;
      const victimMesh = isEp ? this.pieces.get(victimSquare) : (victim || null);
      const destPos = this.board.getSquarePos(to);
      const victimPos = victimMesh ? victimMesh.position.clone() : destPos;

      // If there's a victim mesh to capture, remove it from the pieces map immediately
      // so it doesn't get confused with the arriving piece.
      if (victimMesh && !isEp) {
        // Normal capture: victim sits on `to` square.
        // It will be removed from scene by captureMesh below.
      } else if (isEp && victimSquare) {
        this.pieces.pieces.delete(victimSquare);
      }

      // Animate the moving piece.
      await this.pieces.movePiece(from, to);

      // Handle promotion mesh swap.
      if (promotion) {
        this.pieces.replacePiece(to, promotion, color);
      }

      // Handle castling rook movement.
      if (flags.indexOf('k') >= 0) {
        // Kingside castle: move rook.
        if (color === 'w') await this.pieces.movePiece('h1', 'f1');
        else await this.pieces.movePiece('h8', 'f8');
      } else if (flags.indexOf('q') >= 0) {
        // Queenside castle: move rook.
        if (color === 'w') await this.pieces.movePiece('a1', 'd1');
        else await this.pieces.movePiece('a8', 'd8');
      }

      // Capture: fade + remove the victim mesh at its original square.
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

      // Mark last move (from + to) on the board for readability.
      this.board.highlightSquare(from, CFG.COLORS.highlight, 1200);
      this.board.highlightSquare(to, CFG.COLORS.highlight, 1200);

      this.lastMove = { from, to, captured };

      // UI sync.
      this.ui.setTurn(this.chess.whiteTurn());
      this.ui.setCaptured(this.chess.captured);
      this.ui.setHistory(this.chess.history);

      // Game status.
      this._handleStatus(this.chess.getStatus());
    } finally {
      this.animating = false;
    }
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
        // Subtle camera push-in on the king.
        this.cam.focusOn(kPos);
      }
    } else {
      this.ui.showCheck(false);
    }

    if (status === 'checkmate' || status === 'stalemate' || status === 'draw') {
      this.state = 'gameover';
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

  newGame() {
    this.state = 'playing';
    this.animating = false;
    this.chess.reset();
    this.pieces.placeFromFEN(this.chess.fen());
    this._clearSelection();
    this.lastMove = null;
    this.ui.setTurn(true);
    this.ui.showCheck(false);
    this.ui.hideGameOver();
    this.ui.setCaptured({ w: [], b: [] });
    this.ui.setHistory([]);
    this.audio.startAmbient();
    this.cam.resetView();
  }

  undoMove() {
    if (this.chess.history.length === 0 || this.state !== 'playing') return;
    this.chess.undo();
    this.pieces.placeFromFEN(this.chess.fen());
    this._clearSelection();
    this.lastMove = null;
    this.ui.setTurn(this.chess.whiteTurn());
    this.ui.showCheck(false);
    this.ui.setCaptured(this.chess.captured);
    this.ui.setHistory(this.chess.history);
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.engine.clock.getDelta(), 0.1);

    this.cam.update(dt);
    this.env.update(dt, this.engine.clock.getElapsedTime());
    this.vfx.update(dt);
    this.audio.updateAmbient();
    this.engine.render();
  }
}