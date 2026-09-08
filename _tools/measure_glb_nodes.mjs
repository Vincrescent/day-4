// Measure board footprint + piece bounds from chess_set.glb POSITION accessors.
import { readFileSync } from 'fs';
const buf = readFileSync(process.argv[2] || 'assets/models/chess_set.glb');
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));

// Build node hierarchy (root list, children)
const nodes = json.nodes || [];
function worldMatrix(i, parent = null) {
  const n = nodes[i];
  const T = n.translation || [0, 0, 0];
  const R = n.rotation || [0, 0, 0, 1];
  const S = n.scale || [1, 1, 1];
  // Compose TRS as 4x4 (column-major)
  const m = [
    S[0], 0, 0, T[0],
    0, S[1], 0, T[1],
    0, 0, S[2], T[2],
    0, 0, 0, 1,
  ];
  // Apply rotation (quaternion) — for non-identity, proper compose:
  if (R[0] || R[1] || R[2] || R[3] !== 1) {
    const [x, y, z, w] = R;
    const mR = [
      1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
      2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
      2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
      0, 0, 0, 1,
    ];
    // m = mR * mScale (column-major multiply)
    const mS = [
      S[0], 0, 0, 0,
      0, S[1], 0, 0,
      0, 0, S[2], 0,
      0, 0, 0, 1,
    ];
    const out = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) out[c * 4 + r] += mR[c * 4 + k] * mS[k * 4 + r];
    }
    out[12] = T[0]; out[13] = T[1]; out[14] = T[2]; out[15] = 1;
    m = out;
  }
  if (parent) {
    const out = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) out[c * 4 + r] += parent[c * 4 + k] * m[k * 4 + r];
    }
    return out;
  }
  return m;
}

function xform(v, m) {
  const [x, y, z] = v;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function nodeBounds(i, parentM, acc) {
  const n = nodes[i];
  const m = worldMatrix(i, parentM);
  if (n.mesh != null && !acc.has(i)) {
    acc.set(i, m);
  }
  for (const c of n.children || []) nodeBounds(c, m, acc);
}

// For each root node, compute world-space min/max of its mesh POSITION accessor (with node transform)
const results = [];
for (let i = 0; i < nodes.length; i++) {
  const n = nodes[i];
  if ((json.scene || {}).nodes?.includes(i) === false && i !== (json.scene || {}).nodes?.[0]) { /* include all roots anyway */ }
}
// Simpler: iterate all root nodes (no parent) and compute bounds for each root subtree
function findRoots() {
  const childSet = new Set();
  for (const n of nodes) for (const c of n.children || []) childSet.add(c);
  const roots = [];
  for (let i = 0; i < nodes.length; i++) if (!childSet.has(i)) roots.push(i);
  return roots;
}

function subtreeBounds(rootIdx) {
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const stack = [[rootIdx, null]];
  while (stack.length) {
    const [i, parentM] = stack.pop();
    const n = nodes[i];
    const m = worldMatrix(i, parentM);
    if (n.mesh != null) {
      const prim = json.meshes[n.mesh].primitives[0];
      const accIdx = json.meshes[n.mesh].primitives[0].attributes.POSITION;
      const a = json.accessors[accIdx];
      if (a.min && a.max) {
        for (let k = 0; k < 8; k++) {
          const v = xform(k < 4 ? [a.min[0], a.min[1], a.min[2]] : k < 6 ? [a.max[0], a.min[1], a.min[2]] : k === 6 ? [a.max[0], a.max[1], a.min[2]] : [a.max[0], a.max[1], a.max[2]], m);
          // that's clumsy; do all 8 corners properly below instead
        }
        const corners = [];
        for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) for (let cz = 0; cz < 2; cz++) {
          corners.push([
            cx ? a.max[0] : a.min[0],
            cy ? a.max[1] : a.min[1],
            cz ? a.max[2] : a.min[2],
          ]);
        }
        for (const c of corners) {
          const v = xform(c, m);
          for (let d = 0; d < 3; d++) {
            if (v[d] < min[d]) min[d] = v[d];
            if (v[d] > max[d]) max[d] = v[d];
          }
        }
      }
    }
    for (const c of n.children || []) stack.push([c, m]);
  }
  return { min, max };
}

const roots = findRoots();
for (const r of roots) {
  const n = nodes[r];
  const b = subtreeBounds(r);
  const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  console.log(`${n.name || ('node' + r).padEnd(28)}  min=[${b.min.map(v => v.toFixed(4))}]  max=[${b.max.map(v => v.toFixed(4))}]  size=[${size.map(v => v.toFixed(4))}]`);
}
console.log('');
console.log('BOARD square size (if footprint/8):', (roots.length && (() => { const r = roots.find(r => (nodes[r].name || '').toLowerCase().includes('board')); if (!r) return 'no board node'; const b = subtreeBounds(r); const f = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]); return (f / 8).toFixed(5); })()) || 'n/a');
