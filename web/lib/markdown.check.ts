// Self-check tanpa framework: `bun lib/markdown.check.ts`.
import assert from "node:assert/strict";
import { parseInline, parseMarkdown } from "./markdown";

// Tebal, miring, dan teks biasa dalam satu baris.
assert.deepEqual(parseInline("a **b** c *d*"), [
  { t: "text", v: "a " },
  { t: "bold", v: "b" },
  { t: "text", v: " c " },
  { t: "italic", v: "d" },
]);

// Tautan aman jadi link; skema berbahaya turun jadi teks, isinya tetap terbaca.
assert.deepEqual(parseInline("[BK](tel:119)"), [{ t: "link", v: "BK", href: "tel:119" }]);
for (const bad of ["[klik](javascript:alert(1))", "[x](data:text/html,abc)", "[y](file:///etc)"]) {
  const nodes = parseInline(bad);
  assert.ok(!nodes.some((n) => n.t === "link"), `${bad} tidak boleh jadi tautan`);
}
assert.deepEqual(parseInline("[x](data:text/html,abc)"), [
  { t: "text", v: "x (data:text/html,abc)" },
]);

// Daftar bernomor & bullet.
const md = parseMarkdown("Intro\n\n1. satu\n2. **dua**\n\n- a\n- b\n\n## Judul");
assert.deepEqual(md.map((b) => b.t), ["p", "ol", "ul", "h"]);
assert.equal(md[1].t === "ol" && md[1].items.length, 2);
assert.deepEqual(md[1].t === "ol" && md[1].items[1], [{ t: "bold", v: "dua" }]);

// Enter tunggal = pindah baris di dalam satu paragraf; enter ganda memisah
// paragraf. Materi seperti "**1. Fisik**" + penjelasan di bawahnya bergantung
// pada break ini — kalau digabung spasi, judul kecilnya menempel ke isi.
const p = parseMarkdown("baris satu\nbaris dua\n\nparagraf lain");
assert.equal(p.length, 2);
assert.deepEqual(p[0], {
  t: "p",
  children: [{ t: "text", v: "baris satu" }, { t: "br" }, { t: "text", v: "baris dua" }],
});

// Tidak ada HTML yang lolos jadi markup: kurung sudut tetap jadi teks.
assert.deepEqual(parseInline("<img src=x onerror=alert(1)>"), [
  { t: "text", v: "<img src=x onerror=alert(1)>" },
]);

// Input kosong tidak meledak.
assert.deepEqual(parseMarkdown(""), []);
assert.deepEqual(parseMarkdown("\n\n  \n"), []);

console.log("ok");
