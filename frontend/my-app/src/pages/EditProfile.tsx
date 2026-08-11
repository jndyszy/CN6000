import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { updateProfile, deleteAccount, sendChangePasswordCode, confirmChangePassword } from '../api/users'
import { uploadImage } from '../api/upload'
import { useLanguage } from '../context/LanguageContext'

function EditProfile() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')

  const [username, setUsername] = useState(currentUser.username ?? '')
  const [bio, setBio] = useState(currentUser.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(currentUser.profile_picture ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')

  const [pwdStep, setPwdStep] = useState<'send' | 'confirm'>('send')
  const [pwdSendingCode, setPwdSendingCode] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState('')

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setAvatarUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('upload.failed'))
    } finally {
      setUploading(false)
    }
  }

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')
    setEmailSuccess('')
    setEmailSaving(true)
    try {
      const data = await updateProfile({ email: newEmail })
      const updated = { ...currentUser, ...data.user }
      localStorage.setItem('user', JSON.stringify(updated))
      setEmailSuccess(t('profile.emailUpdated'))
      setNewEmail('')
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : t('profile.saveFailed'))
    } finally {
      setEmailSaving(false)
    }
  }

  const handleSendPasswordCode = async () => {
    setPwdError('')
    setPwdSuccess('')
    setPwdSendingCode(true)
    try {
      await sendChangePasswordCode()
      setPwdStep('confirm')
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : t('profile.saveFailed'))
    } finally {
      setPwdSendingCode(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdError('')
    setPwdSuccess('')
    if (newPwd.length < 6) {
      setPwdError(t('auth.newPasswordError'))
      return
    }
    if (newPwd !== confirmPwd) {
      setPwdError(t('auth.passwordMismatch'))
      return
    }
    setPwdSaving(true)
    try {
      await confirmChangePassword(otpCode, newPwd)
      setPwdSuccess(t('profile.passwordUpdated'))
      setPwdStep('send')
      setOtpCode('')
      setNewPwd('')
      setConfirmPwd('')
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : t('profile.saveFailed'))
    } finally {
      setPwdSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (username.length < 3 || username.length > 50) {
      setError(t('auth.usernameError'))
      return
    }
    setError('')
    setSaving(true)
    try {
      const data = await updateProfile({
        username: username.trim(),
        bio: bio.trim(),
        profile_picture: avatarUrl,
      })
      const updated = { ...currentUser, ...data.user }
      localStorage.setItem('user', JSON.stringify(updated))
      navigate('/settings', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== currentUser.username) {
      setDeleteError(t('profile.usernameWrong'))
      return
    }
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteAccount()
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/', { state: { message: t('profile.accountDeleted') } })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('profile.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>{t('nav.back')}</button>
        <span style={s.logo}>{t('app.name')}</span>
        <span style={s.title}>{t('profile.editTitle')}</span>
      </header>

      <div className="page-body" style={s.body}>
        <form onSubmit={handleSubmit} style={s.form}>
          {/* Avatar */}
          <div style={s.avatarSection}>
            <div style={s.avatar}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={s.avatarImg} />
                : <span style={s.avatarChar}>{username.charAt(0).toUpperCase()}</span>
              }
            </div>
            <label style={s.uploadLabel}>
              {uploading ? `${t('common.uploading')}...` : t('profile.changeAvatar')}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} disabled={uploading} />
            </label>
          </div>

          <div style={s.field}>
            <label style={s.label}>{t('auth.username')}</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              style={s.input}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>{t('profile.bio')}</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder={t('profile.bioPlaceholder')}
              rows={3}
              style={s.textarea}
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={saving || uploading} style={{ ...s.saveBtn, ...(saving ? s.disabled : {}) }}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </form>

        {/* Change Email */}
        <form onSubmit={handleEmailChange} style={{ ...s.form, marginTop: '16px' }}>
          <span style={s.sectionTitle}>{t('profile.changeEmail')}</span>
          <div style={s.field}>
            <label style={s.label}>{t('profile.newEmail')}</label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder={t('profile.newEmailPlaceholder')}
              style={s.input}
              required
            />
          </div>
          {emailError && <p style={s.error}>{emailError}</p>}
          {emailSuccess && <p style={s.success}>{emailSuccess}</p>}
          <button type="submit" disabled={emailSaving} style={{ ...s.saveBtn, ...(emailSaving ? s.disabled : {}) }}>
            {emailSaving ? t('profile.updatingEmail') : t('profile.updateEmail')}
          </button>
        </form>

        {/* Change Password */}
        <form onSubmit={handlePasswordChange} style={{ ...s.form, marginTop: '16px' }}>
          <span style={s.sectionTitle}>{t('profile.changePassword')}</span>
          {pwdStep === 'send' ? (
            <>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                {t('profile.sendCodeDesc', { email: currentUser.email ?? '' })}
              </p>
              {pwdError && <p style={s.error}>{pwdError}</p>}
              <button
                type="button"
                onClick={handleSendPasswordCode}
                disabled={pwdSendingCode}
                style={{ ...s.saveBtn, ...(pwdSendingCode ? s.disabled : {}) }}
              >
                {pwdSendingCode ? t('profile.sendingCode') : t('profile.sendCode')}
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: '13px', color: '#38a169' }}>
                {t('profile.codeSentTo', { email: currentUser.email ?? '' })}
              </p>
              <div style={s.field}>
                <label style={s.label}>{t('auth.otp')}</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  placeholder={t('auth.otpPlaceholder')}
                  style={s.input}
                  maxLength={6}
                  required
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('auth.newPassword')}</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder={t('profile.newPasswordPlaceholder')}
                  style={s.input}
                  required
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('profile.confirmNewPassword')}</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder={t('profile.confirmNewPasswordPlaceholder')}
                  style={s.input}
                  required
                />
              </div>
              {pwdError && <p style={s.error}>{pwdError}</p>}
              {pwdSuccess && <p style={s.success}>{pwdSuccess}</p>}
              <button type="submit" disabled={pwdSaving} style={{ ...s.saveBtn, ...(pwdSaving ? s.disabled : {}) }}>
                {pwdSaving ? t('profile.updatingPassword') : t('profile.updatePassword')}
              </button>
              <button
                type="button"
                style={s.resendBtn}
                onClick={() => { setPwdStep('send'); setPwdError(''); setPwdSuccess(''); setOtpCode(''); setNewPwd(''); setConfirmPwd('') }}
              >
                {t('profile.resendCode')}
              </button>
            </>
          )}
        </form>

        {/* Delete account */}
        <div style={s.dangerZone}>
          <button style={s.deleteBtn} onClick={() => setShowDeleteModal(true)}>{t('profile.deleteAccount')}</button>
        </div>
      </div>

      {/* Delete account modal */}
      {showDeleteModal && (
        <div style={s.modalOverlay} onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); setDeleteError('') }}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <p style={s.modalTitle}>{t('profile.deleteAccountTitle')}</p>
            <p style={s.modalDesc}>{t('profile.deleteWarning')}</p>
            <p style={s.modalDesc}>{t('profile.deleteConfirmPrompt', { username: currentUser.username })}</p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={t('profile.usernamePlaceholder')}
              style={s.confirmInput}
              autoFocus
            />
            {deleteError && <p style={s.deleteError}>{deleteError}</p>}
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); setDeleteError('') }}>{t('common.cancel')}</button>
              <button
                style={{ ...s.saveBtn, background: '#e53e3e', ...(deleting ? s.disabled : {}) }}
                disabled={deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? t('profile.deleting') : t('profile.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f4f5f7' },
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: '#fff', borderBottom: '1px solid #e5e7eb',
    padding: '0 20px', height: '56px',
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  backBtn: { background: 'none', border: 'none', fontSize: '14px', color: '#6b7280', cursor: 'pointer', padding: '4px 8px' },
  logo: { fontSize: '16px', fontWeight: 700, color: '#4f46e5' },
  title: { fontSize: '16px', fontWeight: 600, color: '#1a1a1a' },
  body: { maxWidth: '480px', margin: '0 auto', padding: '24px 16px' },
  form: { background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '20px' },
  avatarSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
  avatar: {
    width: '80px', height: '80px', borderRadius: '50%',
    background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarChar: { color: '#fff', fontSize: '30px', fontWeight: 700 },
  uploadLabel: {
    padding: '6px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
    fontSize: '13px', color: '#6b7280', cursor: 'pointer',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: 500, color: '#555' },
  input: { padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%' },
  textarea: { padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' },
  error: { margin: 0, fontSize: '13px', color: '#e53e3e' },
  success: { margin: 0, fontSize: '13px', color: '#38a169' },
  sectionTitle: { fontSize: '15px', fontWeight: 600, color: '#1a1a1a' },
  saveBtn: { padding: '11px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 500, cursor: 'pointer' },
  disabled: { opacity: 0.6, cursor: 'not-allowed' },
  dangerZone: { marginTop: '16px', textAlign: 'center' as const },
  deleteBtn: { background: 'none', border: 'none', color: '#e53e3e', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' },
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#fff', borderRadius: '12px', padding: '24px', width: '360px', maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
  modalTitle: { fontSize: '18px', fontWeight: 700, color: '#e53e3e', margin: '0 0 12px' },
  modalDesc: { fontSize: '14px', color: '#4b5563', margin: '0 0 10px', lineHeight: 1.6 },
  confirmInput: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, marginTop: '4px' },
  deleteError: { margin: '8px 0 0', fontSize: '13px', color: '#e53e3e' },
  modalBtns: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' },
  cancelBtn: { padding: '9px 18px', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', color: '#6b7280' },
  resendBtn: { background: 'none', border: 'none', fontSize: '13px', color: '#6b7280', cursor: 'pointer', padding: 0, textAlign: 'left' as const },
}

export default EditProfile
