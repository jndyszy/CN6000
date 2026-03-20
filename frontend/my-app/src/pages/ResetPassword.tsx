import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { confirmPasswordReset } from '../api/auth'
import { useLanguage } from '../context/LanguageContext'

function ResetPassword() {
  const location = useLocation()
  const email = (location.state as { email?: string })?.email ?? ''
  const { lang, t, toggle } = useLanguage()

  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const validate = () => {
    if (!/^\d{6}$/.test(otpCode)) return t('auth.otpError')
    if (newPassword.length < 6) return t('auth.newPasswordError')
    if (newPassword !== confirmPassword) return t('auth.passwordMismatch')
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setError('')
    setLoading(true)
    try {
      await confirmPasswordReset(email, otpCode, newPassword)
      navigate('/', { state: { message: t('auth.resetSuccess') } })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetFailed'))
    } finally {
      setLoading(false)
    }
  }

  const LangToggle = (
    <button style={s.langToggle} onClick={toggle}>
      <span style={lang === 'en' ? s.langActive : s.langInactive}>EN</span>
      <span style={s.langSep}> | </span>
      <span style={lang === 'zh' ? s.langActive : s.langInactive}>中文</span>
    </button>
  )

  if (!email) {
    return (
      <div className="auth-page">
        {LangToggle}
        <div className="auth-card">
          <p style={{ textAlign: 'center', color: '#555', fontSize: '14px' }}>
            {t('auth.pageExpired')}
            <Link to="/forgot-password" style={s.link}> {t('auth.forgotPasswordLink')}</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      {LangToggle}
      <div className="auth-card">
        <h2 style={s.title}>{t('auth.resetPasswordTitle')}</h2>
        <p style={s.desc}>{t('auth.codeSentTo')}<br /><strong>{email}</strong></p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>{t('auth.otp')}</label>
            <input
              type="text"
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('auth.otpPlaceholder')}
              maxLength={6}
              required
              style={s.input}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>{t('auth.newPassword')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder2')}
              required
              style={s.input}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>{t('auth.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              required
              style={s.input}
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={loading} style={{ ...s.button, ...(loading ? s.disabled : {}) }}>
            {loading ? t('auth.resetting') : t('auth.resetPasswordBtn')}
          </button>
        </form>

        <div style={s.footer}>
          <Link to="/forgot-password" style={s.link}>{t('auth.resendCode')}</Link>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  langToggle: {
    position: 'fixed',
    top: '16px',
    right: '20px',
    padding: '4px 10px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '20px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  langActive: {
    fontWeight: 700,
    color: '#4f46e5',
  },
  langInactive: {
    fontWeight: 400,
    color: '#9ca3af',
  },
  langSep: {
    color: '#d1d5db',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '22px',
    fontWeight: 600,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  desc: {
    margin: '0 0 24px',
    fontSize: '13px',
    color: '#888',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#555',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  error: {
    margin: 0,
    fontSize: '13px',
    color: '#e53e3e',
  },
  button: {
    padding: '11px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '15px',
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: '4px',
  },
  disabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  footer: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '20px',
  },
  link: {
    color: '#4f46e5',
    textDecoration: 'none',
    fontSize: '14px',
  },
}

export default ResetPassword
