import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const apiHttpOrigins = [
  "http://localhost:8000",
  "http://44.250.178.54:8000",
];

const cspDirectives = [
  "default-src 'self'",

  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self'",

  isDev
    ? "style-src 'self' 'unsafe-inline'"
    : "style-src 'self'",

  `img-src 'self' data: blob: https: ${apiHttpOrigins.join(" ")}`,

  "font-src 'self' data:",

  isDev
    ? `connect-src 'self' ${apiHttpOrigins.join(" ")} ws://localhost:*`
    : `connect-src 'self' https: ${apiHttpOrigins.join(" ")}`,

  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

const contentSecurityPolicy = cspDirectives.join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,

  allowedDevOrigins: ["*.loca.lt", "192.168.202.42"],

  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "44.250.178.54",
        port: "8000",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**",
        pathname: "/media/**",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;