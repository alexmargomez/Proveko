package tests

import (
	"encoding/hex"
	"encoding/json"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

var expectedServices = []string{
	"ms-facturacion",
	"ms-clientes",
	"ms-inventario",
	"ms-caja",
	"ms-comandas",
	"ms-hoteleria",
	"ms-taller",
	"ms-bascula",
	"ms-compras",
	"ms-agenda",
	"ms-taquilla",
	"ms-nomina",
	"ms-contabilidad",
	"ms-reportes",
	"ms-impresiones",
}

func repoRoot(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	return filepath.Clean(filepath.Join(wd, ".."))
}

func TestHexagonalDependencyInversionAST(t *testing.T) {
	root := repoRoot(t)
	forbiddenInfraSubstrings := []string{
		"github.com/jackc/pgx",
		"database/sql",
		"github.com/go-chi/chi",
		"net/http",
		"html/template",
		"text/template",
		"google.golang.org/grpc",
		"/internal/platform/dbpool",
		"/internal/platform/gateway",
		"/internal/platform/httpx",
		"/internal/infrastructure/",
	}

	type target struct {
		owner   string
		modName string
		dir     string
		must    bool
	}
	targets := []target{
		{owner: "core", modName: "ms-core", dir: filepath.Join(root, "core", "internal", "domain"), must: true},
		{owner: "core", modName: "ms-core", dir: filepath.Join(root, "core", "internal", "application"), must: true},
		{owner: "ms-platform", modName: "ms-platform", dir: filepath.Join(root, "services", "ms-platform", "internal", "domain"), must: true},
		{owner: "ms-platform", modName: "ms-platform", dir: filepath.Join(root, "services", "ms-platform", "internal", "application"), must: true},
	}
	for _, svc := range expectedServices {
		targets = append(targets,
			target{owner: svc, modName: svc, dir: filepath.Join(root, "services", svc, "internal", "domain"), must: true},
			target{owner: svc, modName: svc, dir: filepath.Join(root, "services", svc, "internal", "application"), must: true},
			target{owner: svc, modName: svc, dir: filepath.Join(root, "services", svc, "internal", "modules"), must: false},
		)
	}

	fset := token.NewFileSet()
	for _, tgt := range targets {
		info, err := os.Stat(tgt.dir)
		if err != nil || !info.IsDir() {
			if tgt.must {
				t.Errorf("[%s] missing required hexagonal layer directory: %s", tgt.owner, tgt.dir)
			}
			continue
		}

		goFileCount := 0
		err = filepath.WalkDir(tgt.dir, func(path string, d fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if d.IsDir() || !strings.HasSuffix(d.Name(), ".go") || strings.HasSuffix(d.Name(), "_test.go") {
				return nil
			}
			goFileCount++
			astFile, parseErr := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
			if parseErr != nil {
				t.Errorf("[%s] AST parse failed for %s: %v", tgt.owner, path, parseErr)
				return nil
			}
			for _, imp := range astFile.Imports {
				impPath := strings.Trim(imp.Path.Value, `"`)
				for _, bad := range forbiddenInfraSubstrings {
					if impPath == bad || strings.Contains(impPath, bad) {
						t.Errorf("[%s] DIP violation in %s: pure layer imports infrastructure package %q", tgt.owner, path, impPath)
					}
				}
				if strings.HasPrefix(impPath, "ms-") && !strings.HasPrefix(impPath, tgt.modName+"/") && impPath != tgt.modName {
					t.Errorf("[%s] cross-service import violation in %s: %q", tgt.owner, path, impPath)
				}
			}
			return nil
		})
		if err != nil {
			t.Errorf("[%s] walk error on %s: %v", tgt.owner, tgt.dir, err)
		}
		if tgt.must && goFileCount == 0 {
			t.Errorf("[%s] hexagonal layer %s contains zero Go source files", tgt.owner, tgt.dir)
		}
	}

	for _, svc := range expectedServices {
		memDir := filepath.Join(root, "services", svc, "internal", "infrastructure", "persistence", "memory")
		_ = filepath.WalkDir(memDir, func(path string, d fs.DirEntry, walkErr error) error {
			if walkErr != nil || d.IsDir() || !strings.HasSuffix(d.Name(), ".go") {
				return nil
			}
			astFile, parseErr := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
			if parseErr != nil {
				t.Errorf("[%s] parse error in %s: %v", svc, path, parseErr)
				return nil
			}
			for _, imp := range astFile.Imports {
				impPath := strings.Trim(imp.Path.Value, `"`)
				if strings.Contains(impPath, "github.com/jackc/pgx") || strings.HasSuffix(impPath, "/internal/platform/sequences") {
					t.Errorf("[%s] memory adapter %s must remain SQL-free (use seqmem), found %q", svc, path, impPath)
				}
			}
			return nil
		})
	}
}

func TestShareNothingAutonomyZeroReplaceAndIsolatedTempBuild(t *testing.T) {
	root := repoRoot(t)

	allGoModDirs := []struct {
		dir      string
		expected string
	}{
		{filepath.Join(root, "core"), "module ms-core"},
		{filepath.Join(root, "services", "ms-platform"), "module ms-platform"},
	}
	for _, svc := range expectedServices {
		allGoModDirs = append(allGoModDirs, struct {
			dir      string
			expected string
		}{filepath.Join(root, "services", svc), "module " + svc})
	}

	for _, mod := range allGoModDirs {
		raw, err := os.ReadFile(filepath.Join(mod.dir, "go.mod"))
		if err != nil {
			t.Fatalf("missing go.mod in %s: %v", mod.dir, err)
		}
		text := string(raw)
		if !strings.Contains(text, mod.expected) {
			t.Errorf("%s/go.mod expected %q, got:\n%s", mod.dir, mod.expected, text)
		}
		if strings.Contains(text, "replace ") || strings.Contains(text, "../") {
			t.Errorf("Share-Nothing violation in %s/go.mod: replace or parent relative path is forbidden:\n%s", mod.dir, text)
		}
	}

	fset := token.NewFileSet()
	for _, svc := range expectedServices {
		svcDir := filepath.Join(root, "services", svc)
		requiredFiles := []string{
			"go.mod",
			"Dockerfile",
			".env.example",
			"manifest.json",
			"migrations/001_schema.sql",
			"internal/infrastructure/http/ui_dist/ui.js",
			"frontend/package.json",
			"frontend/sdk.d.ts",
		}
		for _, rel := range requiredFiles {
			full := filepath.Join(svcDir, rel)
			st, err := os.Stat(full)
			if err != nil || st.Size() == 0 {
				t.Errorf("[%s] missing or empty required artifact: %s", svc, rel)
			}
		}

		envRaw, err := os.ReadFile(filepath.Join(svcDir, ".env.example"))
		if err == nil {
			envText := string(envRaw)
			if !strings.Contains(envText, "GATEWAY_URL=") {
				t.Errorf("[%s] .env.example must declare GATEWAY_URL", svc)
			}
			if strings.Contains(envText, "GRPC") {
				t.Errorf("[%s] .env.example must not declare secondary gRPC variables", svc)
			}
		}

		pkgJSONRaw, err := os.ReadFile(filepath.Join(svcDir, "frontend", "package.json"))
		if err == nil && strings.Contains(string(pkgJSONRaw), "../../") {
			t.Errorf("[%s] frontend/package.json must not reference folders outside microservice root: %s", svc, string(pkgJSONRaw))
		}

		manifestRaw, err := os.ReadFile(filepath.Join(svcDir, "manifest.json"))
		if err == nil {
			var mf struct {
				ServiceKey string `json:"serviceKey"`
				BundleHash string `json:"bundleHash"`
			}
			if jsonErr := json.Unmarshal(manifestRaw, &mf); jsonErr != nil {
				t.Errorf("[%s] invalid manifest.json: %v", svc, jsonErr)
			} else if mf.ServiceKey != svc || strings.TrimSpace(mf.BundleHash) == "" {
				t.Errorf("[%s] invalid manifest metadata: %+v", svc, mf)
			}
		}

		for _, adapter := range []string{"postgres", "memory"} {
			adapterDir := filepath.Join(svcDir, "internal", "infrastructure", "persistence", adapter)
			if st, statErr := os.Stat(adapterDir); statErr != nil || !st.IsDir() {
				t.Errorf("[%s] missing Liskov persistence adapter directory: %s", svc, adapter)
			}
		}

		_ = filepath.WalkDir(svcDir, func(path string, d fs.DirEntry, walkErr error) error {
			if walkErr != nil || d.IsDir() || !strings.HasSuffix(d.Name(), ".go") {
				return nil
			}
			astFile, parseErr := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
			if parseErr != nil {
				t.Errorf("[%s] parse error in %s: %v", svc, path, parseErr)
				return nil
			}
			for _, imp := range astFile.Imports {
				impPath := strings.Trim(imp.Path.Value, `"`)
				if strings.HasPrefix(impPath, "ms-") && impPath != svc && !strings.HasPrefix(impPath, svc+"/") {
					t.Errorf("[%s] cross-module Go import in %s: %q", svc, path, impPath)
				}
			}
			return nil
		})
	}

	domainLeakTokens := []string{
		"ScaleTicket",
		"CargoRoute",
		"HotelRoom",
		"DiningTable",
		"WorkOrder",
		"PucAccount",
		"GlobalEntityDialogs",
		"openQuickDialog",
		"useProveko",
	}
	for _, sharedDir := range []string{
		filepath.Join(root, "pkg"),
		filepath.Join(root, "ui-sdk", "src"),
		filepath.Join(root, "services", "ms-platform", "sdk-src"),
	} {
		_ = filepath.WalkDir(sharedDir, func(path string, d fs.DirEntry, walkErr error) error {
			if walkErr != nil || d.IsDir() {
				return nil
			}
			raw, readErr := os.ReadFile(path)
			if readErr != nil {
				return nil
			}
			content := string(raw)
			for _, tok := range domainLeakTokens {
				if strings.Contains(content, tok) {
					t.Errorf("business domain leak %q found in standardized SDK file %s", tok, path)
				}
			}
			return nil
		})
	}

	isolatedServerRoot := t.TempDir()
	for _, sample := range []struct {
		name   string
		srcDir string
	}{
		{name: "isolated-core", srcDir: filepath.Join(root, "core")},
		{name: "isolated-ms-platform", srcDir: filepath.Join(root, "services", "ms-platform")},
		{name: "isolated-ms-facturacion", srcDir: filepath.Join(root, "services", "ms-facturacion")},
	} {
		dstDir := filepath.Join(isolatedServerRoot, sample.name)
		if err := copyDirectoryForIsolation(sample.srcDir, dstDir); err != nil {
			t.Fatalf("copy %s to isolated temp dir: %v", sample.name, err)
		}
		outBin := filepath.Join(dstDir, "standalone.bin")
		cmd := exec.Command("go", "build", "-o", outBin, "./cmd/main.go")
		cmd.Dir = dstDir
		cmd.Env = append(os.Environ(), "GOWORK=off", "CGO_ENABLED=0")
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("isolated standalone build failed for %s outside repository: %v\n%s", sample.name, err, string(out))
		}
	}
}

func copyDirectoryForIsolation(src, dst string) error {
	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() && (d.Name() == "node_modules" || d.Name() == ".git") {
			return filepath.SkipDir
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	})
}

func decodeHexTokens(hexItems []string) []string {
	out := make([]string, 0, len(hexItems))
	for _, h := range hexItems {
		b, err := hex.DecodeString(h)
		if err == nil {
			out = append(out, strings.ToLower(string(b)))
		}
	}
	return out
}

func TestCorporateHygieneZeroInternalReferencesAndZeroFakeDomain(t *testing.T) {
	root := repoRoot(t)
	forbidden := decodeHexTokens([]string{
		"616c65786d6172",                                         // personal handle
		"616c70616e656c",                                         // internal panel
		"68635f76657273696f6e32",                                 // legacy project
		"6669786d6f746f72",                                       // external reference
		"6170695f736d",                                           // external reference
		"7a617061746f717565616e646f",                             // external reference
		"73696e20646570656e646572206465206961",                   // informal phrase
		"70617261206465736172726f6c6c61646f7265732068756d616e6f", // informal phrase
		"70726f76656b6f2e636f6d",                                 // nonexistent domain
	})

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			switch d.Name() {
			case ".git", "node_modules", "embed_dist", "ui_dist":
				return filepath.SkipDir
			}
			return nil
		}
		raw, readErr := os.ReadFile(path)
		if readErr != nil {
			return nil
		}
		lower := strings.ToLower(string(raw))
		for _, tok := range forbidden {
			if strings.Contains(lower, tok) {
				t.Errorf("forbidden internal or nonexistent domain token %q detected in %s", tok, path)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk repo root: %v", err)
	}
}
