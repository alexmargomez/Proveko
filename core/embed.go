package core

import (
	"embed"
	"io/fs"
)

//go:embed all:embed_dist
var embeddedAssets embed.FS

func StaticFS() fs.FS {
	sub, err := fs.Sub(embeddedAssets, "embed_dist")
	if err != nil {
		return embeddedAssets
	}
	return sub
}
