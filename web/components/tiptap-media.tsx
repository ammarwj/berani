"use client";

import { useRef } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import TiptapImage from "@tiptap/extension-image";
import { youtubeId, type Align } from "@/lib/markdown";

// Tiga jenis media (gambar, video unggahan, embed YouTube) memakai satu node
// view: ukuran, perataan, pemindahan, dan penghapusannya harus terasa sama.
// Sebelumnya YouTube memakai @tiptap/extension-youtube, dan bedanya terasa —
// iframe-nya tidak bisa diseleksi, jadi tidak bisa dihapus maupun dipindah, dan
// setYoutubeVideo memakai insertContent yang MENGGANTI seleksi: menyisipkan
// video saat sebuah gambar terpilih menimpa gambar itu.

// Lebar minimum drag: di bawah ini media susah dipegang lagi buat dibesarkan.
const MIN_WIDTH = 80;

// Dua mode perataan yang berbeda sifatnya, jadi dua peta kelas.
// Non-float: wrapper `flex`, kotaknya digeser dengan margin auto.
// Float: wrapper TIDAK boleh flex — flex container membuang float sama sekali —
// jadi wrappernya blok biasa dan float dipasang di wrappernya, bukan di kotak
// dalam. Itu yang membuat blok sesudahnya (teks maupun gambar kedua) mengalir
// di sisa ruang sampingnya.
const isFloat = (a: Align) => a === "float-left" || a === "float-right";

const ALIGN_CLASS: Record<Align, string> = {
  left: "mr-auto",
  center: "mx-auto",
  right: "ml-auto",
  "float-left": "",
  "float-right": "",
};

const WRAPPER_CLASS: Record<Align, string> = {
  left: "my-2 flex",
  center: "my-2 flex",
  right: "my-2 flex",
  // max-w-[48%]: dua gambar mengambang harus muat bersebelahan walau guru
  // menyetel lebar masing-masing lebih besar dari separuh kolom.
  "float-left": "float-left mr-3 mb-2 max-w-[48%]",
  "float-right": "float-right ml-3 mb-2 max-w-[48%]",
};

const ALIGN_TOOLS: { value: Align; label: string; icon: string }[] = [
  { value: "left", label: "Rata kiri", icon: "format_align_left" },
  { value: "center", label: "Rata tengah", icon: "format_align_center" },
  { value: "right", label: "Rata kanan", icon: "format_align_right" },
  // Mengambang: media keluar dari aliran, isi berikutnya naik ke sampingnya.
  // Inilah jalan menaruh dua gambar bersebelahan.
  { value: "float-left", label: "Mengambang kiri", icon: "format_image_left" },
  { value: "float-right", label: "Mengambang kanan", icon: "format_image_right" },
];

function MediaView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const { src, alt, width, align } = node.attrs as {
    src: string;
    alt?: string | null;
    width: number | null;
    align: Align | null;
  };
  const current: Align = align ?? "left";

  function onHandlePointerDown(e: React.PointerEvent) {
    // stopPropagation: tanpa ini, mousedown di handle ikut kebaca ProseMirror
    // sebagai klik di dalam editor, yang mengganti selection dan meng-unmount
    // handle ini di tengah drag.
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current;
    if (!box) return;
    const startX = e.clientX;
    const startWidth = box.getBoundingClientRect().width;
    // Saat mengambang, induk box adalah wrapper yang ikut selebar medianya —
    // mengukurnya akan mengunci lebar di angka sekarang. Yang membatasi justru
    // kolom editor, yaitu induk wrappernya.
    const bound = isFloat(current)
      ? box.parentElement?.parentElement
      : box.parentElement;
    const maxWidth = bound?.getBoundingClientRect().width ?? startWidth;
    // Rata kanan tumbuh ke kiri, rata tengah ke dua arah — tanpa ini menarik
    // handle ke kanan pada media rata kanan justru mengecilkannya.
    const factor =
      current === "right" || current === "float-right" ? -1 : current === "center" ? 2 : 1;

    function onMove(ev: PointerEvent) {
      const next = Math.min(
        maxWidth,
        Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX) * factor),
      );
      updateAttributes({ width: Math.round(next) });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Pindah satu blok ke atas/bawah. Menyeret sudah bisa, tapi membidik titik
  // jatuh di antara dua paragraf itu pekerjaan presisi — dua tombol ini
  // memindahkannya satu langkah pasti, dan itu yang dipakai kalau medianya
  // cuma perlu naik sedikit.
  function move(dir: -1 | 1) {
    const pos = getPos();
    if (typeof pos !== "number") return;
    const { state } = editor;
    const $pos = state.doc.resolve(pos);
    const index = $pos.index();
    const parent = $pos.parent;
    const target = index + dir;
    // Sudah di ujung dokumen: tidak ada tetangga untuk ditukar.
    if (target < 0 || target >= parent.childCount) return;

    const self = parent.child(index);
    const neighbour = parent.child(target);
    // Hapus node ini lalu sisipkan di seberang tetangganya. Dihitung dari
    // ukuran tetangga, bukan dari posisi mentah: setelah penghapusan, posisi
    // di belakangnya sudah bergeser sebesar node yang dibuang.
    const insertAt = dir === -1 ? pos - neighbour.nodeSize : pos + neighbour.nodeSize;
    const tr = state.tr.delete(pos, pos + self.nodeSize).insert(insertAt, self);
    // Seleksi ikut pindah supaya toolbarnya tetap terbuka di tempat barunya —
    // kalau tidak, guru harus mengklik ulang medianya tiap satu langkah.
    tr.setSelection(NodeSelection.create(tr.doc, insertAt));
    editor.view.dispatch(tr.scrollIntoView());
  }

  const pos = getPos();
  const index = typeof pos === "number" ? editor.state.doc.resolve(pos).index() : -1;
  const siblings =
    typeof pos === "number" ? editor.state.doc.resolve(pos).parent.childCount : 0;

  return (
    // as="div": media adalah blok sendiri, bukan inline di tengah kalimat.
    // Perataannya butuh elemen blok dengan lebar terbatas, dan lebar itulah yang
    // di-drag guru.
    <NodeViewWrapper
      className={WRAPPER_CLASS[current]}
      // Saat mengambang, lebar guru dipasang di wrapper: wrappernya yang
      // di-float, jadi dialah yang harus selebar medianya — kalau tidak,
      // floatnya selebar kolom dan tidak ada ruang tersisa di sampingnya.
      style={isFloat(current) ? { width: width ?? 300 } : undefined}
    >
      <div
        ref={boxRef}
        className={`relative max-w-full ${ALIGN_CLASS[current]} ${
          selected ? "outline-2 outline-offset-2 outline-primary-container rounded-xl" : ""
        }`}
        style={{ width: isFloat(current) ? "100%" : width ?? "100%" }}
      >
        {/* data-drag-handle menandai area yang memulai drag-pindah: TipTap
            memeriksa `target.closest("[data-drag-handle]")` di mousedown
            (stopEvent, @tiptap/core). Tandanya di medianya saja — bukan di
            kotak luar — supaya handle resize dan toolbar di pojok tetap
            bekerja seperti biasa, bukan ikut menyeret node.
            cursor-grab: tanpa ini tidak ada apa pun di layar yang memberi tahu
            bahwa medianya bisa diseret. */}
        <div data-drag-handle className="cursor-grab active:cursor-grabbing">
          {node.type.name === "image" && (
            // eslint-disable-next-line @next/next/no-img-element -- URL eksternal guru, bukan aset lokal
            <img
              src={src}
              alt={alt ?? ""}
              // draggable={false}: tanpa ini browser memulai drag gambar
              // sendiri (seret berkas), bukan drag node ProseMirror.
              draggable={false}
              className="rounded-xl w-full h-auto block"
            />
          )}
          {node.type.name === "video" && (
            <video
              src={src}
              controls
              playsInline
              preload="metadata"
              className="rounded-xl w-full h-auto block bg-black"
            />
          )}
          {node.type.name === "youtube" && (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              {/* pointer-events-none: selama di editor, klik harus menyeleksi
                  node-nya, bukan masuk ke pemutar YouTube. Tanpa ini iframe
                  menelan setiap klik dan videonya tidak bisa dihapus maupun
                  dipindah — persis keluhan atas extension bawaan. */}
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId(src) ?? ""}`}
                title="Video YouTube"
                className="w-full h-full pointer-events-none"
              />
            </div>
          )}
        </div>

        {selected && (
          <>
            {/* Toolbar perataan + hapus. Muncul hanya saat node terpilih, jadi
                tidak menutupi isi saat guru sedang mengetik di tempat lain. */}
            <div
              contentEditable={false}
              className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 rounded-lg bg-surface-card border border-border-subtle shadow px-1 py-0.5"
            >
              {ALIGN_TOOLS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  title={a.label}
                  aria-label={a.label}
                  aria-pressed={current === a.value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateAttributes({ align: a.value })}
                  className={`w-7 h-7 grid place-items-center rounded ${
                    current === a.value
                      ? "bg-ocean-subtle text-primary-container"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  <span aria-hidden className="ms text-[16px]">
                    {a.icon}
                  </span>
                </button>
              ))}
              <span className="w-px h-5 bg-border-subtle mx-0.5" />
              {/* Naik/turun satu blok. Menyeret memindahkan ke mana saja;
                  ini untuk langkah kecil yang susah dibidik. Mati di ujung
                  dokumen — tidak ada tetangga untuk ditukar. */}
              <button
                type="button"
                title="Pindah ke atas"
                aria-label="Pindah ke atas"
                disabled={index <= 0}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => move(-1)}
                className="w-7 h-7 grid place-items-center rounded text-text-muted hover:text-text-primary disabled:opacity-30"
              >
                <span aria-hidden className="ms text-[16px]">
                  arrow_upward
                </span>
              </button>
              <button
                type="button"
                title="Pindah ke bawah"
                aria-label="Pindah ke bawah"
                disabled={index < 0 || index >= siblings - 1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => move(1)}
                className="w-7 h-7 grid place-items-center rounded text-text-muted hover:text-text-primary disabled:opacity-30"
              >
                <span aria-hidden className="ms text-[16px]">
                  arrow_downward
                </span>
              </button>
              <span className="w-px h-5 bg-border-subtle mx-0.5" />
              <button
                type="button"
                title="Lebar penuh"
                aria-label="Kembalikan ke lebar penuh"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => updateAttributes({ width: null })}
                className="w-7 h-7 grid place-items-center rounded text-text-muted hover:text-text-primary"
              >
                <span aria-hidden className="ms text-[16px]">
                  fit_screen
                </span>
              </button>
              <button
                type="button"
                title="Hapus media"
                aria-label="Hapus media"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => deleteNode()}
                className="w-7 h-7 grid place-items-center rounded text-text-muted hover:text-danger-rose"
              >
                <span aria-hidden className="ms text-[16px]">
                  delete
                </span>
              </button>
            </div>

            <span
              onPointerDown={onHandlePointerDown}
              className="absolute -right-1.5 -bottom-1.5 w-4 h-4 rounded-full bg-primary-container border-2 border-white shadow cursor-nwse-resize touch-none"
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// width & align dipakai ketiga node dan ditulis ke markdown oleh satu fungsi
// (lib/tiptap-md.ts:suffix), jadi definisinya pun satu.
const sizeAttributes = {
  width: {
    default: null,
    parseHTML: (el: HTMLElement) => {
      const w = el.getAttribute("width");
      return w ? Number(w) : null;
    },
    renderHTML: (attrs: Record<string, unknown>) => (attrs.width ? { width: attrs.width } : {}),
  },
  align: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute("data-align"),
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.align ? { "data-align": attrs.align } : {},
  },
};

export const MediaImage = TiptapImage.extend({
  // draggable: true + data-drag-handle di MediaView — lihat komentar di sana.
  // Dulu ini false karena native HTML5 drag membajak mousedown di seluruh node
  // view, termasuk handle resize. data-drag-handle menyelesaikan itu dengan
  // membatasi area pemicunya ke medianya saja, jadi drag-pindah bisa hidup
  // tanpa mengorbankan drag-ukur.
  draggable: true,
  // Gambar bawaan inline; di sini tiap media berdiri sebagai blok sendiri
  // supaya perataannya punya arti.
  inline: false,
  group: "block",
  addAttributes() {
    return { ...this.parent?.(), ...sizeAttributes };
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaView);
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    beraniMedia: {
      setVideo: (options: { src: string }) => ReturnType;
      setYoutube: (options: { src: string }) => ReturnType;
    };
  }
}

// Video yang diunggah guru, diputar langsung di halaman materi lewat <video>.
export const MediaVideo = Node.create({
  name: "video",
  group: "block",
  atom: true,
  // Sama dengan MediaImage: drag-pindah dibatasi ke area data-drag-handle.
  draggable: true,
  addAttributes() {
    return { src: { default: null }, ...sizeAttributes };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes, { controls: "true" })];
  },
  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands, state }) =>
          // insertContentAt(selection.to), bukan insertContent: yang kedua
          // mengganti apa pun yang sedang terpilih, jadi menyisipkan video saat
          // sebuah gambar terseleksi akan menimpa gambar itu.
          commands.insertContentAt(state.selection.to, { type: "video", attrs: options }),
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaView);
  },
});

// Embed YouTube. Node sendiri, bukan @tiptap/extension-youtube: yang bawaan
// memaksa width/height 640×480 di atributnya (yang akan ikut tertulis ke
// markdown sebagai lebar yang tidak pernah dipilih guru) dan iframe-nya tidak
// bisa diseleksi, jadi tidak bisa dihapus maupun dipindah.
export const MediaYoutube = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  // Sama dengan MediaImage: drag-pindah dibatasi ke area data-drag-handle.
  draggable: true,
  addAttributes() {
    return { src: { default: null }, ...sizeAttributes };
  },
  parseHTML() {
    return [{ tag: "div[data-youtube-video] iframe" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-youtube-video": "" }, ["iframe", mergeAttributes(HTMLAttributes)]];
  },
  addCommands() {
    return {
      setYoutube:
        (options) =>
        ({ commands, state }) =>
          commands.insertContentAt(state.selection.to, { type: "youtube", attrs: options }),
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaView);
  },
});
