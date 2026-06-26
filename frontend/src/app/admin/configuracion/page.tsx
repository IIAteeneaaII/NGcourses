'use client';

import { useState } from 'react';
import { featureFlagsApi } from '@/lib/api/client';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlags';
import { logError } from '@/lib/logger';

interface FlagDef {
  nombre: string;
  titulo: string;
  descripcion: string;
}

// Catálogo de flags expuestos en el panel. Agrega aquí los que quieras controlar.
const FLAGS: FlagDef[] = [
  {
    nombre: 'instructores',
    titulo: 'Rol de instructor',
    descripcion:
      'Habilita el rol de instructor: su panel, la asignación del rol a usuarios y la sección "Instructores". Mientras esté apagado, el rol queda oculto y no se pueden crear instructores nuevos (la funcionalidad no se borra, solo se desactiva).',
  },
  {
    nombre: 'multiples_supervisores',
    titulo: 'Múltiples supervisores por organización',
    descripcion:
      'Permite que una organización tenga más de un supervisor. Apagado (recomendado para la beta): cada organización tiene un solo supervisor —el que se crea al dar de alta la empresa— y se oculta la opción de crear supervisores adicionales. Encendido: se habilita crear/agregar varios supervisores a una misma organización (un supervisor sigue perteneciendo a una sola org).',
  },
];

export default function ConfiguracionPage() {
  const { flags, loading, refetch } = useFeatureFlags();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const toggle = async (nombre: string, habilitado: boolean) => {
    setSaving(nombre);
    setError('');
    try {
      await featureFlagsApi.set(nombre, habilitado);
      await refetch();
    } catch (e) {
      logError('admin/configuracion/toggle', e);
      const detail = (e as { detail?: string })?.detail || 'No se pudo actualizar el ajuste.';
      setError(detail);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '720px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: '#0B1B2B' }}>
        Configuración
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'rgba(11,27,43,.55)' }}>
        Activa o desactiva funcionalidades del sistema. Los cambios son inmediatos.
      </p>

      {error && (
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--color-error)' }}>{error}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {FLAGS.map((f) => {
          const on = !!flags[f.nombre];
          const isSaving = saving === f.nombre;
          return (
            <div
              key={f.nombre}
              style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                gap: '20px', padding: '18px 20px', borderRadius: '14px',
                border: '1px solid rgba(0,150,143,.18)', background: '#fff',
              }}
            >
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0B1B2B', marginBottom: '4px' }}>
                  {f.titulo}
                  <span style={{
                    marginLeft: '10px', fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                    borderRadius: '999px',
                    color: on ? '#065f46' : '#92400e',
                    background: on ? '#ecfdf5' : '#fffbeb',
                    border: `1px solid ${on ? '#6ee7b7' : '#fcd34d'}`,
                  }}>
                    {on ? 'Activado' : 'Desactivado'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(11,27,43,.6)', lineHeight: 1.5 }}>
                  {f.descripcion}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={loading || isSaving}
                onClick={() => toggle(f.nombre, !on)}
                title={on ? 'Desactivar' : 'Activar'}
                style={{
                  flexShrink: 0, width: '52px', height: '30px', borderRadius: '999px',
                  border: 'none', cursor: loading || isSaving ? 'not-allowed' : 'pointer',
                  background: on ? '#00968f' : 'rgba(11,27,43,.2)',
                  position: 'relative', transition: 'background .2s', opacity: isSaving ? 0.6 : 1,
                }}
              >
                <span style={{
                  position: 'absolute', top: '3px', left: on ? '25px' : '3px',
                  width: '24px', height: '24px', borderRadius: '50%', background: '#fff',
                  transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
