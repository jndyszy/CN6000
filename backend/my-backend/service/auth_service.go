package service

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"my-backend/conf"
	"my-backend/dao"
	"my-backend/model"
	"my-backend/utils"
)

// ========== 哨兵错误，供 controller 层做分支判断 ==========

var (
	ErrUsernameExists     = errors.New("用户名已被注册")
	ErrEmailExists        = errors.New("邮箱已被注册")
	ErrInvalidCredentials = errors.New("邮箱或密码错误")
	ErrOTPRateLimit       = errors.New("发送过于频繁，请 1 分钟后再试")
	ErrInvalidOTP         = errors.New("验证码错误或已过期")
	ErrUserNotFound       = errors.New("用户不存在")
	ErrAccountBanned      = errors.New("账号已被封禁")
)

// ========== 请求结构体（绑定 + 校验规则写在这里，controller 直接 ShouldBindJSON） ==========

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type SendCodeRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ConfirmPasswordResetRequest struct {
	Email       string `json:"email"        binding:"required,email"`
	OTPCode     string `json:"otp_code"     binding:"required,len=6"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// ========== Register：注册新用户 ==========

func Register(req RegisterRequest) (*model.User, error) {
	// 检查用户名唯一
	existByName, err := dao.GetUserByUsername(req.Username)
	if err != nil {
		return nil, fmt.Errorf("查询用户名失败: %w", err)
	}
	if existByName != nil {
		return nil, ErrUsernameExists
	}

	// 检查邮箱唯一
	existByEmail, err := dao.GetUserByEmail(req.Email)
	if err != nil {
		return nil, fmt.Errorf("查询邮箱失败: %w", err)
	}
	if existByEmail != nil {
		return nil, ErrEmailExists
	}

	// bcrypt 加密密码，cost=10
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		return nil, fmt.Errorf("密码加密失败: %w", err)
	}

	user := &model.User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: string(hash),
	}
	if err := dao.CreateUser(user); err != nil {
		return nil, fmt.Errorf("创建用户失败: %w", err)
	}
	return user, nil
}

// ========== Login：用户登录，返回 JWT Token ==========

type LoginResult struct {
	Token string
	User  *model.User
}

func Login(req LoginRequest) (*LoginResult, error) {
	user, err := dao.GetUserByEmail(req.Email)
	if err != nil {
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}
	// 邮箱不存在与密码错误统一返回同一错误，防止枚举攻击
	if user == nil {
		return nil, ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}
	if user.IsBanned {
		return nil, ErrAccountBanned
	}

	tokenStr, _, err := utils.GenerateToken(user.UserID.String(), user.Username)
	if err != nil {
		return nil, fmt.Errorf("生成 Token 失败: %w", err)
	}
	return &LoginResult{Token: tokenStr, User: user}, nil
}

// ========== Logout：将 Token 的 jti 写入 Redis 黑名单 ==========

func Logout(jti string, expireAt time.Time) error {
	ttl := time.Until(expireAt)
	if ttl <= 0 {
		// Token 已自然过期，无需写黑名单
		return nil
	}
	key := "token:blacklist:" + jti
	return conf.RDB.Set(context.Background(), key, "1", ttl).Err()
}

// ========== SendPasswordResetCode：发送 6 位 OTP 验证码到邮箱 ==========

func SendPasswordResetCode(email string) error {
	ctx := context.Background()

	// 同一邮箱 1 分钟内只允许发送 1 次（防止邮件轰炸）
	rateLimitKey := "ratelimit:otp:" + email
	count, err := conf.RDB.Incr(ctx, rateLimitKey).Result()
	if err != nil {
		return fmt.Errorf("Redis 操作失败: %w", err)
	}
	if count == 1 {
		conf.RDB.Expire(ctx, rateLimitKey, time.Minute)
	}
	if count > 1 {
		return ErrOTPRateLimit
	}

	// 邮箱不存在时静默返回（对外表现与正常流程一致，防止枚举注册邮箱）
	user, err := dao.GetUserByEmail(email)
	if err != nil {
		return fmt.Errorf("查询用户失败: %w", err)
	}
	if user == nil {
		return nil
	}

	// 使用 crypto/rand 生成 6 位随机数字验证码（安全随机）
	code, err := generateOTPCode()
	if err != nil {
		return err
	}

	// 存入 Redis，TTL 10 分钟
	otpKey := "otp:password-reset:" + email
	if err := conf.RDB.Set(ctx, otpKey, code, 10*time.Minute).Err(); err != nil {
		return fmt.Errorf("存储验证码失败: %w", err)
	}

	// 发送邮件；失败时回滚 Redis 中的 OTP，避免留下"发了但没收到"的孤立 Key
	if err := utils.SendPasswordResetEmail(email, code); err != nil {
		conf.RDB.Del(ctx, otpKey)
		return fmt.Errorf("发送邮件失败: %w", err)
	}
	return nil
}

// ========== ConfirmPasswordReset：校验 OTP 并重置密码 ==========

func ConfirmPasswordReset(req ConfirmPasswordResetRequest) error {
	ctx := context.Background()

	// 查询用户
	user, err := dao.GetUserByEmail(req.Email)
	if err != nil {
		return fmt.Errorf("查询用户失败: %w", err)
	}
	if user == nil {
		return ErrUserNotFound
	}

	// 从 Redis 取验证码
	otpKey := "otp:password-reset:" + req.Email
	storedCode, err := conf.RDB.Get(ctx, otpKey).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return ErrInvalidOTP // key 不存在或已过期
		}
		return fmt.Errorf("Redis 查询失败: %w", err)
	}

	// 恒定时间比较，防止时序攻击
	if subtle.ConstantTimeCompare([]byte(storedCode), []byte(req.OTPCode)) != 1 {
		return ErrInvalidOTP
	}

	// 验证成功后立即删除 OTP，防止重复使用
	conf.RDB.Del(ctx, otpKey)

	// bcrypt 加密新密码
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 10)
	if err != nil {
		return fmt.Errorf("密码加密失败: %w", err)
	}

	if err := dao.UpdateUserPassword(user.UserID, string(hash)); err != nil {
		return fmt.Errorf("更新密码失败: %w", err)
	}
	return nil
}

// ========== 内部辅助 ==========

// generateOTPCode 使用 crypto/rand 生成 6 位数字验证码（安全随机）
func generateOTPCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", fmt.Errorf("生成验证码失败: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}
