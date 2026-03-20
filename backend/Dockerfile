# ========================
# Stage 1: Build
# ========================
FROM golang:1.25-alpine AS builder

WORKDIR /app

ENV GOPROXY=https://proxy.golang.org,direct

# 优先复制依赖文件，利用 Docker 层缓存
# 只要 go.mod/go.sum 不变，依赖层就不会重新下载
COPY my-backend/go.mod my-backend/go.sum ./
RUN go mod download

COPY my-backend/ .

# 编译静态二进制（CGO_ENABLED=0 保证无 C 运行时依赖）
# -ldflags="-s -w" 去掉调试符号，减小体积约 30%
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server .

# ========================
# Stage 2: Run
# ========================
FROM alpine:3.21

# ca-certificates：HTTPS 请求（Gmail SMTP）
# tzdata：时区支持
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# 只复制编译产物，不携带源代码
COPY --from=builder /app/server .

# 上传目录（可挂载外部 Volume）
RUN mkdir -p uploads

EXPOSE 8080

CMD ["./server"]
