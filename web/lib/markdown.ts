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
  | { t: "ol"; items: Inline[][] };

// Skema yang boleh jadi tautan. `javascript:` dan `data:` tidak termasuk —
// keduanya menjalankan kode saat diklik siswa.
const SAFE_SCHEME = /^(https?:\/\/|mailto:|tel:)/i;

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

    const bullets = lines.every((l) => /^\s*[-*]\s+/.test(l));
    const numbers = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
    if (bullets) {
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
