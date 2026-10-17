import { appAlert, appFrame } from '../lib/appDialog';

const NATIVE_PICKERS = new Set(['date', 'datetime-local', 'time', 'month', 'week']);

function neutralizePicker(el: HTMLInputElement) {
  const kind = el.type;
  el.type = 'text';
  el.inputMode = 'numeric';
  if (!el.placeholder) {
    el.placeholder = kind === 'datetime-local' ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD';
  }
}

/**
 * Android WebView closes the APK when a native picker, new window, or a form
 * reload starts. Keep those gestures inside the page.
 */
export function preventNativeCrashes() {
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (target instanceof HTMLInputElement && NATIVE_PICKERS.has(target.type)) {
        event.preventDefault();
        neutralizePicker(target);
        target.focus();
      }
    },
    true,
  );

  document.addEventListener(
    'click',
    (event) => {
      const node = event.target instanceof Element ? event.target : null;
      const anchor = node?.closest('a[target="_blank"]');
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return;
      event.preventDefault();
      event.stopPropagation();
      void appFrame(anchor.href);
    },
    true,
  );

  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.getAttribute('action')) return;
      event.preventDefault();
    },
    true,
  );

  window.alert = (message?: unknown) => {
    void appAlert(String(message ?? ''));
  };
  window.confirm = () => false;
  window.prompt = () => null;
}
