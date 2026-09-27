// Isi dialog hapus untuk materi & skenario. Terpisah dari komponennya supaya
// daftar dan editor memakai kalimat yang sama persis — copy-nya bagian dari
// kontrak, sama seperti di form lapor: angka yang disebut di sini satu-satunya
// kesempatan admin menyadari bedanya membuang draf kosong dengan menghanguskan
// nilai kuis puluhan siswa.
import type { Footprint } from "@/components/DeleteContentDialog";

export type ModuleFootprint = {
  completed: number;
  started: number;
  images: number;
};

export function describeModule(f: ModuleFootprint): Footprint {
  return {
    body:
      f.started === 0 ? (
        <p className="t-body-sm text-text-muted">
          Belum ada siswa yang membuka materi ini, jadi tidak ada progres yang hilang.
          {f.images > 0 && ` ${f.images} gambar isi materi ikut dihapus.`}
        </p>
      ) : (
        <div className="rounded-xl bg-danger-subtle p-space-sm flex flex-col gap-1">
          <p className="t-label-md text-danger-rose">Yang hilang permanen:</p>
          <ul className="t-body-sm text-text-primary list-disc pl-5">
            <li>
              progres {f.started} siswa — {f.completed} di antaranya sudah menyelesaikan materi
              ini, beserta nilai kuisnya
            </li>
            {f.images > 0 && <li>{f.images} gambar isi materi</li>}
          </ul>
          <p className="t-body-sm text-text-primary mt-1">
            Badge siswa dihitung dari materi terbit, jadi penyebutnya menyusut dan persentase lama
            tidak bisa direkonstruksi.
          </p>
        </div>
      ),
  };
}

export type ScenarioFootprint = {
  attempts: number;
  students: number;
};

export function describeScenario(f: ScenarioFootprint): Footprint {
  return {
    body:
      f.attempts === 0 ? (
        <p className="t-body-sm text-text-muted">
          Belum ada siswa yang mencoba skenario ini, jadi tidak ada percobaan yang hilang.
        </p>
      ) : (
        <div className="rounded-xl bg-danger-subtle p-space-sm flex flex-col gap-1">
          <p className="t-label-md text-danger-rose">Yang hilang permanen:</p>
          <ul className="t-body-sm text-text-primary list-disc pl-5">
            <li>
              {f.attempts} percobaan dari {f.students} siswa, beserta skornya
            </li>
          </ul>
          <p className="t-body-sm text-text-primary mt-1">
            Halaman progres latihan menghitung dari skenario terbit, jadi angka lama tidak bisa
            direkonstruksi.
          </p>
        </div>
      ),
  };
}
