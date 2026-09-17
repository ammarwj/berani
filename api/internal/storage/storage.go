// Package storage uploads report evidence to Cloudflare R2 (S3-compatible).
package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"berani.id/api/internal/config"
)

var ErrNotConfigured = errors.New("object storage not configured")

type Storage struct {
	client *s3.Client
	bucket string
}

func New(cfg config.R2Config) *Storage {
	if !cfg.Configured() {
		return nil
	}
	client := s3.New(s3.Options{
		Region:       "auto",
		BaseEndpoint: aws.String(cfg.URL()),
		// R2 does not support virtual-host style addressing for the S3 API.
		UsePathStyle: true,
		Credentials: credentials.NewStaticCredentialsProvider(
			cfg.AccessKeyID, cfg.SecretAccessKey, "",
		),
	})
	return &Storage{client: client, bucket: cfg.Bucket}
}

// Upload stores the object under a random key. The key intentionally encodes no
// user identity, so attachments on anonymous reports stay unlinkable.
func (s *Storage) Upload(ctx context.Context, filename, contentType string, body io.Reader) (string, error) {
	if s == nil {
		return "", ErrNotConfigured
	}
	key, err := randomKey(filename)
	if err != nil {
		return "", err
	}
	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", err
	}
	return key, nil
}

// SignedURL grants short-lived read access so admins can view evidence without
// the bucket being public.
func (s *Storage) SignedURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	if s == nil {
		return "", ErrNotConfigured
	}
	req, err := s3.NewPresignClient(s.client).PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

func randomKey(filename string) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	ext := strings.ToLower(filepath.Ext(filename))
	if len(ext) > 10 {
		ext = ""
	}
	return "reports/" + hex.EncodeToString(b) + ext, nil
}
