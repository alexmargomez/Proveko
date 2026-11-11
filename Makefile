.PHONY: build-ui build-go build test scaffold

MODULES = ./core ./services/ms-platform ./services/ms-facturacion ./services/ms-clientes ./services/ms-inventario ./services/ms-caja ./services/ms-comandas ./services/ms-hoteleria ./services/ms-taller ./services/ms-bascula ./services/ms-compras ./services/ms-agenda ./services/ms-taquilla ./services/ms-nomina ./services/ms-contabilidad ./services/ms-reportes ./services/ms-impresiones

build-ui:
	cd core/frontend-shell && npm ci && npm run build

build-go:
	@for mod in $(MODULES); do \
		echo "[build] $$mod"; \
		(cd $$mod && GOWORK=off CGO_ENABLED=0 go build -trimpath ./...) || exit 1; \
	done

build: build-ui build-go

test:
	@for mod in $(MODULES); do \
		(cd $$mod && GOWORK=off go test -race -count=1 ./...) || exit 1; \
	done
	cd tests && GOWORK=off go test -race -count=1 ./...

scaffold:
	cd tools/scaffold-ms && GOWORK=off go run . -name "$(NAME)" -title "$(TITLE)" -icon "$(ICON)"
