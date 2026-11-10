package facturacion_dian

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/alexmargomez/proveko/pkg/licensegate"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
)

func Apply(ctx context.Context, issuerNit string, inv *tenantdb.Invoice) {
	if !licensegate.HasModule(ctx, "facturacion_dian") {
		inv.Cufe = ""
		return
	}

	canonical := fmt.Sprintf(
		"%s|%s|%.2f|%.2f|%.2f|%s|%s",
		inv.ID,
		inv.Date,
		inv.Subtotal,
		inv.TaxTotal,
		inv.Total,
		strings.TrimSpace(issuerNit),
		strings.TrimSpace(inv.CustomerNit),
	)
	sum := sha256.Sum256([]byte(canonical))
	inv.Cufe = strings.ToUpper(hex.EncodeToString(sum[:]))
}
