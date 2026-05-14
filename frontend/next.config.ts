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
    const csp = [
      "default-src 'self'",
      "script-src 'self' https://www.paypal.com https://www.paypalobjects.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.b-cdn.net",
      "connect-src 'self' https://video.bunnycdn.com https://api-m.sandbox.paypal.com https://api-m.paypal.com",
      "frame-src https://www.paypal.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
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
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
