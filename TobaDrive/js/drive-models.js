/* =====================================================================
 * Toba Drive · carangos em 3D de verdade no mapa do Navegar (desde v1.70)
 * Os modelos são montados aqui mesmo, em código (caixinhas e prismas, sem
 * arquivo .glb no repo), e viram um glTF em memória que o Mapbox carrega com
 * map.addModel(id, url). Unidade = metro, Y pra cima, frente do carango = +Z.
 * A cor da carroceria vem do 🎨 (cor da rota), então cada cor vira um modelo.
 * v1.77: todo carango do 🎨 tem modelo aqui (DRIVE_MODELS + DRIVE_MODEL_SPECS);
 * o emoji de lado saiu do mapa.
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

// v1.77: prisma/cone de n lados no eixo "x", "y" ou "z", de a0 (raio r0) até a1 (raio r1).
// u, v = centro nos outros dois eixos (x: y,z · y: x,z · z: x,y). r1 ~0 = cone (bico, chama).
function dmPrism(axis, a0, a1, u, v, r0, r1, n = 12) {
  const at = (t, du, dv) => (axis === "x" ? [t, u + du, v + dv] : axis === "y" ? [u + du, t, v + dv] : [u + du, v + dv, t]);
  const ring = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    ring.push([Math.sin(a), Math.cos(a)]);
  }
  const v0 = ring.map(([s, c]) => at(a0, s * r0, c * r0));
  const v1 = ring.map(([s, c]) => at(a1, s * r1, c * r1));
  const tris = [];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    dmTri(tris, v0[i], v0[j], v1[j]);
    dmTri(tris, v0[i], v1[j], v1[i]);
  }
  // tampas
  for (let i = 1; i < n - 1; i += 1) {
    dmTri(tris, v0[0], v0[i + 1], v0[i]);
    if (r1 > 0.001) dmTri(tris, v1[0], v1[i], v1[i + 1]);
  }
  return dmOrient(tris, at((a0 + a1) / 2, 0, 0));
}

// Roda: prisma deitado no eixo X, centro (cy, cz), raio r, de x0 a x1
function dmWheel(x0, x1, cy, cz, r, n = 10) {
  return dmPrism("x", x0, x1, cy, cz, r, r, n);
}

// Peça espelhada dos dois lados (x e -x): fn(sinal) devolve os triângulos
function dmBoth(fn) {
  return fn(1).concat(fn(-1));
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

/* ---------- v1.77: TODO carango em 3D (Milena: "nada a ver carro de F1 de lado") ----------
 * Mesmo esquema do GT: caixinhas, rodas e cones. Corpo na cor da rota, menos os
 * que têm cor de fábrica (táxi amarelo, viatura preta e branca, tartaruga verde,
 * fantasma branco). */
const DM_TIRE = [0.015, 0.015, 0.02];
const DM_HEAD = [1, 0.95, 0.75];
const DM_TAIL = [0.9, 0.05, 0.05];

// faróis (frente = +Z) e lanternas (trás): pares espelhados, acendem no escuro
function dmLights(x, y0, y1, zFront, zBack, w = 0.4) {
  return [
    { color: DM_HEAD, emissive: [1, 0.95, 0.7], tris: dmBoth((k) => dmBox(k * x - w / 2, y0, zFront - 0.06, k * x + w / 2, y1, zFront + 0.05)) },
    { color: DM_TAIL, emissive: [1, 0.05, 0.05], tris: dmBoth((k) => dmBox(k * x - w / 2, y0, zBack - 0.05, k * x + w / 2, y1, zBack + 0.06)) },
  ];
}

// 4 rodas: meia-bitola x (lado de fora), largura w, raio r, eixos em +za / -zb
function dmFourWheels(x, w, r, za, zb = za) {
  return { color: DM_TIRE, rough: 0.9, tris: dmBoth((k) => [
    ...dmWheel(k > 0 ? x - w : -x, k > 0 ? x : -x + w, r, za, r),
    ...dmWheel(k > 0 ? x - w : -x, k > 0 ? x : -x + w, r, -zb, r),
  ]) };
}

// 🚗 Carrinho (hatch 4 m): base de táxi e viatura também
function driveModelCarro(hex, paint) {
  const body = paint || driveHexRgb(hex);
  return [
    { color: body, metal: 0.35, rough: 0.4, tris: dmBox(-0.88, 0.3, -1.95, 0.88, 0.88, 1.95, { sx: 0.97, sz: 0.97 }) },
    { color: body, metal: 0.35, rough: 0.4, tris: dmBox(-0.84, 0.3, 1.95, 0.84, 0.72, 2.1, { sx: 0.92, sz: 0.5, dz: -0.04 }) },
    { color: DM_GLASS, metal: 0.6, rough: 0.15, tris: dmBox(-0.8, 0.88, -1.6, 0.8, 1.45, 0.75, { sx: 0.86, sz: 0.74, dz: -0.12 }) },
    { color: body, metal: 0.35, rough: 0.4, tris: dmBox(-0.68, 1.45, -1.42, 0.68, 1.52, 0.42) },
    dmFourWheels(0.96, 0.26, 0.33, 1.28),
    ...dmLights(0.6, 0.6, 0.74, 2.0, -1.95),
  ];
}

// 🚕 Táxi: carrinho amarelo com a plaquinha TÁXI acesa no teto e faixa xadrez
function driveModelTaxi(hex) {
  return [
    ...driveModelCarro(hex, driveHexRgb("#facc15")),
    { color: DM_WHITE, emissive: [1, 0.85, 0.3], tris: dmBox(-0.32, 1.52, -0.65, 0.32, 1.76, -0.3, { sx: 0.9 }) },
    { color: DM_BLACK, tris: dmBoth((k) => dmBox(k > 0 ? 0.86 : -0.9, 0.58, -1.4, k > 0 ? 0.9 : -0.86, 0.66, 1.4)) },
  ];
}

// 🚓 Viatura: preta com as portas brancas e o giroflex vermelho/azul
function driveModelViatura(hex) {
  return [
    ...driveModelCarro(hex, [0.015, 0.015, 0.02]),
    { color: DM_WHITE, metal: 0.3, rough: 0.4, tris: dmBoth((k) => dmBox(k > 0 ? 0.84 : -0.9, 0.36, -0.95, k > 0 ? 0.9 : -0.84, 0.86, 0.85)) },
    { color: DM_WHITE, tris: dmBox(-0.66, 1.52, -1.0, 0.66, 1.54, 0.2) },
    { color: [1, 0.05, 0.05], emissive: [1, 0.05, 0.05], tris: dmBox(-0.6, 1.52, -0.55, -0.04, 1.68, -0.32) },
    { color: [0.1, 0.3, 1], emissive: [0.1, 0.35, 1], tris: dmBox(0.04, 1.52, -0.55, 0.6, 1.68, -0.32) },
  ];
}

// 🏍️ Motoca com piloto de capacete (moto na cor da rota)
function driveModelMoto(hex) {
  const body = driveHexRgb(hex);
  return [
    { color: DM_TIRE, rough: 0.9, tris: [...dmWheel(-0.09, 0.09, 0.34, 0.72, 0.34, 12), ...dmWheel(-0.1, 0.1, 0.34, -0.68, 0.34, 12)] },
    { color: body, metal: 0.5, rough: 0.3, tris: dmBox(-0.14, 0.36, -0.62, 0.14, 0.72, 0.66, { sx: 0.8, sz: 0.9 }) },
    { color: body, metal: 0.5, rough: 0.3, tris: dmBox(-0.22, 0.72, -0.02, 0.22, 0.95, 0.5, { sx: 0.8, sz: 0.8, dz: 0.03 }) },
    { color: DM_BLACK, tris: dmBox(-0.19, 0.72, -0.62, 0.19, 0.84, 0.02) },
    { color: [0.6, 0.6, 0.62], metal: 0.8, rough: 0.3, tris: dmBox(-0.42, 0.98, 0.5, 0.42, 1.03, 0.56) },
    // piloto inclinado pra frente
    { color: [0.08, 0.09, 0.12], tris: dmBox(-0.23, 0.84, -0.42, 0.23, 1.42, -0.02, { sx: 0.85, dz: 0.2 }) },
    { color: [0.08, 0.09, 0.12], tris: dmBoth((k) => dmBox(k * 0.2 - 0.06, 0.95, 0.0, k * 0.2 + 0.06, 1.25, 0.52, { dz: 0.05 })) },
    { color: body, metal: 0.4, rough: 0.25, tris: dmBox(-0.16, 1.42, -0.06, 0.16, 1.74, 0.26, { sx: 0.8, sz: 0.8 }) },
    { color: DM_GLASS, metal: 0.6, rough: 0.1, tris: dmBox(-0.13, 1.5, 0.24, 0.13, 1.64, 0.28) },
    { color: DM_HEAD, emissive: [1, 0.95, 0.7], tris: dmBox(-0.09, 0.78, 0.66, 0.09, 0.92, 0.74) },
    { color: DM_TAIL, emissive: [1, 0.05, 0.05], tris: dmBox(-0.08, 0.76, -0.68, 0.08, 0.84, -0.62) },
  ];
}

// 🚌 Busão (11 m): janelão escuro em volta, teto branco, letreiro aceso
function driveModelBusao(hex) {
  const body = driveHexRgb(hex);
  return [
    { color: body, metal: 0.25, rough: 0.5, tris: dmBox(-1.25, 0.38, -5.5, 1.25, 3.0, 5.5) },
    { color: DM_GLASS, metal: 0.6, rough: 0.15, tris: dmBox(-1.28, 1.55, -5.2, 1.28, 2.55, 4.9) },
    { color: DM_GLASS, metal: 0.6, rough: 0.15, tris: dmBox(-1.12, 0.95, 5.45, 1.12, 2.7, 5.56) },
    { color: DM_WHITE, tris: dmBox(-1.2, 3.0, -5.3, 1.2, 3.12, 5.2) },
    { color: [1, 0.6, 0.1], emissive: [1, 0.55, 0.05], tris: dmBox(-0.9, 2.72, 5.5, 0.9, 2.92, 5.58) },
    dmFourWheels(1.24, 0.32, 0.5, 3.4, 3.7),
    ...dmLights(0.95, 0.55, 0.78, 5.55, -5.5, 0.32),
  ];
}

// 🛻 Picape: cabine na frente, caçamba aberta atrás e rodão
function driveModelPicape(hex) {
  const body = driveHexRgb(hex);
  return [
    { color: body, metal: 0.35, rough: 0.45, tris: dmBox(-0.95, 0.45, -2.65, 0.95, 1.0, 2.6, { sx: 0.98, sz: 0.99 }) },
    { color: DM_GLASS, metal: 0.6, rough: 0.15, tris: dmBox(-0.86, 1.0, -0.15, 0.86, 1.68, 1.35, { sx: 0.9, sz: 0.78, dz: -0.1 }) },
    { color: body, metal: 0.35, rough: 0.45, tris: dmBox(-0.76, 1.68, -0.02, 0.76, 1.75, 1.08) },
    { color: [0.06, 0.06, 0.07], rough: 0.9, tris: dmBox(-0.84, 1.0, -2.55, 0.84, 1.03, -0.25) },
    { color: body, metal: 0.35, rough: 0.45, tris: [
      ...dmBoth((k) => dmBox(k > 0 ? 0.85 : -0.95, 1.0, -2.65, k > 0 ? 0.95 : -0.85, 1.3, -0.15)),
      ...dmBox(-0.95, 1.0, -2.65, 0.95, 1.3, -2.55),
    ] },
    { color: DM_BLACK, tris: dmBox(-0.97, 0.45, 2.55, 0.97, 0.7, 2.7) },
    dmFourWheels(1.02, 0.32, 0.43, 1.65, 1.75),
    ...dmLights(0.66, 0.72, 0.88, 2.62, -2.65),
  ];
}

// 🏎️ Max Tobasten: F1 de roda de fora, bico fino, asa na frente e atrás
function driveModelF1(hex) {
  const body = driveHexRgb(hex);
  return [
    { color: DM_BLACK, tris: dmBox(-0.75, 0.08, -2.35, 0.75, 0.16, 1.9) },
    { color: body, metal: 0.5, rough: 0.3, tris: dmBox(-0.32, 0.16, -1.9, 0.32, 0.55, 2.7, { sx: 0.6 }) },
    { color: body, metal: 0.5, rough: 0.3, tris: dmBox(-0.7, 0.16, -1.2, 0.7, 0.5, 0.65, { sx: 0.85, sz: 0.85, dz: -0.05 }) },
    { color: body, metal: 0.5, rough: 0.3, tris: dmBox(-0.26, 0.55, -1.9, 0.26, 0.98, -0.1, { sx: 0.55, sz: 0.7, dz: -0.2 }) },
    // capacete amarelo do piloto + halo
    { color: [0.95, 0.75, 0.05], rough: 0.3, tris: dmBox(-0.15, 0.55, 0.05, 0.15, 0.82, 0.4, { sx: 0.8, sz: 0.8 }) },
    { color: DM_BLACK, tris: dmBox(-0.24, 0.9, 0.0, 0.24, 0.95, 0.62) },
    // asas
    { color: DM_BLACK, tris: [
      ...dmBox(-0.98, 0.06, 2.45, 0.98, 0.14, 2.8),
      ...dmBoth((k) => dmBox(k > 0 ? 0.92 : -0.98, 0.06, 2.4, k > 0 ? 0.98 : -0.92, 0.3, 2.82)),
      ...dmBox(-0.78, 0.92, -2.55, 0.78, 1.02, -2.1),
      ...dmBoth((k) => dmBox(k > 0 ? 0.72 : -0.8, 0.35, -2.6, k > 0 ? 0.8 : -0.72, 1.05, -2.05)),
    ] },
    { color: body, metal: 0.5, rough: 0.3, tris: dmBox(-0.78, 1.02, -2.55, 0.78, 1.05, -2.3) },
    // pneuzão de fora
    { color: DM_TIRE, rough: 0.9, tris: dmBoth((k) => [
      ...dmWheel(k > 0 ? 0.72 : -1.06, k > 0 ? 1.06 : -0.72, 0.36, 1.6, 0.34, 12),
      ...dmWheel(k > 0 ? 0.7 : -1.1, k > 0 ? 1.1 : -0.7, 0.38, -1.55, 0.38, 12),
    ]) },
    { color: DM_TAIL, emissive: [1, 0.05, 0.05], tris: dmBox(-0.08, 0.4, -2.62, 0.08, 0.5, -2.56) },
  ];
}

// 🐢 Modo Marginal: casco em degraus, cabecinha pra fora, patinhas
function driveModelTartaruga() {
  const skin = [0.35, 0.55, 0.12];
  return [
    { color: [0.55, 0.45, 0.15], rough: 0.8, tris: dmBox(-0.98, 0.32, -1.18, 0.98, 0.44, 1.18) },
    { color: [0.06, 0.28, 0.06], rough: 0.7, tris: dmBox(-0.92, 0.44, -1.1, 0.92, 0.82, 1.1, { sx: 0.86, sz: 0.86 }) },
    { color: [0.09, 0.38, 0.08], rough: 0.7, tris: dmBox(-0.78, 0.82, -0.94, 0.78, 1.1, 0.94, { sx: 0.72, sz: 0.72 }) },
    { color: [0.13, 0.48, 0.1], rough: 0.7, tris: dmBox(-0.55, 1.1, -0.66, 0.55, 1.24, 0.66, { sx: 0.6, sz: 0.6 }) },
    { color: skin, rough: 0.8, tris: [
      ...dmBox(-0.26, 0.38, 1.1, 0.26, 0.8, 1.7, { sx: 0.85, sz: 0.8 }),
      ...dmBoth((k) => dmBox(k > 0 ? 0.6 : -0.98, 0, 0.5, k > 0 ? 0.98 : -0.6, 0.36, 0.9)),
      ...dmBoth((k) => dmBox(k > 0 ? 0.6 : -0.98, 0, -0.9, k > 0 ? 0.98 : -0.6, 0.36, -0.5)),
      ...dmBox(-0.1, 0.3, -1.45, 0.1, 0.42, -1.1),
    ] },
    { color: DM_BLACK, tris: dmBoth((k) => dmBox(k * 0.15 - 0.05, 0.62, 1.6, k * 0.15 + 0.05, 0.72, 1.7)) },
  ];
}

// 🚀 Foguete deitado voando baixinho, bico e aletas na cor da rota, fogo atrás
function driveModelFoguete(hex) {
  const body = driveHexRgb(hex);
  return [
    { color: DM_WHITE, metal: 0.3, rough: 0.35, tris: dmPrism("z", -1.8, 1.2, 0, 1.2, 0.55, 0.55, 14) },
    { color: body, metal: 0.4, rough: 0.3, tris: dmPrism("z", 1.2, 2.7, 0, 1.2, 0.55, 0.02, 14) },
    { color: DM_GLASS, emissive: [0.2, 0.5, 0.9], tris: dmBox(-0.2, 1.62, 0.45, 0.2, 1.8, 0.85) },
    { color: body, metal: 0.4, rough: 0.3, tris: [
      ...dmBox(-1.2, 1.14, -1.8, 1.2, 1.26, -0.9, { sz: 0.45, dz: -0.22 }),
      ...dmBox(-0.06, 1.2, -1.8, 0.06, 2.3, -0.9, { sz: 0.45, dz: -0.22 }),
    ] },
    { color: [1, 0.45, 0.05], emissive: [1, 0.4, 0.02], tris: dmPrism("z", -1.8, -3.3, 0, 1.2, 0.46, 0.04, 10) },
    { color: [1, 0.9, 0.3], emissive: [1, 0.9, 0.3], tris: dmPrism("z", -1.82, -2.5, 0, 1.2, 0.3, 0.04, 8) },
  ];
}

// 🛸 OVNI: disco com cúpula acesa e luzinhas na cor da rota em volta
function driveModelOvni(hex) {
  const glow = driveHexRgb(hex);
  const lights = [];
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.sin(a) * 2.05;
    const z = Math.cos(a) * 2.05;
    lights.push(...dmBox(x - 0.12, 1.02, z - 0.12, x + 0.12, 1.16, z + 0.12));
  }
  return [
    { color: [0.55, 0.58, 0.62], metal: 0.85, rough: 0.25, tris: dmPrism("y", 0.75, 1.0, 0, 0, 1.0, 2.2, 20) },
    { color: [0.65, 0.68, 0.72], metal: 0.85, rough: 0.25, tris: dmPrism("y", 1.0, 1.15, 0, 0, 2.2, 1.6, 20) },
    { color: [0.4, 0.9, 0.8], emissive: [0.3, 0.9, 0.75], metal: 0.3, rough: 0.1, tris: dmPrism("y", 1.15, 1.85, 0, 0, 1.0, 0.35, 16) },
    { color: glow, emissive: glow, tris: lights },
    { color: [0.7, 1, 0.6], emissive: [0.6, 1, 0.5], tris: dmPrism("y", 0.6, 0.75, 0, 0, 0.5, 1.0, 12) },
  ];
}

// 👻 Fantasma: lençol branco aceso, olhão preto, bracinhos pra cima
function driveModelFantasma() {
  const sheet = [0.92, 0.94, 1];
  return [
    { color: sheet, emissive: [0.75, 0.8, 0.95], rough: 0.7, tris: [
      ...dmPrism("y", 0.35, 2.15, 0, 0, 0.85, 0.68, 14),
      ...dmPrism("y", 2.15, 2.75, 0, 0, 0.68, 0.12, 14),
      ...dmBoth((k) => dmBox(k > 0 ? 0.62 : -1.12, 1.4, -0.14, k > 0 ? 1.12 : -0.62, 1.62, 0.14, { sx: 0.7 })),
    ] },
    { color: DM_BLACK, tris: [
      ...dmBoth((k) => dmBox(k * 0.24 - 0.11, 1.8, 0.62, k * 0.24 + 0.11, 2.15, 0.82)),
      ...dmBox(-0.16, 1.3, 0.7, 0.16, 1.55, 0.86),
    ] },
  ];
}

const DRIVE_MODELS = {
  gt: driveModelGt,
  arrow: driveModelArrow,
  carro: driveModelCarro,
  taxi: driveModelTaxi,
  viatura: driveModelViatura,
  moto: driveModelMoto,
  busao: driveModelBusao,
  picape: driveModelPicape,
  f1: driveModelF1,
  tartaruga: driveModelTartaruga,
  foguete: driveModelFoguete,
  ovni: driveModelOvni,
  fantasma: driveModelFantasma,
};

// v1.77: medidas de cada modelo pro drive-map.js
// w = largura "de tela" em metros (o carScale deixa isso com DRIVE_CAR_PX; moto e
// busão mentem um pouco pra não virar palito nem trem), nose = onde o farol
// começa (m, antes da escala), beam = acende farol no chão de noite,
// lit = brilha sozinho de dia (marcador, OVNI, fantasma)
const DRIVE_MODEL_SPECS = {
  arrow: { w: 3.8, lit: true },
  gt: { w: 1.9, nose: 0.6, beam: true },
  carro: { w: 1.9, nose: 0.55, beam: true },
  taxi: { w: 1.9, nose: 0.55, beam: true },
  viatura: { w: 1.9, nose: 0.55, beam: true },
  moto: { w: 1.25, nose: 0.2, beam: true },
  busao: { w: 3.3, nose: 1.5, beam: true },
  picape: { w: 2.0, nose: 0.7, beam: true },
  f1: { w: 2.1, nose: 0.7, beam: true },
  tartaruga: { w: 2.0 },
  foguete: { w: 2.4 },
  ovni: { w: 3.4, lit: true },
  fantasma: { w: 2.2, lit: true },
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
