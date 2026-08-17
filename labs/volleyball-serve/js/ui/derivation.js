/**
 * Working panel: the evaluator's intermediate quantities laid out in the order
 * a student would write them down. The numbers only appear once the ball has
 * been served, so the slider cannot be used to read off the answer.
 * To add a step, add one more row() call.
 */
const f = (x, n = 2) => (Number.isFinite(x) ? Number(x).toFixed(n) : '—');

export function createDerivation(root, store) {
  root.innerHTML = `
    <div class="section-title"><h2>Working</h2></div>
    <h3>1 · Does it clear the net?</h3>
    <div id="workNet" class="formula-box"></div>
    <h3>2 · Does it land in?</h3>
    <div id="workLand" class="formula-box"></div>
  `;

  const netEl = root.querySelector('#workNet');
  const landEl = root.querySelector('#workLand');

  const row = (label, value, ok) =>
    `<p class="${ok === undefined ? '' : ok ? 'is-ok' : 'is-bad'}">
       <span>${label}</span><strong>${value}</strong>
     </p>`;

  store.subscribe(({ problem: p, result: r, phase }) => {
    const shown = phase !== 'aim';
    const val = (text) => (shown ? text : '—');
    const flag = (ok) => (shown ? ok : undefined);

    netEl.innerHTML =
      row(`t₁ = x_net / v = ${p.netDistance} / ${f(r.v, 1)}`, val(`${f(r.tNet)} s`)) +
      row('drop in that time h₁ = ½gt₁²', val(`${f(r.dropAtNet)} m`)) +
      row(
        `height at the net = ${p.hitHeight} − h₁`,
        val(`${f(r.heightAtNet)} m`),
        flag(r.netClearance > 0),
      ) +
      row(
        `versus the ${p.netHeight} m tape`,
        val(`${r.netClearance > 0 ? 'over by ' : 'under by '}${f(Math.abs(r.netClearance))} m`),
        flag(r.netClearance > 0),
      );

    landEl.innerHTML =
      row(`t₂ = √(2h/g) = √(2×${p.hitHeight}/${p.g})`, `${f(r.tLand)} s`) +
      row('<em>independent of v — the key idea</em>', '') +
      row(`x = v·t₂ = ${f(r.v, 1)} × ${f(r.tLand)}`, val(`${f(r.xLand, 1)} m`)) +
      row(
        `versus the ${p.courtEnd} m baseline`,
        val(`${r.outBy > 0 ? 'over by ' : 'short by '}${f(Math.abs(r.outBy), 1)} m`),
        flag(r.outBy <= 0),
      );
  });
}
