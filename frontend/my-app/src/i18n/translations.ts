type Lang = 'en' | 'zh'
type Translations = Record<string, string>

export const translations: Record<Lang, Translations> = {
  en: {
    // App
    'app.name': 'BlueNote',

    // Navigation
    'nav.back': '← Back',
    'nav.search': '🔍 Search',
    'nav.logout': 'Log out',
    'nav.settings': 'Settings',
    'nav.myProfile': 'My profile',
    'nav.admin': 'Admin',

    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.editProfile': 'Edit profile',

    // Common
    'common.loading': 'Loading...',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.saving': 'Saving...',
    'common.uploading': 'Uploading',

    // Stats
    'stat.posts': 'Posts',
    'stat.following': 'Following',
    'stat.followers': 'Followers',

    // Feed
    'feed.sort.latest': 'Latest',
    'feed.sort.hot': 'Hot',
    'feed.placeholder': 'Share your thoughts...',
    'feed.tagsPlaceholder': 'Tags (comma separated, e.g. travel, food)',
    'feed.posting': 'Posting...',
    'feed.publish': 'Post',
    'feed.loadingMore': 'Loading more...',
    'feed.noMore': 'All caught up',
    'feed.empty': 'No posts yet. Be the first to share!',

    // Visibility
    'visibility.public': '🌐 Public',
    'visibility.followers': '👥 Followers',
    'visibility.followersOnly': '👥 Followers only',
    'visibility.private': '🔒 Only me',

    // Upload
    'upload.addImage': '+ Add image',
    'upload.failed': 'Upload failed',

    // Sidebar
    'sidebar.hotTags': 'Hot Tags',
    'sidebar.recommended': 'Suggested Users',

    // Post actions
    'post.edit': 'Edit',
    'post.delete': 'Delete',
    'post.report': 'Report',
    'post.deleteConfirm': 'Delete this post?',
    'post.tagsPlaceholder': 'Tags (comma separated, e.g. travel, food)',

    // Report
    'report.post': 'Report post',
    'report.comment': 'Report comment',
    'report.selectReason': 'Select a reason',
    'report.illegal': 'Illegal content',
    'report.adult': 'Adult content',
    'report.misinformation': 'Misinformation',
    'report.spam': 'Spam',
    'report.other': 'Other',
    'report.submitting': 'Submitting...',
    'report.submit': 'Submit report',
    'report.success': 'Report received. We will review it within 24 hours.',

    // Comments
    'comment.empty': 'No comments yet',
    'comment.placeholder': 'Write a comment...',
    'comment.send': 'Send',
    'comment.reply': 'Reply',
    'comment.replyingTo': 'Replying to',

    // Auth - Login
    'auth.login': 'Log in',
    'auth.loggingIn': 'Logging in...',
    'auth.loginFailed': 'Login failed',
    'auth.email': 'Email',
    'auth.emailPlaceholder': 'Enter your email',
    'auth.password': 'Password',
    'auth.passwordPlaceholder': 'Enter your password',
    'auth.forgotPassword': 'Forgot password?',
    'auth.registerLink': 'Register',

    // Auth - Register
    'auth.register': 'Register',
    'auth.registering': 'Registering...',
    'auth.registerFailed': 'Registration failed',
    'auth.registerSuccess': 'Registered successfully. Please log in.',
    'auth.username': 'Username',
    'auth.usernamePlaceholder': '3–50 characters',
    'auth.passwordPlaceholder2': 'At least 6 characters',
    'auth.hasAccount': 'Already have an account?',
    'auth.goLogin': 'Log in',
    'auth.usernameError': 'Username must be 3–50 characters',
    'auth.passwordError': 'Password must be at least 6 characters',

    // Auth - Forgot password
    'auth.forgotPasswordTitle': 'Forgot Password',
    'auth.forgotPasswordDesc': 'Enter your email and we will send you a 6-digit code',
    'auth.emailPlaceholderForgot': 'Enter your registered email',
    'auth.sending': 'Sending...',
    'auth.sendCode': 'Send code',
    'auth.backToLogin': '← Back to login',
    'auth.sendFailed': 'Failed to send. Please try again later.',

    // Auth - Reset password
    'auth.resetPasswordTitle': 'Reset Password',
    'auth.codeSentTo': 'Code sent to',
    'auth.otp': 'Verification code',
    'auth.otpPlaceholder': 'Enter 6-digit code',
    'auth.newPassword': 'New password',
    'auth.confirmPassword': 'Confirm new password',
    'auth.confirmPasswordPlaceholder': 'Enter new password again',
    'auth.resetting': 'Resetting...',
    'auth.resetPasswordBtn': 'Reset password',
    'auth.resendCode': '← Resend code',
    'auth.otpError': 'Code must be 6 digits',
    'auth.newPasswordError': 'New password must be at least 6 characters',
    'auth.passwordMismatch': 'Passwords do not match',
    'auth.resetSuccess': 'Password reset successfully. Please log in.',
    'auth.resetFailed': 'Reset failed. Please check the code.',
    'auth.pageExpired': 'Session expired. Please ',
    'auth.forgotPasswordLink': 'retrieve your password',

    // Search
    'search.title': 'Search',
    'search.userPlaceholder': 'Search username...',
    'search.postPlaceholder': 'Search post content...',
    'search.submit': 'Search',
    'search.usersTab': '👤 Users',
    'search.postsTab': '📝 Posts',
    'search.searching': 'Searching...',
    'search.searchUsers': 'Search users',
    'search.searchPosts': 'Search posts',
    'search.hint': 'Enter a keyword and press Enter or click Search',
    'search.noUsers': 'No users found',
    'search.noPosts': 'No posts found',
    'search.tryAnother': 'Try a different keyword?',
    'search.foundUsers': 'Found {count} user(s)',
    'search.foundPosts': 'Relevant posts found',
    'search.loadMore': 'Load more',
    'search.allLoaded': 'All results loaded',

    // Profile
    'profile.edit': 'Edit profile',
    'profile.editTitle': 'Edit Profile',
    'profile.follow': 'Follow',
    'profile.following': 'Following',
    'profile.notFound': 'User not found',
    'profile.noPosts': 'No posts yet',
    'profile.noFollowing': 'Not following anyone yet',
    'profile.noFollowers': 'No followers yet',
    'profile.tabPosts': 'Posts',
    'profile.tabFollowing': 'Following',
    'profile.tabFollowers': 'Followers',
    'profile.bio': 'Bio',
    'profile.bioPlaceholder': 'Tell us about yourself...',
    'profile.changeAvatar': 'Change avatar',
    'profile.deleteAccount': 'Delete account',
    'profile.deleteAccountTitle': 'Delete Account',
    'profile.deleteWarning': 'This action is irreversible. All your posts, comments and follows will be removed.',
    'profile.deleteConfirmPrompt': 'Enter your username {username} to confirm:',
    'profile.usernamePlaceholder': 'Enter username',
    'profile.usernameWrong': 'Username incorrect. Please try again.',
    'profile.deleting': 'Deleting...',
    'profile.confirmDelete': 'Confirm deletion',
    'profile.accountDeleted': 'Account deleted',
    'profile.deleteFailed': 'Deletion failed. Please try again.',
    'profile.saveFailed': 'Save failed',
    'profile.changeEmail': 'Change Email',
    'profile.newEmail': 'New email',
    'profile.newEmailPlaceholder': 'Enter new email',
    'profile.currentPassword': 'Current password',
    'profile.currentPasswordPlaceholder': 'Enter current password',
    'profile.updateEmail': 'Update email',
    'profile.updatingEmail': 'Updating...',
    'profile.emailUpdated': 'Email updated',
    'profile.changePassword': 'Change Password',
    'profile.newPassword': 'New password',
    'profile.newPasswordPlaceholder': 'At least 6 characters',
    'profile.confirmNewPassword': 'Confirm new password',
    'profile.confirmNewPasswordPlaceholder': 'Enter new password again',
    'profile.updatePassword': 'Update password',
    'profile.updatingPassword': 'Updating...',
    'profile.passwordUpdated': 'Password updated',
    'profile.sendCode': 'Send verification code',
    'profile.sendingCode': 'Sending...',
    'profile.codeSentTo': 'Code sent to {email}',
    'profile.sendCodeDesc': 'A verification code will be sent to {email}',
    'profile.resendCode': '← Resend code',

    // Tags
    'tag.noPosts': 'No posts with this tag',

    // Notifications
    'notif.title': 'Notifications',
    'notif.empty': 'No notifications yet',
    'notif.markAllRead': 'Mark all as read',
    'notif.like': '{actor} liked your post',
    'notif.comment': '{actor} commented on your post',
    'notif.reply': '{actor} replied to your comment',
    'notif.viewPost': 'View post',
  },

  zh: {
    // App
    'app.name': '小蓝书',

    // Navigation
    'nav.back': '← 返回',
    'nav.search': '🔍 搜索',
    'nav.logout': '退出',
    'nav.settings': '设置',
    'nav.myProfile': '个人主页',
    'nav.admin': '管理后台',

    // Settings
    'settings.title': '设置',
    'settings.language': '语言',
    'settings.editProfile': '编辑个人信息',

    // Common
    'common.loading': '加载中...',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.saving': '保存中...',
    'common.uploading': '上传中',

    // Stats
    'stat.posts': '帖子',
    'stat.following': '关注',
    'stat.followers': '粉丝',

    // Feed
    'feed.sort.latest': '最新',
    'feed.sort.hot': '热门',
    'feed.placeholder': '分享你的想法...',
    'feed.tagsPlaceholder': '标签（逗号分隔，如: 旅行, 美食）',
    'feed.posting': '发布中...',
    'feed.publish': '发布',
    'feed.loadingMore': '加载更多...',
    'feed.noMore': '已加载全部',
    'feed.empty': '还没有帖子，来发第一条吧！',

    // Visibility
    'visibility.public': '🌐 公开',
    'visibility.followers': '👥 关注者',
    'visibility.followersOnly': '👥 仅关注者',
    'visibility.private': '🔒 仅自己',

    // Upload
    'upload.addImage': '+ 添加图片',
    'upload.failed': '上传失败',

    // Sidebar
    'sidebar.hotTags': '热门标签',
    'sidebar.recommended': '推荐用户',

    // Post actions
    'post.edit': '编辑',
    'post.delete': '删除',
    'post.report': '举报',
    'post.deleteConfirm': '确定要删除这条帖子吗？',
    'post.tagsPlaceholder': '标签（逗号分隔，如: 旅行, 美食）',

    // Report
    'report.post': '举报帖子',
    'report.comment': '举报评论',
    'report.selectReason': '选择举报原因',
    'report.illegal': '违法违规',
    'report.adult': '色情低俗',
    'report.misinformation': '虚假信息',
    'report.spam': '垃圾广告',
    'report.other': '其他',
    'report.submitting': '提交中...',
    'report.submit': '提交举报',
    'report.success': '已收到您的举报，我们将在 24 小时内处理',

    // Comments
    'comment.empty': '暂无评论',
    'comment.placeholder': '写下你的评论...',
    'comment.send': '发送',
    'comment.reply': '回复',
    'comment.replyingTo': '回复',

    // Auth - Login
    'auth.login': '登录',
    'auth.loggingIn': '登录中...',
    'auth.loginFailed': '登录失败',
    'auth.email': '邮箱',
    'auth.emailPlaceholder': '请输入邮箱',
    'auth.password': '密码',
    'auth.passwordPlaceholder': '请输入密码',
    'auth.forgotPassword': '忘记密码？',
    'auth.registerLink': '注册账号',

    // Auth - Register
    'auth.register': '注册',
    'auth.registering': '注册中...',
    'auth.registerFailed': '注册失败',
    'auth.registerSuccess': '注册成功，请登录',
    'auth.username': '用户名',
    'auth.usernamePlaceholder': '3~50 个字符',
    'auth.passwordPlaceholder2': '至少 6 个字符',
    'auth.hasAccount': '已有账号？',
    'auth.goLogin': '去登录',
    'auth.usernameError': '用户名须为 3~50 个字符',
    'auth.passwordError': '密码至少 6 个字符',

    // Auth - Forgot password
    'auth.forgotPasswordTitle': '找回密码',
    'auth.forgotPasswordDesc': '输入注册邮箱，我们将向您发送 6 位验证码',
    'auth.emailPlaceholderForgot': '请输入注册邮箱',
    'auth.sending': '发送中...',
    'auth.sendCode': '发送验证码',
    'auth.backToLogin': '← 返回登录',
    'auth.sendFailed': '发送失败，请稍后重试',

    // Auth - Reset password
    'auth.resetPasswordTitle': '重置密码',
    'auth.codeSentTo': '验证码已发送至',
    'auth.otp': '验证码',
    'auth.otpPlaceholder': '请输入 6 位验证码',
    'auth.newPassword': '新密码',
    'auth.confirmPassword': '确认新密码',
    'auth.confirmPasswordPlaceholder': '请再次输入新密码',
    'auth.resetting': '重置中...',
    'auth.resetPasswordBtn': '重置密码',
    'auth.resendCode': '← 重新发送验证码',
    'auth.otpError': '验证码为 6 位数字',
    'auth.newPasswordError': '新密码至少 6 个字符',
    'auth.passwordMismatch': '两次输入的密码不一致',
    'auth.resetSuccess': '密码重置成功，请重新登录',
    'auth.resetFailed': '重置失败，请检查验证码是否正确',
    'auth.pageExpired': '页面已过期，请重新',
    'auth.forgotPasswordLink': '找回密码',

    // Search
    'search.title': '搜索',
    'search.userPlaceholder': '搜索用户名...',
    'search.postPlaceholder': '搜索帖子内容...',
    'search.submit': '搜索',
    'search.usersTab': '👤 用户',
    'search.postsTab': '📝 帖子',
    'search.searching': '搜索中...',
    'search.searchUsers': '搜索用户',
    'search.searchPosts': '搜索帖子',
    'search.hint': '输入关键词，按回车或点击搜索',
    'search.noUsers': '没有找到相关用户',
    'search.noPosts': '没有找到相关帖子',
    'search.tryAnother': '换个关键词试试？',
    'search.foundUsers': '找到 {count} 个用户',
    'search.foundPosts': '找到相关帖子',
    'search.loadMore': '加载更多',
    'search.allLoaded': '已加载全部结果',

    // Profile
    'profile.edit': '编辑资料',
    'profile.editTitle': '编辑资料',
    'profile.follow': '关注',
    'profile.following': '已关注',
    'profile.notFound': '用户不存在',
    'profile.noPosts': '暂无帖子',
    'profile.noFollowing': '还没有关注任何人',
    'profile.noFollowers': '还没有粉丝',
    'profile.tabPosts': '帖子',
    'profile.tabFollowing': '关注',
    'profile.tabFollowers': '粉丝',
    'profile.bio': '个人简介',
    'profile.bioPlaceholder': '介绍一下自己...',
    'profile.changeAvatar': '更换头像',
    'profile.deleteAccount': '注销账号',
    'profile.deleteAccountTitle': '注销账号',
    'profile.deleteWarning': '此操作不可逆，账号下所有帖子、评论、关注关系将被清除。',
    'profile.deleteConfirmPrompt': '请输入你的用户名 {username} 以确认：',
    'profile.usernamePlaceholder': '输入用户名',
    'profile.usernameWrong': '用户名输入错误，请重新输入',
    'profile.deleting': '注销中...',
    'profile.confirmDelete': '确认注销',
    'profile.accountDeleted': '账号已注销',
    'profile.deleteFailed': '注销失败，请重试',
    'profile.saveFailed': '保存失败',
    'profile.changeEmail': '修改邮箱',
    'profile.newEmail': '新邮箱',
    'profile.newEmailPlaceholder': '输入新邮箱',
    'profile.currentPassword': '当前密码',
    'profile.currentPasswordPlaceholder': '输入当前密码',
    'profile.updateEmail': '更新邮箱',
    'profile.updatingEmail': '更新中...',
    'profile.emailUpdated': '邮箱已更新',
    'profile.changePassword': '修改密码',
    'profile.newPassword': '新密码',
    'profile.newPasswordPlaceholder': '至少 6 个字符',
    'profile.confirmNewPassword': '确认新密码',
    'profile.confirmNewPasswordPlaceholder': '再次输入新密码',
    'profile.updatePassword': '更新密码',
    'profile.updatingPassword': '更新中...',
    'profile.passwordUpdated': '密码已更新',
    'profile.sendCode': '发送验证码',
    'profile.sendingCode': '发送中...',
    'profile.codeSentTo': '验证码已发送至 {email}',
    'profile.sendCodeDesc': '验证码将发送至 {email}',
    'profile.resendCode': '← 重新发送',

    // Tags
    'tag.noPosts': '该标签下暂无帖子',

    // Notifications
    'notif.title': '消息通知',
    'notif.empty': '暂无通知',
    'notif.markAllRead': '全部标为已读',
    'notif.like': '{actor} 赞了你的帖子',
    'notif.comment': '{actor} 评论了你的帖子',
    'notif.reply': '{actor} 回复了你的评论',
    'notif.viewPost': '查看帖子',
  },
}
