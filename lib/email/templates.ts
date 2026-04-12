/**
 * Email HTML templates — inline styled for maximum email client compatibility.
 */

const GREEN = '#166534'
const GREEN_LIGHT = '#16a34a'
const GRAY_BG = '#f3f4f6'

function baseLayout({
  siteName,
  siteUrl,
  headerBadge,
  body,
}: {
  siteName: string
  siteUrl: string
  headerBadge?: string
  body: string
}) {
  const badge = headerBadge
    ? `<span style="display:inline-block;margin-left:12px;background:#15803d;color:#dcfce7;font-size:11px;font-weight:600;padding:2px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em;">${headerBadge}</span>`
    : ''

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${GRAY_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${GRAY_BG};padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:${GREEN};padding:18px 28px;text-align:left;">
            <a href="${siteUrl}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;">🎾 ${siteName}</a>
            ${badge}
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
              Tento e-mail byl odeslán z webu <a href="${siteUrl}" style="color:#6b7280;">${siteUrl.replace(/^https?:\/\//, '')}</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** Test email template */
export function buildTestEmailHtml({
  siteName,
  siteUrl,
  smtpType,
}: {
  siteName: string
  siteUrl: string
  smtpType: 'default' | 'org'
}) {
  const smtpLabel = smtpType === 'org' ? 'vlastní SMTP organizace' : 'výchozí SMTP SportKalendář'
  return baseLayout({
    siteName,
    siteUrl,
    headerBadge: 'Testovací email',
    body: `
      <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#111827;">✅ Test úspěšný</h1>
      <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6;">
        Tento email byl odeslán pomocí <strong>${smtpLabel}</strong>.
      </p>
      <p style="margin:0;color:#9ca3af;font-size:13px;">
        Odesláno: ${new Date().toLocaleString('cs-CZ')}
      </p>
    `,
  })
}

/** Article notification template */
export function buildArticleEmailHtml({
  siteName,
  siteUrl,
  title,
  excerpt,
  imageUrl,
  articleUrl,
  isNew,
}: {
  siteName: string
  siteUrl: string
  title: string
  excerpt: string | null
  imageUrl: string | null
  articleUrl: string
  isNew: boolean
}) {
  const headerText = isNew ? 'Nový článek' : 'Aktualizovaný článek'

  const imageBlock = imageUrl
    ? `<img src="${imageUrl}" alt="" style="display:block;width:100%;max-height:320px;object-fit:cover;border-radius:8px;margin-bottom:16px;" />`
    : ''

  const excerptBlock = excerpt
    ? `<p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.6;">${excerpt}</p>`
    : ''

  return baseLayout({
    siteName,
    siteUrl,
    headerBadge: headerText,
    body: `
      ${imageBlock}
      <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${title}</h1>
      ${excerptBlock}
      <a href="${articleUrl}" style="display:inline-block;padding:12px 24px;background:${GREEN_LIGHT};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Číst článek →
      </a>
    `,
  })
}

/** Club/org invitation template */
export function buildInvitationEmailHtml({
  siteName,
  siteUrl,
  inviterName,
  loginUrl,
}: {
  siteName: string
  siteUrl: string
  inviterName: string
  loginUrl: string
}) {
  return baseLayout({
    siteName,
    siteUrl,
    headerBadge: 'Pozvánka',
    body: `
      <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#111827;">Byli jste pozváni</h1>
      <p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.6;">
        <strong>${inviterName}</strong> vás zve do členské sekce webu <strong>${siteName}</strong>.
        Klikněte na tlačítko níže pro přihlášení.
      </p>
      <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:${GREEN_LIGHT};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Přihlásit se →
      </a>
      <p style="margin:20px 0 0;color:#9ca3af;font-size:13px;line-height:1.5;">
        Pokud jste tuto pozvánku neočekávali, můžete tento email ignorovat.
      </p>
    `,
  })
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
