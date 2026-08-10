package dao

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"my-backend/conf"
	"my-backend/model"
)

// ReportRow 举报队列展示用的联合查询结果（帖子/评论二选一，取决于 target_type）
type ReportRow struct {
	ReportID             string    `gorm:"column:report_id"              json:"report_id"`
	ReporterID           string    `gorm:"column:reporter_id"            json:"reporter_id"`
	ReporterUsername     string    `gorm:"column:reporter_username"      json:"reporter_username"`
	TargetType           string    `gorm:"column:target_type"            json:"target_type"`
	TargetID             string    `gorm:"column:target_id"              json:"target_id"`
	Reason               string    `gorm:"column:reason"                 json:"reason"`
	Status               string    `gorm:"column:status"                 json:"status"`
	CreatedAt            time.Time `gorm:"column:created_at"             json:"created_at"`
	ContentPreview       string    `gorm:"column:content_preview"        json:"content_preview"`
	TargetAuthorID       string    `gorm:"column:target_author_id"       json:"target_author_id"`
	TargetAuthorUsername string    `gorm:"column:target_author_username" json:"target_author_username"`
	TargetRemoved        bool      `gorm:"column:target_removed"         json:"target_removed"`
}

// ListReports 按状态分页查询举报队列（联表取被举报内容预览与作者），status 为空表示不筛选
func ListReports(status string, limit, offset int) ([]ReportRow, int64, error) {
	var rows []ReportRow
	err := conf.DB.Raw(`
SELECT
    r.report_id, r.reporter_id, ru.username AS reporter_username,
    r.target_type, r.target_id, r.reason, r.status, r.created_at,
    COALESCE(p.content, cm.content, '')                            AS content_preview,
    COALESCE(p.user_id::text, cm.user_id::text, '')                AS target_author_id,
    COALESCE(pu.username, cu.username, '')                         AS target_author_username,
    COALESCE(p.deleted_at, cm.deleted_at) IS NOT NULL               AS target_removed
FROM reports r
LEFT JOIN users ru ON r.reporter_id = ru.user_id
LEFT JOIN posts p    ON r.target_type = 'post'    AND r.target_id = p.post_id
LEFT JOIN users pu   ON p.user_id = pu.user_id
LEFT JOIN comments cm ON r.target_type = 'comment' AND r.target_id = cm.comment_id
LEFT JOIN users cu   ON cm.user_id = cu.user_id
WHERE (? = '' OR r.status = ?)
ORDER BY r.created_at DESC
LIMIT ? OFFSET ?`, status, status, limit, offset).Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	if rows == nil {
		rows = []ReportRow{}
	}

	var total int64
	if err := conf.DB.Raw(`SELECT COUNT(*) FROM reports WHERE (? = '' OR status = ?)`, status, status).
		Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// GetReportByID 查询单条举报记录，未找到返回 (nil, nil)
func GetReportByID(reportID uuid.UUID) (*model.Report, error) {
	var report model.Report
	err := conf.DB.Where("report_id = ?", reportID).First(&report).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &report, err
}

// ResolveReport 将举报标记为已处理（removed=已下架内容 / dismissed=已驳回）
func ResolveReport(reportID, resolverID uuid.UUID, status string) error {
	now := time.Now()
	return conf.DB.Model(&model.Report{}).
		Where("report_id = ?", reportID).
		Updates(map[string]interface{}{
			"status":      status,
			"resolved_by": resolverID,
			"resolved_at": now,
		}).Error
}

// AdminUserRow 用户管理列表展示用的联合查询结果
type AdminUserRow struct {
	UserID           string    `gorm:"column:user_id"            json:"user_id"`
	Username         string    `gorm:"column:username"           json:"username"`
	Email            string    `gorm:"column:email"              json:"email"`
	Role             string    `gorm:"column:role"               json:"role"`
	IsBanned         bool      `gorm:"column:is_banned"          json:"is_banned"`
	BanReason        string    `gorm:"column:ban_reason"         json:"ban_reason"`
	IsPostRestricted bool      `gorm:"column:is_post_restricted" json:"is_post_restricted"`
	RestrictedReason string    `gorm:"column:restricted_reason"  json:"restricted_reason"`
	PostCount        int64     `gorm:"column:post_count"         json:"post_count"`
	CreatedAt        time.Time `gorm:"column:created_at"         json:"created_at"`
}

// ListUsersAdmin 管理后台用户列表：按用户名/邮箱模糊搜索，可选按角色筛选，分页
func ListUsersAdmin(query, role string, limit, offset int) ([]AdminUserRow, int64, error) {
	pattern := "%" + query + "%"
	var rows []AdminUserRow
	err := conf.DB.Raw(`
SELECT
    u.user_id, u.username, u.email, u.role,
    u.is_banned, u.ban_reason, u.is_post_restricted, u.restricted_reason,
    u.created_at,
    COUNT(p.post_id) FILTER (WHERE p.deleted_at IS NULL) AS post_count
FROM users u
LEFT JOIN posts p ON p.user_id = u.user_id
WHERE (u.username ILIKE ? OR u.email ILIKE ?)
  AND (? = '' OR u.role = ?)
GROUP BY u.user_id
ORDER BY u.created_at DESC
LIMIT ? OFFSET ?`, pattern, pattern, role, role, limit, offset).Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	if rows == nil {
		rows = []AdminUserRow{}
	}

	var total int64
	if err := conf.DB.Raw(`
SELECT COUNT(*) FROM users u
WHERE (u.username ILIKE ? OR u.email ILIKE ?) AND (? = '' OR u.role = ?)`,
		pattern, pattern, role, role).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// SetUserBanned 设置/取消封号
func SetUserBanned(userID uuid.UUID, banned bool, reason string) error {
	return conf.DB.Model(&model.User{}).
		Where("user_id = ?", userID).
		Updates(map[string]interface{}{"is_banned": banned, "ban_reason": reason}).Error
}

// SetUserPostRestricted 设置/取消禁止发帖
func SetUserPostRestricted(userID uuid.UUID, restricted bool, reason string) error {
	return conf.DB.Model(&model.User{}).
		Where("user_id = ?", userID).
		Updates(map[string]interface{}{"is_post_restricted": restricted, "restricted_reason": reason}).Error
}

// SetUserRole 设置用户角色（user / admin / super_admin）
func SetUserRole(userID uuid.UUID, role string) error {
	return conf.DB.Model(&model.User{}).
		Where("user_id = ?", userID).
		Update("role", role).Error
}
