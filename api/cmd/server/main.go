package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"berani.id/api/internal/config"
	"berani.id/api/internal/crypto"
	"berani.id/api/internal/db"
	"berani.id/api/internal/httpserver"
	"berani.id/api/internal/mailer"
	"berani.id/api/internal/storage"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool, "migrations"); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	// Reflections are encrypted at rest (PRD §8.2); refuse to start without a key
	// rather than silently storing journal entries in the clear.
	cipher, err := crypto.New(cfg.ReflectionKey)
	if err != nil {
		log.Fatalf("REFLECTION_KEY: %v (generate with: openssl rand -hex 32)", err)
	}

	store := storage.New(cfg.R2)
	if store == nil {
		log.Print("R2 not configured — report attachments disabled")
	}
	if !cfg.SMTP.Configured() {
		log.Print("SMTP not configured — verification and reset emails will be logged, not sent")
	}

	handler := httpserver.NewRouter(httpserver.Deps{
		DB:      pool,
		Config:  cfg,
		Cipher:  cipher,
		Storage: store,
		Mailer:  mailer.New(cfg.SMTP),
	})

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("listening on :%s", cfg.Port)
	log.Fatal(srv.ListenAndServe())
}
