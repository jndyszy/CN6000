import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { likePost, unlikePost, deletePost, updatePost, getComments, createComment, deleteComment, reportPost, reportComment } from '../api/posts'
import { uploadImage } from '../api/upload'
import { useLanguage } from '../context/LanguageContext'
import type { Post, Comment } from '../types'

interface Props {
  post: Post
  currentUserId: string
  onDelete: (postId: string) => void
}

const reportReasons = [
  { value: '违法违规', key: 'report.illegal' },
  { value: '色情低俗', key: 'report.adult' },
  { value: '虚假信息', key: 'report.misinformation' },
  { value: '垃圾广告', key: 'report.spam' },
  { value: '其他', key: 'report.other' },
]

function PostCard({ post: initial, currentUserId, onDelete }: Props) {
  const navigate = useNavigate()
  const { lang, t } = useLanguage()
  const [content, setContent] = useState(initial.content)
  const [liked, setLiked] = useState(initial.is_liked)
  const [likeCount, setLikeCount] = useState(initial.like_count)
  const [commentCount, setCommentCount] = useState(initial.comment_count)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null)
  const [tags, setTags] = useState(initial.tags)
  const [imageUrls, setImageUrls] = useState(initial.image_urls)
  const [visibility, setVisibility] = useState(initial.visibility ?? 'public')
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(initial.content)
  const [editTags, setEditTags] = useState(initial.tags.join(', '))
  const [editImageUrls, setEditImageUrls] = useState<string[]>(initial.image_urls)
  const [editVisibility, setEditVisibility] = useState(initial.visibility ?? 'public')
  const [uploadingImg, setUploadingImg] = useState(false)
  const [saving, setSaving] = useState(false)

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const [showMenu, setShowMenu] = useState(false)
  const [reportModal, setReportModal] = useState<null | { type: 'post' } | { type: 'comment'; commentId: string }>(null)
  const [reportReason, setReportReason] = useState('违法违规')
  const [reporting, setReporting] = useState(false)
  const [reportDone, setReportDone] = useState(false)

  const isOwner = initial.user_id === currentUserId

  const handleLike = async () => {
    const prev = { liked, likeCount }
    setLiked(!liked)
    setLikeCount(liked ? likeCount - 1 : likeCount + 1)
    try {
      liked ? await unlikePost(initial.post_id) : await likePost(initial.post_id)
    } catch {
      setLiked(prev.liked)
      setLikeCount(prev.likeCount)
    }
  }

  const handleToggleComments = async () => {
    if (!commentsLoaded) {
      setLoadingComments(true)
      try {
        const data = await getComments(initial.post_id)
        setComments(data.comments)
        setCommentsLoaded(true)
      } catch {} finally {
        setLoadingComments(false)
      }
    }
    setShowComments(v => !v)
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentInput.trim()) return
    setSubmitting(true)
    try {
      const data = await createComment(initial.post_id, commentInput.trim(), replyingTo?.commentId)
      setComments(prev => [...prev, data.comment])
      setCommentCount(c => c + 1)
      setCommentInput('')
      setReplyingTo(null)
    } catch {} finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(initial.post_id, commentId)
      setComments(prev => prev.filter(c => c.comment_id !== commentId))
      setCommentCount(c => c - 1)
    } catch {}
  }

  const handleDeletePost = async () => {
    if (!confirm(t('post.deleteConfirm'))) return
    try {
      await deletePost(initial.post_id)
      onDelete(initial.post_id)
    } catch {}
  }

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImg(true)
    try {
      const url = await uploadImage(file)
      setEditImageUrls(prev => [...prev, url])
    } catch {} finally {
      setUploadingImg(false)
      e.target.value = ''
    }
  }

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return
    setSaving(true)
    const newTags = editTags.split(/[,，\s]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)
    try {
      await updatePost(initial.post_id, editContent.trim(), editImageUrls, newTags, editVisibility)
      setContent(editContent.trim())
      setTags(newTags)
      setImageUrls(editImageUrls)
      setVisibility(editVisibility)
      setEditing(false)
    } catch {} finally {
      setSaving(false)
    }
  }

  const handleReport = async () => {
    if (!reportModal) return
    setReporting(true)
    try {
      if (reportModal.type === 'post') {
        await reportPost(initial.post_id, reportReason)
      } else {
        await reportComment(initial.post_id, reportModal.commentId, reportReason)
      }
      setReportDone(true)
      setTimeout(() => { setReportModal(null); setReportDone(false); setReportReason('违法违规') }, 1500)
    } catch {} finally {
      setReporting(false)
    }
  }

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  const prevImage = useCallback(() => setLightboxIndex(i => (i !== null && i > 0 ? i - 1 : i)), [])
  const nextImage = useCallback(() => setLightboxIndex(i => (i !== null && i < imageUrls.length - 1 ? i + 1 : i)), [imageUrls.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === 'ArrowLeft') prevImage()
      else if (e.key === 'ArrowRight') nextImage()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, closeLightbox, prevImage, nextImage])

  const renderImageGrid = () => {
    if (imageUrls.length === 0) return null
    const count = imageUrls.length
    const displayUrls = count > 9 ? imageUrls.slice(0, 9) : imageUrls
    const extra = count > 9 ? count - 9 : 0

    let cols: number
    if (count === 1) cols = 1
    else if (count <= 3) cols = count
    else if (count === 4) cols = 2
    else cols = 3

    const aspectPadding = count === 1 ? '56.25%' : '100%'

    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px', marginBottom: '12px' }}>
        {displayUrls.map((url, i) => {
          const isLast = i === displayUrls.length - 1 && extra > 0
          return (
            <div
              key={i}
              style={{ position: 'relative', paddingBottom: aspectPadding, overflow: 'hidden', borderRadius: '6px', cursor: 'zoom-in', background: '#f3f4f6' }}
              onClick={() => setLightboxIndex(i)}
            >
              <img src={url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              {isLast && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '26px', fontWeight: 700 }}>
                  +{extra}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderLightbox = () => {
    if (lightboxIndex === null) return null
    const total = imageUrls.length
    const canPrev = lightboxIndex > 0
    const canNext = lightboxIndex < total - 1
    return (
      <div style={s.lightboxOverlay} onClick={closeLightbox}>
        <button style={s.lightboxClose} onClick={closeLightbox}>✕</button>
        {total > 1 && (
          <div style={s.lightboxCounter}>{lightboxIndex + 1} / {total}</div>
        )}
        {canPrev && (
          <button style={{ ...s.lightboxNav, left: '12px' }} onClick={e => { e.stopPropagation(); prevImage() }}>‹</button>
        )}
        <img
          src={imageUrls[lightboxIndex]}
          alt=""
          style={s.lightboxImg}
          onClick={e => e.stopPropagation()}
        />
        {canNext && (
          <button style={{ ...s.lightboxNav, right: '12px' }} onClick={e => { e.stopPropagation(); nextImage() }}>›</button>
        )}
      </div>
    )
  }

  const formatTime = (iso: string) => {
    const locale = lang === 'zh' ? 'zh-CN' : 'en-US'
    return new Date(iso).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const avatarChar = initial.username.charAt(0).toUpperCase()
  const imgStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' }

  return (
    <div style={s.card}>
      {/* Author row */}
      <div style={s.authorRow}>
        <div style={{ ...s.avatar, overflow: 'hidden' }}>
          {initial.profile_picture ? <img src={initial.profile_picture} alt="" style={imgStyle} /> : avatarChar}
        </div>
        <div style={s.authorInfo}>
          <span style={s.username} onClick={() => navigate(`/users/${initial.user_id}`)}>{initial.username}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={s.time}>{formatTime(initial.created_at)}</span>
            {isOwner && visibility !== 'public' && (
              <span style={s.visibilityBadge}>
                {visibility === 'private' ? '🔒' : '👥'}
              </span>
            )}
          </div>
        </div>
        {isOwner && !editing && (
          <div style={s.ownerActions}>
            <button style={s.textBtn} onClick={() => { setEditing(true); setEditContent(content); setEditTags(tags.join(', ')); setEditVisibility(visibility) }}>{t('post.edit')}</button>
            <button style={{ ...s.textBtn, color: '#e53e3e' }} onClick={handleDeletePost}>{t('post.delete')}</button>
          </div>
        )}
        {!isOwner && !editing && (
          <div style={{ position: 'relative' }}>
            <button style={s.menuBtn} onClick={() => setShowMenu(v => !v)}>···</button>
            {showMenu && (
              <div style={s.menuDropdown}>
                <button style={s.menuItem} onClick={() => { setShowMenu(false); setReportModal({ type: 'post' }) }}>
                  {t('post.report')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {editing ? (
        <div style={s.editArea}>
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            style={s.textarea}
            rows={3}
          />
          <input
            value={editTags}
            onChange={e => setEditTags(e.target.value)}
            placeholder={t('post.tagsPlaceholder')}
            style={{ ...s.textarea, marginTop: '8px', padding: '7px 10px', resize: 'none' }}
          />
          {editImageUrls.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
              {editImageUrls.map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={url} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '6px' }} alt="" />
                  <button
                    onClick={() => setEditImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '12px', cursor: 'pointer', lineHeight: 1, padding: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          <label style={{ marginTop: '8px', display: 'inline-block', padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', color: '#6b7280', cursor: uploadingImg ? 'not-allowed' : 'pointer' }}>
            {uploadingImg ? `${t('common.uploading')}...` : t('upload.addImage')}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditImageUpload} disabled={uploadingImg} />
          </label>
          <select
            value={editVisibility}
            onChange={e => setEditVisibility(e.target.value)}
            style={{ marginTop: '8px', padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#6b7280', outline: 'none', background: '#fff' }}
          >
            <option value="public">{t('visibility.public')}</option>
            <option value="followers">{t('visibility.followersOnly')}</option>
            <option value="private">{t('visibility.private')}</option>
          </select>
          <div style={s.editBtns}>
            <button style={s.cancelBtn} onClick={() => setEditing(false)}>{t('common.cancel')}</button>
            <button style={s.saveBtn} disabled={saving} onClick={handleSaveEdit}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      ) : (
        <p style={s.content}>{content}</p>
      )}

      {/* Images */}
      {renderImageGrid()}
      {renderLightbox()}

      {/* Tags */}
      {tags.length > 0 && (
        <div style={s.tags}>
          {tags.map(tag => (
            <span key={tag} style={s.tag} onClick={() => navigate(`/tags/${tag}`)}>#{tag}</span>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div style={s.actionBar}>
        <button style={{ ...s.actionBarBtn, ...(liked ? s.likedBtn : {}) }} onClick={handleLike}>
          {liked ? '♥' : '♡'} {likeCount}
        </button>
        <button style={s.actionBarBtn} onClick={handleToggleComments}>
          💬 {commentCount}
        </button>
      </div>

      {/* Report modal */}
      {reportModal && (
        <div style={s.modalOverlay} onClick={() => { setReportModal(null); setReportDone(false) }}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <p style={s.modalTitle}>{reportModal.type === 'post' ? t('report.post') : t('report.comment')}</p>
            {reportDone ? (
              <p style={s.reportSuccess}>{t('report.success')}</p>
            ) : (
              <>
                <p style={s.modalLabel}>{t('report.selectReason')}</p>
                {reportReasons.map(r => (
                  <label key={r.value} style={s.reasonRow}>
                    <input type="radio" name="reason" value={r.value} checked={reportReason === r.value} onChange={() => setReportReason(r.value)} />
                    <span style={{ marginLeft: '8px', fontSize: '14px', color: '#374151' }}>{t(r.key)}</span>
                  </label>
                ))}
                <div style={s.modalBtns}>
                  <button style={s.cancelBtn} onClick={() => setReportModal(null)}>{t('common.cancel')}</button>
                  <button style={{ ...s.saveBtn, background: '#e53e3e' }} disabled={reporting} onClick={handleReport}>
                    {reporting ? t('report.submitting') : t('report.submit')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Comments */}
      {showComments && (
        <div style={s.comments}>
          {loadingComments ? (
            <p style={s.hint}>{t('common.loading')}</p>
          ) : (() => {
            const topLevel = comments.filter(c => !c.parent_id)
            const replyMap = comments.reduce<Record<string, Comment[]>>((acc, c) => {
              if (c.parent_id) {
                if (!acc[c.parent_id]) acc[c.parent_id] = []
                acc[c.parent_id].push(c)
              }
              return acc
            }, {})

            const renderComment = (c: Comment, isReply = false) => (
              <div key={c.comment_id} style={isReply ? s.replyItem : s.commentItem}>
                <div style={{ ...(isReply ? s.replyAvatar : s.commentAvatar), overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigate(`/users/${c.user_id}`)}>
                  {c.profile_picture ? <img src={c.profile_picture} alt="" style={imgStyle} /> : c.username.charAt(0).toUpperCase()}
                </div>
                <div style={s.commentBody}>
                  <span style={{ ...s.commentUsername, cursor: 'pointer' }} onClick={() => navigate(`/users/${c.user_id}`)}>{c.username}</span>
                  <span style={s.commentContent}>{c.content}</span>
                  {!isReply && (
                    <button style={s.replyBtn} onClick={() => { setReplyingTo({ commentId: c.comment_id, username: c.username }); setCommentInput('') }}>
                      {t('comment.reply') || '回复'}
                    </button>
                  )}
                </div>
                {c.user_id === currentUserId
                  ? <button style={s.deleteCommentBtn} onClick={() => handleDeleteComment(c.comment_id)}>×</button>
                  : <button style={s.deleteCommentBtn} title={t('post.report')} onClick={() => setReportModal({ type: 'comment', commentId: c.comment_id })}>⚑</button>
                }
              </div>
            )

            return (
              <>
                {comments.length === 0 && <p style={s.hint}>{t('comment.empty')}</p>}
                {topLevel.map(c => (
                  <div key={c.comment_id}>
                    {renderComment(c)}
                    {replyMap[c.comment_id] && (
                      <div style={s.repliesContainer}>
                        {replyMap[c.comment_id].map(r => renderComment(r, true))}
                      </div>
                    )}
                  </div>
                ))}
                {replyingTo && (
                  <div style={s.replyingBanner}>
                    <span>{t('comment.replyingTo') || '回复'} <strong>@{replyingTo.username}</strong></span>
                    <button style={s.cancelReplyBtn} onClick={() => setReplyingTo(null)}>×</button>
                  </div>
                )}
                <form onSubmit={handleSubmitComment} style={s.commentForm}>
                  <input
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    placeholder={replyingTo ? `${t('comment.reply') || '回复'} @${replyingTo.username}...` : t('comment.placeholder')}
                    style={s.commentInput}
                  />
                  <button
                    type="submit"
                    disabled={submitting || !commentInput.trim()}
                    style={{ ...s.sendBtn, ...(submitting || !commentInput.trim() ? s.sendBtnDisabled : {}) }}
                  >
                    {t('comment.send')}
                  </button>
                </form>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  authorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  avatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: '#4f46e5',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '15px',
    flexShrink: 0,
  },
  authorInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  username: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1a1a1a',
    cursor: 'pointer',
  },
  time: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  ownerActions: {
    display: 'flex',
    gap: '8px',
  },
  textBtn: {
    background: 'none',
    border: 'none',
    fontSize: '13px',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '2px 6px',
  },
  content: {
    margin: '0 0 12px',
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  editArea: {
    marginBottom: '12px',
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
    outline: 'none',
  },
  editBtns: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '8px',
  },
  cancelBtn: {
    padding: '5px 14px',
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#6b7280',
  },
  saveBtn: {
    padding: '5px 14px',
    background: '#4f46e5',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#fff',
    cursor: 'pointer',
  },
  tags: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  tag: {
    fontSize: '12px',
    color: '#4f46e5',
    background: '#ede9fe',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  actionBar: {
    display: 'flex',
    gap: '16px',
    paddingTop: '10px',
    borderTop: '1px solid #f3f4f6',
  },
  actionBarBtn: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  likedBtn: {
    color: '#e53e3e',
  },
  comments: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #f3f4f6',
  },
  hint: {
    fontSize: '13px',
    color: '#9ca3af',
    textAlign: 'center',
    margin: '8px 0',
  },
  commentItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '10px',
  },
  repliesContainer: {
    marginLeft: '36px',
    paddingLeft: '10px',
    borderLeft: '2px solid #e5e7eb',
    marginBottom: '8px',
  },
  replyItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    marginBottom: '8px',
  },
  replyAvatar: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: '#ede9fe',
    color: '#7c3aed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 600,
    flexShrink: 0,
  },
  replyBtn: {
    background: 'none',
    border: 'none',
    fontSize: '11px',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '2px 0',
    marginTop: '2px',
    textAlign: 'left' as const,
  },
  replyingBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#f0f4ff',
    border: '1px solid #c7d2fe',
    borderRadius: '6px',
    padding: '5px 10px',
    marginBottom: '6px',
    fontSize: '12px',
    color: '#4f46e5',
  },
  cancelReplyBtn: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
  },
  commentAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#e0e7ff',
    color: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 600,
    flexShrink: 0,
  },
  commentBody: {
    flex: 1,
    background: '#f9fafb',
    borderRadius: '8px',
    padding: '6px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  commentUsername: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#374151',
  },
  commentContent: {
    fontSize: '13px',
    color: '#4b5563',
  },
  visibilityBadge: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '2px 6px',
    letterSpacing: '1px',
    lineHeight: 1,
  },
  menuDropdown: {
    position: 'absolute' as const,
    right: 0,
    top: '100%',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: 10,
    minWidth: '100px',
    overflow: 'hidden',
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: '#e53e3e',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: '#fff',
    borderRadius: '12px',
    padding: '24px',
    width: '320px',
    maxWidth: '90vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1a1a1a',
    margin: '0 0 16px',
  },
  modalLabel: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '0 0 10px',
  },
  reasonRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    cursor: 'pointer',
  },
  modalBtns: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '16px',
  },
  reportSuccess: {
    fontSize: '14px',
    color: '#059669',
    textAlign: 'center' as const,
    padding: '12px 0',
  },
  deleteCommentBtn: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    padding: '2px 4px',
  },
  commentForm: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
  },
  commentInput: {
    flex: 1,
    padding: '7px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: '20px',
    fontSize: '13px',
    outline: 'none',
  },
  sendBtn: {
    padding: '7px 14px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  sendBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  lightboxOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
    padding: '16px',
  },
  lightboxImg: {
    maxWidth: '90vw',
    maxHeight: '85vh',
    borderRadius: '6px',
    objectFit: 'contain',
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
    userSelect: 'none' as const,
  },
  lightboxClose: {
    position: 'absolute' as const,
    top: '16px',
    right: '20px',
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#fff',
    fontSize: '20px',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
  },
  lightboxCounter: {
    position: 'absolute' as const,
    top: '18px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.85)',
    fontSize: '14px',
    fontWeight: 500,
    pointerEvents: 'none' as const,
  },
  lightboxNav: {
    position: 'absolute' as const,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#fff',
    fontSize: '40px',
    width: '48px',
    height: '64px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
    backdropFilter: 'blur(4px)',
  },
}

export default PostCard
