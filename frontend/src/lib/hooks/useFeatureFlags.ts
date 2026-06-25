'use client';

import { useCallback, useEffect, useState } from 'react';
import { featureFlagsApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';

/**
 * Carga los feature flags y los expone como un mapa nombre -> habilitado.
 * El frontend lo usa para mostrar/ocultar funcionalidad (p. ej. el rol instructor).
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await featureFlagsApi.list();
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((f) => { map[f.nombre] = f.habilitado; });
      setFlags(map);
    } catch (e) {
      logError('useFeatureFlags', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { flags, loading, refetch };
}
