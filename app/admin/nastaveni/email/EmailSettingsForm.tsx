'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { saveOrgSmtpSettings, sendTestEmail } from '@/lib/email/actions'

type Props = {
  userEmail: string
  userRole: string
  orgName: string | null
  orgId: string | null
  defaultSmtp: {
    host: string
    port: string
    user: string
    fromName: string
    fromEmail: string
  } | null
  orgSmtp: {
    smtp_enabled: boolean
    smtp_host: string | null
    smtp_port: number | null
    smtp_user: string | null
    smtp_from_name: string | null
    smtp_from_email: string | null
  } | null
}

export default function EmailSettingsForm({
  userEmail,
  userRole,
  orgName,
  orgId,
  defaultSmtp,
  orgSmtp,
}: Props) {
  // Org SMTP state
  const [smtpEnabled, setSmtpEnabled] = useState(orgSmtp?.smtp_enabled ?? false)
  const [smtpHost, setSmtpHost] = useState(orgSmtp?.smtp_host ?? '')
  const [smtpPort, setSmtpPort] = useState(String(orgSmtp?.smtp_port ?? 465))
  const [smtpUser, setSmtpUser] = useState(orgSmtp?.smtp_user ?? '')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpFromName, setSmtpFromName] = useState(orgSmtp?.smtp_from_name ?? '')
  const [smtpFromEmail, setSmtpFromEmail] = useState(orgSmtp?.smtp_from_email ?? '')
  const [saveResult, setSaveResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // Test email state
  const [testTo, setTestTo] = useState(userEmail)
  const [testSmtp, setTestSmtp] = useState<'default' | 'org'>('default')
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string; sentFrom?: string } | null>(null)
  const [testing, setTesting] = useState(false)

  async function handleSaveSmtp(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveResult(null)

    const fd = new FormData()
    fd.set('smtp_enabled', smtpEnabled ? '1' : '0')
    fd.set('smtp_host', smtpHost)
    fd.set('smtp_port', smtpPort)
    fd.set('smtp_user', smtpUser)
    fd.set('smtp_password', smtpPassword)
    fd.set('smtp_from_name', smtpFromName)
    fd.set('smtp_from_email', smtpFromEmail)

    const result = await saveOrgSmtpSettings(fd)
    setSaveResult(result)
    setSaving(false)
    if (result.success) setSmtpPassword('')
  }

  async function handleTest() {
    if (!testTo.trim()) return
    setTesting(true)
    setTestResult(null)

    const result = await sendTestEmail(testTo.trim(), testSmtp === 'org')
    setTestResult(result)
    setTesting(false)
  }

  return (
    <div className="space-y-8">
      {/* ─── SEKCE A: Globální SMTP (jen admin) ─── */}
      {defaultSmtp && userRole === 'admin' && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Výchozí SMTP (globální)</h2>
          <p className="text-sm text-gray-500 mb-4">
            Toto nastavení platí pro celou platformu SportKalendář jako výchozí.
            Konfigurace se mění v systémových proměnných serveru.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <Row label="Host" value={defaultSmtp.host} />
            <Row label="Port" value={defaultSmtp.port} />
            <Row label="Uživatel" value={defaultSmtp.user} />
            <Row label="Odesílatel" value={`${defaultSmtp.fromName} <${defaultSmtp.fromEmail}>`} />
          </div>
        </section>
      )}

      {/* ─── SEKCE B: Vlastní SMTP organizace ─── */}
      {orgId && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Vlastní SMTP {orgName ? `pro ${orgName}` : 'organizace'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {smtpEnabled
                  ? 'Emaily se odesílají z vašeho vlastního SMTP serveru.'
                  : 'Emaily se odesílají z výchozí adresy SportKalendář.'}
              </p>
            </div>
            <Switch
              checked={smtpEnabled}
              onCheckedChange={(v: boolean) => setSmtpEnabled(v)}
            />
          </div>

          {smtpEnabled && (
            <form onSubmit={handleSaveSmtp} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="SMTP Host" value={smtpHost} onChange={setSmtpHost} placeholder="smtp.gmail.com" required />
                <Field label="SMTP Port" value={smtpPort} onChange={setSmtpPort} placeholder="465" type="number" required />
                <Field label="SMTP Uživatel" value={smtpUser} onChange={setSmtpUser} placeholder="email@example.com" required />
                <Field
                  label="SMTP Heslo"
                  value={smtpPassword}
                  onChange={setSmtpPassword}
                  placeholder={orgSmtp?.smtp_user ? 'Zadejte pro změnu hesla' : 'Heslo'}
                  type="password"
                />
              </div>

              <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Jméno odesílatele" value={smtpFromName} onChange={setSmtpFromName} placeholder="TJ Dobřany" />
                <Field label="Email odesílatele" value={smtpFromEmail} onChange={setSmtpFromEmail} placeholder="info@tj-dobrany.cz" type="email" />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Ukládám…' : 'Uložit nastavení'}
                </button>
                {saveResult && (
                  <span className={`text-sm ${saveResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {saveResult.success ? '✓ Uloženo' : `✗ ${saveResult.error}`}
                  </span>
                )}
              </div>
            </form>
          )}
        </section>
      )}

      {/* ─── SEKCE C: Test odeslání ─── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Test odeslání emailu</h2>
        <p className="text-sm text-gray-500 mb-4">
          Odešlete testovací email a ověřte, že SMTP konfigurace funguje správně.
        </p>

        <div className="space-y-4">
          <Field label="Cílový email" value={testTo} onChange={setTestTo} placeholder="vas@email.cz" type="email" />

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Odeslat přes:</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="smtp_source"
                value="default"
                checked={testSmtp === 'default'}
                onChange={() => setTestSmtp('default')}
                className="accent-green-600"
              />
              <span className="text-sm text-gray-700">Výchozí SMTP (SportKalendář)</span>
            </label>
            {orgId && smtpEnabled && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="smtp_source"
                  value="org"
                  checked={testSmtp === 'org'}
                  onChange={() => setTestSmtp('org')}
                  className="accent-green-600"
                />
                <span className="text-sm text-gray-700">Vlastní SMTP {orgName ?? 'organizace'}</span>
              </label>
            )}
          </div>

          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !testTo.trim()}
            className="px-5 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
          >
            {testing ? 'Odesílám…' : 'Odeslat test'}
          </button>

          {testResult && (
            <div className={`rounded-lg p-4 text-sm ${testResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {testResult.success ? (
                <>
                  <p className="font-medium">✅ Email odeslán na {testTo}</p>
                  {testResult.sentFrom && (
                    <p className="mt-1 text-xs opacity-80">Odesláno z: {testResult.sentFrom}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-medium">❌ Chyba při odesílání</p>
                  <p className="mt-1 font-mono text-xs">{testResult.error}</p>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-mono text-xs">{value}</span>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
      />
    </div>
  )
}
