import { useNavigate, Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'

function Settings() {
  const navigate = useNavigate()
  const { lang, t, toggle } = useLanguage()

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>{t('nav.back')}</button>
        <span style={s.headerTitle}>{t('settings.title')}</span>
      </header>

      <div className="page-body" style={s.body}>
        <div style={s.card}>
          <div style={s.row}>
            <span style={s.rowLabel}>{t('settings.language')}</span>
            <button style={s.langBtn} onClick={toggle}>
              <span style={lang === 'en' ? s.langActive : s.langInactive}>EN</span>
              <span style={s.langSep}> | </span>
              <span style={lang === 'zh' ? s.langActive : s.langInactive}>中文</span>
            </button>
          </div>
        </div>

        <div style={s.card}>
          <Link to="/profile/edit" style={s.linkRow}>
            <span style={s.rowLabel}>{t('settings.editProfile')}</span>
            <span style={s.chevron}>›</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f4f5f7',
  },
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 20px', height: '56px',
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  backBtn: {
    background: 'none', border: 'none',
    fontSize: '14px', color: '#6b7280',
    cursor: 'pointer', padding: '4px 8px',
  },
  headerTitle: {
    fontSize: '16px', fontWeight: 600, color: '#1a1a1a',
  },
  body: {
    maxWidth: '480px', margin: '0 auto', padding: '20px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  card: {
    background: '#fff', borderRadius: '10px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px',
  },
  linkRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', color: '#1a1a1a',
  },
  rowLabel: {
    fontSize: '14px', color: '#1a1a1a',
  },
  chevron: {
    color: '#9ca3af', fontSize: '18px',
  },
  langBtn: {
    padding: '4px 10px',
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '20px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
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
}

export default Settings
