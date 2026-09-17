// Jembatan TipTap ⇄ markdown. TipTap bekerja di ProseMirror JSON, bukan HTML —
// jadi isi materi tetap disimpan sebagai markdown di kolom TEXT dan tetap
// dirender lewat parser sendiri jadi elemen React. Tidak ada getHTML(), tidak
// ada dangerouslySetInnerHTML, tidak ada sanitizer HTML yang perlu ditambah di
// server. Konversi terjadi hanya di dua titik: saat editor dibuka dan saat
// guru mengetik.
import { parseMarkdown, type Inline } from "./markdown";

type Mark = { type: string; attrs?: { href?: string } };
type TextNode = { type: "text"; text: string; marks?: Mark[] };
// Di ProseMirror JSON teks juga sebuah node, jadi satu tipe menampung keduanya.
type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
  marks?: Mark[];
};
export type Doc = { type: "doc"; content: Node[] };

const para = (content: Node[]): Node =>
  content.length ? { type: "paragraph", content } : { type: "paragraph" };

const item = (nodes: Inline[]): Node => ({ type: "listItem", content: [para(nodes.map(text))] });

function text(n: Inline): Node {
  if (n.t === "br") return { type: "hardBreak" };
  if (n.t === "bold") return { type: "text", text: n.v, marks: [{ type: "bold" }] };
  if (n.t === "italic") return { type: "text", text: n.v, marks: [{ type: "italic" }] };
  if (n.t === "link")
    return { type: "text", text: n.v, marks: [{ type: "link", attrs: { href: n.href } }] };
  return { type: "text", text: n.v };
}

export function toDoc(md: string): Doc {
  const content = parseMarkdown(md).map((b): Node => {
    if (b.t === "h")
      return { type: "heading", attrs: { level: 2 }, content: b.children.map(text) };
    if (b.t === "ul") return { type: "bulletList", content: b.items.map(item) };
    if (b.t === "ol") return { type: "orderedList", content: b.items.map(item) };
    return para(b.children.map(text));
  });
  // Dokumen ProseMirror tidak boleh kosong — skemanya mewajibkan minimal satu blok.
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

function inline(nodes: Node[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type === "hardBreak") return "\n";
      const t = n as TextNode;
      if (typeof t.text !== "string") return "";
      let s = t.text;
      for (const m of t.marks ?? []) {
        if (m.type === "bold") s = `**${s}**`;
        else if (m.type === "italic") s = `*${s}*`;
        else if (m.type === "link") s = `[${s}](${m.attrs?.href ?? ""})`;
      }
      return s;
    })
    .join("");
}

// Hanya blok yang bisa dihasilkan toolbar yang diterjemahkan. Node lain
// (blockquote, codeBlock, dst.) tidak diaktifkan di StarterKit editor ini, jadi
// tidak ada jalan untuk membuatnya.
// ponytail: satu tabel blok datar, bukan list bersarang. Kalau guru butuh
// sub-poin, markdown.ts perlu paham indentasi dulu — di sana batasnya.
export function toMarkdown(doc: Doc): string {
  const out: string[] = [];
  for (const b of doc.content ?? []) {
    if (b.type === "heading") out.push(`## ${inline(b.content)}`);
    else if (b.type === "bulletList" || b.type === "orderedList") {
      const ordered = b.type === "orderedList";
      const lines = (b.content ?? []).map((li, i) => {
        const body = (li.content ?? []).map((p) => inline(p.content)).join(" ");
        return ordered ? `${i + 1}. ${body}` : `- ${body}`;
      });
      out.push(lines.join("\n"));
    } else out.push(inline(b.content));
  }
  // Blok dipisah baris kosong; paragraf kosong di ujung dokumen dibuang supaya
  // dokumen yang "kosong" benar-benar jadi string kosong.
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
