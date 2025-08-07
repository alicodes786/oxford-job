import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "sonner";
import { getSettings } from "@/lib/settings";

// Initialize settings on server startup
try {
  console.log("Initializing application settings...");
  const settings = getSettings();
  console.log("Settings initialized successfully:", settings);
} catch (error) {
  console.error("Error initializing settings:", error);
}

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Oxford City Listings Dashboard",
  description: "Property management dashboard for Oxford City listings and cleaners",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
} 