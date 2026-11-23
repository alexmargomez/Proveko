package core

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

//go:embed all:embed_dist
var embeddedAssets embed.FS

func StaticFS() fs.FS {
	liveDir := strings.TrimSpace(os.Getenv("LIVE_STATIC_DIR"))
	if liveDir == "" {
		liveDir = "/app/embed_dist"
	}
	if info, err := os.Stat(filepath.Join(liveDir, "index.html")); err == nil && !info.IsDir() {
		return os.DirFS(liveDir)
	}
	sub, err := fs.Sub(embeddedAssets, "embed_dist")
	if err != nil {
		return embeddedAssets
	}
	return sub
}
