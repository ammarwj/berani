package mailer

import (
	"fmt"
	"log"
	"net/smtp"
	"strings"

	"berani.id/api/internal/config"
)

type Mailer struct {
	cfg config.SMTPConfig
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
