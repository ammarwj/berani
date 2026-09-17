// Self-check tanpa framework: `bunx tsx lib/quiz.check.ts` atau `bun lib/quiz.check.ts`.
import assert from "node:assert/strict";
import { removeOption, type Q } from "./quiz";

const q = (correct_index: number, n = 4): Q => ({
  question: "Q",
  options: Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)),
  correct_index,
});

// Kuncinya setelah yang dihapus: bergeser mundur, jawaban tetap sama.
let r = removeOption(q(2), 0);
assert.deepEqual(r.options, ["B", "C", "D"]);
assert.equal(r.options[r.correct_index], "C");

// Kuncinya sebelum yang dihapus: tidak bergeser.
r = removeOption(q(1), 3);
assert.equal(r.options[r.correct_index], "B");

// Kunci itu sendiri yang dihapus: jatuh ke opsi lain, tetap dalam rentang.
r = removeOption(q(3), 3);
assert.equal(r.correct_index, 2);
assert.ok(r.correct_index < r.options.length);

// Menghapus sampai satu opsi tersisa tidak boleh menghasilkan indeks negatif.
r = removeOption(removeOption(removeOption(q(0), 3), 2), 1);
assert.deepEqual(r.options, ["A"]);
assert.equal(r.correct_index, 0);

console.log("ok");
