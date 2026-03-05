const PROXY = url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
const PROXY2 = url => `https://corsproxy.io/?${encodeURIComponent(url)}`;

const SOURCES = [
  { name: 'Polygon', color: '#ff4500', feed: 'https://www.polygon.com/rss/index.xml' },
  { name: 'IGN', color: '#e2002a', feed: 'https://feeds.ign.com/ign/games-all' },
  { name: 'Kotaku', color: '#00c99a', feed: 'https://kotaku.com/rss' },
  { name: 'Eurogamer', color: '#ff7c1f', feed: 'https://www.eurogamer.net/feed' },
  { name: 'GameSpot', color: '#ffcc00', feed: 'https://www.gamespot.com/feeds/mashup/' },
  { name: 'VGC', color: '#a78bfa', feed: 'https://www.videogameschronicle.com/feed/' },
  { name: 'Xbox', color: '#52b043', feed: 'https://news.xbox.com/en-us/feed/' },
  { name: 'PlayStation', color: '#0070d1', feed: 'https://blog.playstation.com/feed/' },
  { name: 'Nintendo', color: '#e4001d', feed: 'https://www.nintendo.com/whatsnew/feed/news.xml' },
];

let knownUrls = new Set();
let isFirstLoad = true;

function ageMs(d) { try { return Date.now() - new Date(d).getTime() } catch { return Infinity } }
function fmtAge(ms) { const m = Math.floor(ms / 60000); if (m < 2) return 'JUST NOW'; if (m < 60) return m + 'M AGO'; const h = Math.floor(m / 60); if (h < 24) return h + 'H AGO'; return Math.floor(h / 24) + 'D AGO' }
function cleanText(s) { if (!s) return ''; return s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() }

function parseXML(xmlStr) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item, entry'));
    return items.map(item => {
      const get = (...tags) => { for (const t of tags) { const el = item.querySelector(t); if (el) return el.textContent || el.getAttribute('href') || '' } return '' };
      const link = item.querySelector('link');
      const url = link ? (link.textContent.trim() || link.getAttribute('href') || '') : '';
      const pubDate = get('pubDate', 'published', 'updated', 'dc\\:date');
      return { title: cleanText(get('title')), desc: cleanText(get('description', 'summary', 'content\\:encoded', 'content')).slice(0, 300), url, date: pubDate, age: ageMs(pubDate) };
    }).filter(a => a.title && a.url);
  } catch { return [] }
}

async function fetchFeed(src) {
  for (const proxyFn of [PROXY, PROXY2]) {
    try {
      const res = await fetch(proxyFn(src.feed), { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const text = await res.text();
      let xmlStr;
      try { const j = JSON.parse(text); xmlStr = j.contents || j.data || text } catch { xmlStr = text }
      if (!xmlStr || xmlStr.length < 100) continue;
      const items = parseXML(xmlStr);
      if (!items.length) continue;
      return items.map(a => ({ ...a, source: src.name, color: src.color }));
    } catch { }
  }
  return []
}

function heat(ms) {
  if (ms < 2 * 3600000) return { c: '#ffaa00', o: '1' };
  if (ms < 8 * 3600000) return { c: '#e8ff47', o: '0.8' };
  if (ms < 24 * 3600000) return { c: '#b8ff47', o: '0.45' };
  return { c: 'transparent', o: '0' }
}

function cardClass(i) {
  if (i === 0) return 'c-hero';
  if (i === 1 || i === 2) return 'c-tall';
  if (i >= 3 && i <= 5) return 'c-third';
  if (i % 3 === 0) return 'c-wide';
  return 'c-sm'
}

function buildCard(a, i, isNew) {
  const h = heat(a.age);
  const cls = cardClass(i);
  const isHot = a.age < 3 * 3600000;
  const showDesc = (cls === 'c-hero' || cls === 'c-tall' || cls === 'c-wide') && a.desc;
  const card = document.createElement('a');
  card.href = a.url; card.target = '_blank'; card.rel = 'noopener noreferrer';
  card.className = 'card ' + cls + (isNew ? ' card-new' : '');
  card.dataset.url = a.url;
  card.style.setProperty('--hc', h.c);
  card.style.setProperty('--ho', h.o);
  card.style.setProperty('--sc2', a.color);
  const body = `
    <div class="src"><div class="sdot"></div>${a.source}</div>
    <div class="ctitle">${a.title}</div>
    ${showDesc ? `<div class="cdesc">${a.desc}</div>` : ''}
    <div class="cmeta">
      <span class="cage">${fmtAge(a.age)}</span>
      ${a.date ? `<span class="ms">·</span><span>${new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>` : ''}
    </div>`;
  card.innerHTML = `<div class="arr">↗</div>${cls === 'c-wide' ? `<div class="wb">${body}</div>` : body}`;
  return card
}

function skeleton() {
  document.getElementById('container').innerHTML = `
    <div class="sgrid">
      <div class="sk" style="grid-column:span 7;min-height:260px"></div>
      <div class="sk" style="grid-column:span 5;min-height:260px"></div>
      <div class="sk" style="grid-column:span 5;min-height:128px"></div>
      <div class="sk" style="grid-column:span 7;min-height:128px"></div>
      <div class="sk" style="grid-column:span 4;min-height:140px"></div>
      <div class="sk" style="grid-column:span 4;min-height:140px"></div>
      <div class="sk" style="grid-column:span 4;min-height:140px"></div>
    </div>`
}

function updateTicker(articles) {
  const t = document.getElementById('ticker');
  const items = articles.slice(0, 16).map(a => `${a.source.toUpperCase()}: ${a.title}`);
  t.innerHTML = [...items, ...items].map(s => `<span>▶ ${s}</span>`).join('')
}

function renderOrDiff(articles, forceFullRender) {
  const el = document.getElementById('container');
  if (!articles.length) {
    el.innerHTML = `<div class="sgrid"><div class="status">
      <h2>NO STORIES LOADED</h2>
      <p>Could not reach RSS feeds. The proxy services may be temporarily down. Check your network and retry.</p>
      <button onclick="loadAll(true)">↻ RETRY</button>
    </div></div>`;
    return
  }

  if (forceFullRender || !el.querySelector('.grid')) {
    const grid = document.createElement('div');
    grid.className = 'grid';
    articles.forEach((a, i) => {
      const card = buildCard(a, i, false);
      card.style.opacity = '0';
      card.style.transform = 'translateY(8px)';
      card.style.transition = `opacity .3s ease ${i * .04}s, transform .3s ease ${i * .04}s, background .2s`;
      grid.appendChild(card)
    });
    el.innerHTML = '';
    el.appendChild(grid);
    requestAnimationFrame(() => {
      grid.querySelectorAll('.card').forEach(c => { c.style.opacity = '1'; c.style.transform = 'translateY(0)' })
    });
    knownUrls = new Set(articles.map(a => a.url));
    return
  }

  const existingCards = Array.from(el.querySelectorAll('.card'));
  const newUrls = new Set(articles.map(a => a.url));
  let changed = 0;

  articles.forEach((a, i) => {
    if (knownUrls.has(a.url)) return;
    const oldCard = existingCards[i];
    const newCard = buildCard(a, i, true);
    newCard.style.transition = 'background .2s';
    if (oldCard) { oldCard.parentNode.replaceChild(newCard, oldCard) }
    changed++
  });

  if (changed >= 4) { renderOrDiff(articles, true); return }
  knownUrls = newUrls
}

async function loadAll(forceFullRender = false) {
  const btn = document.getElementById('btn');
  btn.disabled = true; btn.textContent = '↻';

  if (isFirstLoad || forceFullRender) skeleton();

  const results = await Promise.allSettled(SOURCES.map(fetchFeed));
  let articles = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  const seen = new Set();
  articles = articles.filter(a => { if (!a.url || seen.has(a.url)) return false; seen.add(a.url); return true });

  articles = articles
    .filter(a => a.age < 72 * 3600000 && a.title)
    .sort((a, b) => a.age - b.age)
    .slice(0, 20);

  renderOrDiff(articles, isFirstLoad || forceFullRender);

  if (articles.length) updateTicker(articles);

  isFirstLoad = false;
  btn.disabled = false; btn.textContent = '↻ REFRESH';

  document.getElementById('upd').textContent =
    'UPDATED ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  document.getElementById('count').textContent =
    articles.length ? articles.length + ' STORIES' : ''
}

document.getElementById('dateStr').textContent =
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).toUpperCase();

loadAll();

const REFRESH_MS = 5 * 60 * 1000;
let countdownEnd = Date.now() + REFRESH_MS;
setInterval(() => {
  const rem = Math.max(0, countdownEnd - Date.now());
  const m = Math.floor(rem / 60000);
  const s = Math.floor((rem % 60000) / 1000);
  const el = document.getElementById('countdown');
  if (el) el.textContent = `UPDATE IN ${m}:${String(s).padStart(2, '0')}`;
}, 1000);

setInterval(() => {
  loadAll(false);
  countdownEnd = Date.now() + REFRESH_MS;
}, REFRESH_MS);