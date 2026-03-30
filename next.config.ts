import type { NextConfig } from "next";

// next.config.ts intentionally has NO headers() for /job/* routes.
// Frame-ancestors and X-Frame-Options are controlled entirely by vercel.json
// so there is no conflict between Next.js headers and Vercel platform headers.

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/process": [
      "./app/data/Policy Enrollment Data 22-SEP-25-50141363.xlsx",
      "./app/data/policy-enrollment.json",
    ],
  },
};

export default nextConfig;