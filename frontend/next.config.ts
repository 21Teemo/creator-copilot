import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/projects/:projectId/research/:path*",
        destination: "http://127.0.0.1:8001/api/v1/projects/:projectId/research/:path*",
      },
      {
        source: "/api/v1/projects/:projectId/scripting/:path*",
        destination: "http://127.0.0.1:8002/api/v1/projects/:projectId/scripting/:path*",
      },
      {
        source: "/api/v1/projects/:projectId/thumbnails/:path*",
        destination: "http://127.0.0.1:8002/api/v1/projects/:projectId/thumbnails/:path*",
      },
      {
        source: "/api/v1/projects/:projectId/stock/:path*",
        destination: "http://127.0.0.1:8003/api/v1/projects/:projectId/stock/:path*",
      },
      {
        source: "/api/v1/projects/:projectId/video/:path*",
        destination: "http://127.0.0.1:8003/api/v1/projects/:projectId/video/:path*",
      },
      {
        source: "/api/v1/projects/:projectId/seo/:path*",
        destination: "http://127.0.0.1:8004/api/v1/projects/:projectId/seo/:path*",
      },
      {
        source: "/api/v1/projects/:projectId/publish",
        destination: "http://127.0.0.1:8004/api/v1/projects/:projectId/publish",
      },
    ];
  },
};

export default nextConfig;
