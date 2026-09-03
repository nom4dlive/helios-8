/**
 * Biblioteca GLSL do ORBE — todos os módulos compartilham estes shaders.
 * Emissão em espaço linear; tone mapping ACES + sRGB no OutputPass.
 */

export const NOISE_GLSL = /* glsl */ `
float hash1(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash1(i), hash1(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash1(i + vec3(0.0, 1.0, 0.0)), hash1(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(hash1(i + vec3(0.0, 0.0, 1.0)), hash1(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash1(i + vec3(0.0, 1.0, 1.0)), hash1(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
    u.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return s;
}
float ridged(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(2.0 * vnoise(p) - 1.0);
    s += a * n * n;
    p *= 2.1;
    a *= 0.5;
  }
  return s;
}

/* --- técnicas GENESIS (nom4dlive/genesis) --- */

/* 3D simplex (Ashima) — gradiente suave p/ warp de domínio */
vec3 gmod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 gmod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 gpermute(vec4 x) { return gmod289(((x * 34.0) + 1.0) * x); }
vec4 gtaylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = gmod289(i);
  vec4 p = gpermute(gpermute(gpermute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = gtaylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

/* warp de domínio em cascata q→r (vórtices de tempestade) */
vec3 domainWarp2(vec3 p, float amount) {
  vec3 q = vec3(
    snoise(p + vec3(0.0, 0.0, 0.0)),
    snoise(p + vec3(5.2, 1.3, 0.0)),
    snoise(p + vec3(1.7, 9.2, 0.0)));
  return vec3(
    snoise(p + amount * q + vec3(1.7, 9.2, 0.0)),
    snoise(p + amount * q + vec3(8.3, 2.8, 0.0)),
    snoise(p + amount * q + vec3(3.1, 5.7, 0.0)));
}

/* Voronoi F1 — células p/ crateras e terrenos celulares */
float voronoi(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float md = 8.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 c = vec3(float(x), float(y), float(z));
    vec3 r = c + vec3(
      hash1(i + c + vec3(0.0, 1.3, 2.7)),
      hash1(i + c + vec3(3.1, 0.0, 5.9)),
      hash1(i + c + vec3(7.7, 4.1, 0.0))) - f;
    md = min(md, dot(r, r));
  }
  return sqrt(md);
}

/* rampa de biomas por altitude (oceano profundo → neve) */
vec3 biomeRamp(vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5,
               float h, float sea, float shore, float hill) {
  vec3 col = mix(c0, c1, smoothstep(sea * 0.3, sea, h));
  col = mix(col, c2, smoothstep(sea, shore, h));
  col = mix(col, c3, smoothstep(shore, hill, h));
  col = mix(col, c4, smoothstep(hill, hill + 0.22, h));
  col = mix(col, c5, smoothstep(hill + 0.2, hill + 0.42, h));
  return col;
}
`;



export const SURFACE_VERT = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
void main() {
  vObjPos = position;
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/**
 * Vertice com deslocamento de terreno (genesis): a esfera é esculpida por FBM
 * no plano tangente, gerando silhuetas reais de montanhas no terminador.
 * Sem costura de polo (amostragem 2D no plano tangente, não UV).
 */
export const SPHERE_TERRAIN_VERT = /* glsl */ `
${NOISE_GLSL}
uniform float uTerrainAmp;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;

vec3 displaceTangent(vec3 n, float amp) {
  vec3 t = normalize(cross(n, vec3(0.137, 1.0, 0.271)));
  vec3 b = normalize(cross(n, t));
  vec2 ab = vec2(dot(vObjPos, t), dot(vObjPos, b));
  float h = fbm(vec3(ab * 2.2, 4.17)) - 0.5;
  h += 0.3 * (fbm(vec3(ab * 7.0, 9.31)) - 0.5);
  return position + n * (h * amp);
}

void main() {
  vObjPos = position;
  vUv = uv;
  vec3 n = normalize(position);
  vec3 displaced = displaceTangent(n, uTerrainAmp);
  vec4 wp = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/**
 * Superfície planetária unificada (12 classes de mundo):
 * bandas de gás, turbulência, fraturas, crateras, calotas, manchas
 * + uGlow (veios de lava emissores p/ bloom) e uSpec (oceano).
 */
export const PLANET_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uPalette[6];
uniform float uTime;
uniform float uBandFreq;
uniform float uBandTurb;
uniform float uBandAmp;
uniform float uNoiseScale;
uniform float uNoiseAmp;
uniform float uRidgeScale;
uniform float uRidgeAmp;
uniform float uCraterScale;
uniform float uCraterAmp;
uniform float uPolarCap;
uniform vec3 uSpotPos;
uniform float uSpotSize;
uniform float uSpotOn;
uniform vec3 uSpotColor;
uniform vec3 uAtmosColor;
uniform float uAtmosAmp;
uniform float uGlow;
uniform float uSpec;
uniform vec3 uSunPos;
uniform float uBiome;
uniform float uRim;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  vec3 p = normalize(vObjPos);
  float t = uTime;

  /* bandas: baratas p/ rochosos, warp de domínio em cascata p/ gigantes (genesis) */
  float bands = 0.0;
  if (uBandAmp > 0.001) {
    if (uBandTurb > 0.001) {
      vec3 wq = domainWarp2(p * vec3(1.6, uBandFreq * 0.35, 1.6) + vec3(0.0, t * 0.02, 0.0), 1.25);
      bands = sin(p.y * uBandFreq + wq.x * uBandTurb + wq.y * uBandTurb * 0.5);
    } else {
      bands = sin(p.y * uBandFreq);
    }
  }
  float n = fbm(p * uNoiseScale + 11.7);
  float ridge = ridged(p * uRidgeScale + 4.2);

  vec3 col = uPalette[0];
  col = mix(col, uPalette[1], smoothstep(-0.9, 0.9, bands) * uBandAmp);

  /* biomas por altitude (genesis): a elevação controla a rampa de cores */
  if (uBiome > 0.001) {
    float hgt = n * 0.65 + ridge * 0.35;
    vec3 bio = biomeRamp(uPalette[0], uPalette[1], uPalette[2], uPalette[3],
                         uPalette[4], uPalette[5], hgt, 0.36, 0.52, 0.72);
    col = mix(col, bio, uBiome);
  } else {
    col = mix(col, uPalette[2], smoothstep(0.25, 0.8, n) * uNoiseAmp);
  }
  col = mix(col, uPalette[3], smoothstep(0.45, 0.95, ridge) * uRidgeAmp);

  /* crateras celulares Voronoi (genesis) — bacia escura + borda iluminada */
  if (uCraterAmp > 0.001) {
    float cell = voronoi(p * uCraterScale + 31.4);
    float crater = 1.0 - smoothstep(0.05, 0.42, cell);
    float rimC = smoothstep(0.28, 0.4, cell) * (1.0 - smoothstep(0.42, 0.58, cell));
    col *= 1.0 - crater * uCraterAmp * 0.85;
    col += vec3(1.0, 0.96, 0.9) * rimC * uCraterAmp * 0.28;
  }

  if (uSpotOn > 0.5) {
    float d = distance(p, uSpotPos);
    float spot = 1.0 - smoothstep(uSpotSize * 0.35, uSpotSize, d);
    float swirl = fbm(p * 14.0 + t * 0.05);
    col = mix(col, uSpotColor * (0.85 + 0.3 * swirl), spot * 0.9);
  }

  float capMask = smoothstep(uPolarCap, uPolarCap + 0.08, abs(p.y)) * step(0.01, uPolarCap);
  col = mix(col, uPalette[4], capMask);

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float dif = clamp((dot(N, L) + 0.12) / 1.12, 0.0, 1.0);
  col *= 0.045 + 1.25 * dif;

  /* veios de lava / incandescência térmica (HDR → bloom) */
  if (uGlow > 0.001) {
    float veins = ridged(p * 5.5 + vec3(0.0, t * 0.03, 0.0));
    float cracks = smoothstep(0.52, 0.85, veins);
    vec3 hot = mix(vec3(1.0, 0.25, 0.02), vec3(1.0, 0.75, 0.25), cracks);
    col = mix(col, hot * (1.2 + 2.6 * cracks), cracks * uGlow);
    col += hot * cracks * uGlow * 1.4;
  }

  /* oceano: especular + leve tinta azul nas regiões baixas */
  if (uSpec > 0.001) {
    float low = smoothstep(0.62, 0.4, n);
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 42.0) * low;
    col += vec3(1.0, 0.95, 0.85) * spec * 0.55 * uSpec * dif;
    col = mix(col, col * vec3(0.8, 0.92, 1.1), low * uSpec * 0.25);
  }

  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6);
  col += uAtmosColor * fres * uAtmosAmp * (0.25 + 0.75 * dif);

  /* rim light na silhueta (genesis) */
  if (uRim > 0.001) {
    float rimF = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0);
    col += uAtmosColor * rimF * uRim * 0.55;
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

/** Terra — continentes, oceanos com especular, desertos, gelo polar */
export const EARTH_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uPalette[6];
uniform float uTime;
uniform vec3 uAtmosColor;
uniform float uAtmosAmp;
uniform vec3 uSunPos;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  vec3 p = normalize(vObjPos);
  float n = fbm(p * 3.2 + 7.3);
  float detail = fbm(p * 9.0 + 2.1);
  float h = n + 0.18 * detail;

  float land = smoothstep(0.545, 0.565, h);
  vec3 ocean = mix(uPalette[0], uPalette[1], smoothstep(0.35, 0.545, h));

  float desertBand = 1.0 - smoothstep(0.12, 0.42, abs(abs(p.y) - 0.4));
  vec3 landCol = mix(uPalette[2], uPalette[3], smoothstep(0.56, 0.72, h));
  landCol = mix(landCol, uPalette[5], desertBand * 0.55 * smoothstep(0.55, 0.7, h));

  vec3 col = mix(ocean, landCol, land);
  float ice = smoothstep(0.72, 0.86, abs(p.y) + 0.06 * (detail - 0.5));
  col = mix(col, uPalette[4], ice);

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float dif = clamp((dot(N, L) + 0.12) / 1.12, 0.0, 1.0);
  col *= 0.04 + 1.3 * dif;

  float spec = pow(max(dot(reflect(-L, N), V), 0.0), 42.0) * (1.0 - land) * (1.0 - ice);
  col += vec3(1.0, 0.95, 0.85) * spec * 0.55 * dif;

  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.4);
  col += uAtmosColor * fres * uAtmosAmp * (0.3 + 0.7 * dif);

  /* rim light na silhueta (genesis) */
  float rimF = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0);
  col += uAtmosColor * rimF * 0.35;

  gl_FragColor = vec4(col, 1.0);
}
`;

/** casca de nuvens animada (Terra/Vênus/Titã) — alpha procedural + lado iluminado */
export const CLOUD_SHELL_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform float uAmp;
uniform float uSpeed;
uniform vec3 uTint;
uniform vec3 uSunPos;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  vec3 p = normalize(vObjPos);
  float t = uTime * uSpeed;
  float c = fbm(p * 4.5 + vec3(t * 0.03, 0.0, t * 0.015));
  float c2 = fbm(p * 10.0 - vec3(t * 0.05, 0.0, 0.0));
  float a = smoothstep(0.5, 0.82, c * 0.75 + c2 * 0.25) * uAmp;

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  float dif = clamp((dot(N, L) + 0.1) / 1.1, 0.0, 1.0);
  vec3 col = uTint * (0.12 + 1.15 * dif);
  gl_FragColor = vec4(col, a);
}
`;

/** anéis planetários — bandas procedurais com lacunas de Cassini/Encke */
export const RING_VERT = /* glsl */ `
uniform float uOuter;
varying float vRad;
varying vec2 vUvPlanar;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vRad = length(position.xz);
  vUvPlanar = position.xz / (2.0 * uOuter) + 0.5;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const RING_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uInner;
uniform float uOuter;
uniform vec3 uTint;
uniform float uOpacity;
uniform vec3 uSunPos;
varying float vRad;
varying vec2 vUvPlanar;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  float t = clamp((vRad - uInner) / max(uOuter - uInner, 0.01), 0.0, 1.0);
  float bands = 0.55 + 0.45 * sin(t * 95.0 + fbm(vec3(t * 30.0, 3.7, 1.3)) * 6.0);
  float fine = 0.75 + 0.25 * vnoise(vec3(t * 140.0, 8.1, 2.2));
  float cassini = smoothstep(0.012, 0.05, abs(t - 0.60));
  float encke = smoothstep(0.005, 0.018, abs(t - 0.885));
  float innerFade = smoothstep(0.0, 0.07, t);
  float outerFade = 1.0 - smoothstep(0.93, 1.0, t);
  float bRing = 1.15 - 0.45 * t;

  vec3 col = uTint * mix(0.68, 1.12, bands) * fine;
  col = mix(col, vec3(0.62, 0.5, 0.38),
    smoothstep(0.35, 0.9, fbm(vec3(t * 12.0, 5.5, 9.1))) * 0.45);

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  col *= abs(dot(N, L)) * 0.75 + 0.25;

  float alpha = uOpacity * bands * fine * cassini * encke * innerFade * outerFade * bRing;
  gl_FragColor = vec4(col, alpha);
}
`;

/** estrela com granulação viva; uPulse=1 → modo pulsar (piscada de farol) */
export const STAR_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uColor;
uniform float uTime;
uniform float uPulse;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 p = normalize(vObjPos);
  float gran = fbm(p * 7.0 + vec3(0.0, uTime * 0.1, uTime * 0.06));
  float cells = vnoise(p * 24.0 + vec3(0.0, uTime * 0.3, 0.0));
  float m = gran * 0.6 + cells * 0.4;

  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = clamp(dot(N, V), 0.0, 1.0);

  vec3 col = uColor * (0.9 + 0.5 * m);
  col *= 0.5 + 0.7 * pow(mu, 0.7);
  col *= 1.6 + 0.8 * m;

  if (uPulse > 0.5) {
    float beat = 0.55 + 0.45 * sin(uTime * 10.0);
    col *= 0.7 + 1.6 * beat;
    col = mix(col, vec3(0.9, 0.95, 1.2) * (2.0 + beat), 0.4);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  float rim = pow(1.0 - mu, 2.4);
  gl_FragColor = vec4(uColor * rim * uIntensity, rim);
}
`;

/* ---------------- visão em primeira pessoa ---------------- */

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunSize;
uniform float uStarDensity;
uniform float uTime;
uniform float uBandAmp;
uniform float uBandScale;
uniform float uBandDrift;
uniform vec3 uBandColorA;
uniform vec3 uBandColorB;
uniform float uPulseStar;
varying vec3 vDir;

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uSkyHorizon, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.55));
  col = mix(col * 0.82, col, smoothstep(-0.35, 0.02, h));

  if (uBandAmp > 0.001) {
    float n = fbm(vec3(d.xz * uBandScale, uTime * uBandDrift) + 3.3);
    float bands = sin(d.y * uBandScale * 2.4 + n * 3.0);
    vec3 bandCol = mix(uBandColorB, uBandColorA, smoothstep(-0.8, 0.8, bands));
    col = mix(col, bandCol, uBandAmp * (0.35 + 0.65 * n) * smoothstep(-0.05, 0.25, h));
  }

  if (uStarDensity > 0.001) {
    vec3 sp = d * 120.0;
    vec3 cell = floor(sp);
    float rnd = hash1(cell);
    float star = step(1.0 - 0.004 * uStarDensity, rnd);
    float tw = 0.7 + 0.3 * sin(uTime * 2.0 + rnd * 80.0);
    vec3 off = fract(sp) - 0.5;
    float glow = smoothstep(0.18, 0.0, length(off));
    col += vec3(0.9, 0.95, 1.0) * star * glow * tw * uStarDensity * 0.9;
  }

  float mu = clamp(dot(d, normalize(uSunDir)), 0.0, 1.0);
  float disc = smoothstep(uSunSize * 0.985, uSunSize, mu);
  float halo = pow(mu, 28.0) * 0.5 + pow(mu, 4.0) * 0.12;
  float beat = uPulseStar > 0.5 ? 0.55 + 0.45 * sin(uTime * 10.0) : 1.0;
  col += uSunColor * (disc * 2.2 + halo) * beat;

  gl_FragColor = vec4(col, 1.0);
}
`;

export const TERRAIN_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vHeight = position.y;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const TERRAIN_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uBase;
uniform vec3 uMid;
uniform vec3 uDark;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uSunDir;
uniform float uAmbient;
uniform float uSunStrength;
uniform float uSparkle;
uniform float uGlowVeins;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uSunDir);

  vec2 w = vWorldPos.xz * 0.02;
  vec2 warp = vec2(fbm(vec3(w, 2.2)), fbm(vec3(w + 5.3, 8.4))) - 0.5;
  float detail = fbm(vec3(vWorldPos.xz * 0.09 + warp * 3.0, 1.3));
  float fine = fbm(vec3(vWorldPos.xz * 0.5, 7.7));

  vec3 col = mix(uDark, uBase, smoothstep(-0.4, 0.7, vHeight));
  col = mix(col, uMid, smoothstep(0.35, 0.8, detail) * 0.7);
  col *= 0.82 + 0.36 * fine;

  float dif = clamp(dot(N, L), 0.0, 1.0);
  float wrap = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
  col *= uAmbient + uSunStrength * mix(wrap, dif, 0.72);

  if (uSparkle > 0.001) {
    vec2 cell = floor(vWorldPos.xz * 22.0);
    float sp = pow(hash1(vec3(cell, 3.7)), 30.0);
    col += vec3(1.0, 0.98, 0.92) * sp * uSparkle * dif * 1.6;
  }

  if (uGlowVeins > 0.001) {
    float veins = ridged(vec3(vWorldPos.xz * 0.035, 9.9));
    float cracks = smoothstep(0.55, 0.9, veins);
    col = mix(col, vec3(1.0, 0.35, 0.05) * (1.5 + 2.0 * cracks), cracks * uGlowVeins);
  }

  float dist = distance(vWorldPos, cameraPosition);
  float fogF = 1.0 - exp(-pow(dist * max(uFogDensity, 0.0), 1.35));
  col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

export const ROCK_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vSeed;
void main() {
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vSeed = float(gl_InstanceID) * 0.618;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const ROCK_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uSunDir;
uniform float uAmbient;
uniform float uSunStrength;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vSeed;
void main() {
  vec3 N = normalize(vNormal);
  float dif = clamp(dot(N, normalize(uSunDir)), 0.0, 1.0);
  float n = fbm(vWorldPos * 0.35 + vSeed * 17.0);
  vec3 col = mix(uColorA, uColorB, smoothstep(0.3, 0.75, n));
  col *= uAmbient + uSunStrength * dif;
  float dist = distance(vWorldPos, cameraPosition);
  float fogF = 1.0 - exp(-pow(dist * max(uFogDensity, 0.0), 1.35));
  col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ---------------- fundo ---------------- */

export const NEBULA_FRAG = /* glsl */ `
${NOISE_GLSL}
varying vec3 vObjPos;
void main() {
  vec3 p = normalize(vObjPos);
  float n = fbm(p * 2.5 + 4.4);
  float band = exp(-pow((p.y - 0.12) * 2.1, 2.0));
  vec3 col = vec3(0.008, 0.012, 0.028)
    + vec3(0.04, 0.07, 0.15) * band * n
    + vec3(0.025, 0.045, 0.085) * n * n
    + vec3(0.085, 0.05, 0.035) * band * pow(fbm(p * 5.0 + 3.3), 3.0) * 0.6;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const STAR_PT_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 0.72 + 0.28 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 40.0);
  gl_PointSize = aSize * uPixelRatio * tw * (260.0 / max(-mv.z, 1.0));
  gl_Position = projectionMatrix * mv;
}
`;

export const STAR_PT_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vColor, a);
}
`;
