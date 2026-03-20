package controller

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"my-backend/service"
)

// ========== POST /api/posts/:id/report ==========

func ReportPost(c *gin.Context) {
	reporterID := currentUserID(c)
	postID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	var req service.CreateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := service.ReportPost(reporterID, postID, req); err != nil {
		switch {
		case errors.Is(err, service.ErrReportTargetNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrAlreadyReported):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已收到您的举报，我们将在 24 小时内处理"})
}

// ========== POST /api/posts/:id/comments/:comment_id/report ==========

func ReportComment(c *gin.Context) {
	reporterID := currentUserID(c)
	commentID, ok := parseUUID(c, "comment_id")
	if !ok {
		return
	}

	var req service.CreateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := service.ReportComment(reporterID, commentID, req); err != nil {
		switch {
		case errors.Is(err, service.ErrReportTargetNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrAlreadyReported):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已收到您的举报，我们将在 24 小时内处理"})
}
