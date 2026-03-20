package utils

import (
	"fmt"
	"net/smtp"
	"os"
)

// SendPasswordResetEmail 通过 Gmail SMTP 发送重置密码验证码邮件
//
// 依赖环境变量：
//   - GMAIL_FROM     发件邮箱（Gmail 地址）
//   - GMAIL_PASSWORD Gmail 应用专用密码（Account → Security → App passwords）
func SendPasswordResetEmail(toEmail, code string) error {
	from := os.Getenv("GMAIL_FROM")
	password := os.Getenv("GMAIL_PASSWORD")
	if from == "" || password == "" {
		return fmt.Errorf("未配置 GMAIL_FROM 或 GMAIL_PASSWORD 环境变量")
	}

	host := "smtp.gmail.com"
	addr := host + ":587"
	auth := smtp.PlainAuth("", from, password, host)

	body := fmt.Sprintf(
		"您的密码重置验证码为：%s\r\n\r\n验证码有效期为 10 分钟，请勿泄露给他人。\r\n如非本人操作，请忽略此邮件。",
		code,
	)

	msg := []byte(
		"From: " + from + "\r\n" +
			"To: " + toEmail + "\r\n" +
			"Subject: 密码重置验证码\r\n" +
			"MIME-version: 1.0\r\n" +
			"Content-Type: text/plain; charset=\"UTF-8\"\r\n" +
			"\r\n" +
			body,
	)

	return smtp.SendMail(addr, auth, from, []string{toEmail}, msg)
}
