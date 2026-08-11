import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api/auth'
import { useLanguage } from '../context/LanguageContext'

function Register() {
  const { lang, t, toggle } = useLanguage()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const validate = () => {
    if (username.length < 3 || username.length > 50) return t('auth.usernameError')
    if (password.length < 6) return t('auth.passwordError')
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setError('')
    setLoading(true)
    try {
      await register(username, email, password)
      navigate('/', { state: { message: t('auth.registerSuccess') } })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registerFailed'))
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
        <div style={s.logo}>{t('app.name')}</div>
        <h2 style={s.title}>{t('auth.register')}</h2>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>{t('auth.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              required
              style={s.input}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              required
              style={s.input}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder2')}
              required
              style={s.input}
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={loading} style={{ ...s.button, ...(loading ? s.disabled : {}) }}>
            {loading ? t('auth.registering') : t('auth.register')}
          </button>
        </form>

        <div style={s.footer}>
          <span style={{ color: '#999', fontSize: '14px' }}>{t('auth.hasAccount')}</span>
          <Link to="/" style={s.link}>{t('auth.goLogin')}</Link>
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
  logo: {
    margin: '0 0 6px',
    fontSize: '20px',
    fontWeight: 700,
    color: '#4f46e5',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 24px',
    fontSize: '22px',
    fontWeight: 600,
    color: '#1a1a1a',
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
    alignItems: 'center',
    gap: '8px',
    marginTop: '20px',
  },
  link: {
    color: '#4f46e5',
    textDecoration: 'none',
    fontSize: '14px',
  },
}

export default Register
