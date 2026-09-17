import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import RegisterSW from "@/components/RegisterSW";
import { ICON_NAMES } from "@/components/Icon";

// Plus Jakarta Sans untuk judul & isi, Inter untuk label/data — sesuai DESIGN.md.
// Inter dipakai di kode tiket dan angka, di mana bentuk huruf yang tidak ambigu
// lebih penting daripada kehangatan.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Material Symbols hanya untuk ikon yang benar-benar dipakai. Parameter
// icon_names memotong font dari ~4 MB ke beberapa kilobyte; next/font/google
// belum mendukungnya, jadi <link> ditulis manual.
const ICON_FONT = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=${ICON_NAMES}&display=block`;

export const metadata: Metadata = {
  title: "BERANI",
  description: "Belajar, Edukasi, & Aman Terhadap Bullying",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} ${inter.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={ICON_FONT} />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-on-surface selection:bg-primary-container/20">
        <RegisterSW />
        <TopBar />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
