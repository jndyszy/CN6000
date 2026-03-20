import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import request from '../api/request'
import PostCard from '../components/PostCard'
import { useLanguage } from '../context/LanguageContext'
import type { FeedPostsResponse, Post } from '../types'

const getTagPosts = (name: string, cursor = '', limit = 20) =>
  request<FeedPostsResponse & { tag_name: string }>(
    `/api/tags/${encodeURIComponent(name)}/posts?cursor=${encodeURIComponent(cursor)}&limit=${limit}`
  )

function TagPosts() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')

  const [posts, setPosts] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!name) return
    setLoading(true)
    setPosts([])
    getTagPosts(name)
      .then(data => {
        setPosts(data.posts)
        setNextCursor(data.next_cursor)
        setHasMore(data.has_more)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [name])

  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !loadingMore) handleLoadMore() },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, nextCursor])

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || !nextCursor) return
    setLoadingMore(true)
    try {
      const data = await getTagPosts(name!, nextCursor)
      setPosts(prev => [...prev, ...data.posts])
      setNextCursor(data.next_cursor)
      setHasMore(data.has_more)
    } catch {} finally {
      setLoadingMore(false)
    }
  }

  const handleDeletePost = (postId: string) => setPosts(prev => prev.filter(p => p.post_id !== postId))

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>{t('nav.back')}</button>
        <span style={s.tag}>#{name}</span>
      </header>

      <div className="page-body" style={s.body}>
        {loading && <p style={s.hint}>{t('common.loading')}</p>}
        {!loading && posts.length === 0 && <p style={s.hint}>{t('tag.noPosts')}</p>}
        {posts.map(p => (
          <PostCard key={p.post_id} post={p} currentUserId={currentUser.user_id} onDelete={handleDeletePost} />
        ))}
        <div ref={sentinelRef} style={{ height: '1px' }} />
        {loadingMore && <p style={s.hint}>{t('feed.loadingMore')}</p>}
        {!hasMore && posts.length > 0 && <p style={{ ...s.hint, color: '#d1d5db' }}>{t('feed.noMore')}</p>}
      </div>
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
  tag: { fontSize: '16px', fontWeight: 700, color: '#4f46e5' },
  body: { maxWidth: '680px', margin: '0 auto', padding: '16px' },
  hint: { textAlign: 'center', color: '#9ca3af', fontSize: '14px', padding: '32px' },
}

export default TagPosts
