import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoomGuard — Hidden Camera Lens Detector",
  description:
    "Find hidden camera lenses in Airbnbs, hotels and rentals using your phone's camera and flashlight. Runs fully on your phone — nothing is uploaded.",
  applicationName: "RoomGuard",
  appleWebApp: { capable: true, title: "RoomGuard", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1020",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
