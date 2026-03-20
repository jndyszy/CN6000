package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"my-backend/dao"
)

// GET /api/notifications
// 返回最近 50 条通知 + 未读数
func GetNotifications(c *gin.Context) {
	userID := currentUserID(c)

	notifications, err := dao.GetNotifications(userID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取通知失败"})
		return
	}

	unread, err := dao.GetUnreadCount(userID)
	if err != nil {
		unread = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"notifications": notifications,
		"unread_count":  unread,
	})
}

// GET /api/notifications/unread-count
// 仅返回未读数（用于轮询）
func GetUnreadCount(c *gin.Context) {
	userID := currentUserID(c)
	count, err := dao.GetUnreadCount(userID)
	if err != nil {
		count = 0
	}
	c.JSON(http.StatusOK, gin.H{"unread_count": count})
}

// POST /api/notifications/read-all
// 全部标为已读
func MarkAllRead(c *gin.Context) {
	userID := currentUserID(c)
	if err := dao.MarkAllRead(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "操作失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已全部标为已读"})
}
