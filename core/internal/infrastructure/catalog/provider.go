package catalog

import (
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"ms-core/internal/platform/licensegate"
)

//go:embed default_catalog.json
var embeddedCatalogJSON []byte

type Provider struct {
	mu    sync.RWMutex
	order []string
	byKey map[string]licensegate.ServiceManifest
}

func NewProvider(manifestsDir string) *Provider {
	p := &Provider{
		byKey: make(map[string]licensegate.ServiceManifest),
	}
	var base []licensegate.ServiceManifest
	if err := json.Unmarshal(embeddedCatalogJSON, &base); err == nil {
		for _, m := range base {
			p.Upsert(m)
		}
	}
	if strings.TrimSpace(manifestsDir) != "" {
		p.loadFromDirectory(manifestsDir)
	}
	return p
}

func (p *Provider) loadFromDirectory(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		var m licensegate.ServiceManifest
		if err := json.Unmarshal(raw, &m); err == nil && m.ServiceKey != "" {
			p.Upsert(m)
		}
	}
}

func (p *Provider) Upsert(m licensegate.ServiceManifest) {
	if strings.TrimSpace(m.ServiceKey) == "" {
		return
	}
	if m.BundleHash == "" {
		raw, _ := json.Marshal(m)
		sum := sha256.Sum256(raw)
		m.BundleHash = "rev-" + hex.EncodeToString(sum[:4])
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if _, exists := p.byKey[m.ServiceKey]; !exists {
		p.order = append(p.order, m.ServiceKey)
	}
	p.byKey[m.ServiceKey] = m
}

func (p *Provider) Catalog() []licensegate.ServiceManifest {
	p.mu.RLock()
	defer p.mu.RUnlock()
	out := make([]licensegate.ServiceManifest, 0, len(p.order))
	for _, k := range p.order {
		out = append(out, p.byKey[k])
	}
	return out
}

func (p *Provider) FindService(serviceKey string) (licensegate.ServiceManifest, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	m, ok := p.byKey[serviceKey]
	return m, ok
}

func ServiceEnvVar(serviceKey string) string {
	slug := strings.TrimPrefix(serviceKey, "ms-")
	slug = strings.ToUpper(strings.ReplaceAll(slug, "-", "_"))
	return "MS_" + slug + "_URL"
}
