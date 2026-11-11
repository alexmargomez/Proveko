package money

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math"
	"strings"
)

func IsFinite(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0) && math.Abs(v) < 1e14
}

func RoundCents(v float64) float64 {
	if !IsFinite(v) {
		return 0
	}
	return math.RoundToEven(v*100) / 100
}

func RoundWhole(v float64) float64 {
	if !IsFinite(v) {
		return 0
	}
	return math.RoundToEven(v)
}

func WeightedAverageCost(oldStock, oldCost, inQty, inCost float64) float64 {
	if !IsFinite(oldStock) || !IsFinite(oldCost) || !IsFinite(inQty) || !IsFinite(inCost) {
		return 0
	}
	if inQty <= 0 {
		return RoundCents(oldCost)
	}
	if oldStock <= 0 {
		return RoundCents(inCost)
	}
	totalVal := (oldStock * oldCost) + (inQty * inCost)
	totalQty := oldStock + inQty
	if totalQty <= 0 {
		return RoundCents(inCost)
	}
	return RoundCents(totalVal / totalQty)
}

func FormatCOP(amount float64) string {
	if !IsFinite(amount) {
		return "$0"
	}
	neg := amount < 0
	val := int64(math.RoundToEven(math.Abs(amount)))
	raw := fmt.Sprintf("%d", val)
	var out strings.Builder
	if neg {
		out.WriteByte('-')
	}
	out.WriteByte('$')
	rem := len(raw) % 3
	for i, ch := range raw {
		if i > 0 && (i-rem)%3 == 0 {
			out.WriteByte('.')
		}
		out.WriteRune(ch)
	}
	return out.String()
}

func NewID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand unavailable: " + err.Error())
	}
	if prefix == "" {
		return hex.EncodeToString(b)
	}
	return prefix + "-" + hex.EncodeToString(b)
}
