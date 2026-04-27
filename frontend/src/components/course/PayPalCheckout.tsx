'use client';

import { useState } from 'react';
import {
  PayPalScriptProvider,
  PayPalButtons,
  type ReactPayPalScriptOptions,
} from '@paypal/react-paypal-js';
import { pagosApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';

interface PayPalCheckoutProps {
  cursoId: string;
  monedaCurso?: string;
  onSuccess: (inscripcionId: string | null) => void;
}

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
const PAYPAL_CURRENCY = process.env.NEXT_PUBLIC_PAYPAL_CURRENCY || 'MXN';

export default function PayPalCheckout({ cursoId, monedaCurso, onSuccess }: PayPalCheckoutProps) {
  const [pagoId, setPagoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  if (!PAYPAL_CLIENT_ID) {
    return (
      <div style={{
        padding: '0.75rem 1rem',
        background: '#fff5f5',
        border: '1px solid #fed7d7',
        borderRadius: '0.5rem',
        color: '#9b2c2c',
        fontSize: '0.85rem',
      }}>
        PayPal no esta configurado. Define <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> en
        <code> frontend/.env.local</code> y reinicia el dev server.
      </div>
    );
  }

  const options: ReactPayPalScriptOptions = {
    clientId: PAYPAL_CLIENT_ID,
    currency: monedaCurso || PAYPAL_CURRENCY,
    intent: 'capture',
  };

  return (
    <div style={{ width: '100%' }}>
      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#fff5f5',
          border: '1px solid #fed7d7',
          borderRadius: '0.5rem',
          color: '#9b2c2c',
          fontSize: '0.85rem',
          marginBottom: '0.75rem',
        }}>
          {error}
        </div>
      )}
      <PayPalScriptProvider options={options}>
        <PayPalButtons
          disabled={processing}
          style={{ layout: 'vertical', shape: 'rect', label: 'pay' }}
          createOrder={async () => {
            setError(null);
            setProcessing(true);
            try {
              const resp = await pagosApi.crearOrden(cursoId);
              setPagoId(resp.pago_id);
              return resp.paypal_order_id;
            } catch (e) {
              logError('PayPalCheckout/crearOrden', e);
              const detail = (e as { detail?: string })?.detail || 'No se pudo iniciar el pago';
              setError(detail);
              setProcessing(false);
              throw e;
            }
          }}
          onApprove={async (data) => {
            try {
              const idLocal = pagoId;
              if (!idLocal) {
                setError('Estado de pago perdido. Recarga la pagina.');
                return;
              }
              const resp = await pagosApi.confirmar(idLocal, data.orderID);
              if (resp.status === 'completado') {
                onSuccess(resp.inscripcion_id);
              } else {
                setError(`Pago no completado (status: ${resp.status})`);
              }
            } catch (e) {
              logError('PayPalCheckout/confirmar', e);
              const detail = (e as { detail?: string })?.detail || 'Error al confirmar el pago';
              setError(detail);
            } finally {
              setProcessing(false);
            }
          }}
          onError={(err) => {
            logError('PayPalCheckout/onError', err);
            setError('PayPal reporto un error. Intenta de nuevo.');
            setProcessing(false);
          }}
          onCancel={() => {
            setProcessing(false);
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
}
