import { parseMarkdown, type Inline } from "@/lib/markdown";

function Spans({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.t === "br") return <br key={i} />;
        if (n.t === "bold") return <strong key={i} className="font-semibold text-text-primary">{n.v}</strong>;
        if (n.t === "italic") return <em key={i}>{n.v}</em>;
        if (n.t === "link")
          return (
            // Isi materi ditulis guru, tapi noopener tetap dipasang: satu setelan
            // salah tidak boleh memberi halaman lain akses ke window ini.
            <a
              key={i}
              href={n.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {n.v}
            </a>
          );
        return <span key={i}>{n.v}</span>;
      })}
    </>
  );
}

// Node terstruktur → elemen React. Tidak ada dangerouslySetInnerHTML di jalur ini.
export default function Markdown({ source, className = "" }: { source: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 leading-relaxed ${className}`}>
      {parseMarkdown(source).map((b, i) => {
        if (b.t === "h") return <h2 key={i} className="t-title text-text-primary mt-2"><Spans nodes={b.children} /></h2>;
        if (b.t === "ul")
          return (
            <ul key={i} className="list-disc pl-5 flex flex-col gap-1.5">
              {b.items.map((it, j) => <li key={j}><Spans nodes={it} /></li>)}
            </ul>
          );
        if (b.t === "ol")
          return (
            <ol key={i} className="list-decimal pl-5 flex flex-col gap-1.5">
              {b.items.map((it, j) => <li key={j}><Spans nodes={it} /></li>)}
            </ol>
          );
        return <p key={i}><Spans nodes={b.children} /></p>;
      })}
    </div>
  );
}
