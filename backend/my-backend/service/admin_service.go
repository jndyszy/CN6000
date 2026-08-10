package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"my-backend/conf"
	"my-backend/dao"
)

// ========== 哨兵错误 ==========

var (
	ErrCannotActOnSelf  = errors.New("不能对自己执行该操作")
	ErrInsufficientRole = errors.New("目标用户权限等级不低于你，无法操作")
	ErrReportNotFound   = errors.New("举报记录不存在")
	ErrInvalidRole      = errors.New("无效的角色")
)

// checkHierarchy 校验操作者是否有权处置目标用户：
// admin 只能处置普通用户；super_admin 可以处置普通用户和 admin，但不能处置其他 super_admin。
func checkHierarchy(actorRole, targetRole string) error {
	switch actorRole {
	case "super_admin":
		if targetRole == "super_admin" {
			return ErrInsufficientRole
		}
	default: // "admin"
		if targetRole != "user" {
			return ErrInsufficientRole
		}
	}
	return nil
}

// ========== 举报审核 ==========

type ReportListResult struct {
	Reports []dao.ReportRow `json:"reports"`
	Total   int64           `json:"total"`
}

func ListReports(status string, limit, offset int) (*ReportListResult, error) {
	rows, total, err := dao.ListReports(status, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("查询举报列表失败: %w", err)
	}
	return &ReportListResult{Reports: rows, Total: total}, nil
}

// ResolveReport 处理一条举报：action="remove" 下架被举报内容并标记 removed；action="dismiss" 驳回举报
func ResolveReport(resolverID, reportID uuid.UUID, action string) error {
	report, err := dao.GetReportByID(reportID)
	if err != nil {
		return fmt.Errorf("查询举报失败: %w", err)
	}
	if report == nil {
		return ErrReportNotFound
	}

	switch action {
	case "remove":
		switch report.TargetType {
		case "post":
			if err := DeletePostAsAdmin(report.TargetID); err != nil && !errors.Is(err, ErrPostNotFound) {
				return err
			}
		case "comment":
			if err := dao.SoftDeleteComment(report.TargetID); err != nil {
				return fmt.Errorf("下架评论失败: %w", err)
			}
		}
		return dao.ResolveReport(reportID, resolverID, "removed")
	case "dismiss":
		return dao.ResolveReport(reportID, resolverID, "dismissed")
	default:
		return fmt.Errorf("未知的处理方式: %s", action)
	}
}

// DeletePostAsAdmin 管理员下架帖子（跳过作者归属校验），同步扣减 Redis 热门标签计数
func DeletePostAsAdmin(postID uuid.UUID) error {
	post, err := dao.GetPostByIDRaw(postID)
	if err != nil {
		return fmt.Errorf("查询帖子失败: %w", err)
	}
	if post == nil {
		return ErrPostNotFound
	}

	tagNames, err := dao.GetPostTagNames(postID)
	if err != nil {
		return fmt.Errorf("查询帖子标签失败: %w", err)
	}
	if err := dao.SoftDeletePost(postID); err != nil {
		return fmt.Errorf("下架帖子失败: %w", err)
	}

	ctx := context.Background()
	for _, tag := range tagNames {
		conf.RDB.ZIncrBy(ctx, "hot:tags", -1, tag)
	}
	return nil
}

// DeleteCommentAsAdmin 管理员下架评论（跳过作者归属校验）
func DeleteCommentAsAdmin(commentID uuid.UUID) error {
	comment, err := dao.GetCommentByID(commentID)
	if err != nil {
		return fmt.Errorf("查询评论失败: %w", err)
	}
	if comment == nil {
		return ErrCommentNotFound
	}
	if err := dao.SoftDeleteComment(commentID); err != nil {
		return fmt.Errorf("下架评论失败: %w", err)
	}
	return nil
}

// ========== 用户管理 ==========

type AdminUserListResult struct {
	Users []dao.AdminUserRow `json:"users"`
	Total int64              `json:"total"`
}

func ListUsersAdmin(query, role string, limit, offset int) (*AdminUserListResult, error) {
	rows, total, err := dao.ListUsersAdmin(query, role, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("查询用户列表失败: %w", err)
	}
	return &AdminUserListResult{Users: rows, Total: total}, nil
}

// getTargetForAction 加载目标用户并校验自我操作 / 层级保护
func getTargetForAction(actorID, targetID uuid.UUID, actorRole string) error {
	if actorID == targetID {
		return ErrCannotActOnSelf
	}
	target, err := dao.GetUserByID(targetID)
	if err != nil {
		return fmt.Errorf("查询目标用户失败: %w", err)
	}
	if target == nil {
		return ErrUserNotFound
	}
	return checkHierarchy(actorRole, target.Role)
}

func BanUser(actorID, targetID uuid.UUID, actorRole, reason string) error {
	if err := getTargetForAction(actorID, targetID, actorRole); err != nil {
		return err
	}
	return dao.SetUserBanned(targetID, true, reason)
}

func UnbanUser(actorID, targetID uuid.UUID, actorRole string) error {
	if err := getTargetForAction(actorID, targetID, actorRole); err != nil {
		return err
	}
	return dao.SetUserBanned(targetID, false, "")
}

func RestrictUserPosting(actorID, targetID uuid.UUID, actorRole, reason string) error {
	if err := getTargetForAction(actorID, targetID, actorRole); err != nil {
		return err
	}
	return dao.SetUserPostRestricted(targetID, true, reason)
}

func UnrestrictUserPosting(actorID, targetID uuid.UUID, actorRole string) error {
	if err := getTargetForAction(actorID, targetID, actorRole); err != nil {
		return err
	}
	return dao.SetUserPostRestricted(targetID, false, "")
}

// AdminDeleteUser 管理员强制注销账号（复用用户自助注销的匿名化逻辑）
func AdminDeleteUser(actorID, targetID uuid.UUID, actorRole string) error {
	if err := getTargetForAction(actorID, targetID, actorRole); err != nil {
		return err
	}
	return dao.DeleteAccount(targetID)
}

// SetUserRole 提升/降级管理员角色，仅限 super_admin 调用（由路由中间件保证），且不能操作其他 super_admin
func SetUserRole(actorID, targetID uuid.UUID, newRole string) error {
	if actorID == targetID {
		return ErrCannotActOnSelf
	}
	if newRole != "user" && newRole != "admin" {
		return ErrInvalidRole
	}
	target, err := dao.GetUserByID(targetID)
	if err != nil {
		return fmt.Errorf("查询目标用户失败: %w", err)
	}
	if target == nil {
		return ErrUserNotFound
	}
	if target.Role == "super_admin" {
		return ErrInsufficientRole
	}
	return dao.SetUserRole(targetID, newRole)
}
