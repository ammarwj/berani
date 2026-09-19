package mailer

import (
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strings"

	"berani.id/api/internal/config"
)

var ErrNotConfigured = errors.New("smtp not configured")

type Mailer struct {
	cfg config.SMTPConfig
}

// Config exposes the settings for diagnostics. Password is never returned.
func (m *Mailer) Config() config.SMTPConfig { return m.cfg }

// Check opens a real session and authenticates without sending anything, so a
// wrong password or a blocked port surfaces on demand instead of only when a
// student happens to register.
//
// It dials exactly the way Send does — stdlib smtp.SendMail speaks plaintext
// then STARTTLS, so implicit-TLS port 465 is rejected here rather than reported
// healthy by a check that Send could not have passed.
func (m *Mailer) Check() error {
	if m == nil || !m.cfg.Configured() {
		return ErrNotConfigured
	}
	if m.cfg.Port == "465" {
		return errors.New("port 465 (implicit TLS) tidak didukung net/smtp — pakai port 587 (STARTTLS)")
	}

	addr := net.JoinHostPort(m.cfg.Host, m.cfg.Port)
	c, err := smtp.Dial(addr)
	if err != nil {
		return fmt.Errorf("dial %s: %w", addr, err)
	}
	defer c.Close()

	if ok, _ := c.Extension("STARTTLS"); ok {
		if err := c.StartTLS(&tls.Config{ServerName: m.cfg.Host}); err != nil {
			return fmt.Errorf("starttls: %w", err)
		}
	}
	if m.cfg.Username != "" {
		if err := c.Auth(smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)); err != nil {
			return fmt.Errorf("auth: %w", err)
		}
	}
	return c.Quit()
}

func New(cfg config.SMTPConfig) *Mailer {
	return &Mailer{cfg: cfg}
}

// Send delivers an email, or logs it when SMTP is unconfigured so local dev
// can still complete verification and reset flows.
func (m *Mailer) Send(to, subject, body string) error {
	return m.send(to, subject, body, "")
}

// SendEmail delivers a designed message as multipart/alternative. The plain
// part is what gets logged in dev and what text-only clients show.
func (m *Mailer) SendEmail(to string, e Email) error {
	return m.send(to, e.Subject, e.Text(), e.HTML())
}

func (m *Mailer) send(to, subject, text, html string) error {
	if !m.cfg.Configured() {
		log.Printf("[mailer: no SMTP configured] to=%s subject=%q\n%s", to, subject, text)
		return nil
	}

	msg := buildMessage(m.cfg.From, to, subject, text, html)

	addr := fmt.Sprintf("%s:%s", m.cfg.Host, m.cfg.Port)
	var auth smtp.Auth
	if m.cfg.Username != "" {
		auth = smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)
	}
	// Envelope sender must be the bare address: SMTP_FROM carries a display name
	// ("BERANI <no-reply@…>") for the header, and relays reject that in MAIL FROM.
	return smtp.SendMail(addr, auth, senderAddress(m.cfg.From), []string{to}, []byte(msg))
}

// senderAddress strips the display name from an RFC 5322 address.
func senderAddress(from string) string {
	if a, err := mail.ParseAddress(from); err == nil {
		return a.Address
	}
	return from
}

// buildMessage assembles the MIME message. With html empty it stays a plain
// text/plain mail; otherwise both parts go out as multipart/alternative, ordered
// simplest-first as RFC 2046 requires — clients render the last part they
// understand, so reversing the order hides the designed version.
func buildMessage(from, to, subject, text, html string) string {
	var b strings.Builder
	b.WriteString("From: " + from + "\r\n")
	b.WriteString("To: " + to + "\r\n")
	// Subjects are Indonesian and may carry non-ASCII; unencoded they arrive as
	// mojibake in strict clients.
	b.WriteString("Subject: " + mime.QEncoding.Encode("UTF-8", subject) + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")

	if html == "" {
		b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
		b.WriteString(text)
		return b.String()
	}

	boundary := "berani-" + randomBoundary()
	b.WriteString("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n\r\n")

	b.WriteString("--" + boundary + "\r\n")
	b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
	b.WriteString(text + "\r\n\r\n")

	b.WriteString("--" + boundary + "\r\n")
	b.WriteString("Content-Type: text/html; charset=UTF-8\r\n\r\n")
	b.WriteString(html + "\r\n\r\n")

	b.WriteString("--" + boundary + "--\r\n")
	return b.String()
}

// randomBoundary keeps the delimiter unguessable so body content can never
// collide with it and truncate the message.
func randomBoundary() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "fallback0000"
	}
	return hex.EncodeToString(b)
}
