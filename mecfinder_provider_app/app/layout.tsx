import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import NativeAppHandler from "@/components/NativeAppHandler";
import OfflineOverlay from "@/components/OfflineOverlay";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "MecFinders Provider",
  description: "MecFinders Provider Mobile App",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="font-sans min-h-full flex flex-col bg-cream text-ink">
        <NativeAppHandler />
        <OfflineOverlay />
        <AuthProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
