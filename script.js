/* ====== PERSISTENCE ====== */
const STORAGE_KEY = 'bmfGame';
let initializing = true;   // suppress auto-save during first render

const saveGame = () => {
  const snapshot = {
    settings,
    target,
    state
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    // ignore quota or serialization errors
  }
};

const loadSavedGame = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  let snap;
  try {
    snap = JSON.parse(raw);
  } catch {
    return false;
  }

  if (!snap.settings || !snap.target || !snap.state) return false;

  Object.assign(settings, snap.settings);
  target = snap.target;
  state = snap.state;

  // simple validation
  if (
    !Array.isArray(target) ||
    !Array.isArray(state.U) ||
    !Array.isArray(state.V)
  ) return false;

  applyCSS();
  updateModeButtons();

  $('#nVal').textContent = settings.n;
  $('#rVal').textContent = settings.r;
  $('#zoomVal').textContent = Math.round(settings.zoom * 100) + ' %';

  // recalc solved flag
  solved = matEq(player(), target);

  return true;
};

/* ====== SETTINGS & STATE ====== */
const settings = { n: 5, r: 3, mode: 'mod', zoom: 1, showPreview: true };
let solved = false, state, target;
const $ = sel => document.querySelector(sel);

/* ====== BIT / HEX ====== */
const bitsToHex = b => {
  const pad = (4 - b.length % 4) % 4;
  if (pad) b += '0'.repeat(pad);
  return b.match(/.{4}/g).map(x => parseInt(x, 2).toString(16).toUpperCase()).join('');
};
const hexToBits = h => {
  let res = '';
  for (const c of h.toUpperCase())
    res += parseInt(c, 16).toString(2).padStart(4, '0');
  return res;
};

/* ====== HELPERS ====== */
const matEq = (a, b) => {
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < a.length; j++)
      if (a[i][j] !== b[i][j]) return false;
  return true;
};
const rnd = () => (Math.random() < 0.5 ? 1 : 0);
const calcSize = () => {
  const g = innerWidth <= 600 ? 4 : 6;
  const max = innerWidth <= 600 ? innerWidth * 0.9 : 500;
  const raw = (max - (settings.n - 1) * g) / settings.n;
  return Math.max(22, Math.min(raw, innerWidth <= 600 ? 36 : 46));
};
const applyCSS = () => {
  document.documentElement.style.setProperty('--n', settings.n);
  document.documentElement.style.setProperty('--size', calcSize() + 'px');
  document.documentElement.style.setProperty('--gap', (innerWidth <= 600 ? 4 : 6) + 'px');
  document.documentElement.style.setProperty('--zoom', settings.zoom);
};

/* universal grid builder */
const gridHTML = (n, getCls) =>
  Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      `<div class="tile ${getCls(i, j)}"></div>`
    ).join('')
  ).join('');

const tileCls = (t, p, c) =>
  settings.mode === 'bool'
    ? (t ? (c ? 'good' : (p ? 'zero' : 'want')) : (c ? 'bad' : 'zero'))
    : (t ^ (p ^ c) ? (c ? 'good' : 'want') : (c ? 'bad' : 'zero'));

/* ====== ENCODE / LOAD ====== */
const encode = () => {
  let bits =
    settings.n.toString(2).padStart(4, '0') +
    settings.r.toString(2).padStart(4, '0') +
    (settings.mode === 'mod' ? 1 : 0).toString(2).padStart(4, '0');
  for (let i = 0; i < settings.n; i++)
    for (let j = 0; j < settings.n; j++)
      bits += target[i][j];
  return bitsToHex(bits);
};

const loadFromCode = code => {
  if (!/^[0-9A-F]+$/i.test(code)) return false;
  const bits = hexToBits(code);
  if (bits.length < 12) return false;

  const n = parseInt(bits.slice(0, 4), 2);
  const r = parseInt(bits.slice(4, 8), 2);
  const modeBit = parseInt(bits.slice(8, 12), 2);

  if (n < 2 || n > 10 || r < 1 || r > 6 || ![0, 1].includes(modeBit)) return false;

  const cells = n * n;
  const boardBits = bits.slice(12, 12 + cells).padEnd(cells, '0');
  target = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => +boardBits[i * n + j])
  );

  Object.assign(settings, { n, r, mode: modeBit ? 'mod' : 'bool' });
  applyCSS();
  initState();
  solved = false;
  updateModeButtons();
  $('#nVal').textContent = n;
  $('#rVal').textContent = r;
  render();
  return true;
};

/* ====== STATE ====== */
const initState = () => {
  state = {
    U: Array.from({ length: settings.r }, () => Array(settings.n).fill(0)),
    V: Array.from({ length: settings.r }, () => Array(settings.n).fill(0)),
    cur: 0
  };
};

const genTarget = () => {
  const tU = Array.from({ length: settings.r }, () =>
    Array.from({ length: settings.n }, rnd)
  );
  const tV = Array.from({ length: settings.r }, () =>
    Array.from({ length: settings.n }, rnd)
  );

  target = Array.from({ length: settings.n }, () => Array(settings.n).fill(0));

  for (let k = 0; k < settings.r; k++)
    for (let i = 0; i < settings.n; i++)
      if (tU[k][i])
        for (let j = 0; j < settings.n; j++)
          if (tV[k][j])
            settings.mode === 'bool'
              ? (target[i][j] = 1)
              : (target[i][j] ^= 1);
};

const player = () => {
  const P = Array.from({ length: settings.n }, () => Array(settings.n).fill(0));
  for (let k = 0; k < settings.r; k++)
    for (let i = 0; i < settings.n; i++)
      if (state.U[k][i])
        for (let j = 0; j < settings.n; j++)
          if (state.V[k][j])
            settings.mode === 'bool'
              ? (P[i][j] = 1)
              : (P[i][j] ^= 1);
  return P;
};

/* ====== CELEBRATION ====== */
const showToast = () => {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">✓</span>
    <span class="toast-text">Correct!</span>
  `;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Hide and remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
};

/* ====== RENDER ====== */
const render = () => {
  const P = player();
  const k = state.cur;

  $('#editGrid').innerHTML = gridHTML(settings.n, (i, j) =>
    tileCls(target[i][j], P[i][j], state.U[k][i] && state.V[k][j])
  );

  $('#rowToggles').innerHTML = state.U[k]
    .map((v, i) =>
      `<button class="toggle ${v ? 'on' : ''}" data-row="${i}"></button>`
    )
    .join('');

  $('#colToggles').innerHTML = state.V[k]
    .map((v, j) =>
      `<button class="toggle ${v ? 'on' : ''}" data-col="${j}"></button>`
    )
    .join('');

  $('#cards').innerHTML = Array.from({ length: settings.r }, (_, d) => {
    const mini = gridHTML(settings.n, (i, j) =>
      tileCls(target[i][j], P[i][j], state.U[d][i] && state.V[d][j])
    );
    return `<div class="card ${d === k ? 'active' : ''}" data-card="${d}">
              <div class="grid mini">${mini}</div>
            </div>`;
  }).join('');

  $('#previews').innerHTML = settings.showPreview
    ? `<div class="gridCard">
         <div class="label">Target</div>
         <div class="grid mini">${gridHTML(settings.n, (i, j) => (target[i][j] ? 'good' : 'zero'))}</div>
       </div>
       <div class="gridCard">
         <div class="label">You</div>
         <div class="grid mini">${gridHTML(settings.n, (i, j) => (P[i][j] ? 'good' : 'zero'))}</div>
       </div>`
    : '';

  if (!solved && matEq(P, target)) {
    solved = true;
    showToast();
  } else if (solved && !matEq(P, target)) {
    solved = false;
  }

  $('#codeInput').value = encode();

  if (!initializing) saveGame();  // auto-persist
};

/* ====== UI EVENTS ====== */
$('#menuBtn').onclick = () => $('#panel').classList.toggle('open');

$('#newBtn').onclick = () => {
  newGame();
  $('#panel').classList.remove('open');
};

/* delegated toggles */
$('#app').addEventListener('click', e => {
  const tgt = e.target.closest('[data-row],[data-col],[data-card]');
  if (!tgt) return;

  if (tgt.dataset.row !== undefined)
    state.U[state.cur][+tgt.dataset.row] ^= 1;
  else if (tgt.dataset.col !== undefined)
    state.V[state.cur][+tgt.dataset.col] ^= 1;
  else
    state.cur = +tgt.dataset.card;

  render();
});

/* clear */
$('#clearBtn').onclick = () => {
  state.U.forEach(u => u.fill(0));
  state.V.forEach(v => v.fill(0));
  solved = false;
  render();
};

/* clipboard */
$('#copyCodeBtn').onclick = () => {
  navigator.clipboard.writeText(encode()).then(() => {
    const btn = $('#copyCodeBtn');
    btn.textContent = 'Copy Code';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy Code';
      btn.classList.remove('copied');
    }, 300);
  });
};

/* load code + Enter */
$('#loadCodeBtn').onclick = () => {
  if (!loadFromCode($('#codeInput').value.trim())) alert('Invalid code');
};
$('#codeInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('#loadCodeBtn').click();
});

/* mode buttons */
const updateModeButtons = () => {
  $('#orBtn').classList.toggle('checked', settings.mode === 'bool');
  $('#xorBtn').classList.toggle('checked', settings.mode === 'mod');
};

$('#orBtn').onclick = () => {
  settings.mode = 'bool';
  updateModeButtons();
  newGame();
};
$('#xorBtn').onclick = () => {
  settings.mode = 'mod';
  updateModeButtons();
  newGame();
};

/* steppers */
document.querySelectorAll('.stepper').forEach(st => {
  st.onclick = e => {
    const inc = e.target.classList.contains('plus')
      ? 1
      : e.target.classList.contains('minus')
      ? -1
      : 0;
    if (!inc) return;

    switch (st.dataset.target) {
      case 'n':
        settings.n = Math.max(2, Math.min(10, settings.n + inc));
        $('#nVal').textContent = settings.n;
        newGame();
        break;
      case 'r':
        settings.r = Math.max(1, Math.min(6, settings.r + inc));
        $('#rVal').textContent = settings.r;
        newGame();
        break;
      case 'zoom':
        const percent = Math.round(settings.zoom * 100) + inc * 5;
        settings.zoom = Math.max(0.5, Math.min(1, percent / 100));
        $('#zoomVal').textContent = Math.round(settings.zoom * 100) + ' %';
        applyCSS();
        render();
        break;
    }
  };
});

/* preview toggle */
$('#previewToggle').onchange = e => {
  settings.showPreview = e.target.checked;
  render();
};

/* modal controls */
$('#helpLink').onclick = e => {
  e.preventDefault();
  Tutorial.start();
};

/* resize handling */
addEventListener('resize', () => {
  applyCSS();
  render();
});

/* ====== BOOTSTRAP ====== */
const newGame = () => {
  applyCSS();
  initState();
  genTarget();
  solved = false;
  render();
};

$('#nVal').textContent = settings.n;
$('#rVal').textContent = settings.r;
$('#zoomVal').textContent = '100 %';

if (!loadSavedGame()) newGame();
else render();

initializing = false;   // now enable auto-save
