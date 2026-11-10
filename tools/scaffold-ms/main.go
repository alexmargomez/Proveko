package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	name := flag.String("name", "", "Identificador corto en minúsculas (ej: garantia -> crea services/ms-garantia)")
	title := flag.String("title", "Nuevo Microservicio", "Nombre comercial visible en el menú lateral")
	icon := flag.String("icon", "🧩", "Ícono comercial visible en el menú lateral")
	flag.Parse()

	slug := strings.TrimSpace(strings.ToLower(*name))
	if slug == "" {
		fmt.Fprintln(os.Stderr, "Uso: go run ./tools/scaffold-ms -name <slug> -title \"Título Comercial\" -icon \"🧩\"")
		os.Exit(1)
	}

	pascal := strings.ToUpper(slug[:1]) + slug[1:]
	baseDir := filepath.Join("services", "ms-"+slug)
	for _, sub := range []string{"migrations", "backend", "cmd", "frontend"} {
		if err := os.MkdirAll(filepath.Join(baseDir, sub), 0o755); err != nil {
			panic(err)
		}
	}

	manifest := fmt.Sprintf(`{
  "serviceKey": "ms-%s",
  "displayName": %q,
  "icon": %q,
  "apiPrefix": "/api/v1/%s",
  "modules": [
    {
      "moduleKey": "%s_principal",
      "displayName": "Gestión Principal",
      "tabIcon": %q,
      "defaultActive": true
    }
  ],
  "features": []
}
`, slug, *title, *icon, slug, slug, *icon)
	_ = os.WriteFile(filepath.Join(baseDir, "manifest.json"), []byte(manifest), 0o644)

	sql := fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s;\nCREATE TABLE IF NOT EXISTS %s.records (\n  id TEXT PRIMARY KEY,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  payload JSONB NOT NULL\n);\n", slug, slug)
	_ = os.WriteFile(filepath.Join(baseDir, "migrations", "001_schema.sql"), []byte(sql), 0o644)

	embedGo := "package migrations\n\nimport _ \"embed\"\n\n//go:embed 001_schema.sql\nvar SchemaSQL string\n"
	_ = os.WriteFile(filepath.Join(baseDir, "migrations", "embed.go"), []byte(embedGo), 0o644)

	backendGo := fmt.Sprintf(`package backend

import (
	"net/http"
	"time"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	"github.com/go-chi/chi/v5"
)

type Service struct {
	db            *tenantdb.Manager
	clusterSecret string
}

func NewService(db *tenantdb.Manager, clusterSecret string) *Service {
	return &Service{db: db, clusterSecret: clusterSecret}
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/all", func(w http.ResponseWriter, req *http.Request) {
		tc := authguard.FromContext(req.Context())
		s.db.WithRead(req.Context(), tc.DBName, func(d *tenantdb.TenantData) {
			httpx.JSON(w, http.StatusOK, map[string]any{
				"ok":       true,
				"nextCode": s.db.Seq.Peek(tc.DBName, %q, 100),
				"records":  d.GenericModules[%q],
			})
		})
	})

	r.Post("/records", func(w http.ResponseWriter, req *http.Request) {
		tc := authguard.FromContext(req.Context())
		var fields map[string]string
		if err := httpx.Decode(req, &fields); err != nil {
			httpx.Error(w, http.StatusBadRequest, "Datos inválidos")
			return
		}
		var created tenantdb.GenericRecord
		_ = s.db.WithWrite(req.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
			created = tenantdb.GenericRecord{
				ID:        s.db.Seq.Next(tc.DBName, %q, 100),
				CreatedAt: time.Now().Format("2006-01-02 15:04"),
				ModuleKey: %q,
				Fields:    fields,
			}
			d.GenericModules[%q] = append([]tenantdb.GenericRecord{created}, d.GenericModules[%q]...)
			return nil
		})
		httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "record": created})
	})

	return r
}
`, strings.ToUpper(slug[:min(3, len(slug))]), slug+"_principal", strings.ToUpper(slug[:min(3, len(slug))]), slug+"_principal", slug+"_principal", slug+"_principal")
	_ = os.WriteFile(filepath.Join(baseDir, "backend", "service.go"), []byte(backendGo), 0o644)

	viewTsx := fmt.Sprintf(`import React, { useEffect, useState } from 'react';
import { useProveko, PkAutoCodeInput, PkPrintButton } from '@proveko/ui-sdk';

export const %sView: React.FC = () => {
  const { apiGet, apiPost, toast } = useProveko();
  const [nextCode, setNextCode] = useState('AUTO-101');
  const [description, setDescription] = useState('');
  const [records, setRecords] = useState<{ id: string; createdAt: string; fields: Record<string, string> }[]>([]);

  const load = async () => {
    const res = await apiGet<{ nextCode: string; records: typeof records }>('/api/v1/%s/all');
    setNextCode(res.nextCode);
    setRecords(res.records || []);
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/%s/records', { description });
    setDescription('');
    toast('Registro guardado');
    await load();
  };

  return (
    <div className="pk-card">
      <div className="pk-card-head">
        <div className="pk-card-title">%s %s</div>
      </div>
      <div className="pk-card-body">
        <form onSubmit={handleCreate} className="pk-form-grid" style={{ marginBottom: 14 }}>
          <PkAutoCodeInput label="Consecutivo" value={nextCode} />
          <div className="pk-field">
            <label>Descripción *</label>
            <input required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button type="submit" className="pk-btn pk-btn-primary">💾 Guardar</button>
        </form>
        <div className="pk-table-wrap">
          <table className="pk-table">
            <thead><tr><th>Código</th><th>Fecha</th><th>Detalle</th><th>Imprimir</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.id}</strong></td>
                  <td>{r.createdAt}</td>
                  <td>{r.fields?.description}</td>
                  <td>
                    <PkPrintButton payload={{
                      document_type: %q,
                      document_number: r.id,
                      issue_date: r.createdAt,
                      items: [{ code: r.id, description: r.fields?.description || '', quantity: 1, unit_price: 0, subtotal: 0 }],
                      grand_total: 0
                    }} />
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
`, pascal, slug, slug, *icon, *title, *title)
	_ = os.WriteFile(filepath.Join(baseDir, "frontend", pascal+"View.tsx"), []byte(viewTsx), 0o644)

	fmt.Printf("Microservicio autocontenido creado en %s\n", baseDir)
}
