FROM node:20-alpine AS frontend-builder
WORKDIR /ui
COPY frontend-shell/package.json frontend-shell/package-lock.json* ./frontend-shell/
WORKDIR /ui/frontend-shell
RUN npm ci
COPY frontend-shell/ ./
RUN mkdir -p /ui/embed_dist && npm run build

FROM golang:1.22-alpine AS backend-builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-builder /ui/embed_dist ./embed_dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/service ./cmd/main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 appuser
WORKDIR /app
COPY --from=backend-builder /out/service /app/service
USER appuser
EXPOSE 4000
ENTRYPOINT ["/app/service"]
