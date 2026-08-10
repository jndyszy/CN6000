import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHomeFeed, getMorePosts } from '../api/feed'
import { createPost } from '../api/posts'
import { uploadImage } from '../api/upload'
import { getNotifications, getUnreadCount, markAllRead } from '../api/notifications'
import PostCard from '../components/PostCard'
import { useLanguage } from '../context/LanguageContext'
import type { Post, UserCard, HotTag, RecommendedUser, Notification } from '../types'

function Home() {
  const navigate = useNavigate()
  const { lang, t } = useLanguage()
  const [userCard, setUserCard] = useState<UserCard | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [hotTags, setHotTags] = useState<HotTag[]>([])
  const [recommendedUsers, setRecommendedUsers] = useState<RecommendedUser[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [sort, setSort] = useState<'timeline' | 'community'>(
    () => (localStorage.getItem('feedSort') as 'timeline' | 'community') || 'timeline'
  )

  const [postContent, setPostContent] = useState('')
  const [postTags, setPostTags] = useState('')
  const [imageItems, setImageItems] = useState<{ localUrl: string; serverUrl: string | null }[]>([])
  const [postVisibility, setPostVisibility] = useState('public')
  const [posting, setPosting] = useState(false)

  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const notifRef = useRef<HTMLDivElement>(null)

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    getHomeFeed(sort)
      .then(data => {
        setUserCard(data.user_card)
        setPosts(data.posts)
        setNextCursor(data.next_cursor)
        setHasMore(data.next_cursor !== '')
        setHotTags(data.hot_tags)
        setRecommendedUsers(data.recommended_users)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sort])

  // 轮询未读通知数（15秒一次）
  useEffect(() => {
    const poll = () => getUnreadCount().then(d => setUnreadCount(d.unread_count)).catch(() => {})
    poll()
    const timer = setInterval(poll, 15000)
    return () => clearInterval(timer)
  }, [])

  // 点击通知面板外部时关闭
  useEffect(() => {
    if (!showNotifPanel) return
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNotifPanel])

  // 每次打开面板都重新拉取，打开时顺便标已读
  const handleOpenNotif = async () => {
    const opening = !showNotifPanel
    setShowNotifPanel(opening)
    if (!opening) return
    try {
      const data = await getNotifications()
      setNotifications(data.notifications)
      if (data.unread_count > 0) {
        await markAllRead()
        setUnreadCount(0)
      }
    } catch {}
  }

  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          handleLoadMore()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, nextCursor])

  const handleSortChange = (next: 'timeline' | 'community') => {
    if (next === sort) return
    localStorage.setItem('feedSort', next)
    setSort(next)
    setPosts([])
    setNextCursor('')
    setHasMore(true)
  }

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || !nextCursor) return
    setLoadingMore(true)
    try {
      const data = await getMorePosts(nextCursor, 20, sort)
      setPosts(prev => [...prev, ...data.posts])
      setNextCursor(data.next_cursor)
      setHasMore(data.has_more)
    } catch {} finally {
      setLoadingMore(false)
    }
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!postContent.trim()) return
    setPosting(true)
    const tags = postTags.split(/[,，\s]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)
    try {
      const serverUrls = imageItems.filter(i => i.serverUrl).map(i => i.serverUrl!)
      const data = await createPost(postContent.trim(), serverUrls, tags, postVisibility)
      const newPost = {
        ...data.post,
        image_urls: serverUrls,
        username: userCard!.username,
        profile_picture: userCard!.profile_picture,
        like_count: 0,
        comment_count: 0,
        is_liked: false,
      }
      setPosts(prev => [newPost, ...prev])
      setPostContent('')
      setPostTags('')
      imageItems.forEach(i => URL.revokeObjectURL(i.localUrl))
      setImageItems([])
      setPostVisibility('public')
      if (userCard) {
        setUserCard(prev => prev ? { ...prev, post_count: prev.post_count + 1 } : prev)
      }
    } catch {} finally {
      setPosting(false)
    }
  }

  const handleDeletePost = (postId: string) => {
    setPosts(prev => {
      const deleted = prev.find(p => p.post_id === postId)
      if (deleted?.tags.length) {
        setHotTags(tags =>
          tags.map(t => deleted.tags.includes(t.tag_name) ? { ...t, post_count: t.post_count - 1 } : t)
              .filter(t => t.post_count > 0)
        )
      }
      return prev.filter(p => p.post_id !== postId)
    })
    if (userCard) {
      setUserCard(prev => prev ? { ...prev, post_count: prev.post_count - 1 } : prev)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/')
  }

  const currentUserId = userCard?.user_id ?? ''
  const currentUserRole = JSON.parse(localStorage.getItem('user') || '{}').role
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'super_admin'

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <span style={s.logo}>{t('app.name')}</span>
        <div style={s.headerRight}>
          <button style={s.searchBtn} onClick={() => navigate('/search')}>{t('nav.search')}</button>
          {userCard && (
            <>
              {/* 通知铃铛 */}
              <div ref={notifRef} style={{ position: 'relative' }}>
                <button style={s.notifBtn} onClick={handleOpenNotif} title={t('notif.title')}>
                  🔔
                  {unreadCount > 0 && (
                    <span style={s.notifBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </button>
                {showNotifPanel && (
                  <div style={s.notifPanel}>
                    <div style={s.notifHeader}>
                      <span style={s.notifTitle}>{t('notif.title')}</span>
                    </div>
                    {notifications.length === 0 ? (
                      <p style={s.notifEmpty}>{t('notif.empty')}</p>
                    ) : (
                      <div style={s.notifList}>
                        {notifications.map(n => {
                          const text = t(`notif.${n.type}`).replace('{actor}', n.actor_name)
                          return (
                            <div
                              key={n.notification_id}
                              style={{ ...s.notifItem, background: n.is_read ? '#fff' : '#f0f4ff' }}
                              onClick={() => {
                                setShowNotifPanel(false)
                                if (n.post_id) {
                                  navigate(`/users/${currentUserId}?highlight=${n.post_id}`)
                                } else {
                                  navigate(`/users/${n.actor_id}`)
                                }
                              }}
                            >
                              <div style={{ ...s.notifAvatar, overflow: 'hidden' }}>
                                {n.actor_picture
                                  ? <img src={n.actor_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : (n.actor_name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div style={s.notifContent}>
                                <span style={s.notifText}>{text}</span>
                                <span style={s.notifTime}>{new Date(n.created_at).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {!n.is_read && <span style={s.notifDot} />}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 用户名下拉菜单 */}
              <div className="user-menu" tabIndex={0}>
                <span className="home-username" style={{ ...s.headerUsername, cursor: 'pointer' }}>{userCard.username}</span>
                <div className="user-menu-panel">
                  <button className="user-menu-item" onClick={() => navigate('/settings')}>⚙️ {t('nav.settings')}</button>
                  {isAdmin && (
                    <button className="user-menu-item" onClick={() => navigate('/admin')}>🛠️ {t('nav.admin')}</button>
                  )}
                  <button className="user-menu-item" onClick={() => navigate(`/users/${userCard.user_id}`)}>👤 {t('nav.myProfile')}</button>
                  <button className="user-menu-item danger" onClick={handleLogout}>🚪 {t('nav.logout')}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {loading ? (
        <div style={s.fullLoading}>{t('common.loading')}</div>
      ) : (
        <div className="home-layout">
          {/* Left sidebar */}
          <aside className="home-sidebar-left">
            {userCard && (
              <div style={s.card}>
                <div style={{ ...s.userAvatar, overflow: 'hidden' }}>
                  {userCard.profile_picture
                    ? <img src={userCard.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : userCard.username.charAt(0).toUpperCase()}
                </div>
                <div style={s.userCardName}>{userCard.username}</div>
                <div style={s.userCardEmail}>{userCard.email}</div>
                <div style={s.userStats}>
                  <div style={s.statItem}>
                    <span style={s.statNum}>{userCard.post_count}</span>
                    <span style={s.statLabel}>{t('stat.posts')}</span>
                  </div>
                  <div style={s.statItem}>
                    <span style={s.statNum}>{userCard.following_count}</span>
                    <span style={s.statLabel}>{t('stat.following')}</span>
                  </div>
                  <div style={s.statItem}>
                    <span style={s.statNum}>{userCard.follower_count}</span>
                    <span style={s.statLabel}>{t('stat.followers')}</span>
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* Center feed */}
          <main className="home-feed">
            {/* Sort bar */}
            <div style={s.sortBar}>
              <button
                style={{ ...s.sortBtn, ...(sort === 'timeline' ? s.sortBtnActive : {}) }}
                onClick={() => handleSortChange('timeline')}
              >
                {t('feed.sort.latest')}
              </button>
              <button
                style={{ ...s.sortBtn, ...(sort === 'community' ? s.sortBtnActive : {}) }}
                onClick={() => handleSortChange('community')}
              >
                {t('feed.sort.hot')}
              </button>
            </div>

            {/* Create post */}
            <form onSubmit={handleCreatePost} style={s.createPostCard}>
              <textarea
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                placeholder={t('feed.placeholder')}
                style={s.createPostInput}
                rows={3}
              />
              {imageItems.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {imageItems.map((item, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={item.localUrl} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '6px', opacity: item.serverUrl ? 1 : 0.5 }} alt="" />
                      {!item.serverUrl && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', fontSize: '11px', color: '#fff' }}>...</div>
                      )}
                      <button type="button" onClick={() => { URL.revokeObjectURL(item.localUrl); setImageItems(prev => prev.filter((_, idx) => idx !== i)) }}
                        style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '12px', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="post-footer">
                <input
                  value={postTags}
                  onChange={e => setPostTags(e.target.value)}
                  placeholder={t('feed.tagsPlaceholder')}
                  className="post-tag-input"
                />
                <div className="post-controls">
                  <select
                    value={postVisibility}
                    onChange={e => setPostVisibility(e.target.value)}
                    style={s.visibilitySelect}
                  >
                    <option value="public">{t('visibility.public')}</option>
                    <option value="followers">{t('visibility.followers')}</option>
                    <option value="private">{t('visibility.private')}</option>
                  </select>
                  <label style={{ ...s.postBtn, background: '#f3f4f6', color: '#6b7280', cursor: 'pointer' }}>
                    📎
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const localUrl = URL.createObjectURL(file)
                        setImageItems(prev => [...prev, { localUrl, serverUrl: null }])
                        e.target.value = ''
                        try {
                          const serverUrl = await uploadImage(file)
                          setImageItems(prev => prev.map(i => i.localUrl === localUrl ? { ...i, serverUrl } : i))
                        } catch {
                          URL.revokeObjectURL(localUrl)
                          setImageItems(prev => prev.filter(i => i.localUrl !== localUrl))
                        }
                      }}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={posting || !postContent.trim()}
                    style={{ ...s.postBtn, ...(posting || !postContent.trim() ? s.postBtnDisabled : {}) }}
                  >
                    {posting ? t('feed.posting') : t('feed.publish')}
                  </button>
                </div>
              </div>
            </form>

            {/* Posts */}
            {posts.map(post => (
              <PostCard
                key={post.post_id}
                post={post}
                currentUserId={currentUserId}
                onDelete={handleDeletePost}
              />
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} style={{ height: '1px' }} />
            {loadingMore && <p style={s.loadingMore}>{t('feed.loadingMore')}</p>}
            {!hasMore && posts.length > 0 && <p style={s.noMore}>{t('feed.noMore')}</p>}
            {posts.length === 0 && !loading && <p style={s.noMore}>{t('feed.empty')}</p>}
          </main>

          {/* Right sidebar */}
          <aside className="home-sidebar-right">
            {hotTags.some(tag => tag.post_count > 0) && (
              <div style={s.card}>
                <h4 style={s.sideTitle}>{t('sidebar.hotTags')}</h4>
                {hotTags.filter(tag => tag.post_count > 0).map(tag => (
                  <div key={tag.tag_name} style={{ ...s.tagRow, cursor: 'pointer' }} onClick={() => navigate(`/tags/${tag.tag_name}`)}>
                    <span style={s.tagName}>#{tag.tag_name}</span>
                    <span style={s.tagCount}>{tag.post_count}</span>
                  </div>
                ))}
              </div>
            )}

            {recommendedUsers.length > 0 && (
              <div style={{ ...s.card, marginTop: '12px' }}>
                <h4 style={s.sideTitle}>{t('sidebar.recommended')}</h4>
                {recommendedUsers.map(user => (
                  <div key={user.user_id} style={{ ...s.recUserRow, cursor: 'pointer' }} onClick={() => navigate(`/users/${user.user_id}`)}>
                    <div style={{ ...s.recAvatar, overflow: 'hidden' }}>
                      {user.profile_picture
                        ? <img src={user.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : user.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={s.recInfo}>
                      <span style={s.recName}>{user.username}</span>
                      {user.bio && <span style={s.recBio}>{user.bio}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f4f5f7',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 24px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#4f46e5',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerUsername: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: 500,
  },
  searchBtn: {
    padding: '5px 14px',
    background: 'none',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#6b7280',
    cursor: 'pointer',
  },
  notifBtn: {
    position: 'relative' as const,
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 6px',
    lineHeight: 1,
  },
  notifBadge: {
    position: 'absolute' as const,
    top: '-2px',
    right: '-4px',
    background: '#e53e3e',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 700,
    borderRadius: '10px',
    padding: '1px 4px',
    lineHeight: 1.4,
    minWidth: '16px',
    textAlign: 'center' as const,
  },
  notifPanel: {
    position: 'fixed' as const,
    top: '64px',
    right: '16px',
    width: '320px',
    maxHeight: '480px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    border: '1px solid #e5e7eb',
    zIndex: 9999,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  notifHeader: {
    padding: '14px 16px 10px',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1a1a1a',
  },
  notifList: {
    overflowY: 'auto' as const,
    flex: 1,
  },
  notifEmpty: {
    fontSize: '13px',
    color: '#9ca3af',
    textAlign: 'center' as const,
    padding: '32px 16px',
  },
  notifItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #f9fafb',
    transition: 'background 0.15s',
  },
  notifAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#e0e7ff',
    color: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
  },
  notifText: {
    fontSize: '13px',
    color: '#374151',
    lineHeight: 1.4,
  },
  notifTime: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  notifDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#4f46e5',
    flexShrink: 0,
  },
  fullLoading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 'calc(100vh - 56px)',
    fontSize: '15px',
    color: '#9ca3af',
  },
  card: {
    background: '#fff',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  userAvatar: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: '#4f46e5',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: 700,
    margin: '0 auto 10px',
  },
  userCardName: {
    textAlign: 'center',
    fontWeight: 600,
    fontSize: '15px',
    color: '#1a1a1a',
  },
  userCardEmail: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '2px',
    marginBottom: '14px',
  },
  userStats: {
    display: 'flex',
    justifyContent: 'space-around',
    paddingTop: '12px',
    borderTop: '1px solid #f3f4f6',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  statNum: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  sortBar: {
    display: 'flex',
    gap: '4px',
    background: '#fff',
    borderRadius: '10px',
    padding: '6px',
    marginBottom: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  sortBtn: {
    flex: 1,
    padding: '7px',
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#6b7280',
    cursor: 'pointer',
    fontWeight: 500,
  },
  sortBtnActive: {
    background: '#ede9fe',
    color: '#4f46e5',
    fontWeight: 600,
  },
  visibilitySelect: {
    padding: '7px 8px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#6b7280',
    outline: 'none',
    background: '#fff',
    cursor: 'pointer',
    flexShrink: 0,
  },
  createPostCard: {
    background: '#fff',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  createPostInput: {
    width: '100%',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '14px',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  postBtn: {
    padding: '7px 20px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  postBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  loadingMore: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#9ca3af',
    padding: '12px',
  },
  noMore: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#d1d5db',
    padding: '16px',
  },
  sideTitle: {
    margin: '0 0 12px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  },
  tagRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid #f9fafb',
  },
  tagName: {
    fontSize: '13px',
    color: '#4f46e5',
  },
  tagCount: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  recUserRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    borderBottom: '1px solid #f9fafb',
  },
  recAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: '#e0e7ff',
    color: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    flexShrink: 0,
  },
  recInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflow: 'hidden',
  },
  recName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1a1a1a',
  },
  recBio: {
    fontSize: '12px',
    color: '#9ca3af',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}

export default Home
