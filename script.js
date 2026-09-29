'use strict';

const STORAGE_KEY = 'kanban-pra-cami:v1';

const ASCII_TEXT = 'Cami';
const ASCII_FONT_SIZE = 15;
const ASCII_WAVES = true;

const CARD_SWAP_DELAY = 6000;

const FOCUS_INTERVAL = 2600;

const WIP_LIMIT = 3;

const CATEGORIES = {
  tcc:      { label: 'TCC (TCEM)' },
  escola:   { label: 'Escola / Provas' },
  desenhos: { label: 'Desenhos (Bicos)' },
  academia: { label: 'Academia' },
  pessoal:  { label: 'Pessoal / Autocuidado' },
};

const STATUSES = ['todo', 'doing', 'done'];

const COLUMN_ID = {
  todo:  'coluna-backlog',
  doing: 'coluna-doing',
  done:  'coluna-done',
};

const MOVES = {
  todo:  [{ act: 'next', label: 'Começar',  primary: true }],
  doing: [{ act: 'prev', label: 'Voltar' }, { act: 'next', label: 'Concluir', primary: true }],
  done:  [{ act: 'prev', label: 'Reabrir' }],
};

const EMPTY_TEXT = {
  todo:  'Nada esperando. Adicione uma tarefa acima.',
  doing: 'Escolha só uma tarefa para começar.',
  done:  'O que você terminar aparece aqui.',
};

const TIPS = [
  'Uma coisa de cada vez. Só a próxima já conta.',
  'Semana de prova se vence em blocos pequenos, não em uma noite.',
  'Descansar também está na lista de tarefas.',
  'Você não precisa resolver tudo hoje, só o próximo passo.',
  'Beba água. Depois volte pro TCEM.',
  'Saiu do zero? Então você já está andando.',
];

const ICON_X =
  '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">' +
  '<path d="M2.5 2.5l7 7m0-7l-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (selector, root = document) => root.querySelector(selector);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const pad2 = (n) => String(n).padStart(2, '0');

function makeId() {
  return (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);
}

let tasks = loadTasks();
let activeFilter = 'all';
let lastDeleted = null;
let highlightId = null;
let tipIndex = 0;

function isValidTask(t) {
  return t && typeof t.id === 'string' && typeof t.title === 'string'
    && t.cat in CATEGORIES && STATUSES.includes(t.status);
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return seedTasks();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidTask) : [];
  } catch {
    return seedTasks();
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
  }
}

function seedTasks() {
  return [
    { id: makeId(), title: 'Escrever a introdução do TCEM',           cat: 'tcc',      status: 'todo' },
    { id: makeId(), title: 'Revisar a matéria da prova de Biologia',   cat: 'escola',   status: 'todo' },
    { id: makeId(), title: 'Terminar o esboço da encomenda',           cat: 'desenhos', status: 'doing' },
    { id: makeId(), title: 'Treino de pernas',                         cat: 'academia', status: 'todo' },
    { id: makeId(), title: 'Alongar e beber água',                     cat: 'pessoal',  status: 'done' },
  ];
}

const board = $('#board');

function render() {
  for (const status of STATUSES) {
    const column = document.getElementById(COLUMN_ID[status]);
    const list = $('.task-list', column);

    const all = tasks.filter((t) => t.status === status);
    const visible = activeFilter === 'all' ? all : all.filter((t) => t.cat === activeFilter);

    $('[data-count]', column).textContent =
      activeFilter === 'all' ? pad2(all.length) : `${pad2(visible.length)}/${pad2(all.length)}`;

    if (visible.length) {
      list.replaceChildren(...visible.map(createTaskCard));
    } else {
      const text = activeFilter === 'all' ? EMPTY_TEXT[status] : 'Nenhuma tarefa dessa categoria aqui.';
      list.replaceChildren(el('div', 'empty', text));
    }
  }

  $('#wip-note').hidden = tasks.filter((t) => t.status === 'doing').length <= WIP_LIMIT;

  highlightId = null;
  renderHeroCards();
}

function createTaskCard(task) {
  const card = el('article', 'task' + (task.status === 'done' ? ' is-done' : ''));
  card.dataset.id = task.id;
  card.dataset.cat = task.cat;
  card.draggable = true;
  card.tabIndex = -1;
  if (task.id === highlightId) card.classList.add('is-new');

  card.append(
    el('span', 'tag', CATEGORIES[task.cat].label),
    el('p', 'task-title', task.title)
  );

  const actions = el('div', 'task-actions');
  for (const move of MOVES[task.status]) {
    const button = el('button', 'btn-ghost' + (move.primary ? ' is-primary' : ''), move.label);
    button.type = 'button';
    button.dataset.act = move.act;
    button.setAttribute('aria-label', `${move.label}: ${task.title}`);
    actions.append(button);
  }

  const del = el('button', 'btn-icon');
  del.type = 'button';
  del.dataset.act = 'del';
  del.setAttribute('aria-label', `Excluir: ${task.title}`);
  del.innerHTML = ICON_X;
  actions.append(del);

  card.append(actions);
  return card;
}

const form = $('#form-tarefa');
const inputTitle = $('#input-titulo');
const selectCategory = $('#select-categoria');
const filtersBox = $('#filtros');

function addTask(title, cat) {
  const task = { id: makeId(), title, cat, status: 'todo' };
  tasks.unshift(task);
  highlightId = task.id;
  saveTasks();
  if (activeFilter !== 'all' && activeFilter !== cat) setFilter('all');
  else render();
}

function moveTask(id, direction) {
  const index = tasks.findIndex((t) => t.id === id);
  if (index < 0) return;
  const target = STATUSES[clamp(STATUSES.indexOf(tasks[index].status) + direction, 0, STATUSES.length - 1)];
  setStatus(id, target);
}

function setStatus(id, status) {
  const index = tasks.findIndex((t) => t.id === id);
  if (index < 0 || tasks[index].status === status) return;
  const [task] = tasks.splice(index, 1);
  task.status = status;
  tasks.unshift(task);
  highlightId = id;
  saveTasks();
  render();
  const moved = board.querySelector(`.task[data-id="${CSS.escape(id)}"]`);
  if (moved) moved.focus({ preventScroll: true });
}

function deleteTask(id) {
  const index = tasks.findIndex((t) => t.id === id);
  if (index < 0) return;
  const [task] = tasks.splice(index, 1);
  lastDeleted = { task, index };
  saveTasks();
  render();
  showToast('Tarefa excluída.', 'Desfazer', undoDelete);
}

function undoDelete() {
  if (!lastDeleted) return;
  tasks.splice(lastDeleted.index, 0, lastDeleted.task);
  highlightId = lastDeleted.task.id;
  lastDeleted = null;
  saveTasks();
  hideToast();
  render();
}

function handleAction(id, act) {
  if (act === 'next') moveTask(id, +1);
  else if (act === 'prev') moveTask(id, -1);
  else if (act === 'del') deleteTask(id);
}

function setFilter(filter) {
  activeFilter = filter;
  filtersBox.querySelectorAll('[data-filter]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.filter === filter));
  });
  render();
}

const toast = $('#toast');
let toastTimer = 0;

function showToast(message, actionLabel, onAction) {
  const button = el('button', 'btn-ghost is-primary', actionLabel);
  button.type = 'button';
  button.addEventListener('click', onAction);
  toast.replaceChildren(el('span', '', message), button);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
  clearTimeout(toastTimer);
  toast.hidden = true;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = inputTitle.value.trim();
  if (!title) return;
  addTask(title, selectCategory.value);
  inputTitle.value = '';
  inputTitle.focus();
});

board.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-act]');
  const card = button && button.closest('.task');
  if (card) handleAction(card.dataset.id, button.dataset.act);
});

filtersBox.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-filter]');
  if (!chip) return;
  setFilter(chip.dataset.filter);
  if (chip.dataset.filter !== 'all') selectCategory.value = chip.dataset.filter;
});

board.addEventListener('dragstart', (event) => {
  const card = event.target.closest && event.target.closest('.task');
  if (!card) return;
  event.dataTransfer.setData('text/plain', card.dataset.id);
  event.dataTransfer.effectAllowed = 'move';
  card.classList.add('is-dragging');
});

board.addEventListener('dragend', () => {
  board.querySelectorAll('.is-dragging, .is-over').forEach((n) => n.classList.remove('is-dragging', 'is-over'));
});

board.addEventListener('dragover', (event) => {
  const column = event.target.closest('.kanban-column');
  if (!column) return;
  event.preventDefault();
  board.querySelectorAll('.is-over').forEach((n) => n !== column && n.classList.remove('is-over'));
  column.classList.add('is-over');
});

board.addEventListener('dragleave', (event) => {
  const column = event.target.closest('.kanban-column');
  if (column && !column.contains(event.relatedTarget)) column.classList.remove('is-over');
});

board.addEventListener('drop', (event) => {
  const column = event.target.closest('.kanban-column');
  if (!column) return;
  event.preventDefault();
  column.classList.remove('is-over');
  setStatus(event.dataTransfer.getData('text/plain'), column.dataset.status);
});

function renderHeroCards() {
  const body = $('#card-next');
  const meta = $('#next-meta');
  const doing = tasks.find((t) => t.status === 'doing');
  const next = doing || tasks.find((t) => t.status === 'todo');

  if (next) {
    meta.textContent = doing ? 'fazendo agora' : 'sugestão';
    const wrap = el('div', 'swap-task');
    wrap.dataset.cat = next.cat;
    const button = el('button', 'btn-ghost is-primary', doing ? 'Concluir' : 'Começar');
    button.type = 'button';
    button.dataset.act = 'next';
    button.dataset.id = next.id;
    wrap.append(el('span', 'tag', CATEGORIES[next.cat].label), el('p', 'swap-task-title', next.title), button);
    body.replaceChildren(wrap);
  } else {
    meta.textContent = '';
    body.replaceChildren(el('p', 'swap-text',
      tasks.length ? 'Tudo concluído. Hora de descansar um pouco.' : 'Nada na fila. Adicione uma tarefa acima.'));
  }

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  $('#progress-num').textContent = `${done}/${total}`;
  $('#progress-label').textContent = total ? 'tarefas concluídas' : 'Sem tarefas ainda';
  $('#progress-bar').style.width = total ? `${(done / total) * 100}%` : '0%';

  $('#tip-text').textContent = TIPS[tipIndex % TIPS.length];
}

function initAsciiTitle(canvas, { text, fontSize, waves }) {
  const ctx = canvas.getContext('2d');
  const RAMP = ' .:-=+*#%@';
  const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
  const DISPLAY = '"Bricolage Grotesque", "Arial Black", system-ui, sans-serif';
  const cellW = fontSize * 0.6;
  const cellH = Math.round(fontSize * 1.05);
  const animate = waves && !prefersReducedMotion;
  const stops = readPalette();
  const pointer = { x: 0, y: 0, active: false };

  let cols = 0, rows = 0, width = 0, height = 0;
  let cov = null;
  let colColors = [];
  let ready = false, raf = 0, visible = true;

  function build() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return false;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cols = Math.floor(width / cellW);
    rows = Math.floor(height / cellH);
    const W = Math.ceil(cols * cellW);
    const H = Math.ceil(rows * cellH);

    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });

    o.font = `800 100px ${DISPLAY}`;
    const ratio = (o.measureText(text).actualBoundingBoxAscent || 72) / 100;
    let size = (H * 0.84) / ratio;
    o.font = `800 ${size}px ${DISPLAY}`;
    const textWidth = o.measureText(text).width;
    if (textWidth > W * 0.98) {
      size *= (W * 0.98) / textWidth;
      o.font = `800 ${size}px ${DISPLAY}`;
    }
    o.fillStyle = '#fff';
    o.textBaseline = 'alphabetic';
    o.fillText(text, 2, (H + ratio * size) / 2);

    const data = o.getImageData(0, 0, W, H).data;
    cov = new Float32Array(cols * rows);
    let minCol = cols, maxCol = 0;

    for (let r = 0; r < rows; r++) {
      const y0 = Math.floor(r * cellH), y1 = Math.min(H, Math.floor((r + 1) * cellH));
      for (let c = 0; c < cols; c++) {
        const x0 = Math.floor(c * cellW), x1 = Math.min(W, Math.floor((c + 1) * cellW));
        let sum = 0, n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) { sum += data[(y * W + x) * 4 + 3]; n++; }
        }
        const v = n ? Math.min(1, (sum / (n * 255)) * 1.3) : 0;
        cov[r * cols + c] = v;
        if (v > 0.15) { minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c); }
      }
    }

    colColors = Array.from({ length: cols }, (_, c) => {
      const t = maxCol > minCol ? clamp((c - minCol) / (maxCol - minCol), 0, 1) : 0;
      const [r, g, b] = lerpPalette(stops, t);
      return `rgb(${r},${g},${b})`;
    });
    return true;
  }

  function draw(ms) {
    if (!cov) return;
    const t = ms / 1000;
    ctx.clearRect(0, 0, width, height);
    ctx.font = `700 ${fontSize}px ${MONO}`;
    ctx.textBaseline = 'top';

    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = colColors[c];
      for (let r = 0; r < rows; r++) {
        let dx = 0, dy = 0;

        if (animate) {
          dx = Math.sin(r * 0.55 + t * 1.7) * 2.2 + Math.sin(c * 0.09 + t * 0.9) * 0.8;
          dy = Math.sin(c * 0.22 + t * 1.3) * 1.1;
          if (pointer.active) {
            const px = (c + 0.5) * cellW - pointer.x;
            const py = (r + 0.5) * cellH - pointer.y;
            const d = Math.hypot(px, py);
            if (d < 90 && d > 0) {
              const f = 1 - d / 90;
              dx += (px / d) * f * 3;
              dy += (py / d) * f * 1.5;
            }
          }
        }

        const sc = clamp(Math.round(c + dx), 0, cols - 1);
        const sr = clamp(Math.round(r + dy), 0, rows - 1);
        let v = cov[sr * cols + sc];
        if (v < 0.1) continue;

        if (animate) v += Math.sin(c * 12.9898 + r * 78.233 + t * 2.2) * 0.07;

        const idx = clamp(Math.round(v * (RAMP.length - 1)), 1, RAMP.length - 1);
        ctx.globalAlpha = 0.45 + 0.55 * Math.min(1, v);
        ctx.fillText(RAMP[idx], c * cellW, r * cellH);
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop(ms) { draw(ms); raf = requestAnimationFrame(loop); }
  function start() { if (!raf && animate && visible && ready) raf = requestAnimationFrame(loop); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  canvas.addEventListener('pointermove', (e) => {
    const box = canvas.getBoundingClientRect();
    pointer.x = e.clientX - box.left;
    pointer.y = e.clientY - box.top;
    pointer.active = true;
  });
  canvas.addEventListener('pointerleave', () => { pointer.active = false; });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  }).observe(canvas);

  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });

  new ResizeObserver(() => {
    if (ready && build()) draw(performance.now());
  }).observe(canvas);

  const fontsReady = document.fonts
    ? Promise.allSettled([
        document.fonts.load(`800 100px "Bricolage Grotesque"`, text),
        document.fonts.load(`700 ${fontSize}px "JetBrains Mono"`, RAMP),
      ])
    : Promise.resolve();

  fontsReady.then(() => {
    ready = true;
    if (build()) { draw(performance.now()); start(); }
  });
}

function readPalette() {
  const styles = getComputedStyle(document.documentElement);
  return ['--tcc', '--escola', '--desenhos', '--academia', '--pessoal'].map((name) => {
    const hex = styles.getPropertyValue(name).trim().replace('#', '');
    const n = parseInt(hex, 16);
    return Number.isNaN(n) ? [236, 232, 225] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
}

function lerpPalette(stops, t) {
  const x = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
}

function initTrueFocus(root, { interval }) {
  const words = root.textContent.trim().split(/\s+/);
  root.textContent = '';
  const spans = words.map((word) => root.appendChild(el('span', 'focus-word', word)));

  if (prefersReducedMotion) {
    root.classList.add('is-static');
    return;
  }

  const frame = el('span', 'focus-frame no-anim');
  frame.setAttribute('aria-hidden', 'true');
  frame.append(el('i'), el('i'), el('i'), el('i'));
  root.append(frame);

  let current = 0;
  let timer = 0;

  function focusOn(index, animated = true) {
    current = index;
    spans.forEach((s, i) => s.classList.toggle('is-active', i === index));
    const s = spans[index];
    frame.classList.toggle('no-anim', !animated);
    frame.style.transform = `translate(${s.offsetLeft}px, ${s.offsetTop}px)`;
    frame.style.width = `${s.offsetWidth}px`;
    frame.style.height = `${s.offsetHeight}px`;
  }

  const play = () => { stopTimer(); timer = setInterval(() => focusOn((current + 1) % spans.length), interval); };
  const stopTimer = () => clearInterval(timer);

  spans.forEach((s, i) => {
    s.addEventListener('mouseenter', () => { stopTimer(); focusOn(i); });
    s.addEventListener('mouseleave', play);
  });

  focusOn(0, false);
  play();

  const reposition = () => focusOn(current, false);
  if (document.fonts) document.fonts.ready.then(reposition);
  window.addEventListener('resize', reposition);
}

function initCardSwap(root, { delay, onDropped }) {
  const cards = [...root.querySelectorAll('.swap-card')];
  let order = [...cards];
  let busy = false;
  let timer = 0;
  let paused = false;

  const DROP_MS = prefersReducedMotion ? 0 : 520;
  const SETTLE_MS = prefersReducedMotion ? 0 : 380;

  function layout() {
    order.forEach((card, i) => {
      card.style.setProperty('--slot', i);
      card.inert = i !== 0;
    });
  }

  function swap() {
    if (busy) return;
    busy = true;
    const front = order.shift();
    front.classList.add('is-dropping');

    setTimeout(() => {
      if (onDropped) onDropped(front);
      order.push(front);
      order.forEach((card, i) => {
        card.style.setProperty('--slot', i);
        card.inert = i !== 0;
      });
      front.classList.remove('is-dropping');
      setTimeout(() => { busy = false; }, SETTLE_MS);
    }, DROP_MS);
  }

  function play() {
    clearInterval(timer);
    if (prefersReducedMotion) return;
    timer = setInterval(() => { if (!paused && !document.hidden) swap(); }, delay);
  }

  root.addEventListener('mouseenter', () => { paused = true; });
  root.addEventListener('mouseleave', () => { paused = false; });
  root.addEventListener('focusin', () => { paused = true; });
  root.addEventListener('focusout', () => { paused = false; });

  root.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    swap();
    play();
  });

  layout();
  play();
}

initAsciiTitle($('#ascii-title'), { text: ASCII_TEXT, fontSize: ASCII_FONT_SIZE, waves: ASCII_WAVES });
initTrueFocus($('#true-focus'), { interval: FOCUS_INTERVAL });

const swapRoot = $('#card-swap');
initCardSwap(swapRoot, {
  delay: CARD_SWAP_DELAY,
  onDropped: (card) => {
    if (card.dataset.kind === 'tip') {
      tipIndex += 1;
      $('#tip-text').textContent = TIPS[tipIndex % TIPS.length];
    }
  },
});

swapRoot.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-act]');
  if (button) handleAction(button.dataset.id, button.dataset.act);
});

render();