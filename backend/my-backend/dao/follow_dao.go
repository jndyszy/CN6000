package dao

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm/clause"

	"my-backend/conf"
	"my-backend/model"
)

// ErrFollowExists 已关注
var ErrFollowExists = errors.New("已经关注过了")

// ErrFollowNotFound 未关注
var ErrFollowNotFound = errors.New("尚未关注该用户")

// FollowUser 关注目标用户。已关注时（ON CONFLICT DO NOTHING 影响行数为 0）返回 ErrFollowExists。
func FollowUser(followerID, followeeID uuid.UUID) error {
	follow := model.Follow{FollowerID: followerID, FolloweeID: followeeID}
	result := conf.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&follow)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrFollowExists
	}
	return nil
}

// UnfollowUser 取消关注。未关注时（影响行数为 0）返回 ErrFollowNotFound。
func UnfollowUser(followerID, followeeID uuid.UUID) error {
	result := conf.DB.
		Where("follower_id = ? AND followee_id = ?", followerID, followeeID).
		Delete(&model.Follow{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrFollowNotFound
	}
	return nil
}
