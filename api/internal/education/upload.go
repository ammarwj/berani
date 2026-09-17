package education

import (
	"io"
	"net/http"
	"strings"
)

const maxImageSize = 5 << 20 // 5 MB

var allowedImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

// UploadImage stores an image used inside a module's content ("isi materi")
// and returns the path students' browsers load it from. Kept under
// education/ rather than report/: these objects are meant to be served back
// out publicly (see ServeUpload), unlike report evidence behind SignedURL.
func (h *Handler) UploadImage(w http.ResponseWriter, r *http.Request) {
	if h.Storage == nil {
		http.Error(w, "penyimpanan gambar belum dikonfigurasi", http.StatusServiceUnavailable)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxImageSize)
	if err := r.ParseMultipartForm(maxImageSize); err != nil {
		http.Error(w, "file terlalu besar (maks 5 MB)", http.StatusRequestEntityTooLarge)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file tidak ditemukan", http.StatusBadRequest)
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if !allowedImageTypes[contentType] {
		http.Error(w, "tipe file tidak didukung (gunakan JPG, PNG, WEBP, atau GIF)", http.StatusUnsupportedMediaType)
		return
	}

	key, err := h.Storage.Upload(r.Context(), "materi", header.Filename, contentType, file)
	if err != nil {
		http.Error(w, "gagal mengunggah gambar", http.StatusBadGateway)
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

	body, contentType, err := h.Storage.Get(r.Context(), key)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer body.Close()

	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	// Kuncinya berisi acakan, bukan nama file — URL yang sama tidak pernah
	// menunjuk konten berbeda, jadi aman di-cache selamanya.
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	io.Copy(w, body)
}
