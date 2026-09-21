import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Emit each route as <route>/index.html (e.g. out/bookings/index.html) instead
  // of out/bookings.html. Capacitor's Android WebView serves directory URLs like
  // "/bookings" by looking for an index.html inside them; without this the webview
  // fails with "this page could not reload" on any route reached via a full load.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;