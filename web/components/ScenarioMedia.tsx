import { youtubeId } from "@/lib/markdown";

// Media pendamping skenario latihan, dipakai halaman siswa dan pratinjau di
// editor — satu komponen supaya yang dilihat guru saat menyusun sama persis
// dengan yang dilihat siswa.
//
// Beda dari isi materi: skenario menyimpan media di dua kolom DB
// (media_url + media_kind), bukan di dalam markdown, jadi tidak lewat
// components/Markdown.tsx sama sekali.
export default function ScenarioMedia({
  url,
  kind,
  className = "",
}: {
  url: string;
  kind: string;
  className?: string;
}) {
  if (!url) return null;

  // w-full + h-auto, bukan ukuran tetap: skenario dibaca di layar Android, dan
  // media yang lebih lebar dari layar menggeser seluruh kartu ke samping.
  const box = `rounded-xl overflow-hidden border border-border-subtle ${className}`;

  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL guru, bukan aset lokal
      <img src={url} alt="" className={`${box} w-full h-auto`} />
    );
  }
  if (kind === "video") {
    return (
      // controls: play/pause & volume datang dari browser. playsInline supaya
      // iOS tidak langsung membajaknya jadi fullscreen; preload="metadata"
      // supaya durasinya tampil tanpa mengunduh seluruh video.
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className={`${box} w-full h-auto bg-black`}
      />
    );
  }
  if (kind === "youtube") {
    const id = youtubeId(url);
    if (!id) return null;
    return (
      <div className={`${box} aspect-video bg-black`}>
        <iframe
          className="w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title="Video skenario"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return null;
}
