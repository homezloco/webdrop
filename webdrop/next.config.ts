import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Helps Next determine the correct project root when multiple lockfiles exist
  outputFileTracingRoot: __dirname,
  // Skip ESLint during CI builds (Netlify) to avoid missing plugin failures
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
          // Minimal CSP allowing websockets to same origin
          { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; frame-ancestors 'none';" },
        ],
      },
    ];
  },
};

export default nextConfig;
