/* =====================================================================
 * Toba Drive · carangos em 3D de verdade no mapa do Navegar (desde v1.70)
 * Os modelos são montados aqui mesmo, em código (caixinhas e prismas, sem
 * arquivo .glb no repo), e viram um glTF em memória que o Mapbox carrega com
 * map.addModel(id, url). Unidade = metro, Y pra cima, frente do carango = +Z.
 * A cor da carroceria vem do 🎨 (cor da rota), então cada cor vira um modelo.
 * Nada aqui grava em banco.
 * ===================================================================== */

/* ---------- peças ---------- */
// Caixa de (x0,y0,z0) a (x1,y1,z1). top: encolhe/empurra a tampa de cima
// ({ sx, sz, dz }: escala em X e Z, deslocamento em Z) = para-brisa inclinado.
function dmBox(x0, y0, z0, x1, y1, z1, top = {}) {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const sx = top.sx ?? 1;
  const sz = top.sz ?? 1;
  const dz = top.dz ?? 0;
  const tx = (x) => cx + (x - cx) * sx;
  const tz = (z) => cz + (z - cz) * sz + dz;
  // 0-3 embaixo, 4-7 em cima (mesma ordem)
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
    [tx(x0), y1, tz(z0)], [tx(x1), y1, tz(z0)], [tx(x1), y1, tz(z1)], [tx(x0), y1, tz(z1)],
  ];
  const quads = [[0, 1, 2, 3], [7, 6, 5, 4], [3, 2, 6, 7], [1, 0, 4, 5], [2, 1, 5, 6], [0, 3, 7, 4]];
  return dmOrient(dmQuads(v, quads), [cx, (y0 + y1) / 2, cz]);
}

// Prisma de n lados deitado no eixo X (roda): centro (cy, cz), raio r, de x0 a x1
function dmWheel(x0, x1, cy, cz, r, n = 10) {
  const v = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    v.push([x0, cy + Math.sin(a) * r, cz + Math.cos(a) * r]);
  }
  for (let i = 0; i < n; i += 1) v.push([x1, v[i][1], v[i][2]]);
  const quads = [];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    quads.push([i, j, n + j, n + i]);
  }
  const tris = dmQuads(v, quads);
  // tampas
  for (let i = 1; i < n - 1; i += 1) {
    dmTri(tris, v[0], v[i + 1], v[i]);
    dmTri(tris, v[n], v[n + i], v[n + i + 1]);
  }
  return dmOrient(tris, [(x0 + x1) / 2, cy, cz]);
}

// Polígono no chão (x, z) extrudado de y0 a y1 (a seta)
function dmExtrude(poly, y0, y1) {
  const tris = [];
  const n = poly.length;
  for (let i = 0; i < n; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    dmTri(tris, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]]);
    dmTri(tris, [a[0], y0, a[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]);
  }
  // tampa em leque a partir do 1º ponto (polígono da seta é "quase convexo" a partir da ponta)
  for (let i = 1; i < n - 1; i += 1) {
    dmTri(tris, [poly[0][0], y1, poly[0][1]], [poly[i + 1][0], y1, poly[i + 1][1]], [poly[i][0], y1, poly[i][1]]);
  }
  // tampa sempre pra cima; laterais pra fora do miolo do polígono
  const mid = poly.reduce((m, p) => [m[0] + p[0] / n, m[1] + p[1] / n], [0, 0]);
  return dmOrient(tris, [mid[0], (y0 + y1) / 2, mid[1]], true);
}

// Deixa cada triângulo com a frente pra fora do centro da peça (glTF: anti-horário = frente).
// flatTop: tampa de cima (triângulo deitado) sempre olhando pra cima.
function dmOrient(tris, center, flatTop = false) {
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]];
    const nrm = dmNormal(a, b, c);
    const flat = Math.abs(nrm[1]) > 0.99;
    const out = flatTop && flat
      ? (a[1] > center[1] ? 1 : -1) * nrm[1]
      : nrm[0] * ((a[0] + b[0] + c[0]) / 3 - center[0]) + nrm[1] * ((a[1] + b[1] + c[1]) / 3 - center[1]) + nrm[2] * ((a[2] + b[2] + c[2]) / 3 - center[2]);
    if (out < 0) {
      tris[i + 1] = c;
      tris[i + 2] = b;
    }
  }
  return tris;
}

function dmNormal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const nx = u[1] * w[2] - u[2] * w[1];
  const ny = u[2] * w[0] - u[0] * w[2];
  const nz = u[0] * w[1] - u[1] * w[0];
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

function dmTri(out, a, b, c) {
  out.push(a, b, c);
  return out;
}

function dmQuads(v, quads) {
  const out = [];
  quads.forEach(([a, b, c, d]) => {
    dmTri(out, v[a], v[b], v[c]);
    dmTri(out, v[a], v[c], v[d]);
  });
  return out;
}

/* ---------- glTF em memória ---------- */
// parts: [{ color: [r,g,b] 0-1 linear, emissive?: [r,g,b], metal?, rough?, tris: [[x,y,z]...] }]
// (as peças já saem com a frente pra fora: dmOrient)
function driveBuildGltf(parts) {
  const chunks = [];
  let byteLength = 0;
  const bufferViews = [];
  const accessors = [];
  const meshes = { primitives: [] };
  const materials = [];
  const push = (typed, target) => {
    const pad = (4 - (byteLength % 4)) % 4;
    if (pad) {
      chunks.push(new Uint8Array(pad));
      byteLength += pad;
    }
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: typed.byteLength, target });
    chunks.push(new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength));
    byteLength += typed.byteLength;
    return bufferViews.length - 1;
  };
  parts.forEach((part) => {
    const t = part.tris;
    const n = t.length;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const idx = new Uint16Array(n);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i += 3) {
      const [nx, ny, nz] = dmNormal(t[i], t[i + 1], t[i + 2]);
      for (let k = 0; k < 3; k += 1) {
        const p = t[i + k];
        const o = (i + k) * 3;
        pos[o] = p[0];
        pos[o + 1] = p[1];
        pos[o + 2] = p[2];
        nor[o] = nx;
        nor[o + 1] = ny;
        nor[o + 2] = nz;
        idx[i + k] = i + k;
        for (let d = 0; d < 3; d += 1) {
          min[d] = Math.min(min[d], p[d]);
          max[d] = Math.max(max[d], p[d]);
        }
      }
    }
    const vPos = push(pos, 34962);
    const vNor = push(nor, 34962);
    const vIdx = push(idx, 34963);
    accessors.push({ bufferView: vPos, componentType: 5126, count: n, type: "VEC3", min, max });
    accessors.push({ bufferView: vNor, componentType: 5126, count: n, type: "VEC3" });
    accessors.push({ bufferView: vIdx, componentType: 5123, count: n, type: "SCALAR" });
    materials.push({
      pbrMetallicRoughness: { baseColorFactor: [...part.color, 1], metallicFactor: part.metal ?? 0.15, roughnessFactor: part.rough ?? 0.55 },
      emissiveFactor: part.emissive || [0, 0, 0],
    });
    const a0 = accessors.length - 3;
    meshes.primitives.push({ attributes: { POSITION: a0, NORMAL: a0 + 1 }, indices: a0 + 2, material: materials.length - 1 });
  });
  const bin = new Uint8Array(byteLength);
  let off = 0;
  chunks.forEach((c) => {
    bin.set(c, off);
    off += c.byteLength;
  });
  let b64 = "";
  for (let i = 0; i < bin.length; i += 0x8000) b64 += String.fromCharCode.apply(null, bin.subarray(i, i + 0x8000));
  return {
    asset: { version: "2.0", generator: "Toba Drive" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [meshes],
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength, uri: `data:application/octet-stream;base64,${btoa(b64)}` }],
  };
}

function driveHexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  const n = m ? parseInt(m[1], 16) : 0xfb923c;
  // glTF quer cor linear (o sRGB da tela fica claro demais sem isso)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
}

/* ---------- os modelos ---------- */
const DM_BLACK = [0.02, 0.02, 0.025];
const DM_GLASS = [0.03, 0.05, 0.08];
const DM_WHITE = [0.9, 0.9, 0.9];

// 🏎️ Toba GT: esportivo baixinho com aerofólio (4,4 m x 1,9 m)
function driveModelGt(hex) {
  const body = driveHexRgb(hex);
  return [
    { color: body, metal: 0.45, rough: 0.35, tris: dmBox(-0.95, 0.28, -2.2, 0.95, 0.8, 2.2, { sx: 0.96, sz: 0.97 }) },
    // capô baixinho na frente (bico)
    { color: body, metal: 0.45, rough: 0.35, tris: dmBox(-0.9, 0.28, 2.2, 0.9, 0.62, 2.45, { sx: 0.9, sz: 0.6, dz: -0.05 }) },
    // cabine de vidro escuro com para-brisa deitado
    { color: DM_GLASS, metal: 0.6, rough: 0.15, tris: dmBox(-0.78, 0.8, -1.15, 0.78, 1.28, 0.95, { sx: 0.82, sz: 0.62, dz: -0.18 }) },
    // teto na cor do carro
    { color: body, metal: 0.45, rough: 0.35, tris: dmBox(-0.62, 1.28, -0.82, 0.62, 1.34, 0.42) },
    // aerofólio
    { color: DM_BLACK, tris: dmBox(-0.92, 1.0, -2.25, 0.92, 1.08, -1.85) },
    { color: DM_BLACK, tris: dmBox(-0.6, 0.8, -2.1, -0.5, 1.0, -1.95).concat(dmBox(0.5, 0.8, -2.1, 0.6, 1.0, -1.95)) },
    // rodas
    { color: DM_BLACK, rough: 0.9, tris: [
      ...dmWheel(-1.0, -0.72, 0.34, 1.35, 0.34), ...dmWheel(0.72, 1.0, 0.34, 1.35, 0.34),
      ...dmWheel(-1.0, -0.72, 0.34, -1.35, 0.34), ...dmWheel(0.72, 1.0, 0.34, -1.35, 0.34),
    ] },
    // faróis e lanternas (acendem no escuro)
    { color: [1, 0.95, 0.75], emissive: [1, 0.95, 0.7], tris: dmBox(-0.85, 0.55, 2.2, -0.45, 0.68, 2.3).concat(dmBox(0.45, 0.55, 2.2, 0.85, 0.68, 2.3)) },
    { color: [0.9, 0.05, 0.05], emissive: [1, 0.05, 0.05], tris: dmBox(-0.9, 0.6, -2.26, -0.4, 0.72, -2.2).concat(dmBox(0.4, 0.6, -2.26, 0.9, 0.72, -2.2)) },
  ];
}

// ➤ Seta clássica em 3D: chevron gordinho deitado na rua (4 m), branco com borda na cor
function driveModelArrow(hex) {
  const color = driveHexRgb(hex);
  const outer = [[0, 2.4], [1.9, -1.9], [0, -0.9], [-1.9, -1.9]];
  const inner = [[0, 1.75], [1.35, -1.35], [0, -0.55], [-1.35, -1.35]];
  return [
    // acende sozinha (é marcador, tem que aparecer de dia e de noite)
    { color, emissive: color.map((c) => c * 0.8), metal: 0.1, rough: 0.5, tris: dmExtrude(outer, 0.05, 0.7) },
    { color: DM_WHITE, emissive: [0.85, 0.85, 0.85], tris: dmExtrude(inner, 0.7, 0.95) },
  ];
}

const DRIVE_MODELS = {
  gt: driveModelGt,
  arrow: driveModelArrow,
};

// URL (blob:) do modelo pra cor: guarda pra não remontar a cada leitura do GPS
const driveModelUrls = {};
function driveModelUrl(kind, hex) {
  const key = `${kind}-${hex}`;
  if (!driveModelUrls[key]) {
    const gltf = driveBuildGltf((DRIVE_MODELS[kind] || driveModelArrow)(hex));
    driveModelUrls[key] = URL.createObjectURL(new Blob([JSON.stringify(gltf)], { type: "model/gltf+json" }));
  }
  return driveModelUrls[key];
}
