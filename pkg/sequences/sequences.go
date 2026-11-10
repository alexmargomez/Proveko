package sequences

import (
	"fmt"
	"sync"
)

type Generator struct {
	mu       sync.Mutex
	counters map[string]int
}

func New() *Generator {
	return &Generator{counters: make(map[string]int)}
}

func (g *Generator) Next(dbName, prefix string, baseStart int) string {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := dbName + ":" + prefix
	cur, ok := g.counters[key]
	if !ok || cur < baseStart {
		cur = baseStart
	}
	cur++
	g.counters[key] = cur
	return fmt.Sprintf("%s-%d", prefix, cur)
}

func (g *Generator) Peek(dbName, prefix string, baseStart int) string {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := dbName + ":" + prefix
	cur, ok := g.counters[key]
	if !ok || cur < baseStart {
		cur = baseStart
	}
	return fmt.Sprintf("%s-%d", prefix, cur+1)
}
