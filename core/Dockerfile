FROM golang:1.22-alpine AS backend-builder
ENV CGO_ENABLED=0 GOOS=linux GOMAXPROCS=2 GOGC=75
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -p 2 -trimpath -ldflags="-s -w" -o /out/service ./cmd/main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 appuser
WORKDIR /app
COPY --from=backend-builder /out/service /app/service
USER appuser
EXPOSE 4000
ENTRYPOINT ["/app/service"]
