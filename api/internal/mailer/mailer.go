package mailer

import (
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"net"
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
	if !m.cfg.Configured() {
		log.Printf("[mailer: no SMTP configured] to=%s subject=%q\n%s", to, subject, body)
		return nil
	}

	msg := strings.Join([]string{
		"From: " + m.cfg.From,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	addr := fmt.Sprintf("%s:%s", m.cfg.Host, m.cfg.Port)
	var auth smtp.Auth
	if m.cfg.Username != "" {
		auth = smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)
	}
	return smtp.SendMail(addr, auth, m.cfg.From, []string{to}, []byte(msg))
}
