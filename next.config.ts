import type { NextConfig } from "next";

const csp = (isDev: boolean) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
    "connect-src 'self' https://*.basemaps.cartocdn.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");


  
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    const value = [
      { key: "Content-Security-Policy", value: csp(process.env.NODE_ENV === "development") },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") value.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
    return [{ source: "/:path*", headers: value }];
  },
};

export default nextConfig;
