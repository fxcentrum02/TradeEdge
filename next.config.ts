import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Allow cross-origin requests from ngrok/Telegram during dev
  allowedDevOrigins: [
    "*.ngrok-free.dev",
    "*.ngrok.io",
    "web.telegram.org",
    "*.telegram.org",
  ],
};

export default nextConfig;
