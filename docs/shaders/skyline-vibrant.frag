precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;
uniform float u_pixel;
uniform float u_preset;

varying vec2 v_uv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.0 + 17.17;
    amplitude *= 0.5;
  }
  return value;
}

vec3 tonemap(vec3 color) {
  color = max(color, vec3(0.0));
  return color / (1.0 + color);
}

void main() {
  float pixel = max(u_pixel, 1.0);
  vec2 resolution = max(u_resolution, vec2(1.0));
  vec2 uv = floor(v_uv * resolution / pixel) * pixel / resolution;
  float aspect = resolution.x / resolution.y;
  float x = (uv.x - 0.5) * aspect;
  float y = 1.0 - uv.y;
  float motion = u_time * 0.014;
  float animated = step(0.01, u_time + 0.001);

  float horizon = 0.50 + sin(motion * 0.4) * 0.008;
  float sky = 1.0 - smoothstep(0.04, horizon, y);
  vec3 skyTop = vec3(0.075, 0.28, 0.34);
  vec3 skyBottom = vec3(0.48, 0.72, 0.67);
  vec3 color = mix(skyBottom, skyTop, sky);

  // Sun and a soft halo give each preset a clear light direction.
  vec2 sunPosition = vec2(0.26, 0.20);
  float sunDistance = distance(vec2(x, y), sunPosition);
  float sun = 1.0 - smoothstep(0.065, 0.071, sunDistance);
  float halo = 1.0 - smoothstep(0.02, 0.42, sunDistance);
  color += vec3(1.0, 0.68, 0.34) * sun * 0.88;
  color += vec3(1.0, 0.53, 0.28) * halo * 0.06 * u_intensity;

  // Clouds are intentionally chunky: they keep the preview in a voxel-like language.
  float cloudNoise = fbm(vec2(x * 1.4 + motion * animated, y * 3.1 + 8.0));
  float cloudBand = smoothstep(0.58, 0.77, cloudNoise) * (1.0 - smoothstep(0.12, 0.37, y));
  color = mix(color, vec3(0.83, 0.95, 0.86), cloudBand * 0.18 * u_intensity);

  // Far mountains.
  float mountainHeight = 0.40 + fbm(vec2(x * 1.7, 2.0)) * 0.19;
  float mountainMask = step(mountainHeight, y);
  vec3 mountainColor = mix(vec3(0.17, 0.30, 0.29), vec3(0.08, 0.18, 0.17), y);
  color = mix(color, mountainColor, mountainMask * (1.0 - smoothstep(0.43, 0.62, y)));

  // The near terrain is a stack of simple block bands with a noisy silhouette.
  float groundHeight = 0.55 + noise(vec2(x * 4.0, 7.0)) * 0.09 + noise(vec2(x * 12.0, 4.0)) * 0.025;
  float ground = step(groundHeight, y);
  float depth = clamp((y - groundHeight) * 2.3, 0.0, 1.0);
  vec3 grass = vec3(0.29, 0.63, 0.34);
  vec3 dirt = vec3(0.25, 0.28, 0.17);
  vec3 stone = vec3(0.20, 0.25, 0.23);
  vec3 groundColor = mix(grass, dirt, smoothstep(0.045, 0.16, depth));
  groundColor = mix(groundColor, stone, smoothstep(0.40, 0.82, depth));

  // Sun-facing side of the terrain.
  float light = 0.72 + 0.28 * clamp(0.5 + x * 0.55, 0.0, 1.0);
  groundColor *= light;
  color = mix(color, groundColor, ground);

  // Block seams and tiny grass pixels.
  vec2 blockUv = vec2((x + aspect * 0.5) * 22.0, (y - groundHeight) * 22.0);
  vec2 blockFract = fract(blockUv);
  float seam = step(0.93, max(blockFract.x, blockFract.y)) * ground;
  color = mix(color, color * 0.66, seam * 0.45);
  float grassPixels = step(0.82, noise(vec2(x * 44.0, y * 42.0))) * step(depth, 0.17) * ground;
  color += vec3(0.08, 0.14, 0.045) * grassPixels;

  // A small water strip separates the terrain from the horizon.
  float water = step(groundHeight - 0.037, y) * step(y, groundHeight + 0.015);
  float waterWave = sin((x * 25.0) + motion * 3.0) * 0.5 + 0.5;
  vec3 waterColor = vec3(0.10, 0.46, 0.50) + vec3(0.07, 0.13, 0.10) * waterWave;
  color = mix(color, waterColor, water * 0.7);

  // Presets alter the final lighting, not the scene geometry.
  vec3 vanilla = color;
  vec3 vibrant = pow(max(color, vec3(0.0)), vec3(0.88)) * vec3(1.05, 1.08, 0.93);
  vec3 soft = mix(color, vec3(dot(color, vec3(0.33, 0.42, 0.25))), 0.12);
  soft += vec3(0.13, 0.09, 0.05) * halo;
  vec3 dusk = color * vec3(0.90, 0.68, 1.18) + vec3(0.06, 0.025, 0.12) * (1.0 - sky);
  dusk += vec3(0.18, 0.06, 0.11) * sun;

  vec3 presetColor = vanilla;
  if (u_preset > 0.5 && u_preset < 1.5) presetColor = vibrant;
  if (u_preset > 1.5 && u_preset < 2.5) presetColor = soft;
  if (u_preset > 2.5) presetColor = dusk;
  color = mix(vanilla, presetColor, u_intensity);

  // Gentle vignette and a subtle film line make the preview feel like a viewport.
  vec2 centered = v_uv - 0.5;
  float vignette = 1.0 - dot(centered, centered) * 0.48;
  float scan = 0.985 + 0.015 * sin(v_uv.y * resolution.y * 0.45);
  color *= vignette * scan;
  color = tonemap(color * 1.15);

  gl_FragColor = vec4(color, 1.0);
}
