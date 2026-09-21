import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "MecFinders",
  description: "Customer Mobile App",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MecFinders",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

import { AuthProvider } from "../contexts/AuthContext";
import { NotificationProvider } from "../contexts/NotificationContext";
import HardwareBackButtonHandler from "../components/HardwareBackButtonHandler";
import OfflineOverlay from "../components/OfflineOverlay";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} antialiased`}>
      <body className="font-sans bg-white text-gray-900 overflow-x-hidden min-h-screen">
        <AuthProvider>
          <NotificationProvider>
            <HardwareBackButtonHandler />
            <OfflineOverlay />
            {children}
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
