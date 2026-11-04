import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Workspace — სამუშაო სივრცე",
  description: "შიდა გუნდური სამუშაო სივრცე და ამოცანების მართვის სისტემა",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ka" className="h-full">
      <body className="min-h-full flex flex-col bg-[#F8F7F4] text-[#1C1917]">
        {children}
      </body>
    </html>
  );
}
