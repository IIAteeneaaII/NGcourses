'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { pagosApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './MisCompras.module.css';

interface PagoItem {
  id: string;
  curso_id: string;
  curso_titulo: string | null;
  monto: string;
  moneda: string;
  status: 'pendiente' | 'completado' | 'fallido' | 'cortesia';
  created_at: string;
  referencia_paypal: string | null;
}

const STATUS_LABEL: Record<PagoItem['status'], string> = {
  pendiente: 'Pendiente',
  completado: 'Completado',
  fallido: 'Fallido',
  cortesia: 'Cortesia',
};

function formatMonto(monto: string, moneda: string, status: PagoItem['status']): string {
  if (status === 'cortesia') return 'Gratis (cortesia)';
  const n = Number(monto);
  if (Number.isNaN(n)) return `${monto} ${moneda}`;
  const txt = Number.isInteger(n) ? n.toString() : n.toFixed(2);
  return `$${txt} ${moneda}`;
}

function formatFecha(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function MisCompras() {
  const [pagos, setPagos] = useState<PagoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    pagosApi
      .misCompras()
      .then((resp) => {
        if (cancelled) return;
        setPagos(resp.data);
      })
      .catch((e) => {
        if (cancelled) return;
        logError('MisCompras/fetch', e);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Mis Compras</h3>

      {loading && <p className={styles.empty}>Cargando historial...</p>}
      {error && !loading && (
        <p className={styles.empty}>No se pudo cargar el historial. Intenta mas tarde.</p>
      )}
      {!loading && !error && pagos.length === 0 && (
        <p className={styles.empty}>Aun no tienes compras. Explora el catalogo para inscribirte.</p>
      )}

      {!loading && !error && pagos.length > 0 && (
        <div className={styles.list}>
          {pagos.map((p) => (
            <div key={p.id} className={styles.row}>
              <div className={styles.info}>
                <Link href={`/curso/${p.curso_id}`} className={styles.cursoTitle}>
                  {p.curso_titulo || 'Curso eliminado'}
                </Link>
                <span className={styles.fecha}>{formatFecha(p.created_at)}</span>
                {p.referencia_paypal && (
                  <span className={styles.referencia}>Ref: {p.referencia_paypal}</span>
                )}
              </div>
              <div className={styles.amounts}>
                <span className={styles.monto}>{formatMonto(p.monto, p.moneda, p.status)}</span>
                <span className={`${styles.status} ${styles[`status_${p.status}`]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
