// Subset markdown yang dipakai materi edukasi. Parser sendiri, bukan library:
// keluarannya node terstruktur yang dirender jadi elemen React, jadi tidak ada
// jalan HTML mentah sama sekali. Isi materi ditulis guru dan dibaca siswa —
// itu batas kepercayaan, dan dangerouslySetInnerHTML tidak boleh ada di sini.

export type Inline =
  | { t: "text"; v: string }
  | { t: "br" }
  | { t: "bold"; v: string }
  | { t: "italic"; v: string }
  | { t: "link"; v: string; href: string };

export type Block =
  | { t: "h"; children: Inline[] }
  | { t: "p"; children: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] }
  | { t: "img"; src: string; alt: string }
  | { t: "youtube"; id: string };

// Skema yang boleh jadi tautan. `javascript:` dan `data:` tidak termasuk —
// keduanya menjalankan kode saat diklik siswa.
const SAFE_SCHEME = /^(https?:\/\/|mailto:|tel:)/i;
// Gambar ditempel dari luar (URL eksternal) atau diunggah lewat API sendiri —
// http:// ikut diizinkan karena API dev jalan di http://localhost. Tidak ada
// data: (bisa membawa payload besar sembarangan lewat body materi).
const IMAGE_SCHEME = /^https?:\/\//i;

// Satu baris sendiri, bukan campur dengan teks lain — sama seperti heading.
const IMAGE_LINE = /^!\[([^\]]*)\]\((\S+)\)$/;
// Bukan sintaks markdown standar (tidak ada video embed di markdown), tapi
// satu-satunya jalan membuatnya adalah tombol toolbar, jadi bentuknya bebas
// kita tentukan sendiri.
const YOUTUBE_LINE = /^\[youtube\]\((\S+)\)$/;
const YOUTUBE_ID = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export function youtubeId(url: string): string | null {
  const m = YOUTUBE_ID.exec(url);
  return m ? m[1] : null;
}

const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let rest = s;
  for (let m = INLINE.exec(rest); m; m = INLINE.exec(rest)) {
    if (m.index > 0) out.push({ t: "text", v: rest.slice(0, m.index) });
    if (m[1] !== undefined) {
      // Tautan dengan skema tak dikenal turun jadi teks biasa, bukan dibuang:
      // isinya tetap terbaca siswa, hanya tidak bisa diklik.
      out.push(
        SAFE_SCHEME.test(m[2])
          ? { t: "link", v: m[1], href: m[2] }
          : { t: "text", v: `${m[1]} (${m[2]})` },
      );
    } else if (m[3] !== undefined) out.push({ t: "bold", v: m[3] });
    else out.push({ t: "italic", v: m[4] });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push({ t: "text", v: rest });
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of src.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = raw.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;

    const img = lines.length === 1 ? IMAGE_LINE.exec(lines[0]) : null;
    const yt = lines.length === 1 ? YOUTUBE_LINE.exec(lines[0]) : null;
    const bullets = lines.every((l) => /^\s*[-*]\s+/.test(l));
    const numbers = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
    if (img && IMAGE_SCHEME.test(img[2])) {
      blocks.push({ t: "img", alt: img[1], src: img[2] });
    } else if (yt && youtubeId(yt[1])) {
      blocks.push({ t: "youtube", id: youtubeId(yt[1])! });
    } else if (bullets) {
      blocks.push({ t: "ul", items: lines.map((l) => parseInline(l.replace(/^\s*[-*]\s+/, ""))) });
    } else if (numbers) {
      blocks.push({ t: "ol", items: lines.map((l) => parseInline(l.replace(/^\s*\d+[.)]\s+/, ""))) });
    } else if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
      blocks.push({ t: "h", children: parseInline(lines[0].replace(/^#{1,3}\s+/, "")) });
    } else {
      // Enter tunggal jadi pindah baris, bukan spasi. Markdown asli menggabung
      // dengan spasi, tapi materi yang sudah ada memakai enter tunggal sebagai
      // break sungguhan ("**1. Fisik**" lalu penjelasannya di bawahnya) — dan
      // itu juga yang dilihat guru saat menekan Shift+Enter di editor.
      const children: Inline[] = [];
      lines.forEach((l, i) => {
        if (i > 0) children.push({ t: "br" });
        children.push(...parseInline(l));
      });
      blocks.push({ t: "p", children });
    }
  }
  return blocks;
}
