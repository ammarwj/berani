import { parseMarkdown, type Align, type Inline } from "@/lib/markdown";

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

// Blok media dibungkus <div> sendiri supaya perataannya bekerja: margin auto
// butuh elemen blok dengan lebar terbatas, dan lebar itu yang di-drag guru.
// max-w-full, bukan width tetap: di layar Android lebar 600px yang diatur guru
// di laptop harus menyusut, bukan memaksa halaman menggeser ke samping.
const ALIGN_CLASS: Record<Align, string> = {
  left: "mr-auto",
  center: "mx-auto",
  right: "ml-auto",
};

function MediaBlock({
  width,
  align,
  children,
}: {
  width?: number;
  align?: Align;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`w-full max-w-full ${ALIGN_CLASS[align ?? "left"]}`}
      style={width ? { width } : undefined}
    >
      {children}
    </div>
  );
}

// Node terstruktur → elemen React. Tidak ada dangerouslySetInnerHTML di jalur ini.
export default function Markdown({ source, className = "" }: { source: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 leading-relaxed ${className}`}>
      {parseMarkdown(source).map((b, i) => {
        if (b.t === "h") return <h2 key={i} className="t-title text-text-primary mt-2"><Spans nodes={b.children} /></h2>;
        if (b.t === "img")
          return (
            <MediaBlock key={i} width={b.width} align={b.align}>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL eksternal guru, bukan aset lokal yang bisa dioptimalkan next/image */}
              <img src={b.src} alt={b.alt} className="rounded-xl w-full h-auto" />
            </MediaBlock>
          );
        if (b.t === "video")
          return (
            <MediaBlock key={i} width={b.width} align={b.align}>
              {/* controls: play/pause, volume, dan posisi putar datang dari
                  browser sendiri — kontrol asli Android lebih bisa dipakai
                  (dan lebih bisa diakses) daripada tombol buatan sendiri.
                  playsInline supaya iOS tidak membajaknya jadi fullscreen,
                  preload="metadata" supaya durasi tampil tanpa mengunduh
                  seluruh video di koneksi sekolah. */}
              <video
                src={b.src}
                controls
                playsInline
                preload="metadata"
                className="rounded-xl w-full h-auto bg-black"
              />
            </MediaBlock>
          );
        if (b.t === "youtube")
          return (
            <MediaBlock key={i} width={b.width} align={b.align}>
              <div className="aspect-video rounded-xl overflow-hidden">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${b.id}`}
                  title="Video YouTube"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </MediaBlock>
          );
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
