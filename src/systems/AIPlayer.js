/**
 * AIPlayer — minimax with alpha-beta pruning, 3 difficulty levels.
 * Runs synchronously but yields via setTimeout to avoid UI freeze.
 */
import { Chess } from 'chess.js';

// Piece values (centipawns)
const PIECE_VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-square tables (simplified, from white's perspective; flip for black)
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

function sqToIdx(sq) {
  const col = sq.charCodeAt(0) - 97;
  const row = 8 - parseInt(sq[1]);
  return row * 8 + col;
}

function evaluate(game) {
  const board = game.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const idx = r * 8 + c;
      const flipIdx = (7 - r) * 8 + c;
      const val = PIECE_VAL[piece.type] || 0;
      const pst = PST[piece.type] ? PST[piece.type][piece.color === 'w' ? idx : flipIdx] : 0;
      if (piece.color === 'w') {
        score += val + pst;
      } else {
        score -= val + pst;
      }
    }
  }
  return score;
}

function orderMoves(moves) {
  // MVV-LVA ordering: captures first (high victim, low attacker), then checks, then rest
  return moves.sort((a, b) => {
    const aScore = a.captured ? (PIECE_VAL[a.captured] || 0) * 10 - (PIECE_VAL[a.piece] || 0) : 0;
    const bScore = b.captured ? (PIECE_VAL[b.captured] || 0) * 10 - (PIECE_VAL[b.piece] || 0) : 0;
    return bScore - aScore;
  });
}

function minimax(game, depth, alpha, beta, maximizing) {
  if (depth === 0) return evaluate(game);
  if (game.isGameOver()) {
    if (game.isCheckmate()) return maximizing ? -99999 : 99999;
    return 0; // draw
  }

  const moves = orderMoves(game.moves({ verbose: true }));

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      game.move(m);
      const val = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      game.move(m);
      const val = minimax(game, depth - 1, alpha, beta, true);
      game.undo();
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export class AIPlayer {
  constructor() {
    // Difficulty: 'easy' (depth 1 + random), 'medium' (depth 2), 'hard' (depth 3)
    this.difficulty = 'medium';
    this.thinking = false;
  }

  setDifficulty(level) {
    this.difficulty = level;
  }

  getDepth() {
    switch (this.difficulty) {
      case 'easy': return 1;
      case 'medium': return 2;
      case 'hard': return 3;
      default: return 2;
    }
  }

  /**
   * Returns a promise that resolves to { from, to, promotion? }
   * Uses setTimeout to yield to UI between depth searches.
   */
  async findBestMove(fen) {
    this.thinking = true;
    return new Promise(resolve => {
      setTimeout(() => {
        try {
          const game = new Chess(fen);
          const moves = game.moves({ verbose: true });
          if (moves.length === 0) { this.thinking = false; resolve(null); return; }

          const depth = this.getDepth();
          const isWhite = game.turn() === 'w';

          if (this.difficulty === 'easy' && Math.random() < 0.3) {
            // 30% chance of random move on easy
            const pick = moves[Math.floor(Math.random() * moves.length)];
            this.thinking = false;
            resolve({ from: pick.from, to: pick.to, promotion: pick.promotion || undefined });
            return;
          }

          let bestMove = moves[0];
          let bestVal = isWhite ? -Infinity : Infinity;

          for (const m of orderMoves(moves)) {
            game.move(m);
            const val = minimax(game, depth - 1, -Infinity, Infinity, !isWhite);
            game.undo();

            if (isWhite ? val > bestVal : val < bestVal) {
              bestVal = val;
              bestMove = m;
            }
          }

          this.thinking = false;
          resolve({
            from: bestMove.from,
            to: bestMove.to,
            promotion: bestMove.promotion || undefined,
          });
        } catch (e) {
          console.error('[AI] Error:', e);
          this.thinking = false;
          resolve(null);
        }
      }, this._thinkDelay()); // artificial delay so it feels like thinking
    });
  }

  _thinkDelay() {
    switch (this.difficulty) {
      case 'easy': return 300 + Math.random() * 500;   // 0.3–0.8s
      case 'medium': return 500 + Math.random() * 800;  // 0.5–1.3s
      case 'hard': return 200 + Math.random() * 400;    // 0.2–0.6s (compute takes longer anyway)
      default: return 400;
    }
  }
}
