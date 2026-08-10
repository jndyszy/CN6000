import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listReports, resolveReport, listUsersAdmin, banUser, unbanUser,
  restrictUser, unrestrictUser, adminDeleteUser, promoteToAdmin, demoteAdmin,
} from '../../api/admin'
import type { ReportRow, AdminUserRow } from '../../api/admin'

type Tab = 'reports' | 'users'
type ReportStatus = 'pending' | 'removed' | 'dismissed'

function AdminDashboard() {
  const navigate = useNavigate()
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const isSuperAdmin = currentUser.role === 'super_admin'

  const [tab, setTab] = useState<Tab>('reports')

  const [reportStatus, setReportStatus] = useState<ReportStatus>('pending')
  const [reports, setReports] = useState<ReportRow[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)

  const loadReports = () => {
    setReportsLoading(true)
    listReports(reportStatus)
      .then(d => setReports(d.reports))
      .catch(() => {})
      .finally(() => setReportsLoading(false))
  }
  useEffect(() => { if (tab === 'reports') loadReports() }, [tab, reportStatus])

  const handleResolve = async (reportId: string, action: 'remove' | 'dismiss') => {
    if (action === 'remove' && !confirm('确认下架该内容？')) return
    try {
      await resolveReport(reportId, action)
      loadReports()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  const [userQuery, setUserQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  const loadUsers = () => {
    setUsersLoading(true)
    listUsersAdmin(userQuery, roleFilter)
      .then(d => setUsers(d.users))
      .catch(() => {})
      .finally(() => setUsersLoading(false))
  }
  useEffect(() => { if (tab === 'users') loadUsers() }, [tab])

  const handleUserSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadUsers()
  }

  const runUserAction = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      loadUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleBan = (u: AdminUserRow) => {
    const reason = window.prompt('请输入封号原因：')
    if (reason === null) return
    if (!reason.trim()) { alert('原因不能为空'); return }
    runUserAction(() => banUser(u.user_id, reason.trim()))
  }
  const handleUnban = (u: AdminUserRow) => runUserAction(() => unbanUser(u.user_id))
  const handleRestrict = (u: AdminUserRow) => {
    const reason = window.prompt('请输入限制发帖原因：')
    if (reason === null) return
    if (!reason.trim()) { alert('原因不能为空'); return }
    runUserAction(() => restrictUser(u.user_id, reason.trim()))
  }
  const handleUnrestrict = (u: AdminUserRow) => runUserAction(() => unrestrictUser(u.user_id))
  const handleDeleteUser = (u: AdminUserRow) => {
    if (!confirm(`确认删除账号 ${u.username}？此操作不可恢复。`)) return
    runUserAction(() => adminDeleteUser(u.user_id))
  }
  const handlePromote = (u: AdminUserRow) => {
    if (!confirm(`确认将 ${u.username} 提升为管理员？`)) return
    runUserAction(() => promoteToAdmin(u.user_id))
  }
  const handleDemote = (u: AdminUserRow) => {
    if (!confirm(`确认取消 ${u.username} 的管理员身份？`)) return
    runUserAction(() => demoteAdmin(u.user_id))
  }

  const roleLabel = (role: string) =>
    role === 'super_admin' ? '超级管理员' : role === 'admin' ? '管理员' : '普通用户'

  const reportStatusLabel = (st: ReportStatus) =>
    st === 'pending' ? '待处理' : st === 'removed' ? '已下架' : '已驳回'

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/home')}>← 返回</button>
        <span style={s.headerTitle}>管理后台</span>
      </header>

      <div style={s.tabs}>
        <button style={tab === 'reports' ? s.tabActive : s.tab} onClick={() => setTab('reports')}>举报审核</button>
        <button style={tab === 'users' ? s.tabActive : s.tab} onClick={() => setTab('users')}>用户管理</button>
      </div>

      <div style={s.content}>
        {tab === 'reports' && (
          <div>
            <div style={s.filterBar}>
              {(['pending', 'removed', 'dismissed'] as ReportStatus[]).map(st => (
                <button
                  key={st}
                  style={reportStatus === st ? s.filterActive : s.filter}
                  onClick={() => setReportStatus(st)}
                >
                  {reportStatusLabel(st)}
                </button>
              ))}
            </div>

            {reportsLoading ? (
              <p style={s.empty}>加载中...</p>
            ) : reports.length === 0 ? (
              <p style={s.empty}>暂无内容</p>
            ) : (
              <div style={s.list}>
                {reports.map(r => (
                  <div key={r.report_id} style={s.card}>
                    <div style={s.cardTop}>
                      <span style={s.badge}>{r.target_type === 'post' ? '帖子' : '评论'}</span>
                      <span style={s.reason}>举报原因：{r.reason}</span>
                      <span style={s.meta}>举报人 {r.reporter_username}</span>
                    </div>
                    <p style={s.contentPreview}>
                      {r.target_removed ? '（内容已被下架）' : (r.content_preview || '（内容不存在）')}
                    </p>
                    <div style={s.cardMeta}>
                      <span>作者：{r.target_author_username || '未知'}</span>
                      <span>{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    {r.status === 'pending' && (
                      <div style={s.actions}>
                        <button style={s.dangerBtn} onClick={() => handleResolve(r.report_id, 'remove')}>下架内容</button>
                        <button style={s.plainBtn} onClick={() => handleResolve(r.report_id, 'dismiss')}>驳回举报</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div>
            <form style={s.filterBar} onSubmit={handleUserSearch}>
              <input
                style={s.searchInput}
                placeholder="按用户名/邮箱搜索"
                value={userQuery}
                onChange={e => setUserQuery(e.target.value)}
              />
              <select style={s.select} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="">全部角色</option>
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
                <option value="super_admin">超级管理员</option>
              </select>
              <button type="submit" style={s.plainBtn}>搜索</button>
            </form>

            {usersLoading ? (
              <p style={s.empty}>加载中...</p>
            ) : users.length === 0 ? (
              <p style={s.empty}>没有匹配的用户</p>
            ) : (
              <div style={s.list}>
                {users.map(u => (
                  <div key={u.user_id} style={s.card}>
                    <div style={s.cardTop}>
                      <span style={s.username}>{u.username}</span>
                      <span style={s.badge}>{roleLabel(u.role)}</span>
                      {u.is_banned && <span style={s.badgeDanger}>已封号</span>}
                      {u.is_post_restricted && <span style={s.badgeWarn}>限制发帖</span>}
                    </div>
                    <div style={s.cardMeta}>
                      <span>{u.email}</span>
                      <span>发帖 {u.post_count}</span>
                      <span>注册于 {new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                    {u.is_banned && u.ban_reason && <p style={s.reasonNote}>封禁原因：{u.ban_reason}</p>}
                    {u.is_post_restricted && u.restricted_reason && <p style={s.reasonNote}>限制原因：{u.restricted_reason}</p>}

                    {u.role !== 'super_admin' && (
                      <div style={s.actions}>
                        {u.is_banned
                          ? <button style={s.plainBtn} onClick={() => handleUnban(u)}>解除封号</button>
                          : <button style={s.dangerBtn} onClick={() => handleBan(u)}>封号</button>}
                        {u.is_post_restricted
                          ? <button style={s.plainBtn} onClick={() => handleUnrestrict(u)}>解除限制</button>
                          : <button style={s.warnBtn} onClick={() => handleRestrict(u)}>限制发帖</button>}
                        <button style={s.dangerBtn} onClick={() => handleDeleteUser(u)}>删除账号</button>
                        {isSuperAdmin && u.role === 'user' && (
                          <button style={s.plainBtn} onClick={() => handlePromote(u)}>设为管理员</button>
                        )}
                        {isSuperAdmin && u.role === 'admin' && (
                          <button style={s.plainBtn} onClick={() => handleDemote(u)}>取消管理员</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
  tabs: {
    display: 'flex', gap: '4px',
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 20px',
  },
  tab: {
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    padding: '12px 8px', fontSize: '14px', color: '#6b7280', cursor: 'pointer',
  },
  tabActive: {
    background: 'none', border: 'none', borderBottom: '2px solid #1a1a1a',
    padding: '12px 8px', fontSize: '14px', color: '#1a1a1a', fontWeight: 600, cursor: 'pointer',
  },
  content: {
    maxWidth: '760px', margin: '0 auto', padding: '20px',
  },
  filterBar: {
    display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap',
  },
  filter: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '999px',
    padding: '6px 14px', fontSize: '13px', color: '#6b7280', cursor: 'pointer',
  },
  filterActive: {
    background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '999px',
    padding: '6px 14px', fontSize: '13px', color: '#fff', cursor: 'pointer',
  },
  searchInput: {
    flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '8px 12px', fontSize: '14px', outline: 'none',
  },
  select: {
    border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '8px 10px', fontSize: '14px', color: '#1a1a1a',
  },
  empty: {
    textAlign: 'center', color: '#9ca3af', fontSize: '14px', padding: '40px 0',
  },
  list: {
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  card: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px 16px',
  },
  cardTop: {
    display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px',
  },
  username: {
    fontSize: '15px', fontWeight: 600, color: '#1a1a1a',
  },
  badge: {
    background: '#f0f4ff', color: '#4c6ef5', fontSize: '12px',
    borderRadius: '6px', padding: '2px 8px',
  },
  badgeDanger: {
    background: '#fef2f2', color: '#dc2626', fontSize: '12px',
    borderRadius: '6px', padding: '2px 8px',
  },
  badgeWarn: {
    background: '#fffbeb', color: '#d97706', fontSize: '12px',
    borderRadius: '6px', padding: '2px 8px',
  },
  reason: {
    fontSize: '13px', color: '#374151',
  },
  meta: {
    fontSize: '12px', color: '#9ca3af', marginLeft: 'auto',
  },
  contentPreview: {
    fontSize: '14px', color: '#1a1a1a', background: '#f9fafb',
    borderRadius: '8px', padding: '10px 12px', margin: '0 0 8px 0',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  cardMeta: {
    display: 'flex', gap: '16px', fontSize: '12px', color: '#9ca3af', marginBottom: '8px', flexWrap: 'wrap',
  },
  reasonNote: {
    fontSize: '13px', color: '#dc2626', margin: '0 0 8px 0',
  },
  actions: {
    display: 'flex', gap: '8px', flexWrap: 'wrap',
  },
  dangerBtn: {
    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
    borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
  },
  warnBtn: {
    background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a',
    borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
  },
  plainBtn: {
    background: '#f4f5f7', color: '#374151', border: '1px solid #e5e7eb',
    borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
  },
}

export default AdminDashboard
