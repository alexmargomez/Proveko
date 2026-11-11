package main

import (
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	name := flag.String("name", "", "Identificador corto en minúsculas (ej: garantia -> crea services/ms-garantia)")
	title := flag.String("title", "Nuevo Servicio", "Nombre comercial visible en el menú lateral")
	icon := flag.String("icon", "🧩", "Ícono comercial visible en el menú lateral")
	port := flag.Int("port", 4120, "Puerto HTTP del microservicio")
	flag.Parse()

	slug := strings.TrimSpace(strings.ToLower(*name))
	if slug == "" {
		fmt.Fprintln(os.Stderr, "Uso: go run . -name <slug> -title \"Título Comercial\" -icon \"🧩\" -port 4120")
		os.Exit(1)
	}

	modName := "ms-" + slug
	pascal := strings.ToUpper(slug[:1]) + slug[1:]
	codePrefix := strings.ToUpper(slug[:minInt(3, len(slug))])
	servicesRoot := filepath.Join("..", "..", "services")
	if _, err := os.Stat("services"); err == nil {
		servicesRoot = "services"
	}
	baseDir := filepath.Join(servicesRoot, modName)

	dirs := []string{
		"migrations",
		"internal/platform",
		"internal/domain",
		"internal/application",
		"internal/infrastructure/persistence/memory",
		"internal/infrastructure/persistence/postgres",
		"internal/infrastructure/http/ui_dist",
		"backend",
		"cmd",
		"frontend",
	}
	for _, sub := range dirs {
		if err := os.MkdirAll(filepath.Join(baseDir, sub), 0o755); err != nil {
			panic(err)
		}
	}

	templatePlatformDir := filepath.Join(servicesRoot, "ms-agenda", "internal", "platform")
	if err := copyPlatformTree(templatePlatformDir, filepath.Join(baseDir, "internal", "platform"), "ms-agenda", modName); err != nil {
		panic("no se pudo clonar internal/platform base: " + err.Error())
	}

	templateSDK := filepath.Join(servicesRoot, "ms-agenda", "frontend", "sdk.d.ts")
	if rawSDK, err := os.ReadFile(templateSDK); err == nil {
		mustWrite(filepath.Join(baseDir, "frontend", "sdk.d.ts"), string(rawSDK))
	}

	goMod := fmt.Sprintf(`module %s

go 1.22

require (
	github.com/go-chi/chi/v5 v5.1.0
	github.com/jackc/pgx/v5 v5.7.1
	golang.org/x/crypto v0.27.0
)
`, modName)
	mustWrite(filepath.Join(baseDir, "go.mod"), goMod)

	dockerfile := fmt.Sprintf(`FROM golang:1.22-alpine AS builder
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
EXPOSE %d
ENTRYPOINT ["/app/service"]
`, *port)
	mustWrite(filepath.Join(baseDir, "Dockerfile"), dockerfile)

	envExample := fmt.Sprintf(`APP_ENV=production
SERVICE_NAME=%[1]s
PORT=%[2]d
GATEWAY_URL=http://127.0.0.1:4000
SERVICE_PUBLIC_URL=http://127.0.0.1:%[2]d
S2S_SHARED_KEY=replace_with_64_char_random_s2s_shared_key
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=service_app
DB_PASSWORD=replace_with_service_db_password
DB_SSLMODE=require
`, modName, *port)
	mustWrite(filepath.Join(baseDir, ".env.example"), envExample)

	manifest := fmt.Sprintf(`{
  "serviceKey": "%[1]s",
  "displayName": %[2]q,
  "icon": %[3]q,
  "apiPrefix": "/api/v1/%[4]s",
  "uiBundlePath": "/api/v1/%[4]s/ui.js",
  "bundleHash": "rev-v1",
  "category": "Servicios",
  "summary": %[2]q,
  "modules": [
    {
      "moduleKey": "%[4]s_principal",
      "displayName": "Gestión Principal",
      "tabIcon": %[3]q,
      "defaultActive": true,
      "summary": "Operación principal del servicio."
    }
  ],
  "submodules": [
    {
      "submoduleKey": "%[4]s_operacion",
      "displayName": "Registro y Consulta Operativa",
      "dependsOnModule": "%[4]s_principal",
      "defaultActive": true,
      "summary": "Submódulo operativo principal."
    }
  ],
  "features": []
}
`, modName, *title, *icon, slug)
	mustWrite(filepath.Join(baseDir, "manifest.json"), manifest)
	pkgIdent := "ms" + strings.ReplaceAll(slug, "-", "")
	mustWrite(filepath.Join(baseDir, "embed.go"), fmt.Sprintf("package %s\n\nimport _ \"embed\"\n\n//go:embed manifest.json\nvar ManifestJSON []byte\n", pkgIdent))

	pgSchema := strings.ReplaceAll(slug, "-", "_")
	sql := fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %[1]s;\nCREATE TABLE IF NOT EXISTS %[1]s.records (\n  id TEXT PRIMARY KEY,\n  code TEXT NOT NULL,\n  description TEXT NOT NULL,\n  created_at TEXT NOT NULL\n);\n", pgSchema)
	mustWrite(filepath.Join(baseDir, "migrations", "001_schema.sql"), sql)
	mustWrite(filepath.Join(baseDir, "migrations", "embed.go"), "package migrations\n\nimport _ \"embed\"\n\n//go:embed 001_schema.sql\nvar SchemaSQL string\n")

	domainGo := fmt.Sprintf(`package domain

import (
	"context"
	"strings"
	"time"

	"%[1]s/internal/platform/apperr"
	"%[1]s/internal/platform/money"
)

type Record struct {
	ID          string `+"`json:\"id\"`"+`
	Code        string `+"`json:\"code\"`"+`
	Description string `+"`json:\"description\"`"+`
	CreatedAt   string `+"`json:\"createdAt\"`"+`
}

func NewRecord(code, description string) (Record, error) {
	desc := strings.TrimSpace(description)
	if desc == "" {
		return Record{}, apperr.Validation("La descripción es obligatoria")
	}
	return Record{
		ID:          money.NewID("rec"),
		Code:        code,
		Description: desc,
		CreatedAt:   time.Now().UTC().Format("2006-01-02 15:04"),
	}, nil
}

type Repository interface {
	List(ctx context.Context, dbName string) (nextCode string, records []Record, err error)
	Create(ctx context.Context, dbName, description string) (Record, error)
}
`, modName)
	mustWrite(filepath.Join(baseDir, "internal/domain/entities.go"), domainGo)

	appGo := fmt.Sprintf(`package application

import (
	"context"

	"%[1]s/internal/domain"
	"%[1]s/internal/platform/authguard"
	"%[1]s/internal/platform/licensegate"
)

type Service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context) (string, []domain.Record, error) {
	if err := licensegate.CheckModule(ctx, %[2]q); err != nil {
		return "", nil, err
	}
	tc := authguard.FromContext(ctx)
	return s.repo.List(ctx, tc.DBName)
}

func (s *Service) Create(ctx context.Context, description string) (domain.Record, error) {
	if err := licensegate.CheckModule(ctx, %[2]q); err != nil {
		return domain.Record{}, err
	}
	tc := authguard.FromContext(ctx)
	return s.repo.Create(ctx, tc.DBName, description)
}
`, modName, slug+"_principal")
	mustWrite(filepath.Join(baseDir, "internal/application/usecases.go"), appGo)

	memGo := fmt.Sprintf(`package memory

import (
	"context"
	"sync"

	"%[1]s/internal/domain"
	"%[1]s/internal/platform/seqmem"
)

type Repository struct {
	mu   sync.Mutex
	seq  *seqmem.MemoryGenerator
	data map[string][]domain.Record
}

func NewRepository() *Repository {
	return &Repository{
		seq:  seqmem.NewMemory(),
		data: make(map[string][]domain.Record),
	}
}

func (r *Repository) List(_ context.Context, dbName string) (string, []domain.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	src := r.data[dbName]
	out := make([]domain.Record, len(src))
	copy(out, src)
	return r.seq.Peek(dbName, %[2]q, 100), out, nil
}

func (r *Repository) Create(_ context.Context, dbName, description string) (domain.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	code := r.seq.Next(dbName, %[2]q, 100)
	rec, err := domain.NewRecord(code, description)
	if err != nil {
		return domain.Record{}, err
	}
	r.data[dbName] = append([]domain.Record{rec}, r.data[dbName]...)
	return rec, nil
}
`, modName, codePrefix)
	mustWrite(filepath.Join(baseDir, "internal/infrastructure/persistence/memory/repo.go"), memGo)

	pgGo := fmt.Sprintf(`package postgres

import (
	"context"

	"%[1]s/internal/domain"
	"%[1]s/internal/platform/dbpool"
	"%[1]s/internal/platform/sequences"
	"%[1]s/migrations"
)

type Repository struct {
	dbMgr *dbpool.Manager
}

func NewRepository(dbMgr *dbpool.Manager) *Repository {
	return &Repository{dbMgr: dbMgr}
}

func (r *Repository) List(ctx context.Context, dbName string) (string, []domain.Record, error) {
	pool, err := r.dbMgr.OpenServicePool(ctx, dbName, %[1]q, migrations.SchemaSQL)
	if err != nil {
		return "", nil, err
	}
	nextCode, err := sequences.PeekSQL(ctx, pool, %[2]q, %[3]q, 100)
	if err != nil {
		return "", nil, err
	}
	rows, err := pool.Query(ctx, "SELECT id, code, description, created_at FROM %[2]s.records ORDER BY created_at DESC")
	if err != nil {
		return "", nil, err
	}
	defer rows.Close()
	var list []domain.Record
	for rows.Next() {
		var rec domain.Record
		if err := rows.Scan(&rec.ID, &rec.Code, &rec.Description, &rec.CreatedAt); err != nil {
			return "", nil, err
		}
		list = append(list, rec)
	}
	return nextCode, list, rows.Err()
}

func (r *Repository) Create(ctx context.Context, dbName, description string) (domain.Record, error) {
	pool, err := r.dbMgr.OpenServicePool(ctx, dbName, %[1]q, migrations.SchemaSQL)
	if err != nil {
		return domain.Record{}, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.Record{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	code, err := sequences.NextSQL(ctx, tx, %[2]q, %[3]q, 100)
	if err != nil {
		return domain.Record{}, err
	}
	rec, err := domain.NewRecord(code, description)
	if err != nil {
		return domain.Record{}, err
	}
	if _, err := tx.Exec(ctx, "INSERT INTO %[2]s.records (id, code, description, created_at) VALUES ($1,$2,$3,$4)", rec.ID, rec.Code, rec.Description, rec.CreatedAt); err != nil {
		return domain.Record{}, err
	}
	return rec, tx.Commit(ctx)
}
`, modName, pgSchema, codePrefix)
	mustWrite(filepath.Join(baseDir, "internal/infrastructure/persistence/postgres/repo.go"), pgGo)

	mustWrite(filepath.Join(baseDir, "internal/infrastructure/http/ui_dist/ui.js"), "export default function View(){return null;}\n")

	httpGo := fmt.Sprintf(`package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	%[1]s "%[2]s"
	"%[2]s/internal/application"
	"%[2]s/internal/platform/httpx"
	"%[2]s/internal/platform/security"
)

//go:embed ui_dist/ui.js
var uiBundle []byte

func NewHandler(app *application.Service, pub ed25519.PublicKey, s2sKey string, replay *security.ReplayGuard) http.Handler {
	root := chi.NewRouter()
	health := func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": %[2]q})
	}
	root.Get("/health", health)
	root.Get("/api/v1/%[3]s/health", health)

	mountRoutes := func(r chi.Router) {
		r.Use(httpx.RequireServicePassport(%[2]q, pub, s2sKey, replay))
		r.Get("/manifest", func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(%[1]s.ManifestJSON)
		})
		r.Get("/ui.js", func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(uiBundle)
		})
		r.Get("/all", func(w http.ResponseWriter, req *http.Request) {
			nextCode, records, err := app.List(req.Context())
			if err != nil {
				httpx.RespondError(w, err)
				return
			}
			httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "nextCode": nextCode, "records": records})
		})
		r.Post("/records", func(w http.ResponseWriter, req *http.Request) {
			var body struct {
				Description string `+"`json:\"description\"`"+`
			}
			if err := httpx.Decode(w, req, &body); err != nil {
				httpx.RespondError(w, err)
				return
			}
			rec, err := app.Create(req.Context(), body.Description)
			if err != nil {
				httpx.RespondError(w, err)
				return
			}
			httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "record": rec})
		})
	}

	root.Route("/api/v1/%[3]s", mountRoutes)
	root.Group(mountRoutes)
	return root
}
`, pkgIdent, modName, slug)
	mustWrite(filepath.Join(baseDir, "internal/infrastructure/http/router.go"), httpGo)

	backendGo := fmt.Sprintf(`package backend

import (
	"crypto/ed25519"
	"net/http"

	"%[1]s/internal/application"
	"%[1]s/internal/domain"
	httpadapter "%[1]s/internal/infrastructure/http"
	"%[1]s/internal/infrastructure/persistence/memory"
	"%[1]s/internal/infrastructure/persistence/postgres"
	"%[1]s/internal/platform/config"
	"%[1]s/internal/platform/dbpool"
	"%[1]s/internal/platform/security"
)

type Service struct {
	handler http.Handler
}

func NewService(cfg config.ServiceConfig, pub ed25519.PublicKey, replay *security.ReplayGuard, dbMgr *dbpool.Manager) *Service {
	var repo domain.Repository
	if dbMgr != nil && dbMgr.HasPostgres() {
		repo = postgres.NewRepository(dbMgr)
	} else {
		repo = memory.NewRepository()
	}
	app := application.NewService(repo)
	return &Service{
		handler: httpadapter.NewHandler(app, pub, cfg.S2SSharedKey, replay),
	}
}

func (s *Service) Handler() http.Handler {
	return s.handler
}
`, modName)
	mustWrite(filepath.Join(baseDir, "backend/service.go"), backendGo)

	mainGo := fmt.Sprintf(`package main

import (
	"context"
	"fmt"
	"log"
	"time"

	%[1]s "%[2]s"
	"%[2]s/backend"
	"%[2]s/internal/platform/config"
	"%[2]s/internal/platform/dbpool"
	"%[2]s/internal/platform/gateway"
	"%[2]s/internal/platform/httpx"
	"%[2]s/internal/platform/security"
)

func main() {
	cfg, err := config.LoadService(%[2]q, %[3]d)
	if err != nil {
		log.Fatalf("[%[2]s] invalid config: %%v", err)
	}
	gw := gateway.NewClient(cfg.GatewayURL, cfg.S2SSharedKey)
	if cfg.CorePublicHex == "" && gw != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		if pubHex, fetchErr := gw.FetchVerifierPublicKey(ctx); fetchErr == nil && pubHex != "" {
			cfg.CorePublicHex = pubHex
		}
		cancel()
	}
	pub, err := security.LoadVerifierPublicKey(cfg.CorePublicHex, cfg.DevEd25519Seed, cfg.IsProduction())
	if err != nil {
		log.Fatalf("[%[2]s] invalid public key: %%v", err)
	}
	dbMgr := dbpool.NewManager(cfg.CommonConfig, false)
	replay := security.NewReplayGuard(16384)
	svc := backend.NewService(cfg, pub, replay, dbMgr)
	if gw != nil {
		gw.RegisterWithRetry(%[1]s.ManifestJSON, cfg.ServicePublicURL)
	}
	srv := httpx.NewServer(fmt.Sprintf(":%%d", cfg.HTTPPort), svc.Handler())
	if err := httpx.ListenAndServeGraceful(srv, dbMgr.Close); err != nil {
		log.Fatalf("[%[2]s] server error: %%v", err)
	}
}
`, pkgIdent, modName, *port)
	mustWrite(filepath.Join(baseDir, "cmd/main.go"), mainGo)

	viewTsx := fmt.Sprintf(`import React, { useEffect, useState } from 'react';
import { usePlatform, useAsyncAction, PkAutoCodeInput, PkPrintButton } from '@platform/ui-sdk';

interface RecordItem {
  id: string;
  code: string;
  description: string;
  createdAt: string;
}

export const %[1]sView: React.FC = () => {
  const { apiGet, apiPost, toast } = usePlatform();
  const { busy, run } = useAsyncAction();
  const [nextCode, setNextCode] = useState('AUTO-101');
  const [description, setDescription] = useState('');
  const [records, setRecords] = useState<RecordItem[]>([]);

  const load = async () => {
    const res = await apiGet<{ nextCode: string; records: RecordItem[] }>('/api/v1/%[2]s/all');
    setNextCode(res.nextCode);
    setRecords(res.records || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await apiPost('/api/v1/%[2]s/records', { description });
      setDescription('');
      toast('Registro guardado correctamente');
      await load();
    });
  };

  return (
    <div className="pk-card">
      <div className="pk-card-head">
        <div className="pk-card-title">%[3]s %[4]s</div>
      </div>
      <div className="pk-card-body">
        <form onSubmit={handleCreate} className="pk-form-grid" style={{ marginBottom: 14 }}>
          <PkAutoCodeInput label="Consecutivo" value={nextCode} />
          <div className="pk-field">
            <label>Descripción *</label>
            <input required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
            {busy ? 'Guardando...' : 'Guardar Registro'}
          </button>
        </form>
        <div className="pk-table-wrap">
          <table className="pk-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha</th>
                <th>Detalle</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.code}</strong></td>
                  <td>{r.createdAt}</td>
                  <td>{r.description}</td>
                  <td>
                    <PkPrintButton
                      payload={{
                        document_type: %[4]q,
                        document_number: r.code,
                        issue_date: r.createdAt,
                        items: [{ code: r.code, description: r.description, quantity: 1, unit_price: 0, subtotal: 0 }],
                        grand_total: 0,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default %[1]sView;
`, pascal, slug, *icon, *title)
	mustWrite(filepath.Join(baseDir, "frontend", pascal+"View.tsx"), viewTsx)

	pkgJSON := fmt.Sprintf(`{
  "name": "%[1]s-ui",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "sync-sdk": "curl -fsSL \"${GATEWAY_URL:-http://localhost:4000}/api/v1/platform/ui-sdk.d.ts\" -o ./sdk.d.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit && esbuild %[2]sView.tsx --bundle --format=esm --target=es2020 --jsx=automatic --minify --external:react --external:react-dom --external:react/jsx-runtime --external:@platform/ui-sdk --outfile=../internal/infrastructure/http/ui_dist/ui.js"
  },
  "devDependencies": {
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "esbuild": "^0.24.0",
    "typescript": "^5.6.3"
  }
}
`, modName, pascal)
	mustWrite(filepath.Join(baseDir, "frontend", "package.json"), pkgJSON)

	tsConfigJSON := `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["./**/*.ts", "./**/*.tsx"]
}
`
	mustWrite(filepath.Join(baseDir, "frontend", "tsconfig.json"), tsConfigJSON)

	fmt.Printf("Microservicio Hexagonal autónomo creado en %s\n", baseDir)
}

func copyPlatformTree(srcRoot, dstRoot, oldMod, newMod string) error {
	return filepath.WalkDir(srcRoot, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcRoot, p)
		if err != nil {
			return err
		}
		target := filepath.Join(dstRoot, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		raw, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		updated := strings.ReplaceAll(string(raw), `"`+oldMod+`/internal/platform/`, `"`+newMod+`/internal/platform/`)
		return os.WriteFile(target, []byte(updated), 0o644)
	})
}

func mustWrite(path, content string) {
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		panic(err)
	}
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
