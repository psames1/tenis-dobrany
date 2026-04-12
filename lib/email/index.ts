// Barrel re-exports for backwards compatibility
// Old code: import { sendEmail } from '@/lib/email'
// New code: import { sendEmail } from '@/lib/email/mailer' (preferred)
export { sendEmail } from './mailer'
export { stripHtml, buildArticleEmailHtml } from './templates'
