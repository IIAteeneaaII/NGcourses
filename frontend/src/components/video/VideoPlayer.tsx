'use client';

import { useEffect, useRef, useState } from 'react';
import type { BunnyVideoConfig } from '@/types/course';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  config?: BunnyVideoConfig;
  videoUrl?: string;
  onTimeUpdate?: (currentTime: number) => void;
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

  const bunnyStreamUrl = config
    ? `https://iframe.mediadelivery.net/embed/${config.libraryId}/${config.videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`
    : null;

  // Bunny.net postMessage events
  useEffect(() => {
    if (!bunnyStreamUrl) return;

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
  }, [bunnyStreamUrl, onTimeUpdate, onEnded]);

  // Native <video> events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => onTimeUpdate?.(video.currentTime);
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
          onLoad={() => setIsLoading(false)}
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
