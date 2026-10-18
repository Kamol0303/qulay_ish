import { OWNER_PATH } from './owner.constants';
import { SECTION_KEYS, type GateSnapshot, type SectionKey } from './platform-gate.policy';

const LABELS: Record<SectionKey, string> = {
  register: "Ro'yxatdan o'tish",
  login: 'Kirish',
  workers: 'Ishchilar',
  jobs: 'Buyurtmalar',
  chat: 'Chat',
  calls: "Qo'ng'iroq",
  verification: 'Tasdiqlash',
  admin: 'Admin panel',
  superAdmin: 'Super admin panel',
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

export function renderOwnerPage(opts: {
  authed: boolean;
  snap: GateSnapshot | null;
  error?: string;
}): string {
  const error = opts.error
    ? `<p class="err">${esc(opts.error)}</p>`
    : '';
  const body = opts.authed && opts.snap ? panel(opts.snap) : login(error);
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
  input[type="text"], input[type="password"] { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid #4a4034; background: #100e0b; color: #fff; font: inherit; }
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

function panel(snap: GateSnapshot): string {
  const sections = SECTION_KEYS.map((key) => {
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

  const presence = (value: string, label: string, extra = '') => {
    const on = snap.state === value ? ' on' : '';
    return `<form method="post" action="${OWNER_PATH}">
      <input type="hidden" name="action" value="presence">
      <input type="hidden" name="value" value="${value}">
      ${extra}
      <button type="submit" class="${on.trim()}">${label}</button>
    </form>`;
  };

  return `<div class="top">
    <h1>Boshqaruv</h1>
    <form method="post" action="${OWNER_PATH}">
      <input type="hidden" name="action" value="logout">
      <button type="submit" class="warn">Chiqish</button>
    </form>
  </div>
  <p class="status">Sayt hozir: ${esc(stateLabel(snap.state))}. Rejim: ${snap.billing === 'free' ? 'bepul' : 'pullik'}.</p>
  <h2>Sayt</h2>
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
    <label class="note"><input type="checkbox" name="confirm" value="yes" required> Odamlar uchun sayt yo'qoladi. Ma'lumot saqlanadi.</label>
    <div class="actions" style="margin-top:10px"><button type="submit" class="warn">O'chirish</button></div>
  </form>
  </div>
  <h2>To'lov rejimi</h2>
  <div class="card"><div class="pair">
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
  <p class="note">Bepul rejimda super admin to'lovsiz ishlaydi. Pullik rejimda obuna muddati tugasa, super admin paneli yopiladi. Ishchi va buyurtmachiga tegmaydi.</p>
  </div>
  <h2>Bo'limlar</h2>
  <div class="card">${sections}</div>`;
}
