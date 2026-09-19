package mailer

import (
	"html/template"
	"strings"
)

// Email is one transactional message: a short explanation and exactly one
// action. Every field is content, never markup — the layout lives here so the
// three call sites stay readable and stay consistent with each other.
type Email struct {
	Subject string
	Heading string
	Intro   string
	Action  string // button label, phrased as what happens when clicked
	URL     string
	Expiry  string // e.g. "Tautan ini berlaku 24 jam."
	Note    string // what to do if this wasn't you
}

// Text is the plain-text alternative. It is not a fallback afterthought: mail
// clients that show text-only, and spam filters that score HTML-only mail
// harshly, both depend on it.
func (e Email) Text() string {
	var b strings.Builder
	b.WriteString(e.Heading + "\n\n")
	b.WriteString(e.Intro + "\n\n")
	b.WriteString(e.Action + ":\n" + e.URL + "\n\n")
	if e.Expiry != "" {
		b.WriteString(e.Expiry + "\n\n")
	}
	if e.Note != "" {
		b.WriteString(e.Note + "\n\n")
	}
	b.WriteString("--\nBERANI — ruang aman untuk belajar dan bersuara.\n")
	return b.String()
}

// HTML renders the message for mail clients.
//
// Table layout and inline styles throughout, deliberately: Outlook renders mail
// with the Word engine, which has no flexbox or grid, and Gmail strips <style>
// blocks in several contexts. Anything expressed as a class would silently
// vanish for a large share of recipients.
//
// No remote images either. Gmail hides images by default, so a logo <img> shows
// as a broken box on first open — on a mail whose whole job is to look
// trustworthy, that is worse than no logo at all. The brand mark is type and a
// gradient rule, which always render.
func (e Email) HTML() string {
	var b strings.Builder
	if err := emailTmpl.Execute(&b, e); err != nil {
		// Templating a struct of plain strings cannot fail at runtime; degrade
		// to text rather than dropping an email a student is waiting on.
		return "<pre>" + template.HTMLEscapeString(e.Text()) + "</pre>"
	}
	return b.String()
}

var emailTmpl = template.Must(template.New("email").Parse(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{{.Subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f9ff;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">{{.Intro}}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8f9ff" style="background-color:#f8f9ff;">
<tr>
<td align="center" style="padding:32px 16px;">

<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;">

<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:14px;overflow:hidden;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td height="4" bgcolor="#2563eb" style="height:4px;line-height:4px;font-size:0;background-color:#2563eb;background-image:linear-gradient(90deg,#2563eb 0%,#06b6d4 100%);">&nbsp;</td>
</tr>
<tr>
<td style="padding:32px 36px 36px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<div style="font-size:14px;font-weight:700;letter-spacing:0.28em;color:#1e3a8a;">BERANI</div>

<h1 style="margin:22px 0 0 0;font-size:23px;line-height:30px;font-weight:700;letter-spacing:-0.01em;color:#0f172a;">{{.Heading}}</h1>

<p style="margin:12px 0 0 0;font-size:15px;line-height:25px;color:#334155;">{{.Intro}}</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0 0;">
<tr>
<td bgcolor="#2563eb" style="background-color:#2563eb;border-radius:8px;">
<a href="{{.URL}}" style="display:inline-block;padding:13px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;">{{.Action}}</a>
</td>
</tr>
</table>

{{if .Expiry}}<p style="margin:18px 0 0 0;font-size:13px;line-height:20px;color:#64748b;">{{.Expiry}}</p>{{end}}

<div style="margin:26px 0 0 0;border-top:1px solid #e2e8f0;"></div>

<p style="margin:18px 0 0 0;font-size:13px;line-height:20px;color:#64748b;">Kalau tombolnya tidak bisa diklik, salin tautan ini ke browser:</p>
<p style="margin:6px 0 0 0;font-size:13px;line-height:20px;word-break:break-all;"><a href="{{.URL}}" style="color:#2563eb;text-decoration:underline;">{{.URL}}</a></p>

{{if .Note}}<p style="margin:18px 0 0 0;font-size:13px;line-height:20px;color:#64748b;">{{.Note}}</p>{{end}}

</td>
</tr>
</table>

</td>
</tr>

<tr>
<td style="padding:18px 36px 0 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#94a3b8;">
BERANI — ruang aman untuk belajar dan bersuara.
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`))
