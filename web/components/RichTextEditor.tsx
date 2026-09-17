"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { toDoc, toMarkdown, type Doc } from "@/lib/tiptap-md";

// WYSIWYG dengan TipTap, tapi yang disimpan tetap markdown: `onUpdate` membaca
// ProseMirror JSON dan menerjemahkannya di lib/tiptap-md.ts. getHTML() sengaja
// tidak dipakai — begitu isi materi jadi HTML, halaman siswa butuh
// dangerouslySetInnerHTML dan server butuh sanitizer HTML. Node → elemen React
// tidak butuh keduanya.

// Skema yang sama dengan renderer siswa. Kalau di sini lebih longgar, guru bisa
// membuat tautan yang tampak valid di editor lalu diam-diam mati di halaman siswa.
const SAFE_SCHEME = /^(https?:\/\/|mailto:|tel:)/i;

const btn =
  "min-h-9 min-w-9 px-2.5 rounded-lg border t-label-md transition disabled:opacity-40";
const off = "border-border-subtle bg-surface-card text-text-primary hover:border-primary-container";
const on = "border-primary-container bg-ocean-subtle text-primary-container";

type Tool = {
  label: string;
  title: string;
  mark?: string;
  run: (e: Editor) => void;
  active?: (e: Editor) => boolean;
};

const TOOLS: Tool[] = [
  { label: "B", title: "Tebal", run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive("bold") },
  { label: "I", title: "Miring", run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive("italic") },
  {
    label: "H",
    title: "Subjudul",
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e) => e.isActive("heading", { level: 2 }),
  },
  {
    label: "• List",
    title: "Daftar poin",
    run: (e) => e.chain().focus().toggleBulletList().run(),
    active: (e) => e.isActive("bulletList"),
  },
  {
    label: "1. List",
    title: "Daftar bernomor",
    run: (e) => e.chain().focus().toggleOrderedList().run(),
    active: (e) => e.isActive("orderedList"),
  },
];

export default function RichTextEditor({
  value,
  onChange,
  label = "Isi materi",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const editor = useEditor({
    // Editor tidak dirender saat SSR: kontennya butuh DOM, dan merendernya di
    // server membuat markup awal beda dengan hasil hidrasi.
    immediatelyRender: false,
    // Default v3 adalah false: tanpa ini tombol tidak pernah menyala/mati
    // mengikuti posisi kursor, jadi guru tidak tahu sedang mengetik di dalam apa.
    shouldRerenderOnTransaction: true,
    extensions: [
      // Sisanya (blockquote, codeBlock, horizontalRule, strike, underline, code)
      // dimatikan karena markdown.ts tidak bisa merendernya — tombolnya tidak
      // ada, tapi pintasan keyboard dan paste tetap bisa membuatnya.
      StarterKit.configure({
        heading: { levels: [2] },
        link: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        underline: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        isAllowedUri: (url) => SAFE_SCHEME.test(url),
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: toDoc(value),
    onUpdate: ({ editor }) => onChange(toMarkdown(editor.getJSON() as Doc)),
    editorProps: {
      attributes: {
        // contenteditable tidak bisa dijangkau <label for>; role + aria-label
        // yang membuatnya terbaca screen reader.
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class:
          "min-h-40 px-3.5 py-3 t-body text-text-primary focus:outline-none [&_h2]:t-title [&_h2]:text-text-primary [&_h2]:mt-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_p]:my-1.5 [&_li]:my-0.5 [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold",
      },
    },
  });

  // Nilai tidak disinkron balik dari prop: satu-satunya penulis `body` adalah
  // editor ini, dan setContent() saat mengetik akan memindahkan kursor ke awal.

  function link() {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Alamat tautan (https://, mailto:, atau tel:)", "https://");
    if (!url) return;
    if (!SAFE_SCHEME.test(url)) {
      window.alert("Tautan harus diawali https://, http://, mailto:, atau tel:");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.title}
            aria-label={t.title}
            aria-pressed={editor ? t.active?.(editor) : false}
            disabled={!editor}
            onClick={() => editor && t.run(editor)}
            className={`${btn} ${editor && t.active?.(editor) ? on : off}`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          title="Tautan"
          aria-label="Tautan"
          aria-pressed={editor?.isActive("link") ?? false}
          disabled={!editor}
          onClick={link}
          className={`${btn} ${editor?.isActive("link") ? on : off}`}
        >
          Tautan
        </button>
      </div>

      <div className="border border-border-subtle rounded-xl bg-surface-card focus-within:ring-3 focus-within:ring-primary-container/20 focus-within:border-primary-container transition">
        <EditorContent editor={editor} />
      </div>

      <p className="t-label-md text-text-muted">
        Teks diformat langsung di kotak. Enter membuat paragraf baru, Shift+Enter pindah baris
        dalam paragraf yang sama.
      </p>
    </div>
  );
}
