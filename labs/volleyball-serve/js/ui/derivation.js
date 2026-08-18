/**
 * Working panel: the evaluator's intermediate quantities laid out in the order
 * a student would write them down. The numbers only appear once the ball has
 * been served, so the slider cannot be used to read off the answer.
 * To add a step, add one more row() call.
 */
import { renderRichText } from './math.js';

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

  const math = (tex, fallback) => ({ type: 'math', tex, fallback });
  const row = (label, value, ok) => {
    const p = document.createElement('p');
    if (ok !== undefined) p.className = ok ? 'is-ok' : 'is-bad';

    const labelEl = document.createElement('span');
    if (Array.isArray(label)) renderRichText(labelEl, label);
    else labelEl.textContent = label;

    const valueEl = document.createElement('strong');
    valueEl.textContent = value;
    p.appendChild(labelEl);
    p.appendChild(valueEl);
    return p;
  };

  const replaceRows = (container, rows) => {
    container.textContent = '';
    rows.forEach((item) => container.appendChild(item));
  };

  store.subscribe(({ problem: p, result: r, phase }) => {
    const shown = phase !== 'aim';
    const val = (text) => (shown ? text : '—');
    const flag = (ok) => (shown ? ok : undefined);

    replaceRows(netEl, [
      row(
        [
          math(
            String.raw`t_1 = \frac{x_{\mathrm{net}}}{v} = \frac{${p.netDistance}}{${f(r.v, 1)}}`,
            `t₁ = x_net / v = ${p.netDistance} / ${f(r.v, 1)}`,
          ),
        ],
        val(`${f(r.tNet)} s`),
      ),
      row(
        [
          math(
            String.raw`h_1 = \frac{1}{2} g t_1^2`,
            'drop in that time h₁ = ½gt₁²',
          ),
        ],
        val(`${f(r.dropAtNet)} m`),
      ),
      row(
        [
          math(
            String.raw`y_{\mathrm{net}} = ${p.hitHeight} - h_1`,
            `height at the net = ${p.hitHeight} − h₁`,
          ),
        ],
        val(`${f(r.heightAtNet)} m`),
        flag(r.netClearance > 0),
      ),
      row(
        `versus the ${p.netHeight} m tape`,
        val(`${r.netClearance > 0 ? 'over by ' : 'under by '}${f(Math.abs(r.netClearance))} m`),
        flag(r.netClearance > 0),
      ),
    ]);

    replaceRows(landEl, [
      row(
        [
          math(
            String.raw`t_2 = \sqrt{\frac{2h}{g}} = \sqrt{\frac{2 \times ${p.hitHeight}}{${p.g}}}`,
            `t₂ = √(2h/g) = √(2×${p.hitHeight}/${p.g})`,
          ),
        ],
        `${f(r.tLand)} s`,
      ),
      row('independent of v — the key idea', ''),
      row(
        [
          math(
            String.raw`x = v t_2 = ${f(r.v, 1)} \times ${f(r.tLand)}`,
            `x = v·t₂ = ${f(r.v, 1)} × ${f(r.tLand)}`,
          ),
        ],
        val(`${f(r.xLand, 1)} m`),
      ),
      row(
        `versus the ${p.courtEnd} m baseline`,
        val(`${r.outBy > 0 ? 'over by ' : 'short by '}${f(Math.abs(r.outBy), 1)} m`),
        flag(r.outBy <= 0),
      ),
    ]);
  });
}
