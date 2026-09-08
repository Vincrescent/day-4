/**
 * ChessEngine — wraps chess.js with move history + captured tracking.
 */
import { Chess } from 'chess.js';

export class ChessEngine {
  constructor() {
    this.game = new Chess();
    this.history = [];
    this.captured = { w: [], b: [] }; // w = pieces captured BY white (black pieces)
  }

  reset() {
    this.game.reset();
    this.history = [];
    this.captured = { w: [], b: [] };
  }

  makeMove(from, to, promotion = 'q') {
    let result = null;
    try {
      result = this.game.move({ from, to, promotion });
    } catch (e) {
      return null;
    }
    if (!result) return null;
    this.history.push(result.san);
    if (result.captured) {
      // result.color is the side that moved; captured piece belongs to the other
      if (result.color === 'w') this.captured.w.push(result.captured);
      else this.captured.b.push(result.captured);
    }
    return result;
  }

  undo() {
    if (this.history.length === 0) return false;
    const last = this.game.history({ verbose: true }).pop();
    this.game.undo();
    this.history.pop();
    if (last && last.captured) {
      if (last.color === 'w') this.captured.w.pop();
      else this.captured.b.pop();
    }
    return true;
  }

  legalMovesFrom(square) {
    const mv = this.game.moves({ square, verbose: true });
    return mv;
  }

  isLegal(from, to) {
    return this.legalMovesFrom(from).some(m => m.to === to);
  }

  getStatus() {
    const g = this.game;
    if (g.isCheckmate()) return 'checkmate';
    if (g.isStalemate()) return 'stalemate';
    if (g.isDraw()) return 'draw';
    if (g.isCheck()) return 'check';
    return 'playing';
  }

  getPromotionSquare(from, to) {
    // Returns {type, color} if the move is a promotion
    const mv = this.legalMovesFrom(from).find(m => m.to === to);
    if (mv && mv.promotion) {
      return { type: 'q', color: this.game.turn() };
    }
    return null;
  }

  fen() { return this.game.fen(); }
  turn() { return this.game.turn(); }
  whiteTurn() { return this.game.turn() === 'w'; }
  inCheck() { return this.game.inCheck(); }

  findKingSquare(color) {
    const board = this.game.board();
    for (const row of board) {
      for (const sq of row) {
        if (sq && sq.type === 'k' && sq.color === color) return sq.square;
      }
    }
    return null;
  }

  pieceAt(square) {
    try {
      return this.game.get(square);
    } catch (e) {
      return undefined;
    }
  }
}
