'use strict';

const feedEl = document.getElementById('feed');
const tabsEl = document.getElementById('tabs');
const updatedEl = document.getElementById('updated');
const refreshBtn = document.getElementById('refreshBtn');

let DATA = null;
let activeCat = 'すべて';

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return `${d}日前`;
}

function fmtUpdated(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `最終更新 ${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderTabs() {
  const cats = ['すべて', ...(DATA.categories || [])];
  tabsEl.innerHTML = '';
  cats.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'tab' + (c === activeCat ? ' active' : '');
    b.textContent = c;
    b.onclick = () => { activeCat = c; renderTabs(); renderFeed(); window.scrollTo(0, 0); };
    tabsEl.appendChild(b);
  });
}

function renderFeed() {
  const items = (DATA.items || []).filter(
    (it) => activeCat === 'すべて' || it.category === activeCat
  );
  if (!items.length) {
    feedEl.innerHTML = '<div class="empty">該当する記事がありません</div>';
    return;
  }
  feedEl.innerHTML = '';
  items.forEach((it) => {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = it.url;
    a.target = '_blank';
    a.rel = 'noopener';
    const thumb = it.image
      ? `<img class="card-thumb" loading="lazy" src="${escapeHtml(it.image)}" alt="" onerror="this.outerHTML='<div class=&quot;card-thumb placeholder&quot;>${it.emoji || '📰'}</div>'">`
      : `<div class="card-thumb placeholder">${it.emoji || '📰'}</div>`;
    a.innerHTML = `
      <div class="card-body">
        <div class="card-meta">
          <span class="chip">${it.emoji || ''} ${escapeHtml(it.category || '')}</span>
          <span>${escapeHtml(it.source || '')}</span>
          <span>·</span>
          <span>${timeAgo(it.published)}</span>
        </div>
        <p class="card-title">${escapeHtml(it.title)}</p>
        ${it.summary ? `<p class="card-summary">${escapeHtml(it.summary)}</p>` : ''}
      </div>
      ${thumb}
    `;
    feedEl.appendChild(a);
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function load() {
  refreshBtn.classList.add('spin');
  try {
    const res = await fetch('data.json?_=' + Date.now(), { cache: 'no-store' });
    DATA = await res.json();
    activeCat = (DATA.categories || []).includes(activeCat) || activeCat === 'すべて'
      ? activeCat : 'すべて';
    renderTabs();
    renderFeed();
    updatedEl.textContent = fmtUpdated(DATA.generated_at) + ` ・ ${DATA.count || 0}件`;
  } catch (e) {
    feedEl.innerHTML = '<div class="empty">データを読み込めませんでした。<br>少し待って再読み込みしてください。</div>';
  } finally {
    setTimeout(() => refreshBtn.classList.remove('spin'), 400);
  }
}

refreshBtn.onclick = load;

// 引っ張って更新（簡易）
let touchStartY = 0;
window.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchend', (e) => {
  if (window.scrollY === 0 && e.changedTouches[0].clientY - touchStartY > 90) load();
}, { passive: true });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

load();
