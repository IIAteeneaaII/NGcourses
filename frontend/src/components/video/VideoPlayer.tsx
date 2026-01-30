'use client';

import { useEffect, useRef, useState } from 'react';
import type { BunnyVideoConfig } from '@/types/course';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  config: BunnyVideoConfig;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  className?: string;
}

export default function VideoPlayer({
  config,
  onTimeUpdate,
  onEnded,
  className = '',
}: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bunnyStreamUrl = `https://iframe.mediadelivery.net/embed/${config.libraryId}/${config.videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'timeupdate' && onTimeUpdate) {
        onTimeUpdate(event.data.currentTime);
      }
      if (event.data?.type === 'ended' && onEnded) {
        onEnded();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTimeUpdate, onEnded]);

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
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
