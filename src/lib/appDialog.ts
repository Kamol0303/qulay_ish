export type DialogRequest =
  | { kind: 'alert'; message: string; resolve: () => void }
  | { kind: 'confirm'; message: string; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; message: string; resolve: (value: string | null) => void }
  | { kind: 'frame'; url: string; resolve: () => void };

type Host = (request: DialogRequest) => void;

let host: Host | null = null;

export function bindDialogHost(next: Host | null) {
  host = next;
}

function ask(request: DialogRequest) {
  if (host) {
    host(request);
    return;
  }
  if (request.kind === 'confirm') request.resolve(false);
  else if (request.kind === 'prompt') request.resolve(null);
  else request.resolve();
}

export function appAlert(message: string): Promise<void> {
  return new Promise((resolve) => ask({ kind: 'alert', message, resolve }));
}

export function appConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => ask({ kind: 'confirm', message, resolve }));
}

export function appPrompt(message: string): Promise<string | null> {
  return new Promise((resolve) => ask({ kind: 'prompt', message, resolve }));
}

export function appFrame(url: string): Promise<void> {
  return new Promise((resolve) => ask({ kind: 'frame', url, resolve }));
}
