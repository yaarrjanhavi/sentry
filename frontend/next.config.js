/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // If BACKEND_URL is set (e.g. FastAPI on Render/Railway), proxy /api requests to it.
  // Otherwise, use native Next.js serverless route handlers in /src/app/api/*
  async rewrites() {
    if (process.env.BACKEND_URL) {
      return [
        {
          source: '/api/:path*',
          destination: `${process.env.BACKEND_URL}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
