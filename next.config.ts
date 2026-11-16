import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async redirects() {
    return [
      { source: "/admin", destination: "/team", permanent: false },
      { source: "/admin/people", destination: "/team", permanent: false },
      { source: "/admin/people/:id", destination: "/team/:id", permanent: false },
      { source: "/admin/assign", destination: "/team", permanent: false },
    ]
  },
};

export default nextConfig;
