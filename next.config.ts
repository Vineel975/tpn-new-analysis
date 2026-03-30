import type { NextConfig } from "next";

// Origins allowed to embed /job/* pages inside a Spectra <iframe>.
//
// Set SPECTRA_ORIGIN in Vercel environment variables.
// For multiple origins (e.g. local + production) separate with a space:
//   SPECTRA_ORIGIN="http://localhost:50052 https://spectra.fhpl.net"
//
// Default covers local IIS Express dev — update this for your setup.
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
      {
        // Apply to every /job/* route — these are the pages Spectra embeds
        source: "/job/:path*",
        headers: [
          // DO NOT include X-Frame-Options — Chrome/Edge ignore ALLOW-FROM
          // and its presence can interfere with the CSP header below.
          // CSP frame-ancestors is the correct modern mechanism.
          {
            key: "Content-Security-Policy",
            // 'self' allows the ClaimAI app to iframe itself (e.g. for dev).
            // SPECTRA_ORIGIN allows the Spectra page to embed it.
            // Add extra origins separated by spaces if needed.
            value: `frame-ancestors 'self' ${SPECTRA_ORIGIN}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;