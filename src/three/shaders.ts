/**
 * Biblioteca GLSL compartilhada — value noise, fBm e ridged noise.
 * Todos os shaders emitem em espaço linear; o OutputPass aplica
 * tone mapping ACES + conversão sRGB no final do pipeline.
 *
 * AUDITORIA: nenhum parâmetro pode degenerar a geometria — toda entrada
 * externa é clampada no lado CPU antes de virar uniform.
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

/** Shader planetário genérico: bandas, turbulência, fraturas, crateras, calotas e manchas. */
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
uniform vec3 uSunPos;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 p = normalize(vObjPos);
  float t = uTime;

  float bands = sin(p.y * uBandFreq + (fbm(p * 3.0 + vec3(0.0, t * 0.02, 0.0)) - 0.5) * uBandTurb);
  float n = fbm(p * max(uNoiseScale, 0.1) + 11.7);
  float ridge = ridged(p * max(uRidgeScale, 0.1) + 4.2);

  vec3 col = uPalette[0];
  col = mix(col, uPalette[1], smoothstep(-0.9, 0.9, bands) * uBandAmp);
  col = mix(col, uPalette[2], smoothstep(0.25, 0.8, n) * uNoiseAmp);
  col = mix(col, uPalette[3], smoothstep(0.45, 0.95, ridge) * uRidgeAmp);

  if (uCraterAmp > 0.001) {
    float c = fbm(p * max(uCraterScale, 0.1) + 31.4);
    float crater = smoothstep(0.5, 0.56, c) * smoothstep(0.74, 0.62, c);
    col *= 1.0 - crater * uCraterAmp;
    col += vec3(0.9) * crater * uCraterAmp * 0.08;
  }

  if (uSpotOn > 0.5) {
    float d = distance(p, normalize(uSpotPos));
    float spot = 1.0 - smoothstep(uSpotSize * 0.35, max(uSpotSize, 0.02), d);
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

  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6);
  col += uAtmosColor * fres * uAtmosAmp * (0.25 + 0.75 * dif);

  gl_FragColor = vec4(col, 1.0);
}
`;

/** Shader dedicado da Terra: oceanos, continentes, desertos, gelo e brilho especular do mar. */
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

  gl_FragColor = vec4(col, 1.0);
}
`;

/** Camada de nuvens (Terra): alpha procedural derivado de fBm em movimento. */
export const CLOUD_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform float uCloudAmp;
uniform vec3 uSunPos;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 p = normalize(vObjPos);
  float t = uTime;
  float c = fbm(p * 4.5 + vec3(t * 0.03, 0.0, t * 0.015));
  float c2 = fbm(p * 10.0 - vec3(t * 0.05, 0.0, 0.0));
  float a = smoothstep(0.5, 0.82, c * 0.75 + c2 * 0.25) * clamp(uCloudAmp, 0.0, 1.0);

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  float dif = clamp((dot(N, L) + 0.1) / 1.1, 0.0, 1.0);
  vec3 col = vec3(1.0) * (0.12 + 1.15 * dif);

  gl_FragColor = vec4(col, a);
}
`;

/** Fotosfera do Sol — granulação animada com HDR para o bloom. */
export const SUN_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 p = normalize(vObjPos);
  float t = uTime;
  float n1 = fbm(p * 4.0 + vec3(0.0, t * 0.08, t * 0.05));
  float n2 = fbm(p * 9.0 - vec3(t * 0.12, 0.0, t * 0.07));
  float cells = vnoise(p * 22.0 + vec3(0.0, t * 0.35, 0.0));
  float m = n1 * 0.55 + n2 * 0.3 + cells * 0.15;

  vec3 col = mix(vec3(0.95, 0.35, 0.02), vec3(1.0, 0.72, 0.18), smoothstep(0.2, 0.55, m));
  col = mix(col, vec3(1.0, 0.93, 0.62), smoothstep(0.55, 0.85, m));

  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  col *= 0.45 + 0.75 * pow(mu, 0.65);

  col *= 1.9 + 0.9 * m;
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Coroa solar — casca aditiva com flicker. */
export const CORONA_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  float glow = pow(1.0 - mu, 2.2);
  float flicker = 0.85 + 0.3 * fbm(normalize(vObjPos) * 5.0 + uTime * 0.25);
  vec3 col = mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.82, 0.38), mu);
  gl_FragColor = vec4(col * glow * flicker * 1.35, glow);
}
`;

/** Halo atmosférico aditivo (fresnel). */
export const ATMO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform vec3 uSunPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  float rim = pow(1.0 - mu, 2.8);
  float dif = clamp(dot(N, normalize(uSunPos - vWorldPos)), 0.0, 1.0);
  vec3 col = uColor * rim * (0.35 + 0.85 * dif) * uIntensity;
  gl_FragColor = vec4(col, rim);
}
`;

/** Anéis: bandas radiais procedurais com lacuna de Cassini e Encke. */
export const RING_VERT = /* glsl */ `
varying float vRad;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vRad = length(position.xz);
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
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  float span = max(uOuter - uInner, 0.001);
  float t = clamp((vRad - uInner) / span, 0.0, 1.0);

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
  float dif = abs(dot(N, L)) * 0.75 + 0.25;
  col *= dif;

  float alpha = uOpacity * bands * fine * cassini * encke * innerFade * outerFade * bRing;
  gl_FragColor = vec4(col, alpha);
}
`;

/** Campo de estrelas com cintilação. */
export const STAR_VERT = /* glsl */ `
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
  gl_PointSize = clamp(aSize * uPixelRatio * tw * (260.0 / max(-mv.z, 1.0)), 1.0, 7.0);
  gl_Position = projectionMatrix * mv;
}
`;

export const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vColor, a);
}
`;

/** Nebulosa de fundo sutil. */
export const NEBULA_FRAG = /* glsl */ `
${NOISE_GLSL}
varying vec3 vObjPos;

void main() {
  vec3 p = normalize(vObjPos);
  float n = fbm(p * 2.5 + 4.4);
  float band = exp(-pow((p.y - 0.12) * 2.1, 2.0));
  vec3 col = vec3(0.010, 0.014, 0.026)
    + vec3(0.045, 0.075, 0.15) * band * n
    + vec3(0.028, 0.048, 0.085) * n * n
    + vec3(0.085, 0.05, 0.035) * band * pow(fbm(p * 5.0 + 3.3), 3.0) * 0.6;
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------
 * SHADERS DA CENA DE SUPERFÍCIE (visita em 1ª pessoa)
 * ------------------------------------------------------------------ */

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_FRAG = /* glsl */ `
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uSunDir;
uniform float uStarDensity;
uniform float uTime;
uniform float uSunDiffuse;
uniform float uSunStrength;
uniform vec3 uSunTint;
uniform float uBandAmp;
uniform float uBandScale;
uniform float uBandDrift;
uniform vec3 uBandColorA;
uniform vec3 uBandColorB;
uniform float uMilkyWay;
varying vec3 vDir;
${NOISE_GLSL}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);

  vec3 col = mix(uSkyHorizon, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.55));
  col = mix(col * 0.82, col, smoothstep(-0.35, 0.02, h));

  /* faixa da Via Láctea (planos inclinados de poeira) */
  if (uMilkyWay > 0.001) {
    float bandAxis = dot(d, normalize(vec3(0.42, 0.55, -0.72)));
    float mw = exp(-bandAxis * bandAxis * 14.0);
    float dust = fbm(d * 6.0 + 8.8);
    col += vec3(0.42, 0.47, 0.58) * mw * (0.25 + 0.75 * dust) * uMilkyWay * 0.22;
  }

  /* faixas de nuvens (gigantes gasosos, smog de Titã, névoa marciana) */
  if (uBandAmp > 0.001) {
    float n = fbm(vec3(d.xz * uBandScale, uTime * uBandDrift) * 1.0 + 3.3);
    float bands = sin(d.y * uBandScale * 2.4 + n * 3.0);
    vec3 bandCol = mix(uBandColorB, uBandColorA, smoothstep(-0.8, 0.8, bands));
    col = mix(col, bandCol, uBandAmp * (0.35 + 0.65 * n) * smoothstep(-0.05, 0.25, h));
  }

  /* estrelas */
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

  /* contribuição do Sol: núcleo + halo difuso conforme a atmosfera */
  float mu = clamp(dot(d, normalize(uSunDir)), 0.0, 1.0);
  float sharp = uSunStrength * (1.0 - uSunDiffuse);
  float diffuse = uSunStrength * uSunDiffuse;
  col += uSunTint * pow(mu, 320.0) * 2.2 * sharp;
  col += uSunTint * pow(mu, 40.0) * 0.5 * sharp;
  col += uSunTint * pow(mu, 3.5) * 0.28 * diffuse;

  gl_FragColor = vec4(col, 1.0);
}
`;

/* Terreno: quando uBaked = 1 o deslocamento e as normais já vêm da CPU
   (colisão exata, zero ruído duplicado GPU/JS); uCloudSea = 1 anima o
   mar de nuvens na GPU. */
export const TERRAIN_VERT = /* glsl */ `
${NOISE_GLSL}
uniform float uScale;
uniform float uAmp;
uniform float uDuneAmp;
uniform float uCloudSea;
uniform float uTime;
uniform float uBaked;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

void main() {
  vec3 p = position;
  float h = 0.0;
  if (uBaked < 0.5 && uCloudSea > 0.5) {
    h = (fbm(vec3(p.xz * 0.004 + uTime * 0.01, 3.3)) - 0.5) * uAmp * 2.0;
    h += sin(p.x * 0.008 + uTime * 0.05) * cos(p.z * 0.006) * uAmp * 0.6;
    p.y += h;
    float e = 2.0;
    float hxE = (fbm(vec3((p.xz + vec2(e, 0.0)) * 0.004 + uTime * 0.01, 3.3)) - 0.5) * uAmp * 2.0;
    float hzE = (fbm(vec3((p.xz + vec2(0.0, e)) * 0.004 + uTime * 0.01, 3.3)) - 0.5) * uAmp * 2.0;
    vNormal = normalize(vec3(h - hxE, e, h - hzE));
    vHeight = h / max(uAmp * 5.5, 1.0);
  } else {
    /* assado: posição já deslocada, normal vinda do buffer */
    vNormal = normalize(mat3(modelMatrix) * normal);
    vHeight = p.y / max(uAmp * 5.5, 1.0);
  }

  vec4 wp = modelMatrix * vec4(p, 1.0);
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
uniform float uCloudSea;
uniform vec3 uSunDir;
uniform float uAmbient;
uniform float uSunStrength;
uniform vec3 uSunTint;
uniform float uSparkle;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uSunDir);

  float detail;
  vec3 col;
  if (uCloudSea > 0.5) {
    detail = fbm(vec3(vWorldPos.xz * 0.02, 1.3));
    float bands = 0.5 + 0.5 * sin(vWorldPos.z * 0.09 + detail * 4.0);
    col = mix(uDark, uBase, bands);
    col = mix(col, uMid, smoothstep(0.4, 0.9, detail));
  } else {
    vec2 w = vWorldPos.xz * 0.02;
    vec2 warp = vec2(fbm(vec3(w, 2.2)), fbm(vec3(w + 5.3, 8.4))) - 0.5;
    detail = fbm(vec3(vWorldPos.xz * 0.09 + warp * 3.0, 1.3));
    float fine = fbm(vec3(vWorldPos.xz * 0.5, 7.7));
    col = mix(uDark, uBase, smoothstep(-0.4, 0.7, vHeight));
    col = mix(col, uMid, smoothstep(0.35, 0.8, detail) * 0.7);
    col *= 0.82 + 0.36 * fine;
  }

  float dif = clamp(dot(N, L), 0.0, 1.0);
  float wrap = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
  col *= uAmbient + uSunStrength * mix(wrap, dif, 0.72);
  col *= mix(vec3(1.0), uSunTint, clamp(uSunStrength, 0.0, 1.0) * 0.5);

  if (uSparkle > 0.001) {
    vec2 cell = floor(vWorldPos.xz * 22.0);
    float sp = pow(hash1(vec3(cell, 3.7)), 30.0);
    col += vec3(1.0, 0.98, 0.92) * sp * uSparkle * dif * 1.6;
  }

  if (uCloudSea > 0.5) {
    float sh = pow(clamp(dot(N, L), 0.0, 1.0), 3.0);
    col += uSunTint * sh * 0.22;
  }

  /* névoa exponencial (distância + leve densificação perto do horizonte) */
  float dist = distance(vWorldPos, cameraPosition);
  float fogF = 1.0 - exp(-pow(dist * max(uFogDensity, 0.0), 1.35));
  col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
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

export const ROCK_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vSeed;
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vSeed = float(gl_InstanceID) * 0.618;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const PLUME_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uSpeed;
uniform float uGravity;
uniform float uSpread;
uniform float uWind;
uniform vec3 uOrigin;
varying float vFade;
varying float vSeed;

void main() {
  float s = fract(aSeed + uTime * 0.11);
  vSeed = aSeed;
  float t = s * uSpeed;

  vec3 dir = normalize(vec3(
    (fract(aSeed * 12.9898) - 0.5) * uSpread,
    1.0,
    (fract(aSeed * 78.233) - 0.5) * uSpread
  ));
  vec3 p = uOrigin + dir * t * 1.4;
  p.y -= 0.5 * uGravity * t * t;
  p.x += uWind * t * t * 0.35;
  if (p.y < uOrigin.y) p.y = uOrigin.y;

  vFade = (1.0 - s) * smoothstep(0.0, 0.08, s);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp((2.2 + s * 7.0) * (140.0 / max(-mv.z, 1.0)), 1.0, 12.0);
  gl_Position = projectionMatrix * mv;
}
`;

export const PLUME_FRAG = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vFade;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.05, d) * vFade * 0.5;
  vec3 col = mix(uColorA, uColorB, fract(vSeed * 7.31));
  gl_FragColor = vec4(col, a);
}
`;
