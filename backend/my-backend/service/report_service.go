package service

import (
	"errors"
	"fmt"

	"github.com/google/uuid"

	"my-backend/dao"
	"my-backend/model"
)

// ========== 哨兵错误 ==========

var (
	ErrReportTargetNotFound = errors.New("举报目标不存在")
	ErrAlreadyReported      = errors.New("您已经举报过该内容")
)

// ========== 请求结构体 ==========

type CreateReportRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// ========== ReportPost：举报帖子 ==========

func ReportPost(reporterID, postID uuid.UUID, req CreateReportRequest) error {
	// 检查帖子是否存在
	post, err := dao.GetPostByIDRaw(postID)
	if err != nil {
		return fmt.Errorf("查询帖子失败: %w", err)
	}
	if post == nil {
		return ErrReportTargetNotFound
	}

	report := &model.Report{
		ReporterID: reporterID,
		TargetType: "post",
		TargetID:   postID,
		Reason:     req.Reason,
	}
	created, err := dao.CreateReport(report)
	if err != nil {
		return fmt.Errorf("创建举报失败: %w", err)
	}
	if !created {
		return ErrAlreadyReported
	}
	return nil
}

// ========== ReportComment：举报评论 ==========

func ReportComment(reporterID, commentID uuid.UUID, req CreateReportRequest) error {
	// 检查评论是否存在
	comment, err := dao.GetCommentByID(commentID)
	if err != nil {
		return fmt.Errorf("查询评论失败: %w", err)
	}
	if comment == nil {
		return ErrReportTargetNotFound
	}

	report := &model.Report{
		ReporterID: reporterID,
		TargetType: "comment",
		TargetID:   commentID,
		Reason:     req.Reason,
	}
	created, err := dao.CreateReport(report)
	if err != nil {
		return fmt.Errorf("创建举报失败: %w", err)
	}
	if !created {
		return ErrAlreadyReported
	}
	return nil
}
