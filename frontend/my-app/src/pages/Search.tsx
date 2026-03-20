import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchUsers, searchPosts } from '../api/search'
import PostCard from '../components/PostCard'
import { useLanguage } from '../context/LanguageContext'
import type { SimpleUser, Post } from '../types'

type Tab = 'users' | 'posts'

function Search() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<SimpleUser[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setSearched(true)
    setPosts([])
    setUsers([])
    try {
      if (tab === 'users') {
        const data = await searchUsers(q)
        setUsers(data.users)
      } else {
        const data = await searchPosts(q)
        setPosts(data.posts)
        setNextCursor(data.next_cursor)
        setHasMore(data.has_more)
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  const handleTabSwitch = (next: Tab) => {
    setTab(next)
    setSearched(false)
    setUsers([])
    setPosts([])
  }

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await searchPosts(query.trim(), nextCursor)
      setPosts(prev => [...prev, ...data.posts])
      setNextCursor(data.next_cursor)
      setHasMore(data.has_more)
    } catch {} finally {
      setLoadingMore(false)
    }
  }

  const handleDeletePost = (postId: string) => setPosts(prev => prev.filter(p => p.post_id !== postId))

  const noResults = searched && !loading && users.length === 0 && posts.length === 0

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>
          {t('nav.back')}
        </button>
        <span style={s.headerTitle}>{t('search.title')}</span>
      </header>

      {/* Search area */}
      <div style={s.searchArea}>
        <form onSubmit={handleSearch} style={s.searchForm}>
          <div style={s.searchBar}>
            <span style={s.searchIcon}>🔍</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={tab === 'users' ? t('search.userPlaceholder') : t('search.postPlaceholder')}
              style={s.searchInput}
              autoFocus
            />
            {query && (
              <button type="button" style={s.clearBtn} onClick={() => { setQuery(''); setSearched(false); setUsers([]); setPosts([]) }}>
                ✕
              </button>
            )}
          </div>
          <button type="submit" style={s.submitBtn}>{t('search.submit')}</button>
        </form>

        {/* Tab pills */}
        <div style={s.pills}>
          <button
            style={{ ...s.pill, ...(tab === 'users' ? s.pillActive : {}) }}
            onClick={() => handleTabSwitch('users')}
          >
            {t('search.usersTab')}
          </button>
          <button
            style={{ ...s.pill, ...(tab === 'posts' ? s.pillActive : {}) }}
            onClick={() => handleTabSwitch('posts')}
          >
            {t('search.postsTab')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="page-body" style={s.body}>
        {/* Loading */}
        {loading && (
          <div style={s.stateBox}>
            <div style={s.spinner} />
            <p style={s.stateText}>{t('search.searching')}</p>
          </div>
        )}

        {/* Initial hint */}
        {!searched && !loading && (
          <div style={s.stateBox}>
            <div style={s.stateEmoji}>🔍</div>
            <p style={s.stateTitle}>{tab === 'users' ? t('search.searchUsers') : t('search.searchPosts')}</p>
            <p style={s.stateText}>{t('search.hint')}</p>
          </div>
        )}

        {/* No results */}
        {noResults && (
          <div style={s.stateBox}>
            <div style={s.stateEmoji}>😕</div>
            <p style={s.stateTitle}>{tab === 'users' ? t('search.noUsers') : t('search.noPosts')}</p>
            <p style={s.stateText}>{t('search.tryAnother')}</p>
          </div>
        )}

        {/* User results */}
        {!loading && searched && tab === 'users' && users.length > 0 && (
          <div>
            <p style={s.resultCount}>{t('search.foundUsers', { count: users.length })}</p>
            {users.map(u => (
              <div
                key={u.user_id}
                style={s.userCard}
                onClick={() => navigate(`/users/${u.user_id}`)}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(79,70,229,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
              >
                <div style={s.userAvatar}>
                  {u.profile_picture
                    ? <img src={u.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : u.username.charAt(0).toUpperCase()
                  }
                </div>
                <div style={s.userInfo}>
                  <span style={s.userName}>{u.username}</span>
                  {u.bio && <span style={s.userBio}>{u.bio}</span>}
                </div>
                <span style={s.arrowIcon}>›</span>
              </div>
            ))}
          </div>
        )}

        {/* Post results */}
        {!loading && searched && tab === 'posts' && posts.length > 0 && (
          <div>
            <p style={s.resultCount}>{t('search.foundPosts')}</p>
            {posts.map(p => (
              <PostCard key={p.post_id} post={p} currentUserId={currentUser.user_id} onDelete={handleDeletePost} />
            ))}
            {hasMore && (
              <button style={s.loadMoreBtn} onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? t('common.loading') : t('search.loadMore')}
              </button>
            )}
            {!hasMore && <p style={s.endText}>{t('search.allLoaded')}</p>}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
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
  searchArea: {
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    position: 'sticky',
    top: '56px',
    zIndex: 99,
  },
  searchForm: {
    display: 'flex',
    gap: '10px',
    maxWidth: '680px',
    margin: '0 auto',
    width: '100%',
  },
  searchBar: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    background: '#f4f5f7',
    borderRadius: '12px',
    padding: '0 14px',
    border: '2px solid transparent',
    transition: 'border-color 0.2s',
  },
  searchIcon: {
    fontSize: '16px',
    marginRight: '8px',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    color: '#1a1a1a',
    padding: '10px 0',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '4px',
    flexShrink: 0,
  },
  submitBtn: {
    padding: '10px 22px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    letterSpacing: '0.3px',
  },
  pills: {
    display: 'flex',
    gap: '8px',
    maxWidth: '680px',
    margin: '0 auto',
    width: '100%',
  },
  pill: {
    padding: '6px 18px',
    borderRadius: '20px',
    border: '1.5px solid #e5e7eb',
    background: '#fff',
    fontSize: '13px',
    fontWeight: 500,
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  pillActive: {
    background: '#ede9fe',
    borderColor: '#4f46e5',
    color: '#4f46e5',
    fontWeight: 600,
  },
  body: {
    maxWidth: '680px',
    margin: '0 auto',
    padding: '20px 16px',
  },
  stateBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 20px',
    gap: '8px',
  },
  stateEmoji: {
    fontSize: '48px',
    marginBottom: '8px',
  },
  stateTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#374151',
    margin: 0,
  },
  stateText: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: 0,
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #4f46e5',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '12px',
  },
  resultCount: {
    fontSize: '13px',
    color: '#9ca3af',
    marginBottom: '12px',
    fontWeight: 500,
  },
  userCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.2s',
  },
  userAvatar: {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    background: '#4f46e5',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '18px',
    flexShrink: 0,
    overflow: 'hidden',
  },
  userInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  userName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1a1a1a',
  },
  userBio: {
    fontSize: '13px',
    color: '#9ca3af',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  arrowIcon: {
    fontSize: '22px',
    color: '#d1d5db',
    flexShrink: 0,
  },
  loadMoreBtn: {
    display: 'block',
    width: '100%',
    padding: '12px',
    marginTop: '8px',
    background: '#fff',
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#4f46e5',
    fontWeight: 500,
    cursor: 'pointer',
  },
  endText: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#d1d5db',
    padding: '16px',
  },
}

export default Search
