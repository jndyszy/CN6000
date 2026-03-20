package dao

import (
	"my-backend/conf"
	"my-backend/model"
)

// CreateReport 创建举报记录；重复举报（同一用户对同一内容）静默忽略（ON CONFLICT DO NOTHING）。
// 返回 (true, nil) 表示成功写入，(false, nil) 表示已存在（忽略），(_, err) 表示失败。
func CreateReport(report *model.Report) (created bool, err error) {
	result := conf.DB.
		Exec(`
INSERT INTO reports (report_id, reporter_id, target_type, target_id, reason, created_at)
VALUES (?, ?, ?, ?, ?, NOW())
ON CONFLICT ON CONSTRAINT uq_reports_unique DO NOTHING`,
			report.ReportID,
			report.ReporterID,
			report.TargetType,
			report.TargetID,
			report.Reason,
		)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}
