import type { NextConfig } from "next";

// The Spectra server origin allowed to embed /job/* pages in an <iframe>.
// Set SPECTRA_ORIGIN in your deployment environment variables.
// Local dev default: http://localhost:50052 (IIS Express default port)
const SPECTRA_ORIGIN = process.env.SPECTRA_ORIGIN || "http://localhost:50052";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/process": [
      "./app/data/Policy Enrollment Data 22-SEP-25-50141363.xlsx",
      "./app/data/policy-enrollment.json",
    ],
  },

  async headers() {
    return [
      // Allow Spectra to embed /job/* inside an <iframe>
      // X-Frame-Options: legacy browsers; CSP frame-ancestors: modern standard
      {
        source: "/job/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: `ALLOW-FROM ${SPECTRA_ORIGIN}`,
          },
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors 'self' ${SPECTRA_ORIGIN}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;