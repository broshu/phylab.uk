import { L } from './lang.js?v=20261020f';

// Avatars and the small diagrams Galileo sends in the chat.
// Drawn here as inline SVG so the lab has no image files to load.

export const AVATARS = {
  aristotle: `<svg viewBox="7 5 50 50" aria-hidden="true">
    <circle cx="32" cy="32" r="32" fill="#e9dcc0"/>
    <path d="M10 64c2-12 10-18 22-18s20 6 22 18z" fill="#f4efe4"/>
    <path d="M20 50c4 4 20 4 24 0l2 14H18z" fill="#c9b892"/>
    <ellipse cx="32" cy="29" rx="12" ry="14" fill="#e8b98f"/>
    <path d="M18 27c-2-11 6-17 14-17s16 6 14 17c-1-6-5-9-6-9-3 3-13 3-16 0-1 0-5 3-6 9z" fill="#f2f0ea"/>
    <path d="M20 30c0 14 6 22 12 22s12-8 12-22c-2 5-5 7-7 7h-10c-2 0-5-2-7-7z" fill="#f2f0ea"/>
    <path d="M27 38c2 1.5 8 1.5 10 0" stroke="#b9a68a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <circle cx="27.5" cy="29" r="1.6" fill="#3b2f25"/><circle cx="36.5" cy="29" r="1.6" fill="#3b2f25"/>
    <path d="M24.5 25.5c1.5-1 4-1 5 0M34.5 25.5c1-1 3.5-1 5 0" stroke="#d8d4ca" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M17 19c4-6 10-8 15-8s11 2 15 8" stroke="#6d8a3e" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-dasharray="3 2.2"/>
  </svg>`,
  galileo: `<svg viewBox="7 5 50 50" aria-hidden="true">
    <circle cx="32" cy="32" r="32" fill="#cfdde8"/>
    <path d="M10 64c2-12 10-18 22-18s20 6 22 18z" fill="#2d2f3a"/>
    <path d="M23 47l9 7 9-7-3 9h-12z" fill="#f4f1ea"/>
    <ellipse cx="32" cy="29" rx="12" ry="14" fill="#e2ad85"/>
    <path d="M19 28c-1-10 5-16 13-16s14 6 13 16c-2-5-4-7-6-7-3 2-11 2-14 0-2 0-4 2-6 7z" fill="#8a6a4f"/>
    <path d="M21 33c1 11 6 17 11 17s10-6 11-17c-2 4-4 5-6 5h-10c-2 0-4-1-6-5z" fill="#9b7a5c"/>
    <path d="M27.5 39c2 1.3 7 1.3 9 0" stroke="#6f5440" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <circle cx="27.5" cy="29" r="1.6" fill="#2c221b"/><circle cx="36.5" cy="29" r="1.6" fill="#2c221b"/>
    <path d="M24.5 25.6c1.5-1.2 4-1.2 5 0M34.5 25.6c1-1.2 3.5-1.2 5 0" stroke="#6f5440" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M16 12c4 0 28-3 32 0" stroke="none"/>
  </svg>`,
  student: `<svg viewBox="7 5 50 50" aria-hidden="true">
    <circle cx="32" cy="32" r="32" fill="#d7e6dc"/>
    <path d="M12 64c2-12 10-18 20-18s18 6 20 18z" fill="#2f5d4f"/>
    <ellipse cx="32" cy="30" rx="11" ry="12.5" fill="#efc7a3"/>
    <path d="M20 29c-2-10 4-16 12-16s14 6 12 16c-2-4-5-7-10-7-4 0-8 2-14 7z" fill="#2b2622"/>
    <circle cx="28" cy="31" r="1.5" fill="#2b2622"/><circle cx="36" cy="31" r="1.5" fill="#2b2622"/>
    <path d="M28.5 36.5c2 1.4 5 1.4 7 0" stroke="#b3785a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg>`,
};

const INK = '#1d2620';
const HEAVY = '#5b6168';
const LIGHT = '#b9bec4';
const BLUE = '#0072B2';
const ORANGE = '#D55E00';

function stone(cx, cy, rx, ry, fill, label) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${INK}" stroke-width="1.5"/>
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12" font-weight="600" fill="${fill === HEAVY ? '#fff' : INK}">${label}</text>`;
}

function arrow(x, y1, y2, color, label) {
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 6}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    <path d="M${x - 6} ${y2 - 8} L${x} ${y2} L${x + 6} ${y2 - 8}z" fill="${color}"/>
    <text x="${x + 12}" y="${(y1 + y2) / 2 + 4}" font-size="13" font-weight="600" fill="${color}">${label}</text>`;
}

const FRAME = (w, h, body, label) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" font-family="Inter, system-ui, sans-serif">
    <rect width="${w}" height="${h}" rx="10" fill="#fff"/>${body}</svg>`;

export const PICTURES = {
  stones: FRAME(
    300,
    170,
    `${stone(80, 46, 30, 22, HEAVY, L('heavy', '重'))}${arrow(80, 74, 150, BLUE, L('speed 8', '速度 8'))}
     ${stone(210, 50, 17, 13, LIGHT, L('light', '轻'))}${arrow(210, 70, 110, ORANGE, L('speed 4', '速度 4'))}
     <line x1="20" y1="160" x2="280" y2="160" stroke="#c9c3b3" stroke-width="2"/>`,
    L('A heavy stone falling at speed 8 and a light stone falling at speed 4', '重石头以速度 8 下落，轻石头以速度 4 下落'),
  ),
  tied: FRAME(
    300,
    170,
    `${stone(150, 40, 30, 22, HEAVY, L('heavy', '重'))}
     <path d="M150 62 C 140 74, 160 82, 150 94" stroke="#8a6a3c" stroke-width="2.5" fill="none"/>
     ${stone(150, 106, 17, 13, LIGHT, L('light', '轻'))}
     <text x="196" y="80" font-size="34" font-weight="700" fill="${INK}">?</text>
     <text x="40" y="80" font-size="12" fill="#62695f">${L('tied with', '用绳子')}</text><text x="40" y="95" font-size="12" fill="#62695f">${L('a rope', '绑在一起')}</text>
     <line x1="20" y1="160" x2="280" y2="160" stroke="#c9c3b3" stroke-width="2"/>`,
    L('The heavy and the light stone tied together with a rope, falling at an unknown speed', '重石头和轻石头用绳子绑在一起，下落速度未知'),
  ),
  contradiction: FRAME(
    320,
    190,
    `<rect x="10" y="10" width="140" height="170" rx="8" fill="#eef4f9"/>
     <rect x="170" y="10" width="140" height="170" rx="8" fill="#fbefe8"/>
     <text x="80" y="32" text-anchor="middle" font-size="12.5" font-weight="700" fill="${BLUE}">${L('The light stone', '轻石头')}</text>
     <text x="80" y="48" text-anchor="middle" font-size="12.5" font-weight="700" fill="${BLUE}">${L('holds it back', '拖住重石头')}</text>
     <text x="240" y="32" text-anchor="middle" font-size="12.5" font-weight="700" fill="${ORANGE}">${L('Together they', '合在一起')}</text>
     <text x="240" y="48" text-anchor="middle" font-size="12.5" font-weight="700" fill="${ORANGE}">${L('are heavier', '更重')}</text>
     ${stone(80, 82, 22, 16, HEAVY, 'H')}${stone(80, 116, 13, 10, LIGHT, 'L')}
     <line x1="80" y1="98" x2="80" y2="106" stroke="#8a6a3c" stroke-width="2.5"/>
     ${stone(240, 82, 22, 16, HEAVY, 'H')}${stone(240, 116, 13, 10, LIGHT, 'L')}
     <line x1="240" y1="98" x2="240" y2="106" stroke="#8a6a3c" stroke-width="2.5"/>
     <text x="80" y="160" text-anchor="middle" font-size="15" font-weight="700" fill="${BLUE}">${L('slower than 8', '比 8 慢')}</text>
     <text x="240" y="160" text-anchor="middle" font-size="15" font-weight="700" fill="${ORANGE}">${L('faster than 8', '比 8 快')}</text>
     <circle cx="160" cy="98" r="15" fill="#b7354a"/><text x="160" y="104" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">≠</text>`,
    L('One way of reasoning says the tied pair is slower than 8, the other says faster than 8', '一种推理说绑在一起的石头比 8 慢，另一种说比 8 快'),
  ),
  method: FRAME(
    320,
    212,
    `<text x="20" y="30" font-size="14" font-weight="700" fill="${INK}">${L('How a thought experiment wins', '思想实验怎样取胜')}</text>
     ${[
       L('Take the rule as true, just for now', '暂且承认规则成立'),
       L('Imagine a simple case', '设想一个简单情境'),
       L('Reason it one way', '用一种方式推理'),
       L('Reason it another way', '换一种方式推理'),
       L('Spot the contradiction', '找出矛盾'),
       L('Reject the rule', '否定这条规则'),
     ]
       .map(
         (t, i) => `<circle cx="32" cy="${54 + i * 26}" r="10" fill="#2f5d4f"/>
       <text x="32" y="${58 + i * 26}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${i + 1}</text>
       <text x="52" y="${58 + i * 26}" font-size="13" fill="${INK}">${t}</text>`,
       )
       .join('')}`,
    L('The six steps of a thought experiment', '思想实验的六个步骤'),
  ),
};
