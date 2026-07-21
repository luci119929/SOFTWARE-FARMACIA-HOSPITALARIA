import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './client';

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// Hook de lectura con recarga manual.
export function useApi<T>(path: string): State<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error de conexión'))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
