package service

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"my-backend/conf"
	"my-backend/dao"
	"my-backend/model"
	"my-backend/utils"
)

// ========== 哨兵错误 ==========

var (
	ErrSelfFollow       = errors.New("不能关注自己")
	ErrAlreadyFollowing = errors.New("已经关注过了")
	ErrNotFollowing     = errors.New("尚未关注该用户")
	ErrInvalidUsername  = errors.New("用户名长度须在 3~50 字符之间")
)

// ========== 请求结构体 ==========

// UpdateProfileRequest 更新个人资料（全部可选，用指针区分"未传"与"传空"）
type UpdateProfileRequest struct {
	Username       *string `json:"username"`
	Bio            *string `json:"bio"`
	ProfilePicture *string `json:"profile_picture"`
	Email          *string `json:"email"`
}

// ConfirmChangePasswordRequest 通过 OTP 修改密码
type ConfirmChangePasswordRequest struct {
	OTPCode     string `json:"otp_code"     binding:"required,len=6"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// ========== DeleteAccount：账号注销 ==========

// DeleteAccount 注销当前用户账号：级联软删帖子/评论、清除点赞关注、匿名化用户记录、使 Token 失效。
func DeleteAccount(currentUserID uuid.UUID, jti string, expiry time.Time) error {
	if err := dao.DeleteAccount(currentUserID); err != nil {
		return fmt.Errorf("注销账号失败: %w", err)
	}

	// 将当前 Token 加入黑名单（复用 Logout 逻辑）
	ttl := time.Until(expiry)
	if ttl > 0 {
		conf.RDB.Set(context.Background(), "token:blacklist:"+jti, "1", ttl)
	}
	return nil
}

// ========== FollowUser：关注用户 ==========

func FollowUser(currentUserID, targetUserID uuid.UUID) error {
	if currentUserID == targetUserID {
		return ErrSelfFollow
	}

	// 检查目标用户是否存在
	target, err := dao.GetUserByID(targetUserID)
	if err != nil {
		return fmt.Errorf("查询用户失败: %w", err)
	}
	if target == nil {
		return ErrUserNotFound
	}

	if err := dao.FollowUser(currentUserID, targetUserID); err != nil {
		if errors.Is(err, dao.ErrFollowExists) {
			return ErrAlreadyFollowing
		}
		return fmt.Errorf("关注失败: %w", err)
	}

	// 使推荐用户缓存失效
	conf.RDB.Del(context.Background(), "recommend:users:"+currentUserID.String())
	return nil
}

// ========== UnfollowUser：取消关注 ==========

func UnfollowUser(currentUserID, targetUserID uuid.UUID) error {
	if err := dao.UnfollowUser(currentUserID, targetUserID); err != nil {
		if errors.Is(err, dao.ErrFollowNotFound) {
			return ErrNotFollowing
		}
		return fmt.Errorf("取消关注失败: %w", err)
	}

	// 使推荐用户缓存失效
	conf.RDB.Del(context.Background(), "recommend:users:"+currentUserID.String())
	return nil
}

// ========== GetUserProfile：用户主页 ==========

// UserProfileResult 用户主页返回结果
type UserProfileResult struct {
	Stats *dao.UserStatsRow
	Posts []dao.PostRow
}

func GetUserProfile(targetUserID, currentUserID uuid.UUID) (*UserProfileResult, error) {
	stats, err := dao.GetUserStats(targetUserID)
	if err != nil {
		return nil, fmt.Errorf("查询用户统计失败: %w", err)
	}
	if stats == nil {
		return nil, ErrUserNotFound
	}

	posts, err := dao.GetPostsByUserID(targetUserID, currentUserID, time.Time{}, 20)
	if err != nil {
		return nil, fmt.Errorf("查询用户帖子失败: %w", err)
	}

	return &UserProfileResult{Stats: stats, Posts: posts}, nil
}

// ========== GetFollowing：关注列表 ==========

func GetFollowing(targetUserID uuid.UUID) ([]dao.UserRow, error) {
	// 检查用户是否存在
	user, err := dao.GetUserByID(targetUserID)
	if err != nil {
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	return dao.GetFollowingList(targetUserID)
}

// ========== GetFollowers：粉丝列表 ==========

func GetFollowers(targetUserID uuid.UUID) ([]dao.UserRow, error) {
	user, err := dao.GetUserByID(targetUserID)
	if err != nil {
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	return dao.GetFollowersList(targetUserID)
}

// ========== UpdateProfile：更新个人资料 ==========

func UpdateProfile(currentUserID uuid.UUID, req UpdateProfileRequest) (*model.User, error) {
	updates := make(map[string]interface{})

	if req.Email != nil {
		existing, err := dao.GetUserByEmail(*req.Email)
		if err != nil {
			return nil, fmt.Errorf("查询邮箱失败: %w", err)
		}
		if existing != nil && existing.UserID != currentUserID {
			return nil, ErrEmailExists
		}
		updates["email"] = *req.Email
	}

	if req.Username != nil {
		u := *req.Username
		if len(u) < 3 || len(u) > 50 {
			return nil, ErrInvalidUsername
		}
		// 检查用户名是否已被他人使用
		existing, err := dao.GetUserByUsername(u)
		if err != nil {
			return nil, fmt.Errorf("查询用户名失败: %w", err)
		}
		if existing != nil && existing.UserID != currentUserID {
			return nil, ErrUsernameExists
		}
		updates["username"] = u
	}

	if req.Bio != nil {
		updates["bio"] = *req.Bio
	}

	if req.ProfilePicture != nil {
		updates["profile_picture"] = *req.ProfilePicture
	}

	if len(updates) > 0 {
		if err := dao.UpdateUserProfile(currentUserID, updates); err != nil {
			return nil, fmt.Errorf("更新资料失败: %w", err)
		}
	}

	return dao.GetUserByID(currentUserID)
}

// ========== SendChangePasswordCode：发送修改密码验证码 ==========

func SendChangePasswordCode(userID uuid.UUID) error {
	ctx := context.Background()

	user, err := dao.GetUserByID(userID)
	if err != nil {
		return fmt.Errorf("查询用户失败: %w", err)
	}
	if user == nil {
		return ErrUserNotFound
	}

	// 同一邮箱 1 分钟内只允许发送 1 次
	rateLimitKey := "ratelimit:otp:" + user.Email
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

	code, err := generateOTPCode()
	if err != nil {
		return err
	}

	otpKey := "otp:change-password:" + userID.String()
	if err := conf.RDB.Set(ctx, otpKey, code, 10*time.Minute).Err(); err != nil {
		return fmt.Errorf("存储验证码失败: %w", err)
	}

	if err := utils.SendPasswordResetEmail(user.Email, code); err != nil {
		conf.RDB.Del(ctx, otpKey)
		return fmt.Errorf("发送邮件失败: %w", err)
	}
	return nil
}

// ========== ConfirmChangePassword：验证 OTP 并修改密码 ==========

func ConfirmChangePassword(userID uuid.UUID, req ConfirmChangePasswordRequest) error {
	ctx := context.Background()

	otpKey := "otp:change-password:" + userID.String()
	storedCode, err := conf.RDB.Get(ctx, otpKey).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return ErrInvalidOTP
		}
		return fmt.Errorf("Redis 查询失败: %w", err)
	}

	if subtle.ConstantTimeCompare([]byte(storedCode), []byte(req.OTPCode)) != 1 {
		return ErrInvalidOTP
	}

	conf.RDB.Del(ctx, otpKey)

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 10)
	if err != nil {
		return fmt.Errorf("密码加密失败: %w", err)
	}

	return dao.UpdateUserPassword(userID, string(hash))
}

// ========== SearchUsers：搜索用户 ==========

// SearchUsersResult 搜索用户返回结果
type SearchUsersResult struct {
	Users []dao.UserRow
	Total int64
}

func SearchUsers(q string, limit int) (*SearchUsersResult, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	users, total, err := dao.SearchUsers(q, limit)
	if err != nil {
		return nil, fmt.Errorf("搜索用户失败: %w", err)
	}
	return &SearchUsersResult{Users: users, Total: total}, nil
}
