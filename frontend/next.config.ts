import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: ['*.loca.lt', '192.168.202.42'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/media/**',
      },
    ],
  },
  async headers() {
    // Activar solo cuando el sitio se sirve detrás de HTTPS (dominio + TLS).
    // Mientras se acceda por http:// (IP de EC2 sin certificado), estas dos
    // directivas rompen la carga de assets: 'upgrade-insecure-requests'
    // reescribe los sub-recursos a https:// y el navegador no los puede pedir.
    const httpsEnabled = process.env.ENABLE_HTTPS === 'true';

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.paypal.com https://www.paypalobjects.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.b-cdn.net",
      "connect-src 'self' https://video.bunnycdn.com https://api-m.sandbox.paypal.com https://api-m.paypal.com",
      "frame-src https://www.paypal.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(httpsEnabled ? ["upgrade-insecure-requests"] : []),
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
          // HSTS solo tiene sentido sobre HTTPS; el navegador lo ignora en HTTP.
          ...(httpsEnabled
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
