export interface Post {
  post_id: string
  user_id: string
  username: string
  profile_picture?: string
  content: string
  image_urls: string[]
  created_at: string
  like_count: number
  comment_count: number
  is_liked: boolean
  tags: string[]
  visibility: string
}

export interface Comment {
  comment_id: string
  parent_id?: string | null
  content: string
  created_at: string
  user_id: string
  username: string
  profile_picture?: string
}

export interface UserCard {
  user_id: string
  username: string
  email: string
  profile_picture: string
  post_count: number
  following_count: number
  follower_count: number
}

export interface HotTag {
  tag_name: string
  post_count: number
}

export interface RecommendedUser {
  user_id: string
  username: string
  bio?: string
  profile_picture?: string
}

export interface HomeFeedResponse {
  user_card: UserCard
  posts: Post[]
  next_cursor: string
  hot_tags: HotTag[]
  recommended_users: RecommendedUser[]
}

export interface FeedPostsResponse {
  posts: Post[]
  next_cursor: string
  has_more: boolean
}

export interface UserProfile {
  user_id: string
  username: string
  email: string
  bio: string
  profile_picture: string
  post_count: number
  following_count: number
  follower_count: number
}

export interface Notification {
  notification_id: string
  actor_id: string
  actor_name: string
  actor_picture?: string
  type: 'like' | 'comment' | 'reply'
  post_id?: string | null
  is_read: boolean
  created_at: string
}

export interface SimpleUser {
  user_id: string
  username: string
  bio?: string
  profile_picture?: string
}
