package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"my-backend/service"
)

// parseAdminPage 从 query 读取 limit/offset，带默认值与上限
func parseAdminPage(c *gin.Context) (limit, offset int) {
	limit, _ = strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset, _ = strconv.Atoi(c.DefaultQuery("offset", "0"))
	if offset < 0 {
		offset = 0
	}
	return
}

// adminActionError 把 admin_service 的哨兵错误统一映射为 HTTP 状态码
func adminActionError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrUserNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrCannotActOnSelf), errors.Is(err, service.ErrInsufficientRole), errors.Is(err, service.ErrInvalidRole):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
	}
}

// ========== GET /api/admin/reports ==========

func ListReports(c *gin.Context) {
	limit, offset := parseAdminPage(c)
	status := c.Query("status") // 不传 = 全部；pending / removed / dismissed

	result, err := service.ListReports(status, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ========== POST /api/admin/reports/:id/resolve ==========

func ResolveReport(c *gin.Context) {
	resolverID := currentUserID(c)
	reportID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	var req struct {
		Action string `json:"action" binding:"required,oneof=remove dismiss"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := service.ResolveReport(resolverID, reportID, req.Action); err != nil {
		switch {
		case errors.Is(err, service.ErrReportNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "处理成功"})
}

// ========== GET /api/admin/users ==========

func ListUsersAdmin(c *gin.Context) {
	limit, offset := parseAdminPage(c)
	query := c.Query("query")
	role := c.Query("role")

	result, err := service.ListUsersAdmin(query, role, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ========== POST /api/admin/users/:id/ban ==========

func BanUser(c *gin.Context) {
	actorID := currentUserID(c)
	actorRole := c.GetString("role")
	targetID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := service.BanUser(actorID, targetID, actorRole, req.Reason); err != nil {
		adminActionError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已封禁该账号"})
}

// ========== POST /api/admin/users/:id/unban ==========

func UnbanUser(c *gin.Context) {
	actorID := currentUserID(c)
	actorRole := c.GetString("role")
	targetID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	if err := service.UnbanUser(actorID, targetID, actorRole); err != nil {
		adminActionError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已解除封禁"})
}

// ========== POST /api/admin/users/:id/restrict ==========

func RestrictUser(c *gin.Context) {
	actorID := currentUserID(c)
	actorRole := c.GetString("role")
	targetID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := service.RestrictUserPosting(actorID, targetID, actorRole, req.Reason); err != nil {
		adminActionError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已限制该账号发帖"})
}

// ========== POST /api/admin/users/:id/unrestrict ==========

func UnrestrictUser(c *gin.Context) {
	actorID := currentUserID(c)
	actorRole := c.GetString("role")
	targetID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	if err := service.UnrestrictUserPosting(actorID, targetID, actorRole); err != nil {
		adminActionError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已解除发帖限制"})
}

// ========== DELETE /api/admin/users/:id ==========

func AdminDeleteUser(c *gin.Context) {
	actorID := currentUserID(c)
	actorRole := c.GetString("role")
	targetID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	if err := service.AdminDeleteUser(actorID, targetID, actorRole); err != nil {
		adminActionError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "账号已删除"})
}

// ========== POST /api/admin/users/:id/promote（仅 super_admin）==========

func PromoteToAdmin(c *gin.Context) {
	actorID := currentUserID(c)
	targetID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	if err := service.SetUserRole(actorID, targetID, "admin"); err != nil {
		adminActionError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已提升为管理员"})
}

// ========== POST /api/admin/users/:id/demote（仅 super_admin）==========

func DemoteAdmin(c *gin.Context) {
	actorID := currentUserID(c)
	targetID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	if err := service.SetUserRole(actorID, targetID, "user"); err != nil {
		adminActionError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已取消管理员身份"})
}

// ========== DELETE /api/admin/posts/:id ==========

func AdminDeletePost(c *gin.Context) {
	postID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	if err := service.DeletePostAsAdmin(postID); err != nil {
		switch {
		case errors.Is(err, service.ErrPostNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "帖子已下架"})
}

// ========== DELETE /api/admin/comments/:id ==========

func AdminDeleteComment(c *gin.Context) {
	commentID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	if err := service.DeleteCommentAsAdmin(commentID); err != nil {
		switch {
		case errors.Is(err, service.ErrCommentNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "评论已下架"})
}
