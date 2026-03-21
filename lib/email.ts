import nodemailer from 'nodemailer'

/**
 * Creates the SMTP transport from environment variables.
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
}

export async function sendEmail({
  to,
  bcc,
  subject,
  html,
}: {
  to: string | string[]
  bcc?: string | string[]
  subject: string
  html: string
}) {
  const transport = createTransport()
  const from = process.env.SMTP_FROM ?? 'noreply@tenis-dobrany.cz'

  await transport.sendMail({ from, to, bcc, subject, html })
}

/** Strip HTML tags and collapse whitespace — for text preview */
export function stripHtml(html: string, maxLength = 300): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

/** Build the HTML email body for article notifications */
export function buildArticleEmailHtml({
  title,
  excerpt,
  imageUrl,
  articleUrl,
  isNew,
}: {
  title: string
  excerpt: string | null
  imageUrl: string | null
  articleUrl: string
  isNew: boolean
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tenis-dobrany.cz'
  const headerText = isNew ? 'Nový článek' : 'Aktualizovaný článek'

  const imageBlock = imageUrl
    ? `<img src="${imageUrl}" alt="" style="display:block;width:100%;max-height:320px;object-fit:cover;border-radius:8px 8px 0 0;" />`
    : ''

  const excerptBlock = excerpt
    ? `<p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.6;">${excerpt}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#166534;padding:18px 28px;text-align:left;">
            <a href="${siteUrl}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;">🎾 TJ Dobřany</a>
            <span style="display:inline-block;margin-left:12px;background:#15803d;color:#dcfce7;font-size:11px;font-weight:600;padding:2px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em;">${headerText}</span>
          </td>
        </tr>
        <!-- Image -->
        ${imageBlock ? `<tr><td style="padding:0;">${imageBlock}</td></tr>` : ''}
        <!-- Content -->
        <tr>
          <td style="padding:28px;">
            <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${title}</h1>
            ${excerptBlock}
            <a href="${articleUrl}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
              Číst článek →
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
              Tento e-mail byl odeslán, protože jste registrovaným členem webu <a href="${siteUrl}" style="color:#6b7280;">${siteUrl.replace(/^https?:\/\//, '')}</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
