FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/service ./cmd/main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 appuser
WORKDIR /app
COPY --from=builder /out/service /app/service
USER appuser
EXPOSE 4107
ENTRYPOINT ["/app/service"]
