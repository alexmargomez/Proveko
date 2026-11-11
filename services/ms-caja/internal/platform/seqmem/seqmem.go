package seqmem

import (
	"fmt"
	"sync"
)

type MemoryGenerator struct {
	mu       sync.Mutex
	counters map[string]int
}

func NewMemory() *MemoryGenerator {
	return &MemoryGenerator{counters: make(map[string]int)}
}

func (g *MemoryGenerator) Next(dbName, prefix string, baseStart int) string {
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

func (g *MemoryGenerator) Peek(dbName, prefix string, baseStart int) string {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := dbName + ":" + prefix
	cur, ok := g.counters[key]
	if !ok || cur < baseStart {
		cur = baseStart
	}
	return fmt.Sprintf("%s-%d", prefix, cur+1)
}
