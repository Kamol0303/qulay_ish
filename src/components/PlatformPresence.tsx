import { useEffect, useState } from 'react';
import { resolveApiBase } from '../lib/api/client';
import { readGatePayload, type GateSections, type GateState } from '../lib/platformGate';

export type GateView =
  | { status: 'loading' }
  | { status: 'open' }
  | { status: 'ready'; state: GateState; sections: GateSections };

export function useSiteGate(): GateView {
  const [gate, setGate] = useState<GateView>({ status: 'loading' });

  useEffect(() => {
    let gone = false;
    const load = (keepReady: boolean) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4000);
      fetch(`${resolveApiBase()}/gate`, { signal: controller.signal, cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error('gate'))))
        .then((body) => {
          const parsed = readGatePayload(body);
          if (!parsed) throw new Error('gate');
          if (!gone) setGate({ status: 'ready', ...parsed });
        })
        .catch(() => {
          if (!gone && !keepReady) setGate({ status: 'open' });
        })
        .finally(() => window.clearTimeout(timer));
    };
    load(false);
    const poll = window.setInterval(() => load(true), 20000);
    return () => {
      gone = true;
      window.clearInterval(poll);
    };
  }, []);

  return gate;
}
