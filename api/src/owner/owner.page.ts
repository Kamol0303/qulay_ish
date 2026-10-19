import { OWNER_PATH } from './owner.constants';
import type { LedgerItem, OwnerFeedItem } from './platform-gate.service';
import { meter, som, type GateSnapshot } from './platform-gate.policy';

const LABELS = {
  admin: 'Admin paneli',
  superAdmin: 'Super admin paneli',
} as const;

const STATUS_LABEL: Record<string, string> = {
  sending: 'Yuborilmoqda',
  sent: 'Yuborildi',
  error: 'Xato',
  short: 'Balans yetmadi',
};

const PURPOSE_LABEL: Record<string, string> = {
  login: 'Kirish',
  register: "Ro'yxat",
  reset: 'Parol',
  payment: "To'lov",
  notice: 'Bildirishnoma',
};

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stateLabel(state: GateSnapshot['state']): string {
  if (state === 'paused') return "To'xtatilgan";
  if (state === 'off') return 'Yopiq';
  if (state === 'removed') return "O'chirilgan";
  return 'Ishlayapti';
}

function stateTone(state: GateSnapshot['state']): string {
  if (state === 'live') return 'ok';
  if (state === 'paused') return 'low';
  return 'due';
}

function dayText(days: number | null): string {
  if (days == null) return 'sana yo‘q';
  if (days < 0) return 'Tugagan';
  return `${days} kun`;
}

function dayTone(days: number | null, billing: GateSnapshot['billing']): string {
  if (billing === 'free') return 'ok';
  if (days == null) return 'low';
  if (days < 0 || days <= 3) return 'due';
  if (days <= 7) return 'low';
  return 'ok';
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function untilText(iso: string | null): string {
  if (!iso) return 'sana yo‘q';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'sana yo‘q';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function renderOwnerPage(opts: {
  authed: boolean;
  snap: GateSnapshot | null;
  feed?: OwnerFeedItem[];
  ledger?: LedgerItem[];
  subscription?: { until: string | null; days: number | null };
  error?: string;
}): string {
  const error = opts.error ? `<p class="err">${esc(opts.error)}</p>` : '';
  const body = opts.authed && opts.snap
    ? panel(opts.snap, opts.feed || [], opts.ledger || [], opts.subscription || { until: null, days: null }, error)
    : login(error);
  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Boshqaruv</title>
<script>try{var t=localStorage.getItem('desk-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<style>
  :root {
    color-scheme: light;
    --bg: #f3f5f8;
    --card: #ffffff;
    --text: #172033;
    --muted: #5d6b7c;
    --line: #e4e9f0;
    --ok: #0e9f6e;
    --ok-bg: #e7f7f0;
    --low: #b7791f;
    --low-bg: #fff6df;
    --due: #c2413a;
    --due-bg: #fdeceb;
    --info: #1d4f91;
    --info-bg: #e8f1ff;
    --accent: #1f6f54;
    --shadow: 0 12px 32px rgba(23, 32, 51, 0.06);
    --radius: 18px;
  }
  [data-theme="dark"] {
    color-scheme: dark;
    --bg: #10151c;
    --card: #1a212c;
    --text: #f4f7fb;
    --muted: #a9b4c2;
    --line: #2c3644;
    --ok-bg: #14352b;
    --low-bg: #3a2e14;
    --due-bg: #3a1d1c;
    --info-bg: #17283f;
    --accent: #8fd0b4;
    --shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--text); font: 16px/1.45 "Segoe UI", system-ui, sans-serif; }
  main { max-width: 1120px; margin: 0 auto; padding: 20px 16px 72px; }
  h1 { font-size: 28px; line-height: 1.15; margin: 0; letter-spacing: -0.03em; }
  h2 { font-size: 16px; margin: 0 0 12px; }
  button, input, select { font: inherit; color: inherit; }
  button { border: 0; border-radius: 999px; padding: 10px 14px; background: var(--text); color: var(--bg); font-weight: 700; cursor: pointer; }
  button.on { background: var(--accent); color: #fff; }
  button.warn { background: var(--due); color: #fff; }
  button.ghost { background: transparent; color: var(--text); border: 1px solid var(--line); }
  button:disabled { opacity: 0.45; cursor: default; }
  input[type="text"], input[type="password"], input[type="number"], select {
    width: 100%; padding: 11px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); }
  label { display: block; font-size: 13px; color: var(--muted); margin: 0 0 6px; }
  .top { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 14px; }
  .top-actions { display: flex; gap: 8px; align-items: center; }
  .status { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
  .pill { background: var(--card); border-radius: 16px; padding: 12px 14px; box-shadow: var(--shadow); border: 1px solid var(--line); }
  .pill b { display: block; margin-top: 4px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); }
  .card.danger { border-color: #e7b7b3; }
  .note { color: var(--muted); font-size: 14px; margin: 8px 0 0; }
  .err { background: var(--due-bg); color: var(--due); border-radius: 12px; padding: 10px 12px; }
  .pair, .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .row { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); }
  .money { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; margin-top: 12px; }
  .money input { flex: 1; min-width: 120px; width: auto; }
  .figure { font-size: 22px; font-weight: 750; letter-spacing: -0.03em; margin: 4px 0; }
  .bar { height: 8px; border-radius: 99px; background: var(--line); overflow: hidden; margin-top: 8px; }
  .bar > span { display: block; height: 100%; background: var(--ok); }
  .tone-low .bar > span, .tag.low { background: var(--low); }
  .tone-due .bar > span { background: var(--due); }
  .pill .tag { display: inline-flex; width: auto; }
  .tag { display: inline-flex; border-radius: 999px; padding: 2px 8px; font-size: 12px; font-weight: 750; background: var(--ok-bg); color: var(--ok); }
  .tag.low { background: var(--low-bg); color: var(--low); }
  .tag.due { background: var(--due-bg); color: var(--due); }
  .tag.info { background: var(--info-bg); color: var(--info); }
  .banner { margin-top: 10px; border-radius: 12px; padding: 8px 10px; font-size: 14px; font-weight: 650; }
  .banner.low { background: var(--low-bg); color: var(--low); }
  .banner.due { background: var(--due-bg); color: var(--due); }
  .filters { display: grid; grid-template-columns: 1.4fr 0.8fr 0.8fr auto; gap: 8px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 8px 6px; border-top: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-size: 12px; font-weight: 700; }
  code { font: 14px ui-monospace, monospace; }
  .pager { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 10px; }
  .modal { position: fixed; inset: 0; background: rgba(16, 20, 26, 0.46); display: flex; align-items: flex-end; justify-content: center; padding: 16px; z-index: 20; }
  .sheet { width: min(440px, 100%); background: var(--card); color: var(--text); border-radius: 20px; padding: 18px; box-shadow: var(--shadow); }
  .toast { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); background: var(--text); color: var(--bg); border-radius: 999px; padding: 10px 16px; font-weight: 750; opacity: 0; pointer-events: none; transition: opacity .2s; z-index: 30; }
  .toast.show { opacity: 1; }
  .login { max-width: 420px; margin: 8vh auto 0; }
  @media (min-width: 800px) { .modal { align-items: center; } }
  @media (max-width: 800px) {
    .status, .grid, .filters { grid-template-columns: 1fr; }
    h1 { font-size: 24px; }
  }
</style>
</head>
<body>
<main>
${body}
</main>
<div id="toast" class="toast" role="status"></div>
</body>
</html>`;
}

function login(error: string): string {
  return `<div class="login">
  <h1>Boshqaruv</h1>
  <p class="note">Shaxsiy kirish</p>
  <form class="login card" method="post" action="${OWNER_PATH}">
    ${error}
    <input type="hidden" name="action" value="login">
    <label for="phone">Telefon</label>
    <input id="phone" name="phone" type="text" inputmode="tel" autocomplete="username" required>
    <label for="password">Parol</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <div class="actions" style="margin-top:16px"><button type="submit">Kirish</button></div>
  </form>
</div>`;
}

function moneyForm(name: string, label: string, value: number): string {
  return `<form method="post" action="${OWNER_PATH}" class="money">
    <div style="flex:1;min-width:140px">
      <label>${esc(label)}</label>
      <input name="value" type="number" min="0" step="1" value="${value}" required>
    </div>
    <input type="hidden" name="action" value="money">
    <input type="hidden" name="name" value="${name}">
    <button type="submit">Saqlash</button>
  </form>`;
}

function meterBlock(kind: 'otp' | 'ai', credit: number, price: number): string {
  const view = meter(credit, price);
  const title = kind === 'otp' ? 'OTP' : "Sun'iy intellekt";
  const unit = kind === 'otp' ? 'SMS' : "so'rov";
  let banner = '';
  if (view.tone === 'due') {
    banner = `<div class="banner due" data-banner="${kind}">${kind === 'otp' ? "OTP to'lovi yaqin: to'lovni amalga oshiring" : "Sun'iy intellekt to'lovi yaqin: to'lovni amalga oshiring"}</div>`;
  } else if (view.tone === 'low') {
    banner = `<div class="banner low" data-banner="${kind}">${title} qoldig‘i oz: taxminan ${view.left} ta ${unit} qoldi.</div>`;
  }
  const caption = view.tone === 'free'
    ? 'Tekin'
    : view.left == null
      ? ''
      : `${view.left} ta ${unit}`;
  return `<div class="card tone-${view.tone}" id="card-${kind}">
    <h2>${title}</h2>
    <div class="figure" data-credit="${kind}">${esc(som(credit))}</div>
    <div class="note" data-caption="${kind}">Narx ${esc(som(price))} · ${esc(caption)}</div>
    <div class="bar" aria-hidden="true"><span data-bar="${kind}" style="width:${view.pct}%"></span></div>
    ${banner}
    ${moneyForm(kind === 'otp' ? 'otpPrice' : 'aiPrice', `${title} narxi`, price)}
    ${moneyForm(kind === 'otp' ? 'otpCredit' : 'aiCredit', kind === 'otp' ? 'OTP qoldiq' : "Sun'iy intellekt qoldiq", credit)}
  </div>`;
}

function panel(
  snap: GateSnapshot,
  feed: OwnerFeedItem[],
  ledger: LedgerItem[],
  subscription: { until: string | null; days: number | null },
  error: string,
): string {
  const sections = (['admin', 'superAdmin'] as const).map((key) => {
    const open = snap.sections[key];
    return `<div class="row">
      <div><strong>${esc(LABELS[key])}</strong><div class="note">${open ? 'ochiq' : 'yopiq'}</div></div>
      <form method="post" action="${OWNER_PATH}">
        <input type="hidden" name="action" value="section">
        <input type="hidden" name="name" value="${key}">
        <input type="hidden" name="value" value="${open ? 'off' : 'on'}">
        <button type="submit" class="${open ? 'ghost' : 'on'}">${open ? 'Yopish' : 'Ochish'}</button>
      </form>
    </div>`;
  }).join('');

  const presence = (value: string, label: string, danger = false) => {
    const on = snap.state === value ? ' on' : '';
    return `<form method="post" action="${OWNER_PATH}" ${danger ? 'data-danger="1"' : ''}>
      <input type="hidden" name="action" value="presence">
      <input type="hidden" name="value" value="${value}">
      ${danger ? '<label class="note"><input type="checkbox" name="confirm" value="yes" required> Admin va super admin paneli yopiladi.</label>' : ''}
      <button type="submit" class="${danger ? 'warn' : (on.trim() || 'ghost')}">${label}</button>
    </form>`;
  };

  const rows = feed.map((item) => `<tr>
    <td>${esc(when(item.at))}</td>
    <td>${esc(PURPOSE_LABEL[item.purpose] || 'Boshqa')}</td>
    <td>${esc(item.phone || '—')}</td>
    <td><code>${esc(item.code || '—')}</code> ${item.code ? `<button type="button" class="ghost copy" data-code="${esc(item.code)}">Nusxa</button>` : ''}</td>
    <td>${item.status ? `<span class="tag ${item.status === 'short' || item.status === 'error' ? 'due' : item.status === 'sending' ? 'info' : ''}">${esc(STATUS_LABEL[item.status] || item.status)}</span>` : '—'}</td>
  </tr>`).join('');

  const ledgerRows = ledger.length
    ? ledger.map((item) => {
        const sign = item.amountSom > 0 ? '+' : '−';
        const amount = `${sign}${som(Math.abs(item.amountSom))}`;
        return `<tr>
          <td>${esc(when(item.at))}</td>
          <td>${item.actor === 'system' ? 'Tizim' : 'Egasi'}</td>
          <td>${item.kind === 'ai' ? "Sun'iy intellekt" : 'OTP'}</td>
          <td>${esc(amount)}</td>
          <td>${esc(som(item.balanceSom))}</td>
          <td>${esc(item.reason)}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="6">Hali yozuv yo‘q.</td></tr>';

  const balance = snap.smsBalance == null ? 'hali yo‘q' : som(snap.smsBalance);
  const boot = JSON.stringify({ snap, feed, ledger, subscription }).replace(/</g, '\\u003c');
  const daysTone = dayTone(subscription.days, snap.billing);

  return `${error}
  <div class="top">
    <div>
      <h1>Boshqaruv</h1>
      <p class="note">Mehrli qo'llar</p>
    </div>
    <div class="top-actions">
      <button type="button" class="ghost" id="theme">Tungi</button>
      <form method="post" action="${OWNER_PATH}">
        <input type="hidden" name="action" value="logout">
        <button type="submit" class="ghost">Chiqish</button>
      </form>
    </div>
  </div>
  <section class="status" id="status-bar">
    <div class="pill"><span class="note">Panellar holati</span><b class="tag ${stateTone(snap.state)}" id="state-tag">${esc(stateLabel(snap.state))}</b></div>
    <div class="pill"><span class="note">Rejim</span><b id="billing-tag">${snap.billing === 'free' ? 'Bepul' : 'Pullik'}</b></div>
    <div class="pill"><span class="note">Obuna tugashi</span><b class="tag ${daysTone}" id="days-tag">${esc(untilText(subscription.until))} · ${esc(dayText(subscription.days))}</b></div>
  </section>
  <div class="grid">
    <section class="card">
      <h2>Admin panellar boshqaruvi</h2>
      <div class="actions">
        ${presence('live', 'Ishga tushirish')}
        ${presence('paused', "To'xtatish")}
        <form method="post" action="${OWNER_PATH}">
          <input type="hidden" name="action" value="restore">
          <button type="submit" class="ghost">Tiklash</button>
        </form>
      </div>
      ${sections}
      <p class="note">To'xtatish faqat admin va super admin panelini yopadi. Ishchi va buyurtmachi ishlayveradi.</p>
    </section>
    <section class="card">
      <h2>Narxlar</h2>
      <div class="pair">
        <form method="post" action="${OWNER_PATH}">
          <input type="hidden" name="action" value="billing">
          <input type="hidden" name="value" value="free">
          <button type="submit" class="${snap.billing === 'free' ? 'on' : 'ghost'}">Bepul</button>
        </form>
        <form method="post" action="${OWNER_PATH}">
          <input type="hidden" name="action" value="billing">
          <input type="hidden" name="value" value="paid">
          <button type="submit" class="${snap.billing === 'paid' ? 'on' : 'ghost'}">Pullik</button>
        </form>
      </div>
      <p class="note">Pullik rejimda obuna tugasa admin va super admin paneli to'xtaydi. Bepul rejimda ochiq.</p>
      ${moneyForm('staff', 'Admin va super admin narxi', snap.staffPriceSom)}
    </section>
    ${meterBlock('otp', snap.otpCreditSom, snap.otpPriceSom)}
    ${meterBlock('ai', snap.aiCreditSom, snap.aiPriceSom)}
    <section class="card">
      <h2>Provayderdagi SMS qoldiq</h2>
      <div class="figure" id="sms-balance">${esc(balance)}</div>
      <p class="note">Bu provayder hisobidagi qoldiq. OTP qoldig‘idan alohida.</p>
    </section>
    <section class="card danger">
      <h2>Xavfli zona</h2>
      <p class="note">Yopish va o'chirish faqat admin va super admin panelini yopadi. Ishchi va buyurtmachi ishlayveradi.</p>
      <div class="actions" style="margin-top:12px">
        ${presence('off', 'Yopish', true)}
        <form method="post" action="${OWNER_PATH}" data-danger="1">
          <input type="hidden" name="action" value="presence">
          <input type="hidden" name="value" value="removed">
          <label class="note"><input type="checkbox" name="confirm" value="yes" required> Admin va super admin paneli yopiladi.</label>
          <button type="submit" class="warn">O'chirish</button>
        </form>
      </div>
    </section>
  </div>
  <section class="card" style="margin-top:14px">
    <h2>Kodlar jurnali</h2>
    <div class="filters">
      <input id="q" type="text" placeholder="Telefon yoki kod">
      <select id="purpose">
        <option value="">Barcha tur</option>
        <option value="login">Kirish</option>
        <option value="register">Ro'yxat</option>
        <option value="reset">Parol</option>
        <option value="payment">To'lov</option>
        <option value="notice">Bildirishnoma</option>
      </select>
      <select id="status">
        <option value="">Barcha holat</option>
        <option value="sent">Yuborildi</option>
        <option value="sending">Yuborilmoqda</option>
        <option value="error">Xato</option>
        <option value="short">Balans yetmadi</option>
      </select>
      <button type="button" class="ghost" id="sort">Yangi</button>
    </div>
    <table>
      <thead><tr><th>Sana</th><th>Tur</th><th>Telefon</th><th>Kod</th><th>Holat</th></tr></thead>
      <tbody id="feed-body">${rows || '<tr><td colspan="5">Hali kod yo‘q.</td></tr>'}</tbody>
    </table>
    <div class="pager">
      <button type="button" class="ghost" id="prev">Oldingi</button>
      <span class="note" id="page-label"></span>
      <button type="button" class="ghost" id="next">Keyingi</button>
    </div>
  </section>
  <section class="card" style="margin-top:14px">
    <h2>Qoldiq jurnali</h2>
    <table>
      <thead><tr><th>Sana</th><th>Kim</th><th>Xizmat</th><th>Qancha</th><th>Qoldiq</th><th>Sabab</th></tr></thead>
      <tbody id="ledger-body">${ledgerRows}</tbody>
    </table>
  </section>
  <div id="modal" class="modal" hidden>
    <div class="sheet" role="dialog" aria-modal="true">
      <h2 id="modal-title"></h2>
      <p class="note" id="modal-need"></p>
      <p class="note" id="modal-credit"></p>
      <form method="post" action="${OWNER_PATH}" id="pay-form">
        <input type="hidden" name="action" value="topup">
        <input type="hidden" name="name" id="pay-kind" value="otp">
        <label for="pay-amount">To'lov summasi</label>
        <input id="pay-amount" name="value" type="number" min="1" step="1" required>
        <div class="actions" style="margin-top:14px">
          <button type="submit">To'lovni amalga oshirish</button>
          <button type="button" class="ghost" id="pay-later">Keyinroq</button>
        </div>
      </form>
    </div>
  </div>
  <div id="confirm" class="modal" hidden>
    <div class="sheet" role="dialog" aria-modal="true">
      <h2>Panellar yopilsinmi?</h2>
      <p class="note">Admin va super admin paneli yopiladi. Ishchi va buyurtmachi ishlayveradi.</p>
      <div class="actions" style="margin-top:14px">
        <button type="button" class="warn" id="confirm-yes">Tasdiqlash</button>
        <button type="button" class="ghost" id="confirm-no">Bekor</button>
      </div>
    </div>
  </div>
  <script type="application/json" id="boot">${boot}</script>
  <script>${clientScript()}</script>`;
}

function clientScript(): string {
  return `(() => {
  var bootEl = document.getElementById('boot');
  if (!bootEl) return;
  var boot = JSON.parse(bootEl.textContent || '{}');
  var page = 1;
  var pageSize = 8;
  var sort = 'new';
  var pending = null;
  function som(n) {
    var v = Math.max(0, Math.floor(Number(n) || 0));
    return String(v).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ') + " so'm";
  }
  function meter(credit, price) {
    var c = Math.max(0, Math.floor(credit || 0));
    var p = Math.max(0, Math.floor(price || 0));
    if (!p) return { tone: 'free', left: null, pct: 100 };
    var left = Math.floor(c / p);
    if (left < 1) return { tone: 'due', left: 0, pct: 0 };
    if (left <= 20) return { tone: 'low', left: left, pct: Math.max(8, Math.round((left / 20) * 100)) };
    return { tone: 'ok', left: left, pct: 100 };
  }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    function z(n){ return String(n).padStart(2, '0'); }
    return z(d.getDate()) + '.' + z(d.getMonth()+1) + '.' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  function toast(text) {
    var el = document.getElementById('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  function setText(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
  function paintCard(kind, credit, price) {
    var card = document.getElementById('card-' + kind);
    if (!card) return;
    var view = meter(credit, price);
    card.className = 'card tone-' + view.tone;
    var figure = card.querySelector('[data-credit]');
    if (figure) figure.textContent = som(credit);
    var unit = kind === 'otp' ? 'SMS' : "so'rov";
    var title = kind === 'otp' ? 'OTP' : "Sun'iy intellekt";
    var caption = card.querySelector('[data-caption]');
    if (caption) caption.textContent = view.tone === 'free' ? ('Narx ' + som(price) + ' · Tekin') : ('Narx ' + som(price) + ' · ' + view.left + ' ta ' + unit);
    var bar = card.querySelector('[data-bar]');
    if (bar) bar.style.width = view.pct + '%';
    var old = card.querySelector('[data-banner]');
    if (old) old.remove();
    if (view.tone === 'due' || view.tone === 'low') {
      var banner = document.createElement('div');
      banner.className = 'banner ' + view.tone;
      banner.setAttribute('data-banner', kind);
      banner.textContent = view.tone === 'due'
        ? (kind === 'otp' ? "OTP to'lovi yaqin: to'lovni amalga oshiring" : "Sun'iy intellekt to'lovi yaqin: to'lovni amalga oshiring")
        : (title + " qoldig‘i oz: taxminan " + view.left + " ta " + unit + " qoldi.");
      var form = card.querySelector('form');
      card.insertBefore(banner, form);
    }
    var inputs = card.querySelectorAll('input[name="value"]');
    if (inputs[0]) inputs[0].value = price;
    if (inputs[1]) inputs[1].value = credit;
  }
  function paintSnap(snap) {
    if (!snap) return;
    boot.snap = snap;
    var state = snap.state === 'paused' ? "To'xtatilgan" : snap.state === 'off' ? 'Yopiq' : snap.state === 'removed' ? "O'chirilgan" : 'Ishlayapti';
    var tag = document.getElementById('state-tag');
    if (tag) {
      tag.textContent = state;
      tag.className = 'tag ' + (snap.state === 'live' ? 'ok' : snap.state === 'paused' ? 'low' : 'due');
    }
    setText('billing-tag', snap.billing === 'free' ? 'Bepul' : 'Pullik');
    setText('sms-balance', snap.smsBalance == null ? 'hali yo‘q' : som(snap.smsBalance));
    paintCard('otp', snap.otpCreditSom, snap.otpPriceSom);
    paintCard('ai', snap.aiCreditSom, snap.aiPriceSom);
  }
  function purposeLabel(v) {
    return { login: 'Kirish', register: "Ro'yxat", reset: 'Parol', payment: "To'lov", notice: 'Bildirishnoma' }[v] || 'Boshqa';
  }
  function statusLabel(v) {
    return { sending: 'Yuborilmoqda', sent: 'Yuborildi', error: 'Xato', short: 'Balans yetmadi' }[v] || '—';
  }
  function rows() {
    var q = (document.getElementById('q').value || '').toLowerCase();
    var purpose = document.getElementById('purpose').value;
    var status = document.getElementById('status').value;
    var list = (boot.feed || []).filter(function (item) {
      if (purpose && item.purpose !== purpose) return false;
      if (status && item.status !== status) return false;
      var blob = (item.phone + ' ' + item.code).toLowerCase();
      return !q || blob.indexOf(q) >= 0;
    });
    list.sort(function (a, b) {
      return sort === 'new' ? (a.at < b.at ? 1 : -1) : (a.at > b.at ? 1 : -1);
    });
    return list;
  }
  function paintFeed() {
    var list = rows();
    var pages = Math.max(1, Math.ceil(list.length / pageSize));
    if (page > pages) page = pages;
    var slice = list.slice((page - 1) * pageSize, page * pageSize);
    var body = document.getElementById('feed-body');
    body.textContent = '';
    if (!slice.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = 'Hali kod yo‘q.';
      tr.appendChild(td);
      body.appendChild(tr);
    }
    slice.forEach(function (item) {
      var tr = document.createElement('tr');
      [when(item.at), purposeLabel(item.purpose), item.phone || '—'].forEach(function (text) {
        var td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      var code = document.createElement('td');
      var c = document.createElement('code');
      c.textContent = item.code || '—';
      code.appendChild(c);
      if (item.code) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ghost copy';
        btn.textContent = 'Nusxa';
        btn.setAttribute('data-code', item.code);
        code.appendChild(document.createTextNode(' '));
        code.appendChild(btn);
      }
      tr.appendChild(code);
      var st = document.createElement('td');
      if (item.status) {
        var badge = document.createElement('span');
        badge.className = 'tag ' + (item.status === 'short' || item.status === 'error' ? 'due' : item.status === 'sending' ? 'info' : '');
        badge.textContent = statusLabel(item.status);
        st.appendChild(badge);
      } else st.textContent = '—';
      tr.appendChild(st);
      body.appendChild(tr);
    });
    document.getElementById('page-label').textContent = page + ' / ' + pages;
    document.getElementById('prev').disabled = page <= 1;
    document.getElementById('next').disabled = page >= pages;
  }
  function paintLedger(list) {
    boot.ledger = list || [];
    var body = document.getElementById('ledger-body');
    body.textContent = '';
    if (!boot.ledger.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 6;
      td.textContent = 'Hali yozuv yo‘q.';
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
    boot.ledger.forEach(function (item) {
      var tr = document.createElement('tr');
      var sign = item.amountSom > 0 ? '+' : '−';
      [when(item.at), item.actor === 'system' ? 'Tizim' : 'Egasi', item.kind === 'ai' ? "Sun'iy intellekt" : 'OTP', sign + som(Math.abs(item.amountSom)), som(item.balanceSom), item.reason].forEach(function (text) {
        var td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }
  function openPay(prompt) {
    if (!prompt) return;
    document.getElementById('modal-title').textContent = prompt.title;
    document.getElementById('modal-need').textContent = 'Kerakli summa: ' + som(prompt.need);
    document.getElementById('modal-credit').textContent = 'Joriy qoldiq: ' + som(prompt.credit);
    document.getElementById('pay-kind').value = prompt.kind;
    document.getElementById('pay-amount').value = prompt.need;
    document.getElementById('modal').hidden = false;
  }
  function send(form) {
    var body = new URLSearchParams(new FormData(form));
    body.set('format', 'json');
    return fetch(form.action, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    }).then(function (res) { return res.json().then(function (data) { data._status = res.status; return data; }); })
      .then(function (data) {
        if (!data.ok) { toast(data.error || "Saqlab bo'lmadi"); return; }
        toast(data.message || 'Saqlandi');
        paintSnap(data.snap);
        boot.feed = data.feed || [];
        paintFeed();
        paintLedger(data.ledger || []);
        document.getElementById('modal').hidden = true;
        if (data.prompt) openPay(data.prompt);
      })
      .catch(function () { toast("Saqlab bo'lmadi"); });
  }
  document.addEventListener('submit', function (event) {
    var form = event.target;
    var action = form.querySelector && form.querySelector('input[name="action"]');
    if (!form || !form.action || form.classList.contains('login')) return;
    if (action && action.value === 'logout') return;
    event.preventDefault();
    if (form.dataset.danger && !form.dataset.confirmed) {
      pending = form;
      document.getElementById('confirm').hidden = false;
      return;
    }
    form.dataset.confirmed = '';
    send(form);
  });
  document.getElementById('confirm-yes').onclick = function () {
    if (!pending) return;
    var box = pending.querySelector('input[name="confirm"]');
    if (box) box.checked = true;
    pending.dataset.confirmed = '1';
    document.getElementById('confirm').hidden = true;
    var form = pending;
    pending = null;
    send(form);
  };
  document.getElementById('confirm-no').onclick = function () {
    pending = null;
    document.getElementById('confirm').hidden = true;
  };
  document.getElementById('pay-later').onclick = function () { document.getElementById('modal').hidden = true; };
  document.getElementById('theme').onclick = function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('desk-theme', next); } catch (e) {}
    this.textContent = next === 'dark' ? 'Kunduz' : 'Tungi';
  };
  if (document.documentElement.getAttribute('data-theme') === 'dark') document.getElementById('theme').textContent = 'Kunduz';
  document.getElementById('q').addEventListener('input', function () { page = 1; paintFeed(); });
  document.getElementById('purpose').addEventListener('change', function () { page = 1; paintFeed(); });
  document.getElementById('status').addEventListener('change', function () { page = 1; paintFeed(); });
  document.getElementById('sort').onclick = function () {
    sort = sort === 'new' ? 'old' : 'new';
    this.textContent = sort === 'new' ? 'Yangi' : 'Eski';
    paintFeed();
  };
  document.getElementById('prev').onclick = function () { page -= 1; paintFeed(); };
  document.getElementById('next').onclick = function () { page += 1; paintFeed(); };
  document.addEventListener('click', function (event) {
    var btn = event.target.closest && event.target.closest('.copy');
    if (!btn) return;
    var text = btn.getAttribute('data-code') || '';
    var done = function () { toast('Nusxa olindi'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(done);
    else done();
  });
  paintFeed();
})();`;
}
