/** @type {import('next').NextConfig} */

// Content-Security-Policy directives.
// Note: Next.js App Router requires 'unsafe-inline' for script-src due to
// inline hydration scripts injected during SSR. Development mode also requires
// 'unsafe-eval' for React Refresh (hot module reloading). A nonce-based CSP
// would be stricter but requires additional Next.js middleware configuration.
const isDev = process.env.NODE_ENV === "development";
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  // Prevent MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block framing from other origins (clickjacking protection).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Reduce referrer leakage across origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Limit browser feature access.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS — browsers enforce HTTPS after first visit.
  // Note: only effective when the app is served over HTTPS (production).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Content Security Policy — restricts resource loading to same origin.
  { key: "Content-Security-Policy", value: cspDirectives },
  // Remove the server technology fingerprint.
  { key: "X-Powered-By", value: "" },
];

const nextConfig = {
  reactStrictMode: true,
  // Suppress the Next.js powered-by header at the framework level too.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Apply to all routes.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
