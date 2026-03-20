package utils

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// jwtSecret 优先读取环境变量 JWT_SECRET，生产环境必须设置
var jwtSecret = func() []byte {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s)
	}
	return []byte("default-secret-change-in-production")
}()

// JWTClaims 自定义 Claims，jti 字段用于登出黑名单
type JWTClaims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	JTI      string `json:"jti"` // JWT ID（UUID），登出时写入 Redis 黑名单
	jwt.RegisteredClaims
}

// GenerateToken 生成 HS256 JWT，有效期 24 小时
// 返回 tokenString 和 jti（UUID字符串）
func GenerateToken(userID, username string) (tokenString string, jti string, err error) {
	jti = uuid.New().String()
	now := time.Now()

	claims := JWTClaims{
		UserID:   userID,
		Username: username,
		JTI:      jti,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err = token.SignedString(jwtSecret)
	return
}

// ParseToken 解析并验证 JWT，返回 Claims
func ParseToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("非预期的签名算法: %v", t.Header["alg"])
		}
		return jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("无效的 token")
	}
	return claims, nil
}
