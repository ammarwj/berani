export type Q = { question: string; options: string[]; correct_index: number };

// Menghapus opsi harus ikut membetulkan kunci jawaban: buang opsi sebelum kunci
// dan indeksnya bergeser ke jawaban yang salah — tanpa error di mana pun, karena
// indeks barunya masih dalam rentang yang valid dan validateQuiz di server pun
// meloloskannya. Karena itu logikanya dipisah ke sini dan diuji.
export function removeOption(q: Q, oi: number): Q {
  const options = q.options.filter((_, j) => j !== oi);
  const shifted =
    q.correct_index > oi ? q.correct_index - 1 : Math.min(q.correct_index, options.length - 1);
  return { ...q, options, correct_index: Math.max(shifted, 0) };
}
