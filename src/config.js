/**
 * Central configuration — dimensions, colors, timing, scale.
 *
 * Colors are stored as THREE.Color objects so ChessBoard / PieceController
 * can assign them directly to material.emissive without type-coercion surprises.
 */
import * as THREE from 'three';

const hex = h => new THREE.Color(h);

export const CFG = {
  SQUARE_SIZE: 1,
  BOARD_OFFSET_Y: 1.10,   // top of dais + board slab, where squares/pieces sit
  SET_SCALE: 16.2,        // GLB board 0.55m × 16.2 = ~8.95u (outer stone border framing 8u grid)

  COLORS: {
    boardLight:  hex(0x7a746e),
    boardDark:   hex(0x1a1816),
    highlight:   hex(0xc9a84c),
    legalMove:   hex(0x3a6b3a),
    selected:    hex(0xffcc00),
    whitePiece:  hex(0xf5e6c8),
    blackPiece:  hex(0x1a1410),
    checkWarn:   hex(0xcc3333),
    daisStone:   hex(0x3a3128),
    fog:         hex(0x070503),
  },

  CAMERA: {
    // Inside the 1.8× Kenney room (21.6 × 7.6 m).
    INTRO_START: [0, 6.2, 9.8],
    INTRO_END:   [0, 3.3, 6.9],
    INTRO_DUR:   4.0,
    ORBIT_MIN:   4,
    ORBIT_MAX:   9.5,
  },

  ANIM: {
    MOVE_DUR:    380,
    CAPTURE_DUR: 260,
  },
};