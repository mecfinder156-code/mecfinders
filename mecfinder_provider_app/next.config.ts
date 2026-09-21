import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Emit each route as <route>/index.html (e.g. out/job/index.html) instead of
  // out/job.html. Capacitor's Android WebView serves directory URLs like "/job"
  // by looking for an index.html inside them; without this the webview fails
  // with a raw "webpage not available / could not load" screen on any route
  // reached via a full reload (deep link, notification tap, hard refresh).
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;