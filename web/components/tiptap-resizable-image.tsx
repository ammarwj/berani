"use client";

import { useRef } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import TiptapImage from "@tiptap/extension-image";

// Lebar minimum drag: di bawah ini gambar susah dipegang lagi buat dibesarkan.
const MIN_WIDTH = 80;

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const { src, alt, width } = node.attrs as { src: string; alt: string | null; width: number | null };

  function onHandlePointerDown(e: React.PointerEvent) {
    // stopPropagation: tanpa ini, mousedown di handle ikut kebaca ProseMirror
    // sebagai klik di dalam editor, yang mengganti selection dan meng-unmount
    // handle ini di tengah drag.
    e.preventDefault();
    e.stopPropagation();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const startX = e.clientX;
    const startWidth = wrapper.getBoundingClientRect().width;
    const maxWidth = wrapper.parentElement?.getBoundingClientRect().width ?? startWidth;

    function onMove(ev: PointerEvent) {
      const next = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX)));
      updateAttributes({ width: Math.round(next) });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <NodeViewWrapper as="span" className="inline-block max-w-full">
      <span
        ref={wrapperRef}
        className="relative inline-block max-w-full"
        style={width ? { width } : undefined}
      >
        <img
          src={src}
          alt={alt ?? ""}
          draggable={false}
          className="rounded-xl max-w-full block"
          style={width ? { width: "100%", height: "auto" } : undefined}
        />
        {selected && (
          <span
            onPointerDown={onHandlePointerDown}
            className="absolute -right-1.5 -bottom-1.5 w-4 h-4 rounded-full bg-primary-container border-2 border-white shadow cursor-nwse-resize touch-none"
          />
        )}
      </span>
    </NodeViewWrapper>
  );
}

export const ResizableImage = TiptapImage.extend({
  // Image bawaan punya draggable: true di node spec (buat drag-pindah gambar
  // di dalam dokumen) — itu bikin ProseMirror pasang native HTML5 drag di
  // wrapper node view, yang membajak mousedown+move sebelum pointer event
  // custom kita sempat jalan. stopPropagation di handler React tidak bisa
  // menahan native drag itu karena deteksinya di layer browser, bukan JS.
  draggable: false,
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute("width");
          return w ? Number(w) : null;
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
