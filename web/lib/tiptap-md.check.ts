// Self-check tanpa framework: `bun lib/tiptap-md.check.ts`.
import assert from "node:assert/strict";
import { toDoc, toMarkdown, type Doc } from "./tiptap-md";

// Yang paling penting: markdown yang ada di DB harus kembali utuh setelah
// dibuka di editor dan disimpan lagi tanpa diubah. Kalau round-trip ini rusak,
// guru yang cuma membetulkan satu typo bisa merusak seluruh materi.
const SAMPLE = `## Apa itu perundungan?

Perundungan adalah **tindakan agresif** yang *berulang*.

- Fisik: memukul
- Verbal: mengejek

1. Catat kejadiannya
2. Lapor ke [guru BK](tel:119)`;

assert.equal(toMarkdown(toDoc(SAMPLE)), SAMPLE);

// Dokumen kosong: ProseMirror wajib punya minimal satu blok, tapi hasil
// simpannya harus string kosong — bukan "\n\n" yang lolos "wajib diisi".
assert.deepEqual(toDoc(""), { type: "doc", content: [{ type: "paragraph" }] });
assert.equal(toMarkdown(toDoc("")), "");
assert.equal(toMarkdown({ type: "doc", content: [{ type: "paragraph" }, { type: "paragraph" }] }), "");

// Satu teks bisa punya dua mark sekaligus.
assert.equal(
  toMarkdown({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "penting", marks: [{ type: "bold" }, { type: "italic" }] }],
      },
    ],
  } as Doc),
  "***penting***",
);

// Shift+Enter di dalam paragraf jadi baris baru, dan parser markdown
// menyatukannya lagi jadi satu paragraf — bukan dua.
const br: Doc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "baris satu" },
        { type: "hardBreak" },
        { type: "text", text: "baris dua" },
      ],
    },
  ],
};
assert.equal(toMarkdown(br), "baris satu\nbaris dua");
// Dan kembali lagi utuh: satu paragraf berisi break, bukan dua paragraf.
assert.deepEqual(toDoc(toMarkdown(br)), br);

// Node yang tidak dikenal tidak boleh meledak atau menyelundupkan isinya.
assert.equal(
  toMarkdown({
    type: "doc",
    content: [{ type: "image", attrs: { src: "x" } }, { type: "paragraph", content: [{ type: "text", text: "a" }] }],
  } as Doc),
  "a",
);

// Tautan berskema berbahaya tidak pernah sampai ke editor sebagai link —
// parseMarkdown menurunkannya jadi teks, dan itu harus tetap berlaku di sini.
for (const bad of ["[klik](javascript:alert(1))", "[x](data:text/html,abc)", "[y](file:///etc)"]) {
  // Isinya boleh tetap terbaca sebagai teks; yang tidak boleh ada adalah mark
  // link-nya — itu yang membuatnya bisa diklik siswa.
  assert.equal(JSON.stringify(toDoc(bad)).includes('"link"'), false, `${bad} jadi tautan`);
}
assert.ok(JSON.stringify(toDoc("[BK](tel:119)")).includes('"link"'), "tautan aman harus tetap link");

// Isi 5 materi seed yang sebenarnya. Sampel buatan sendiri hanya menguji apa
// yang sempat terpikirkan; yang ini menangkap kasus nyata — "**1. Fisik**"
// dengan enter tunggal sebelum penjelasannya sempat hilang jadi spasi di sini.
import modules from "./__fixtures__/modules.json";
for (const m of modules) {
  assert.equal(toMarkdown(toDoc(m.body)), m.body.trim(), `round-trip mengubah: ${m.title}`);
}

console.log("ok");
