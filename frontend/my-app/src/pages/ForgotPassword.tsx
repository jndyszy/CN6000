import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { sendPasswordResetCode } from '../api/auth'
import { useLanguage } from '../context/LanguageContext'

function ForgotPassword() {
  const { lang, t, toggle } = useLanguage()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await sendPasswordResetCode(email)
      navigate('/reset-password', { state: { email } })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.sendFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <button style={s.langToggle} onClick={toggle}>
        <span style={lang === 'en' ? s.langActive : s.langInactive}>EN</span>
        <span style={s.langSep}> | </span>
        <span style={lang === 'zh' ? s.langActive : s.langInactive}>中文</span>
      </button>
      <div className="auth-card">
        <h2 style={s.title}>{t('auth.forgotPasswordTitle')}</h2>
        <p style={s.desc}>{t('auth.forgotPasswordDesc')}</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholderForgot')}
              required
              style={s.input}
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={loading} style={{ ...s.button, ...(loading ? s.disabled : {}) }}>
            {loading ? t('auth.sending') : t('auth.sendCode')}
          </button>
        </form>

        <div style={s.footer}>
          <Link to="/" style={s.link}>{t('auth.backToLogin')}</Link>
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

export default ForgotPassword
