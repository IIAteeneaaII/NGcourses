'use client';

import { useEffect, useRef, useState } from 'react';
import type { BunnyVideoConfig } from '@/types/course';
import styles from './VideoPlayer.module.css';

const BUNNY_ORIGIN = 'https://iframe.mediadelivery.net';

interface VideoPlayerProps {
  config?: BunnyVideoConfig;
  videoUrl?: string;
  /** duration llega cuando el reproductor la conoce (Bunny o <video>). */
  onTimeUpdate?: (currentTime: number, duration?: number) => void;
  onEnded?: () => void;
  className?: string;
}

export default function VideoPlayer({
  config,
  videoUrl,
  onTimeUpdate,
  onEnded,
  className = '',
}: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const subscribedRef = useRef(false);

  // Suscribe a timeupdate/ended del reproductor de Bunny (protocolo player.js).
  // Se hace una sola vez por video para no recibir eventos duplicados.
  const subscribeBunny = () => {
    const target = iframeRef.current?.contentWindow;
    if (!target || subscribedRef.current) return;
    subscribedRef.current = true;
    for (const value of ['timeupdate', 'ended']) {
      target.postMessage(
        JSON.stringify({ context: 'player.js', version: '0.0.11', method: 'addEventListener', value, listener: value }),
        BUNNY_ORIGIN,
      );
    }
  };

  const bunnyStreamUrl = config
    ? `https://iframe.mediadelivery.net/embed/${config.libraryId}/${config.videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`
    : null;

  // Eventos del reproductor de Bunny. Bunny usa el protocolo player.js: manda
  // "ready" al cargar y solo emite timeupdate/ended si el padre se suscribe.
  // Los mensajes llegan como texto JSON.
  useEffect(() => {
    if (!bunnyStreamUrl) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== BUNNY_ORIGIN) return;
      let data: { context?: string; event?: string; type?: string; value?: { seconds?: number; duration?: number }; currentTime?: number } | null = null;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!data) return;

      const name = data.context === 'player.js' ? data.event : data.type;
      if (name === 'ready') subscribeBunny();
      if (name === 'timeupdate' && onTimeUpdate) {
        const seconds = data.value?.seconds ?? data.currentTime;
        if (typeof seconds === 'number') onTimeUpdate(seconds, data.value?.duration);
      }
      if (name === 'ended' && onEnded) onEnded();
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [bunnyStreamUrl, onTimeUpdate, onEnded]);

  // Native <video> events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () =>
      onTimeUpdate?.(video.currentTime, Number.isFinite(video.duration) ? video.duration : undefined);
    const handleEnded = () => onEnded?.();
    const handleCanPlay = () => setIsLoading(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoUrl, onTimeUpdate, onEnded]);

  // Reset loading on source change
  useEffect(() => {
    setIsLoading(true);
    subscribedRef.current = false;
  }, [videoUrl, config?.videoId]);

  // Local video mode
  if (videoUrl) {
    return (
      <div className={`${styles.container} ${className}`}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingText}>Cargando video...</div>
          </div>
        )}
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          preload="metadata"
          className={styles.video}
          onLoadedData={() => setIsLoading(false)}
        />
      </div>
    );
  }

  // Bunny.net iframe mode
  if (bunnyStreamUrl) {
    return (
      <div className={`${styles.container} ${className}`}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingText}>Cargando video...</div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={bunnyStreamUrl}
          loading="lazy"
          className={styles.iframe}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          onLoad={() => {
            setIsLoading(false);
            // Respaldo por si el aviso "ready" de Bunny llegó antes de escucharlo.
            window.setTimeout(subscribeBunny, 1500);
          }}
        />
      </div>
    );
  }

  // No video source
  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.loadingOverlay}>
        <div className={styles.loadingText}>No hay video disponible</div>
      </div>
    </div>
  );
}
