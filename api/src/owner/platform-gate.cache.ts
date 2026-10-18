import { defaultSnapshot, type GateSnapshot } from './platform-gate.policy';

let snapshot: GateSnapshot = defaultSnapshot();

export function currentGate(): GateSnapshot {
  return snapshot;
}

export function rememberGate(next: GateSnapshot) {
  snapshot = next;
}

export function callsOpen(): boolean {
  return snapshot.sections.calls;
}
