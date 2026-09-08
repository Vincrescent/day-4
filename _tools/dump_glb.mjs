// Dump mesh/node/material details of a GLB.
import { readFileSync } from 'fs';
const buf = readFileSync(process.argv[2]);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
console.log('nodes:', JSON.stringify(json.nodes?.map((n, i) => ({ i, name: n.name, mesh: n.mesh })), null, 1));
console.log('meshes:', (json.meshes || []).map((m, i) => ({ i, name: m.name, prims: m.primitives.length })));
console.log('materials:', (json.materials || []).map((m, i) => ({ i, name: m.name, side: m.doubleSided ? 'double' : 'single', base: m.pbrMetallicRoughness?.baseColorFactor })));

// Estimate bounding boxes per mesh (using accessor min/max on POSITION)
function xform(v, m) {
  const [x, y, z] = v;
  return [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];
}
const nodes = json.nodes || [];
function worldMat(i, parent) {
  const n = nodes[i];
  const T = n.translation || [0,0,0];
  const R = n.rotation || [0,0,0,1];
  const S = n.scale || [1,1,1];
  const out = [
    S[0],0,0,T[0], 0,S[1],0,T[1], 0,0,S[2],T[2], 0,0,0,1,
  ];
  if (R[0]||R[1]||R[2]||R[3]!==1) {
    const [x,y,z,w]=R;
    const mR=[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,
      2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,
      2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0,0,0,0,1];
    const mS=[S[0],0,0,0,0,S[1],0,0,0,0,S[2],0,0,0,0,1];
    const o=new Array(16).fill(0);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=mR[c*4+k]*mS[k*4+r];
    o[12]=T[0];o[13]=T[1];o[14]=T[2];o[15]=1;
    if(parent){const o2=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o2[c*4+r]+=parent[c*4+k]*o[k*4+r];return o2;}
    return o;
  }
  if(parent){const o2=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o2[c*4+r]+=parent[c*4+k]*o[k*4+r];return o2;}
  return out;
}
for (let mi = 0; mi < (json.meshes||[]).length; mi++) {
  const mesh = json.meshes[mi];
  let min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  // find node referencing this mesh
  const owners = nodes.map((n,i)=>({n,i})).filter(x=>x.n.mesh===mi);
  for (const {n,i} of owners) {
    const m = worldMat(i, null);
    const prim = mesh.primitives[0];
    const a = json.accessors[prim.attributes.POSITION];
    if (a.min && a.max) {
      for (let cx=0;cx<2;cx++)for(let cy=0;cy<2;cy++)for(let cz=0;cz<2;cz++){
        const v = xform([cx?a.max[0]:a.min[0], cy?a.max[1]:a.min[1], cz?a.max[2]:a.min[2]], m);
        for(let d=0;d<3;d++){ if(v[d]<min[d])min[d]=v[d]; if(v[d]>max[d])max[d]=v[d]; }
      }
    }
  }
  console.log(`mesh[${mi}] "${mesh.name}"  min=[${min.map(v=>v.toFixed(2))}]  max=[${max.map(v=>v.toFixed(2))}]`);
}
