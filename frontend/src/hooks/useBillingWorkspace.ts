import { useCallback, useEffect, useRef, useState } from 'react';
import { billingRequest } from '../utils/tenantBillingApi';

export function useBillingWorkspace<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [revision, setRevision] = useState(0);
  const loading = loadedRevision !== revision;
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const refresh = useCallback(() => { setError(''); setRevision(n => n + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void billingRequest<T>(path, undefined, 'GET', controller.signal).then(value => { if (!controller.signal.aborted) { setData(value); setError(''); } })
      .catch((e: Error) => { if (!controller.signal.aborted) { setData(null); setError(e.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoadedRevision(revision); });
    return () => controller.abort();
  }, [path, revision]);
  async function run<R>(url: string, input: object, method = 'POST', success = 'Saved.') {
    if (busy || loading) return null;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await billingRequest<R>(url, input, method);
      if (!active.current) return null;
      setNotice(success); refresh(); return result;
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Request failed.'); return null; }
    finally { if (active.current) setBusy(false); }
  }
  return { data, error, notice, busy: busy || loading, loading, refresh, run };
}
