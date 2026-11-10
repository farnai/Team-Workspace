import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";

export const metadata: Metadata = {
  title: "Team Workspace — სამუშაო სივრცე",
  description: "შიდა გუნდური სამუშაო სივრცე და ამოცანების მართვის სისტემა",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ka" className="h-full overflow-hidden">
      <body className="h-full overflow-hidden flex flex-col bg-[#F8F7F4] text-[#1C1917]">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
