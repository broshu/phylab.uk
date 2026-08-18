/**
 * The server: a standalone figure component.
 *
 * Two modes:
 *   'aim'   — standing on the ground. The hitting arm is drawn further back the
 *             larger the chosen speed, so winding up is visible before serving.
 *   'serve' — animated: crouch and toss, jump, contact exactly at the apex
 *             (hand at problem.hitHeight), then follow through and land.
 *
 * The player owns the ball up to the moment of contact; after that the scene
 * takes over and draws the projectile. Everything here is geometry in metres —
 * the caller supplies the world→screen transform.
 */

/** Animation timeline, seconds on the animation clock. */
export const SERVE_TIMELINE = {
  toss: 0.12, // ball leaves the holding hand
  windup: 0.35, // crouch and full cock
  contact: 0.85, // apex of the jump, ball leaves the hitting hand
  land: 1.45, // feet back on the floor
};

// The server starts with the front foot clearly behind the serve line, then
// carries the body a small distance forward during the jump. The contact
// position is kept just in front of the line so the hand (and the projectile
// origin at x = 0) still read as vertically aligned on screen.
const START_X = -0.24;
const CONTACT_X = 0.02;
const LAND_X = 0.16;

/** Body proportions in metres, roughly a 1.94 m player. */
const BODY = {
  hip: 1.02,
  shoulder: 1.6,
  headY: 1.82,
  headR: 0.12,
  thigh: 0.5,
  shin: 0.52,
  upperArm: 0.34,
  forearm: 0.36,
  stanceBack: -0.2,
  stanceFront: 0.18,
};

const REACH = BODY.shoulder + BODY.upperArm + BODY.forearm; // ≈ 2.30 m
const G_TOSS = 10; // visual gravity for the toss, m/s²

const clamp01 = (u) => Math.max(0, Math.min(1, u));
const lerp = (a, b, u) => a + (b - a) * u;
const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
const rad = (deg) => (deg * Math.PI) / 180;

/** Point at distance `len` from `p` in a direction `deg` back from straight up. */
function fromAngle(p, deg, len) {
  const a = rad(deg);
  return { x: p.x - Math.sin(a) * len, y: p.y + Math.cos(a) * len };
}

/** Two-link IK: knee position for a hip/foot pair, bending forward (+x). */
function knee(hip, foot, a, b) {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const d = Math.min(Math.hypot(dx, dy), a + b - 1e-4) || 1e-4;
  const ux = dx / d;
  const uy = dy / d;
  const t = (d * d + a * a - b * b) / (2 * d); // along hip→foot
  const h = Math.sqrt(Math.max(0, a * a - t * t)); // perpendicular offset
  // perpendicular pointing forward (+x)
  const px = -uy;
  const py = ux;
  const sign = px >= 0 ? 1 : -1;
  return { x: hip.x + ux * t + px * h * sign, y: hip.y + uy * t + py * h * sign };
}

export function createPlayer(problem) {
  const jumpHeight = Math.max(0, problem.hitHeight - REACH);

  /** Hitting-arm angle, degrees back from vertical. */
  function hitArmAngle(mode, t, speedFrac) {
    // the whole point of this linkage: faster serve → hand further back
    const aim = lerp(40, 155, clamp01(speedFrac));
    if (mode === 'aim') return aim;
    if (t < SERVE_TIMELINE.windup) {
      return lerp(aim, 165, easeInOut(t / SERVE_TIMELINE.windup)); // full cock
    }
    if (t < SERVE_TIMELINE.contact) {
      const u = (t - SERVE_TIMELINE.windup) / (SERVE_TIMELINE.contact - SERVE_TIMELINE.windup);
      return lerp(165, 0, u * u); // whip through, fastest near contact
    }
    const u = clamp01((t - SERVE_TIMELINE.contact) / 0.5);
    return lerp(0, -125, easeInOut(u)); // follow through, down across the body
  }

  /** Whole-body vertical offset and crouch depth. */
  function lift(mode, t, speedFrac) {
    if (mode === 'aim') return { jump: 0, crouch: 0.05 * clamp01(speedFrac) };
    if (t < SERVE_TIMELINE.windup) {
      return { jump: 0, crouch: 0.2 * easeInOut(t / SERVE_TIMELINE.windup) };
    }
    if (t < SERVE_TIMELINE.contact) {
      const u = (t - SERVE_TIMELINE.windup) / (SERVE_TIMELINE.contact - SERVE_TIMELINE.windup);
      return { jump: jumpHeight * Math.sin((u * Math.PI) / 2), crouch: 0.2 * (1 - Math.min(1, u * 2.5)) };
    }
    if (t < SERVE_TIMELINE.land) {
      const u = (t - SERVE_TIMELINE.contact) / (SERVE_TIMELINE.land - SERVE_TIMELINE.contact);
      return { jump: jumpHeight * Math.cos((u * Math.PI) / 2), crouch: 0 };
    }
    const u = clamp01((t - SERVE_TIMELINE.land) / 0.35);
    return { jump: 0, crouch: 0.16 * Math.sin(u * Math.PI) }; // absorb the landing
  }

  /** Horizontal body position: planted behind the line, then a short jump. */
  function bodyX(mode, t) {
    if (mode === 'aim' || t <= SERVE_TIMELINE.windup) return START_X;
    if (t < SERVE_TIMELINE.contact) {
      const u = (t - SERVE_TIMELINE.windup) / (SERVE_TIMELINE.contact - SERVE_TIMELINE.windup);
      return lerp(START_X, CONTACT_X, easeInOut(u));
    }
    if (t < SERVE_TIMELINE.land) {
      const u = (t - SERVE_TIMELINE.contact) / (SERVE_TIMELINE.land - SERVE_TIMELINE.contact);
      return lerp(CONTACT_X, LAND_X, easeInOut(u));
    }
    return LAND_X;
  }

  /**
   * Ball position while the player still has it: held in the front hand, then
   * tossed on a real parabola that arrives at the contact height exactly when
   * the hitting hand does.
   */
  function ballPoint(mode, t, front) {
    if (mode === 'aim' || t <= SERVE_TIMELINE.toss) return { ...front, held: true };
    const tau = t - SERVE_TIMELINE.toss;
    const tc = SERVE_TIMELINE.contact - SERVE_TIMELINE.toss;
    const y0 = front.y;
    const x0 = front.x;
    const v0 = (problem.hitHeight - y0 + 0.5 * G_TOSS * tc * tc) / tc;
    return {
      x: lerp(x0, 0, clamp01(tau / tc)),
      y: y0 + v0 * tau - 0.5 * G_TOSS * tau * tau,
      held: false,
    };
  }

  /** Everything except the ball — used both for drawing and for the toss origin. */
  function skeleton(mode, t, speedFrac) {
    const { jump, crouch } = lift(mode, t, speedFrac);
    const airborne = jump > 0.02;
    const x = bodyX(mode, t);

    const hip = { x, y: BODY.hip + jump - crouch };
    const shoulder = { x, y: BODY.shoulder + jump - crouch * 0.7 };
    const head = { x: x + 0.02, y: BODY.headY + jump - crouch * 0.6 };

    // feet stay planted on the floor, and tuck up once the player is airborne
    const footY = airborne ? jump * 0.75 : 0;
    const backFoot = { x: x + BODY.stanceBack + (airborne ? 0.05 : 0), y: footY };
    const frontFoot = { x: x + BODY.stanceFront - (airborne ? 0.06 : 0), y: footY };

    const hitDeg = hitArmAngle(mode, t, speedFrac);
    const hitElbow = fromAngle(shoulder, hitDeg + 12, BODY.upperArm);
    const hitHand = fromAngle(hitElbow, hitDeg - 8, BODY.forearm);

    // front arm: holds the ball low in front, lifts to toss, then drops away
    let frontDeg;
    if (mode === 'aim') frontDeg = -125;
    else if (t < SERVE_TIMELINE.toss) frontDeg = lerp(-125, -105, t / SERVE_TIMELINE.toss);
    else frontDeg = lerp(-105, -150, clamp01((t - SERVE_TIMELINE.toss) / 0.6));
    const frontElbow = fromAngle(shoulder, frontDeg - 10, BODY.upperArm);
    const frontHand = fromAngle(frontElbow, frontDeg + 6, BODY.forearm);

    return {
      hip,
      shoulder,
      head,
      backFoot,
      frontFoot,
      backKnee: knee(hip, backFoot, BODY.thigh, BODY.shin),
      frontKnee: knee(hip, frontFoot, BODY.thigh, BODY.shin),
      hitElbow,
      hitHand,
      frontElbow,
      frontHand,
    };
  }

  // The toss must start from one fixed point, not from the hand as it moves,
  // otherwise the parabola would be recomputed every frame.
  let releaseCache = null;
  function releasePoint() {
    if (!releaseCache) {
      const s = skeleton('serve', SERVE_TIMELINE.toss, 0.5);
      releaseCache = { x: s.frontHand.x + 0.08, y: s.frontHand.y };
    }
    return releaseCache;
  }

  function pose(mode, t, speedFrac) {
    const s = skeleton(mode, t, speedFrac);
    const held = { x: s.frontHand.x + 0.08, y: s.frontHand.y };
    const inHand = mode === 'aim' || t <= SERVE_TIMELINE.toss;
    return { ...s, ball: ballPoint(mode, t, inHand ? held : releasePoint()) };
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{toX:(x:number)=>number, toY:(y:number)=>number, scale:number}} geom
   * @param {Record<string,string>} palette
   * @param {{mode:'aim'|'serve', t:number, speedFrac:number, showBall:boolean}} state
   */
  function draw(ctx, geom, palette, { mode, t, speedFrac, showBall = true }) {
    const p = pose(mode, t, speedFrac);
    const { toX, toY, scale } = geom;
    const P = (pt) => [toX(pt.x), toY(pt.y)];

    const limb = Math.max(2.5, 0.075 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = palette.ink;

    const chain = (pts, width) => {
      ctx.lineWidth = width;
      ctx.beginPath();
      pts.forEach((pt, i) => (i ? ctx.lineTo(...P(pt)) : ctx.moveTo(...P(pt))));
      ctx.stroke();
    };

    // back arm and leg first, slightly lighter, for a sense of depth
    ctx.globalAlpha = 0.55;
    chain([p.hip, p.backKnee, p.backFoot], limb);
    ctx.globalAlpha = 1;

    chain([p.hip, p.shoulder], limb * 1.35); // torso
    chain([p.hip, p.frontKnee, p.frontFoot], limb);
    chain([p.shoulder, p.frontElbow, p.frontHand], limb * 0.85);
    chain([p.shoulder, p.hitElbow, p.hitHand], limb); // hitting arm on top

    ctx.beginPath();
    ctx.arc(...P(p.head), BODY.headR * scale, 0, Math.PI * 2);
    ctx.fillStyle = palette.ink;
    ctx.fill();

    if (showBall) {
      ctx.beginPath();
      ctx.arc(...P(p.ball), Math.max(4, 0.105 * scale), 0, Math.PI * 2);
      ctx.fillStyle = palette.ball;
      ctx.fill();
    }
  }

  return {
    draw,
    pose,
    jumpHeight,
    reach: REACH,
    /** Where the ball leaves the hand — by construction, the contact height. */
    contactPoint: { x: 0, y: problem.hitHeight },
  };
}
