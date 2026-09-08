/**
 * Central configuration — dimensions, colors, timing.
 * Colors are hex ints (use with new THREE.Color / material.color.setHex).
 */
export const CFG = {
  SQUARE_SIZE: 1,
  BOARD_OFFSET_Y: 0.8, // top of dais where the board sits

  COLORS: {
    boardLight:  0xd4b896,
    boardDark:   0x3d2b1f,
    highlight:   0xc9a84c,
    legalMove:   0x3a6b3a,
    selected:    0xffcc00,
    whitePiece:  0xf5e6c8,
    blackPiece:  0x1a1410,
    checkWarn:   0xcc3333,
    daisStone:   0x3a3128,
    fog:         0x070503,
  },

  CAMERA: {
    INTRO_START: [0, 9, 17],
    INTRO_END:   [0, 3.6, 7.2],
    INTRO_DUR:   4.0,
    ORBIT_MIN:   4,
    ORBIT_MAX:   17,
  },

  ANIM: {
    MOVE_DUR:  380,
    CAPTURE_DUR: 260,
  },
};
