FROM node:20-alpine AS shell-builder
WORKDIR /ui
COPY core/frontend-shell/package.json core/frontend-shell/package-lock.json* ./frontend-shell/
WORKDIR /ui/frontend-shell
RUN npm ci
COPY core/frontend-shell/ ./
RUN mkdir -p /ui/embed_dist && npm run build

FROM golang:1.22-alpine AS go-builder
WORKDIR /src
COPY core/go.mod core/go.sum ./
RUN go mod download
COPY core/ .
COPY --from=shell-builder /ui/embed_dist ./embed_dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/ms-core ./cmd/main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 appuser
WORKDIR /app
COPY --from=go-builder /out/ms-core /app/ms-core
USER appuser
EXPOSE 4000
ENTRYPOINT ["/app/ms-core"]
