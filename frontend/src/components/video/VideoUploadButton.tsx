'use client';

import { useState, useRef } from 'react';
import * as tus from 'tus-js-client';
import { videoApi } from '@/lib/api/client';
import styles from './VideoUploadButton.module.css';

interface BunnyInitResponse {
  bunny_video_id: string;
  tus_upload_url: string;
  tus_headers: Record<string, string>;
  embed_url: string;
}

interface VideoStatusResponse {
  bunny_video_id: string;
  status: string;
  is_ready: boolean;
  hls_url: string | null;
  thumbnail_url: string | null;
  embed_url: string | null;
}

interface Props {
  cursoId: string;
  moduloId: string;
  leccionId: string;
  currentBunnyVideoId?: string | null;
  onUploadComplete?: (videoId: string, embedUrl: string) => void;
}

export default function VideoUploadButton({
  cursoId,
  moduloId,
  leccionId,
  currentBunnyVideoId,
  onUploadComplete,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'initiating' | 'uploading' | 'encoding' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadRef = useRef<tus.Upload | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setErrorMsg('Solo se permiten archivos de video');
      return;
    }

    setStatus('initiating');
    setErrorMsg('');
    setProgress(0);

    try {
      // 1. Inicializar en backend → Bunny crea el video y devuelve TUS headers
      const initResp = await videoApi.initUpload(cursoId, moduloId, leccionId) as BunnyInitResponse;
      const { bunny_video_id, tus_headers } = initResp;

      setStatus('uploading');

      // 2. Upload TUS correcto con chunks de 5MB
      await uploadViaTUS(file, tus_headers, bunny_video_id);

      // 3. Esperar encoding
      setStatus('encoding');
      startPolling(bunny_video_id);

    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Error al subir el video');
    }
  };

  const uploadViaTUS = (
    file: File,
    tusHeaders: Record<string, string>,
    videoId: string,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: 'https://video.bunnycdn.com/tusupload',
        retryDelays: [0, 3000, 5000, 10000],
        chunkSize: 50 * 1024 * 1024, // 50 MB por chunk — menos requests, upload más rápido
        headers: tusHeaders,
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = Math.round((bytesUploaded / bytesTotal) * 100);
          setProgress(pct);
        },
        onSuccess: () => resolve(),
        onError: (err) => reject(new Error(err.message)),
      });

      uploadRef.current = upload;
      upload.start();
    });
  };

  const startPolling = (videoId: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const statusResp = await videoApi.status(cursoId, moduloId, leccionId) as VideoStatusResponse;

        if (statusResp.is_ready) {
          clearInterval(pollingRef.current!);
          setStatus('ready');
          setEmbedUrl(statusResp.embed_url);
          onUploadComplete?.(videoId, statusResp.embed_url || '');
        } else if (statusResp.status === 'failed' || statusResp.status === 'upload_failed') {
          clearInterval(pollingRef.current!);
          setStatus('error');
          setErrorMsg('El video falló al procesarse en Bunny.net');
        }
      } catch {
        // ignorar errores de polling
      }
    }, 5000);
  };

  const handleClick = () => fileInputRef.current?.click();

  const getStatusLabel = () => {
    switch (status) {
      case 'initiating': return 'Iniciando...';
      case 'uploading': return `Subiendo ${progress}%`;
      case 'encoding': return 'Procesando en Bunny.net...';
      case 'ready': return 'Video listo ✓';
      case 'error': return 'Error — reintentar';
      default: return currentBunnyVideoId ? 'Reemplazar video' : 'Subir video';
    }
  };

  return (
    <div className={styles.wrapper}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <button
        type="button"
        className={`${styles.button} ${status === 'ready' ? styles.ready : ''} ${status === 'error' ? styles.error : ''}`}
        onClick={handleClick}
        disabled={status === 'initiating' || status === 'uploading' || status === 'encoding'}
      >
        {status === 'uploading' || status === 'encoding' ? (
          <span className={styles.spinner} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        )}
        {getStatusLabel()}
      </button>

      {status === 'uploading' && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      )}

      {status === 'error' && errorMsg && (
        <p className={styles.errorText}>{errorMsg}</p>
      )}

      {status === 'ready' && embedUrl && (
        <p className={styles.successText}>Video procesado correctamente</p>
      )}

      {currentBunnyVideoId && status === 'idle' && (
        <span className={styles.existingBadge}>Video actual: {currentBunnyVideoId.slice(0, 8)}...</span>
      )}
    </div>
  );
}
