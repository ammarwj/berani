package main

import (
	"os"

	"berani.id/api/internal/mailer"
)

func main() {
	all := map[string]mailer.Email{
		"reset": {
			Subject: "Atur ulang password BERANI",
			Heading: "Buat password baru",
			Intro:   "Kami menerima permintaan untuk mengatur ulang password akun BERANI-mu.",
			Action:  "Buat password baru",
			URL:     "https://berani.site/reset-password?token=8f3a91c4e7b25d06af1938bc4d5e2071",
			Expiry:  "Tautan ini berlaku 1 jam.",
			Note:    "Kalau kamu tidak meminta ini, abaikan saja email ini. Password lamamu tetap aktif.",
		},
		"admin": {
			Subject: "Atur ulang password BERANI",
			Heading: "Admin sekolah mengatur ulang passwordmu",
			Intro:   "Admin sekolah meminta pengaturan ulang password akun BERANI-mu. Buat password baru untuk bisa masuk lagi.",
			Action:  "Buat password baru",
			URL:     "https://berani.site/reset-password?token=8f3a91c4e7b25d06af1938bc4d5e2071",
			Expiry:  "Tautan ini berlaku 1 jam.",
			Note:    "Kalau kamu merasa ini keliru, hubungi guru pendamping di sekolahmu.",
		},
	}
	for name, e := range all {
		os.WriteFile("/tmp/mailpreview/"+name+".html", []byte(e.HTML()), 0644)
	}
}
