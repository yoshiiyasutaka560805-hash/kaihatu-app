import { useCallback, useEffect, useState } from 'react';

// 取得系の共通フック：const { data, error, loading, reload } = useApi(() => get('/seekers'), [deps])
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const load = useCallback(() => {
    setState(s => ({ ...s, loading: true }));
    return Promise.resolve(fn())
      .then(data => setState({ data, error: '', loading: false }))
      .catch(e => setState({ data: null, error: e.message, loading: false }));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

// 送信系：const [run, busy, error] = useAction(); await run(() => post(...))
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (fn) => {
    setBusy(true); setError('');
    try { return await fn(); } catch (e) { setError(e.message); throw e; } finally { setBusy(false); }
  }, []);
  return [run, busy, error, setError];
}

// メタ情報（選択肢一覧）をキャッシュして共有
let metaCache = null;
export function useMeta() {
  const [meta, setMeta] = useState(metaCache);
  useEffect(() => {
    if (metaCache) return;
    import('../api/client').then(({ get }) => get('/settings/meta')).then(m => { metaCache = m; setMeta(m); }).catch(() => {});
  }, []);
  return meta;
}
