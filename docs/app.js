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

// ============================================================
//  情報を追加（GitHub連携で user_topics.json を編集）
// ============================================================
const GH_OWNER = 'sugawara-ship-it';
const GH_REPO = 'mynews';
const GH_FILE = 'user_topics.json';
const TOKEN_KEY = 'mynews_gh_token';

const fab = document.getElementById('fab');
const sheet = document.getElementById('sheet');
const sheetClose = document.getElementById('sheetClose');
const addForm = document.getElementById('addForm');
const userList = document.getElementById('userList');
const tokenInput = document.getElementById('tokenInput');
const saveTokenBtn = document.getElementById('saveToken');
const tokenNotice = document.getElementById('tokenNotice');
const openSettingsBtn = document.getElementById('openSettings');
const settings = document.getElementById('settings');
const catList = document.getElementById('catList');

let GH_SHA = null;            // user_topics.json の現在のsha
let USER_TOPICS = [];         // 現在の追加トピック

const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, ms);
}

function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64decode(b64) { return decodeURIComponent(escape(atob(b64.replace(/\n/g, '')))); }

async function ghGet() {
  const token = getToken();
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  const res = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}?_=${Date.now()}`,
    { headers, cache: 'no-store' }
  );
  if (!res.ok) throw new Error('読み込み失敗 (' + res.status + ')');
  const j = await res.json();
  GH_SHA = j.sha;
  const obj = JSON.parse(b64decode(j.content));
  return obj.topics || [];
}

async function ghPut(topics, message) {
  const token = getToken();
  if (!token) throw new Error('トークン未設定');
  const body = {
    message,
    content: b64encode(JSON.stringify({ topics }, null, 2) + '\n'),
    sha: GH_SHA,
  };
  const res = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`,
    { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || ('保存失敗 (' + res.status + ')'));
  }
  const j = await res.json();
  GH_SHA = j.content.sha;
}

function renderUserList() {
  if (!USER_TOPICS.length) {
    userList.innerHTML = '<p class="muted">まだ追加された情報はありません。</p>';
    return;
  }
  userList.innerHTML = '';
  USER_TOPICS.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'u-item';
    div.innerHTML = `
      <div class="u-main">
        <div class="u-name">${escapeHtml(t.emoji || '📰')} ${escapeHtml(t.name)} <span class="muted">(${escapeHtml(t.category || '')})</span></div>
        <div class="u-q">${escapeHtml((t.queries || []).join(' / '))}</div>
      </div>
      <button class="u-del" data-i="${i}">削除</button>`;
    userList.appendChild(div);
  });
  userList.querySelectorAll('.u-del').forEach((b) => {
    b.onclick = () => deleteTopic(parseInt(b.dataset.i, 10));
  });
}

function fillCategories() {
  const cats = new Set(['音楽', '不動産', '地域', '武道', '経済', 'テック']);
  (DATA?.categories || []).forEach((c) => cats.add(c));
  catList.innerHTML = [...cats].map((c) => `<option value="${escapeHtml(c)}">`).join('');
}

function updateTokenUI() {
  const has = !!getToken();
  tokenNotice.hidden = has;
  addForm.style.opacity = has ? '1' : '.45';
  addForm.style.pointerEvents = has ? 'auto' : 'none';
}

async function openSheet() {
  sheet.hidden = false;
  fillCategories();
  updateTokenUI();
  if (getToken()) {
    userList.innerHTML = '<p class="muted">読み込み中…</p>';
    try {
      USER_TOPICS = await ghGet();
      renderUserList();
    } catch (e) {
      userList.innerHTML = `<p class="muted">読み込めませんでした：${escapeHtml(e.message)}</p>`;
    }
  } else {
    USER_TOPICS = [];
    renderUserList();
  }
}

function closeSheet() { sheet.hidden = true; }

fab.onclick = openSheet;
sheetClose.onclick = closeSheet;
openSettingsBtn.onclick = () => { settings.open = true; settings.scrollIntoView({ behavior: 'smooth' }); tokenInput.focus(); };

saveTokenBtn.onclick = () => {
  const v = tokenInput.value.trim();
  if (!v) { toast('トークンを入力してください'); return; }
  localStorage.setItem(TOKEN_KEY, v);
  tokenInput.value = '';
  updateTokenUI();
  toast('トークンを保存しました');
  openSheet();
};

addForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!getToken()) { toast('先にトークンを設定してください'); return; }
  const fd = new FormData(addForm);
  const queries = String(fd.get('queries')).split('\n').map((s) => s.trim()).filter(Boolean);
  if (!queries.length) { toast('キーワードを入力してください'); return; }
  const topic = {
    name: String(fd.get('name')).trim(),
    category: String(fd.get('category')).trim() || 'その他',
    emoji: String(fd.get('emoji')).trim() || '📰',
    enabled: true,
    queries,
  };
  const btn = addForm.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = '追加中…';
  try {
    if (GH_SHA === null) await ghGet();   // 念のため最新shaを取得
    const next = [...USER_TOPICS, topic];
    await ghPut(next, 'add topic: ' + topic.name);
    USER_TOPICS = next;
    renderUserList();
    addForm.reset();
    toast('追加しました！次回更新から収集されます');
  } catch (err) {
    toast('エラー：' + err.message, 4000);
  } finally {
    btn.disabled = false; btn.textContent = 'この情報を追加する';
  }
};

async function deleteTopic(i) {
  if (!confirm('「' + USER_TOPICS[i].name + '」を削除しますか？')) return;
  try {
    const next = USER_TOPICS.filter((_, idx) => idx !== i);
    await ghPut(next, 'remove topic');
    USER_TOPICS = next;
    renderUserList();
    toast('削除しました');
  } catch (err) {
    toast('エラー：' + err.message, 4000);
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

load();
