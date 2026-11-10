package education

import (
	"io"
	"net/http"
	"strconv"
	"strings"
)

const (
	maxImageSize = 5 << 20  // 5 MB
	maxVideoSize = 50 << 20 // 50 MB
)

var allowedImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

// Hanya wadah yang bisa diputar <video> di Chrome Android tanpa plugin apa pun.
// Tidak ada MKV/AVI: keduanya terunggah mulus lalu diam-diam gagal diputar di
// halaman siswa, dan guru baru tahu setelah materinya terbit.
var allowedVideoTypes = map[string]bool{
	"video/mp4":       true,
	"video/webm":      true,
	"video/quicktime": true, // .mov — keluaran default kamera iPhone
}

// UploadImage stores an image used inside a module's content ("isi materi")
// and returns the path students' browsers load it from. Kept under
// education/ rather than report/: these objects are meant to be served back
// out publicly (see ServeUpload), unlike report evidence behind SignedURL.
func (h *Handler) UploadImage(w http.ResponseWriter, r *http.Request) {
	h.upload(w, r, maxImageSize, allowedImageTypes,
		"tipe file tidak didukung (gunakan JPG, PNG, WEBP, atau GIF)")
}

// UploadVideo menerima video yang diputar langsung di halaman materi — bukan
// embed YouTube. Batas 50 MB, sepuluh kali lipat gambar: satu menit rekaman
// ponsel saja sudah belasan MB, dan video yang ditolak tanpa alasan jelas akan
// dikira aplikasinya rusak. Objeknya ikut prefix "materi/" supaya ServeUpload
// dan uploadKeys (pembersih saat materi dihapus) berlaku sama untuk keduanya.
func (h *Handler) UploadVideo(w http.ResponseWriter, r *http.Request) {
	h.upload(w, r, maxVideoSize, allowedVideoTypes,
		"tipe video tidak didukung (gunakan MP4, WEBM, atau MOV)")
}

func (h *Handler) upload(w http.ResponseWriter, r *http.Request, maxSize int64, allowed map[string]bool, typeErr string) {
	if h.Storage == nil {
		http.Error(w, "penyimpanan berkas belum dikonfigurasi", http.StatusServiceUnavailable)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxSize)
	if err := r.ParseMultipartForm(maxSize); err != nil {
		http.Error(w, "file terlalu besar (maks "+strconv.FormatInt(maxSize>>20, 10)+" MB)", http.StatusRequestEntityTooLarge)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file tidak ditemukan", http.StatusBadRequest)
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if !allowed[contentType] {
		http.Error(w, typeErr, http.StatusUnsupportedMediaType)
		return
	}

	key, err := h.Storage.Upload(r.Context(), "materi", header.Filename, contentType, file)
	if err != nil {
		http.Error(w, "gagal mengunggah berkas", http.StatusBadGateway)
		return
	}
	writeJSON(w, map[string]string{"path": "/uploads/" + key})
}

// ServeUpload streams a materi image back out. Public and unauthenticated —
// materi sendiri sudah bisa dibaca tanpa login (optionalAuth) — tapi hanya
// melayani key berawalan "materi/", supaya route ini tidak diam-diam jadi
// jalan pintas membaca lampiran laporan yang seharusnya privat.
func (h *Handler) ServeUpload(w http.ResponseWriter, r *http.Request) {
	if h.Storage == nil {
		http.NotFound(w, r)
		return
	}
	key := r.PathValue("key")
	if !strings.HasPrefix(key, "materi/") {
		http.NotFound(w, r)
		return
	}

	// Range diteruskan ke R2, bukan diabaikan: <video> meminta potongan file
	// untuk seek, dan browser yang tidak mendapat 206 memperlakukan videonya
	// sebagai tidak bisa dilompati — di Chrome Android sering gagal play sama
	// sekali. Accept-Ranges selalu diumumkan supaya browser tahu boleh meminta.
	obj, err := h.Storage.Get(r.Context(), key, r.Header.Get("Range"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer obj.Body.Close()

	if obj.ContentType != "" {
		w.Header().Set("Content-Type", obj.ContentType)
	}
	// Kuncinya berisi acakan, bukan nama file — URL yang sama tidak pernah
	// menunjuk konten berbeda, jadi aman di-cache selamanya.
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("Accept-Ranges", "bytes")
	if obj.ContentLength > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(obj.ContentLength, 10))
	}
	if obj.ContentRange != "" {
		w.Header().Set("Content-Range", obj.ContentRange)
		w.WriteHeader(http.StatusPartialContent)
	}
	io.Copy(w, obj.Body)
}
