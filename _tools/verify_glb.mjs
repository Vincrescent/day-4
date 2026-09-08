// Verify the exported GLB: parse JSON header, list nodes + meshes + materials + images.
import { readFileSync } from 'fs';
const GLB = 'D:/CODE/30 DAYS/DAY 4/assets/models/chess_set.glb';
const buf = readFileSync(GLB);
const magic = buf.readUInt32LE(0);
const version = buf.readUInt32LE(4);
const length = buf.readUInt32LE(8);
console.log('magic', magic.toString(16), 'version', version, 'length', length, 'bytes', buf.length);

// JSON chunk
const jsonChunkLen = buf.readUInt32LE(12);
const jsonChunkType = buf.readUInt32LE(16);
console.log('jsonChunkType', jsonChunkType.toString(16), 'jsonChunkLen', jsonChunkLen);
const jsonStr = buf.slice(20, 20 + jsonChunkLen).toString('utf8');
const g = JSON.parse(jsonStr);

console.log('\n=== NODES (%d) ===', g.nodes.length);
for (const n of g.nodes) {
  const tr = n.translation || [0,0,0];
  console.log(`  [${n.name}] mesh=${n.mesh ?? '-'} t=(${tr.map(v=>v.toFixed(3)).join(',')})`);
}

console.log('\n=== MESHES (%d) ===', g.meshes.length);
let totalTris = 0;
for (const m of g.meshes) {
  let tri = 0;
  for (const p of m.primitives) {
    const acc = g.accessors[p.indices];
    if (acc) tri += acc.count / 3;
  }
  totalTris += tri;
  console.log(`  [${m.name}] prims=${m.primitives.length} tris=${tri}`);
}
console.log('  TOTAL TRIS:', totalTris);

console.log('\n=== MATERIALS (%d) ===', g.materials.length);
for (const m of g.materials) {
  const pbr = m.pbrMetallicRoughness || {};
  const bc = pbr.baseColorFactor || [];
  const texs = [];
  if (m.normalTexture) texs.push('normal');
  if (m.occularMetallicRoughness?.roughnessTexture || pbr.metallicRoughnessTexture) texs.push('metalRough');
  if (pbr.baseColorTexture) texs.push('baseColor');
  if (m.emissiveTexture) texs.push('emissive');
  console.log(`  [${m.name}] base=${bc.map(v=>v.toFixed(2)).join(',')} texs=[${texs.join(', ')}]`);
}

console.log('\n=== IMAGES (%d) ===', (g.images||[]).length);
for (const im of g.images || []) {
  const view = g.bufferViews[im.bufferView];
  console.log(`  [${im.name||'-'}] mime=${im.mimeType||'-'} bytes=${view?.byteLength ?? 'n/a'}`);
}
console.log('\nGLB_VERIFY_DONE');
