import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getUserProfile, getFollowing, getFollowers, followUser, unfollowUser } from '../api/users'
import PostCard from '../components/PostCard'
import { useLanguage } from '../context/LanguageContext'
import type { UserProfile as Profile, SimpleUser, Post } from '../types'

type Tab = 'posts' | 'following' | 'followers'

function UserRow({ user }: { user: SimpleUser }) {
  const navigate = useNavigate()
  return (
    <div style={s.userRow} onClick={() => navigate(`/users/${user.user_id}`)}>
      <div style={{ ...s.rowAvatar, overflow: 'hidden' }}>
        {user.profile_picture
          ? <img src={user.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : user.username.charAt(0).toUpperCase()}
      </div>
      <div style={s.rowInfo}>
        <span style={s.rowName}>{user.username}</span>
        {user.bio && <span style={s.rowBio}>{user.bio}</span>}
      </div>
    </div>
  )
}

function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const [highlightActive, setHighlightActive] = useState(!!highlightId)
  const { t } = useLanguage()
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const isOwn = currentUser.user_id === id

  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [following, setFollowing] = useState<SimpleUser[]>([])
  const [followers, setFollowers] = useState<SimpleUser[]>([])
  const [followingLoaded, setFollowingLoaded] = useState(false)
  const [followersLoaded, setFollowersLoaded] = useState(false)
  const [tab, setTab] = useState<Tab>('posts')
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setTab('posts')
    setFollowingLoaded(false)
    setFollowersLoaded(false)
    getUserProfile(id)
      .then(data => {
        setProfile(data.user)
        setPosts(data.posts)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!highlightId || posts.length === 0) return
    const timer = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
    const fadeTimer = setTimeout(() => setHighlightActive(false), 2500)
    return () => { clearTimeout(timer); clearTimeout(fadeTimer) }
  }, [posts, highlightId])

  const switchTab = async (next: Tab) => {
    setTab(next)
    if (next === 'following' && !followingLoaded) {
      const data = await getFollowing(id!)
      setFollowing(data.users)
      setFollowingLoaded(true)
    }
    if (next === 'followers' && !followersLoaded) {
      const data = await getFollowers(id!)
      setFollowers(data.users)
      setFollowersLoaded(true)
    }
  }

  const handleFollow = async () => {
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await unfollowUser(id!)
        setIsFollowing(false)
        setProfile(p => p ? { ...p, follower_count: p.follower_count - 1 } : p)
      } else {
        await followUser(id!)
        setIsFollowing(true)
        setProfile(p => p ? { ...p, follower_count: p.follower_count + 1 } : p)
      }
    } catch {} finally {
      setFollowLoading(false)
    }
  }

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.post_id !== postId))
    setProfile(p => p ? { ...p, post_count: p.post_count - 1 } : p)
  }

  const tabLabels: Record<Tab, string> = {
    posts: t('profile.tabPosts'),
    following: t('profile.tabFollowing'),
    followers: t('profile.tabFollowers'),
  }

  if (loading) return <div style={s.center}>{t('common.loading')}</div>
  if (!profile) return <div style={s.center}>{t('profile.notFound')}</div>

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>{t('nav.back')}</button>
        <span style={s.logo}>{t('app.name')}</span>
        <span style={s.headerTitle}>{profile.username}</span>
        {!isOwn && (
          <button
            style={{ ...s.actionBtn, ...(isFollowing ? s.followingStyle : s.followStyle) }}
            disabled={followLoading}
            onClick={handleFollow}
          >
            {isFollowing ? t('profile.following') : t('profile.follow')}
          </button>
        )}
      </header>

      <div className="page-body" style={s.body}>
        <div style={s.profileCard}>
          <div style={{ ...s.avatar, overflow: 'hidden' }}>
            {profile.profile_picture
              ? <img src={profile.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : profile.username.charAt(0).toUpperCase()}
          </div>
          <div style={s.profileName}>{profile.username}</div>
          <div style={s.profileEmail}>{profile.email}</div>
          {profile.bio && <div style={s.profileBio}>{profile.bio}</div>}
          <div style={s.stats}>
            <div style={s.stat}>
              <span style={s.statNum}>{profile.post_count}</span>
              <span style={s.statLabel}>{t('stat.posts')}</span>
            </div>
            <div style={s.stat}>
              <span style={s.statNum}>{profile.following_count}</span>
              <span style={s.statLabel}>{t('stat.following')}</span>
            </div>
            <div style={s.stat}>
              <span style={s.statNum}>{profile.follower_count}</span>
              <span style={s.statLabel}>{t('stat.followers')}</span>
            </div>
          </div>
        </div>

        <div style={s.tabs}>
          {(['posts', 'following', 'followers'] as Tab[]).map(tabKey => (
            <button
              key={tabKey}
              style={{ ...s.tab, ...(tab === tabKey ? s.tabActive : {}) }}
              onClick={() => switchTab(tabKey)}
            >
              {tabLabels[tabKey]}
            </button>
          ))}
        </div>

        <div style={s.tabContent}>
          {tab === 'posts' && (
            posts.length === 0
              ? <p style={s.empty}>{t('profile.noPosts')}</p>
              : posts.map(p => {
                  const isHighlight = p.post_id === highlightId
                  return (
                    <div
                      key={p.post_id}
                      ref={isHighlight ? highlightRef : null}
                      style={isHighlight ? {
                        borderRadius: '10px',
                        boxShadow: highlightActive ? '0 0 0 3px #4f46e5, 0 4px 20px rgba(79,70,229,0.25)' : 'none',
                        transition: 'box-shadow 1.5s ease',
                      } : undefined}
                    >
                      <PostCard post={p} currentUserId={currentUser.user_id} onDelete={handleDeletePost} />
                    </div>
                  )
                })
          )}
          {tab === 'following' && (
            following.length === 0
              ? <p style={s.empty}>{t('profile.noFollowing')}</p>
              : following.map(u => <UserRow key={u.user_id} user={u} />)
          )}
          {tab === 'followers' && (
            followers.length === 0
              ? <p style={s.empty}>{t('profile.noFollowers')}</p>
              : followers.map(u => <UserRow key={u.user_id} user={u} />)
          )}
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f4f5f7' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#9ca3af' },
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: '#fff', borderBottom: '1px solid #e5e7eb',
    padding: '0 20px', height: '56px',
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  backBtn: { background: 'none', border: 'none', fontSize: '14px', color: '#6b7280', cursor: 'pointer', padding: '4px 8px' },
  logo: { fontSize: '16px', fontWeight: 700, color: '#4f46e5' },
  headerTitle: { flex: 1, fontSize: '16px', fontWeight: 600, color: '#1a1a1a' },
  actionBtn: {
    padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer', textDecoration: 'none', border: 'none',
  },
  followStyle: { background: '#4f46e5', color: '#fff' },
  followingStyle: { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' },
  body: { maxWidth: '680px', margin: '0 auto', padding: '20px 16px' },
  profileCard: {
    background: '#fff', borderRadius: '10px', padding: '24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center', marginBottom: '12px',
  },
  avatar: {
    width: '72px', height: '72px', borderRadius: '50%',
    background: '#4f46e5', color: '#fff', margin: '0 auto 12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '28px', fontWeight: 700,
  },
  profileName: { fontSize: '18px', fontWeight: 700, color: '#1a1a1a' },
  profileEmail: { fontSize: '13px', color: '#9ca3af', marginTop: '2px' },
  profileBio: { fontSize: '14px', color: '#4b5563', marginTop: '10px', lineHeight: 1.5 },
  stats: { display: 'flex', justifyContent: 'space-around', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  statNum: { fontSize: '18px', fontWeight: 700, color: '#1a1a1a' },
  statLabel: { fontSize: '12px', color: '#9ca3af' },
  tabs: {
    display: 'flex', background: '#fff', borderRadius: '10px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px', overflow: 'hidden',
  },
  tab: {
    flex: 1, padding: '12px', background: 'none', border: 'none',
    fontSize: '14px', color: '#6b7280', cursor: 'pointer', borderBottom: '2px solid transparent',
  },
  tabActive: { color: '#4f46e5', borderBottom: '2px solid #4f46e5', fontWeight: 600 },
  tabContent: {},
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: '14px', padding: '32px' },
  userRow: {
    background: '#fff', borderRadius: '10px', padding: '14px 16px',
    marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px',
    cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  rowAvatar: {
    width: '40px', height: '40px', borderRadius: '50%',
    background: '#e0e7ff', color: '#4f46e5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, fontSize: '16px', flexShrink: 0,
  },
  rowInfo: { display: 'flex', flexDirection: 'column', gap: '2px' },
  rowName: { fontSize: '14px', fontWeight: 600, color: '#1a1a1a' },
  rowBio: { fontSize: '12px', color: '#9ca3af' },
}

export default UserProfile
