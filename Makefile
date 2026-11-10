.PHONY: build-ui build-go build test scaffold

build-ui:
	cd core/frontend-shell && npm install --no-audit --no-fund && npm run build

build-go:
	CGO_ENABLED=0 go build -trimpath -o bin/proveko ./cmd/cluster-runner

build: build-ui build-go

test:
	go test -v ./...

# Uso: make scaffold NAME=garantia TITLE="Garantías y Postventa" ICON="🛡️"
scaffold:
	go run ./tools/scaffold-ms -name "$(NAME)" -title "$(TITLE)" -icon "$(ICON)"
