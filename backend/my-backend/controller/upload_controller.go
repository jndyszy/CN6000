package controller

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// 允许上传的 MIME 类型及对应扩展名（通过 magic bytes 检测）
var allowedMIME = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/gif":  "gif",
	"image/webp": "webp",
}

const maxUploadSize = 10 << 20 // 10 MB

// UploadImage POST /api/upload/image
// 接收 multipart/form-data 中的 file 字段，校验 MIME（magic bytes）后按日期目录保存，返回可访问 URL。
func UploadImage(c *gin.Context) {
	// 限制解析内存（超出部分写临时文件）
	if err := c.Request.ParseMultipartForm(maxUploadSize); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件超过 10MB"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未携带文件"})
		return
	}
	defer file.Close()

	// 文件大小校验
	if header.Size > maxUploadSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件超过 10MB"})
		return
	}

	// 读取前 512 字节进行 MIME 检测（magic bytes）
	buf := make([]byte, 512)
	n, _ := file.Read(buf)
	mimeType := http.DetectContentType(buf[:n])

	ext, ok := allowedMIME[mimeType]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件类型不支持（仅支持 jpg/png/gif/webp）"})
		return
	}

	// 重置文件指针到开头，保证写入完整内容
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "磁盘写入失败"})
		return
	}

	// 按日期创建目录（存储根目录通过 UPLOAD_DIR 环境变量配置，默认 ./uploads）
	uploadRoot := os.Getenv("UPLOAD_DIR")
	if uploadRoot == "" {
		uploadRoot = "./uploads"
	}
	now := time.Now()
	dateDir := fmt.Sprintf("%d/%02d/%02d", now.Year(), int(now.Month()), now.Day())
	absDir := filepath.Join(uploadRoot, dateDir)
	if err := os.MkdirAll(absDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "磁盘写入失败"})
		return
	}

	// 以 UUID 重命名，避免路径穿越和文件名冲突
	filename := uuid.New().String() + "." + ext
	dst := filepath.Join(absDir, filename)

	out, err := os.Create(dst)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "磁盘写入失败"})
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "磁盘写入失败"})
		return
	}

	// 构造公开访问 URL（生产环境通过 BASE_URL 环境变量覆盖域名）
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}
	url := fmt.Sprintf("%s/uploads/%s/%s", baseURL, dateDir, filename)

	c.JSON(http.StatusOK, gin.H{"url": url})
}
