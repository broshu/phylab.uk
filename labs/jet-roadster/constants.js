// Every model number lives here. SI units. Change a value once; all modules follow.
export const C = Object.freeze({
  // Car and air supply (the textbook problem)
  m: 2000,            // kg, held constant (air mass lost is ignored)
  g: 10,              // m/s²
  u: 500,             // m/s, exhaust speed
  flow: 40,           // kg/s, tail jet
  a: 10,              // m/s², tail jet acceleration = u·flow/m
  gas: 90,            // kg of compressed air
  mu: 0.1,            // friction coefficient on every surface that is not ice
  fanFactor: 3,       // N = 3mg with the fan on (suction adds 2mg)
  sideMax: 20000,     // N, side jet power limit

  // Challenge track: ice straight A→B, then a quarter circle about O = (0, −R)
  L: 45,              // m, AB
  R: 20,              // m, lane-centre radius
  roadHalfWidth: 3,   // m
  runoff: 1.4,        // s shown after leaving the road

  // Free drive
  wheelbase: 4.0,     // m (drawn car ×1.35)
  steerMax: 0.5,      // rad at the front wheels
  steerRate: 1.8,     // rad/s while a steering key is held
  steerReturn: 2.6,   // rad/s back to centre when released
  brakeShare: 0.7,    // brakes ask for 70 % of μN, leaving some grip for steering

  h: 1 / 600          // s, integration step for both models
});

export const TAIL = C.m * C.a;   // 20 kN

/** Largest friction force the tyres can give, μN. */
export function frictionLimit(fan, mu = C.mu) { return mu * C.m * C.g * (fan ? C.fanFactor : 1); }

// Free-drive world. Ice: the challenge straight plus a round rink. Everything else has μ = C.mu.
export const WORLD = Object.freeze({
  minX: -125, maxX: 115, minZ: -95, maxZ: 85,
  start: {x: -62, z: 0, yaw: 0},     // on the ground, facing the ice straight
  icePad: {x: -30, z: 40, r: 12},
  circle: {x: 45, z: 32, r: C.R},
  cones: Object.freeze([-40, -31, -22, -13, -4].map((x, i) => Object.freeze({x, z: 20 + (i % 2 ? 1.5 : -1.5)})))
});
