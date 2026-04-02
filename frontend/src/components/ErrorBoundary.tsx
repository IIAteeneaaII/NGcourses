'use client';

/**
 * ErrorBoundary — ISO 25010 §6.4 Fiabilidad / Tolerancia a fallos
 *
 * Captura errores de renderizado en el subárbol de componentes hijos
 * para evitar que un fallo aislado tumbe toda la página.
 *
 * Uso:
 *   <ErrorBoundary fallback={<p>Algo salió mal.</p>}>
 *     <ComponenteComplejo />
 *   </ErrorBoundary>
 */

import React from 'react';
import { logError } from '@/lib/logger';

interface Props {
  children: React.ReactNode;
  /** Contenido a mostrar cuando se captura un error. */
  fallback?: React.ReactNode;
  /** Contexto para identificar el origen del error en logs. */
  context?: string;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const context = this.props.context ?? 'ErrorBoundary';
    logError(`${context}/componentDidCatch`, { error, componentStack: info.componentStack });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: '1rem', color: 'var(--color-text-secondary, #666)' }}>
          <p>Ocurrió un error inesperado en este componente.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{ marginTop: '0.5rem', cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
