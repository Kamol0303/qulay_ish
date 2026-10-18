import { OWNER_PATH } from './owner.constants';
import type { OwnerFeedItem } from './platform-gate.service';
import { type GateSnapshot } from './platform-gate.policy';

const LABELS = {
  admin: 'Admin panel',
  superAdmin: 'Super admin panel',
} as const;

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

export function renderOwnerPage(opts: {
  authed: boolean;
  snap: GateSnapshot | null;
  feed?: OwnerFeedItem[];
  error?: string;
}): string {
  const error = opts.error
    ? `<p class="err">${esc(opts.error)}</p>`
    : '';
  const body = opts.authed && opts.snap ? panel(opts.snap, opts.feed || []) : login(error);
  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Boshqaruv</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: #14120e; color: #f4efe6; font: 16px/1.45 Georgia, "Times New Roman", serif; }
  main { max-width: 720px; margin: 0 auto; padding: 28px 18px 64px; }
  h1 { font-size: 28px; font-weight: 600; margin: 0 0 6px; letter-spacing: -0.03em; }
  .sub { color: #b7aa96; margin: 0 0 22px; }
  form.login, .card { background: #221e18; border: 1px solid #3a3228; border-radius: 18px; padding: 18px; }
  label { display: block; font-size: 13px; color: #d9cbb8; margin: 12px 0 6px; }
  input[type="text"], input[type="password"], input[type="number"] { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid #4a4034; background: #100e0b; color: #fff; font: inherit; }
  input[type="number"] { width: 140px; }
  button, .ghost { font: 600 14px/1.2 system-ui, sans-serif; border-radius: 999px; border: 0; padding: 10px 14px; cursor: pointer; }
  button { background: #e7d7bf; color: #211b14; }
  button.on { background: #8f6b3e; color: #fff; }
  button.warn { background: #8c3b2a; color: #fff; }
  .err { background: #3a241c; color: #ffd0c2; border-radius: 12px; padding: 10px 12px; }
  .row { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid #3a3228; }
  .row:first-child { border-top: 0; }
  .actions, .pair { display: flex; flex-wrap: wrap; gap: 8px; }
  .status { margin: 0 0 14px; color: #e7d7bf; }
  .note { color: #b7aa96; font-size: 14px; }
  .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  h2 { font-size: 18px; margin: 22px 0 10px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font: 14px/1.35 system-ui, sans-serif; }
  td { padding: 8px 6px; border-top: 1px solid #3a3228; vertical-align: top; }
  code { font: 14px ui-monospace, monospace; color: #f4efe6; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

function login(error: string): string {
  return `<h1>Boshqaruv</h1>
<p class="sub">Shaxsiy kirish</p>
<form class="login" method="post" action="${OWNER_PATH}">
  ${error}
  <input type="hidden" name="action" value="login">
  <label for="phone">Telefon</label>
  <input id="phone" name="phone" type="text" inputmode="tel" autocomplete="username" required>
  <label for="password">Parol</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <div class="actions" style="margin-top:16px"><button type="submit">Kirish</button></div>
</form>`;
}

function moneyField(name: string, label: string, value: number): string {
  return `<form method="post" action="${OWNER_PATH}" class="row">
    <div><strong>${label}</strong><div class="note">${value.toLocaleString('uz-UZ')} so'm</div></div>
    <div class="actions">
      <input type="hidden" name="action" value="money">
      <input type="hidden" name="name" value="${name}">
      <input name="value" type="number" min="0" step="1" value="${value}" required>
      <button type="submit">Saqlash</button>
    </div>
  </form>`;
}

function panel(snap: GateSnapshot, feed: OwnerFeedItem[]): string {
  const sections = (['admin', 'superAdmin'] as const).map((key) => {
    const open = snap.sections[key];
    return `<div class="row">
      <div><strong>${esc(LABELS[key])}</strong><div class="note">${open ? 'ochiq' : 'yopiq'}</div></div>
      <form method="post" action="${OWNER_PATH}">
        <input type="hidden" name="action" value="section">
        <input type="hidden" name="name" value="${key}">
        <input type="hidden" name="value" value="${open ? 'off' : 'on'}">
        <button type="submit" class="${open ? '' : 'on'}">${open ? "O'chirish" : 'Yoqish'}</button>
      </form>
    </div>`;
  }).join('');

  const presence = (value: string, label: string) => {
    const on = snap.state === value ? ' on' : '';
    return `<form method="post" action="${OWNER_PATH}">
      <input type="hidden" name="action" value="presence">
      <input type="hidden" name="value" value="${value}">
      <button type="submit" class="${on.trim()}">${label}</button>
    </form>`;
  };

  const balance = snap.smsBalance == null ? 'hali yo‘q' : `${snap.smsBalance.toLocaleString('uz-UZ')} so'm`;
  const rows = feed.length
    ? feed.map((item) => `<tr>
        <td>${esc(item.at.slice(0, 16).replace('T', ' '))}</td>
        <td>${esc(item.phone || '—')}</td>
        <td><code>${esc(item.code || '—')}</code></td>
        <td>${esc(item.detail)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4">Hali kod yo‘q.</td></tr>';

  return `<div class="top">
    <h1>Boshqaruv</h1>
    <form method="post" action="${OWNER_PATH}">
      <input type="hidden" name="action" value="logout">
      <button type="submit" class="warn">Chiqish</button>
    </form>
  </div>
  <p class="status">Panellar: ${esc(stateLabel(snap.state))}. Rejim: ${snap.billing === 'free' ? 'bepul' : 'pullik'}.</p>
  <p class="note">To'xtatish, yopish va o'chirish faqat admin va super admin panelini yopadi. Ishchi va buyurtmachi ishlayveradi.</p>
  <h2>Admin panellar</h2>
  <div class="card"><div class="actions">
    ${presence('live', 'Ishga tushirish')}
    ${presence('paused', "To'xtatish")}
    ${presence('off', 'Yopish')}
    <form method="post" action="${OWNER_PATH}">
      <input type="hidden" name="action" value="restore">
      <button type="submit">Tiklash</button>
    </form>
  </div>
  <form method="post" action="${OWNER_PATH}" style="margin-top:14px">
    <input type="hidden" name="action" value="presence">
    <input type="hidden" name="value" value="removed">
    <label class="note"><input type="checkbox" name="confirm" value="yes" required> Admin va super admin paneli yopiladi.</label>
    <div class="actions" style="margin-top:10px"><button type="submit" class="warn">O'chirish</button></div>
  </form>
  <div style="margin-top:8px">${sections}</div>
  </div>
  <h2>Narxlar</h2>
  <div class="card">
    <div class="pair" style="margin-bottom:8px">
      <form method="post" action="${OWNER_PATH}">
        <input type="hidden" name="action" value="billing">
        <input type="hidden" name="value" value="free">
        <button type="submit" class="${snap.billing === 'free' ? 'on' : ''}">Bepul</button>
      </form>
      <form method="post" action="${OWNER_PATH}">
        <input type="hidden" name="action" value="billing">
        <input type="hidden" name="value" value="paid">
        <button type="submit" class="${snap.billing === 'paid' ? 'on' : ''}">Pullik</button>
      </form>
    </div>
    <p class="note">Pullik rejimda obuna tugasa admin va super admin paneli to'xtaydi. Bepul rejimda ikkalasi ham ochiq. Oddiy foydalanuvchiga tegmaydi.</p>
    ${moneyField('staff', 'Admin va super admin narxi', snap.staffPriceSom)}
    ${moneyField('otpPrice', 'OTP narxi, har bir SMS', snap.otpPriceSom)}
    ${moneyField('otpCredit', 'OTP qoldiq', snap.otpCreditSom)}
    ${moneyField('aiPrice', "Sun'iy intellekt narxi, har bir so'rov", snap.aiPriceSom)}
    ${moneyField('aiCredit', "Sun'iy intellekt qoldiq", snap.aiCreditSom)}
    <p class="note">Provayderdagi SMS qoldiq: ${esc(balance)}. OTP narxi 0 bo'lsa SMS tekin ketadi. Qoldiq narxdan kam bo'lsa SMS ketmaydi, kod shu yerda qoladi.</p>
  </div>
  <h2>Kodlar</h2>
  <div class="card">
    <table>
      <tr><td>Vaqt</td><td>Telefon</td><td>Kod</td><td>Holat</td></tr>
      ${rows}
    </table>
  </div>`;
}
