package backend

import (
	"context"
	"fmt"
	"html"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	printingv1 "github.com/alexmargomez/proveko/proto/printing/v1"
	"github.com/go-chi/chi/v5"
	"google.golang.org/grpc"
)

type Service struct {
	db            *tenantdb.Manager
	clusterSecret string
}

func NewService(db *tenantdb.Manager, clusterSecret string) *Service {
	return &Service{
		db:            db,
		clusterSecret: clusterSecret,
	}
}

func (s *Service) RegisterGRPC(srv *grpc.Server) {
	printingv1.RegisterPrintServiceServer(srv, s)
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/branding", s.handleGetBranding)
	r.Put("/branding", s.handleUpdateBranding)
	r.Post("/render", s.handleRenderDocument)

	return r
}

func (s *Service) handleGetBranding(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())
	var branding tenantdb.BrandingConfig
	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		branding = normalizeBranding(d.Branding)
	})
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"branding": branding,
	})
}

func (s *Service) handleUpdateBranding(w http.ResponseWriter, r *http.Request) {
	var input tenantdb.BrandingConfig
	if err := httpx.Decode(r, &input); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato JSON inválido para el membrete empresarial")
		return
	}
	if strings.TrimSpace(input.CompanyName) == "" {
		httpx.Error(w, http.StatusBadRequest, "El nombre o razón social de la empresa es obligatorio")
		return
	}

	tc := authguard.FromContext(r.Context())
	normalized := normalizeBranding(input)
	if err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		d.Branding = normalized
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"branding": normalized,
	})
}

func (s *Service) handleRenderDocument(w http.ResponseWriter, r *http.Request) {
	var req printingv1.RenderDocumentRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "No fue posible decodificar la solicitud de impresión")
		return
	}
	res, err := s.RenderDocument(r.Context(), &req)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"title":          res.Title,
		"format":         res.Format,
		"html_printable": res.HTMLPrintable,
	})
}

func (s *Service) RenderDocument(ctx context.Context, req *printingv1.RenderDocumentRequest) (*printingv1.RenderDocumentResponse, error) {
	if req == nil {
		req = &printingv1.RenderDocumentRequest{}
	}
	tc := authguard.FromContext(ctx)
	var branding tenantdb.BrandingConfig
	s.db.WithRead(ctx, tc.DBName, func(d *tenantdb.TenantData) {
		branding = normalizeBranding(d.Branding)
	})

	docType := strings.TrimSpace(req.DocumentType)
	if docType == "" {
		docType = "FACTURA DE VENTA"
	}
	docNumber := strings.TrimSpace(req.DocumentNumber)
	if docNumber == "" {
		docNumber = "DOC-0001"
	}
	issueDate := strings.TrimSpace(req.IssueDate)
	if issueDate == "" {
		issueDate = time.Now().Format("2006-01-02 15:04")
	}

	variant := strings.TrimSpace(req.LayoutVariant)
	var format string
	var htmlOut string

	switch {
	case variant == "tirilla_80mm" || (variant == "" && branding.DefaultFormat == "tirilla_80mm"):
		format = "tirilla_80mm"
		htmlOut = renderThermal80mm(branding, req, docType, docNumber, issueDate)
	case variant == "factura_taller":
		format = "factura_taller"
		htmlOut = renderWorkshopLetter(branding, req, docType, docNumber, issueDate)
	default:
		format = "carta_membrete"
		htmlOut = renderStandardLetter(branding, req, docType, docNumber, issueDate)
	}

	title := fmt.Sprintf("%s %s — %s", docType, docNumber, branding.CompanyName)
	return &printingv1.RenderDocumentResponse{
		Title:         title,
		Format:        format,
		HTMLPrintable: htmlOut,
	}, nil
}

func normalizeBranding(b tenantdb.BrandingConfig) tenantdb.BrandingConfig {
	if strings.TrimSpace(b.CompanyName) == "" {
		b.CompanyName = "Empresa Cliente S.A.S."
	}
	if strings.TrimSpace(b.PrimaryColor) == "" {
		b.PrimaryColor = "#023047"
	}
	switch b.DefaultFormat {
	case "carta_membrete", "tirilla_80mm", "media_carta":
	default:
		b.DefaultFormat = "carta_membrete"
	}
	return b
}

func renderThermal80mm(b tenantdb.BrandingConfig, req *printingv1.RenderDocumentRequest, docType, docNum, issueDate string) string {
	var sb strings.Builder
	title := html.EscapeString(docType + " " + docNum)

	sb.WriteString(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>` + title + `</title><style>
@page { size: 80mm auto; margin: 2mm; }
* { box-sizing: border-box; }
body { font-family: 'Courier New', Courier, monospace; background: #f1f5f9; color: #0f172a; margin: 0; padding: 12px; }
.toolbar { max-width: 310px; margin: 0 auto 10px; text-align: center; }
.btn-print { background: ` + html.EscapeString(b.PrimaryColor) + `; color: #fff; border: none; border-radius: 6px; padding: 9px 16px; font-weight: 700; font-size: 13px; cursor: pointer; width: 100%; }
.ticket { width: 302px; margin: 0 auto; background: #fff; padding: 12px 10px; border: 1px dashed #94a3b8; font-size: 12px; line-height: 1.35; }
.center { text-align: center; }
.bold { font-weight: 700; }
.sep { border-top: 1px dashed #334155; margin: 8px 0; }
table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
th, td { padding: 3px 0; vertical-align: top; }
.right { text-align: right; }
@media print {
  body { background: #fff; padding: 0; }
  .no-print { display: none !important; }
  .ticket { border: none; width: 100%; padding: 2px; }
}
</style></head><body>`)

	sb.WriteString(`<div class="toolbar no-print"><button class="btn-print" onclick="window.print()">🖨️ Imprimir Tirilla</button></div>`)
	sb.WriteString(`<div class="ticket">`)
	sb.WriteString(`<div class="center bold" style="font-size:14px;">` + html.EscapeString(b.CompanyName) + `</div>`)
	if b.Nit != "" {
		sb.WriteString(`<div class="center">NIT: ` + html.EscapeString(b.Nit) + `</div>`)
	}
	if b.TaxRegime != "" {
		sb.WriteString(`<div class="center">` + html.EscapeString(b.TaxRegime) + `</div>`)
	}
	if b.Address != "" {
		sb.WriteString(`<div class="center">` + html.EscapeString(b.Address) + `</div>`)
	}
	if b.Phone != "" {
		sb.WriteString(`<div class="center">Tel: ` + html.EscapeString(b.Phone) + `</div>`)
	}
	if b.DianResolution != "" {
		sb.WriteString(`<div class="center" style="font-size:10.5px;margin-top:4px;">` + html.EscapeString(b.DianResolution) + `</div>`)
	}

	sb.WriteString(`<div class="sep"></div>`)
	sb.WriteString(`<div><span class="bold">` + html.EscapeString(docType) + `:</span> ` + html.EscapeString(docNum) + `</div>`)
	sb.WriteString(`<div><span class="bold">Fecha:</span> ` + html.EscapeString(issueDate) + `</div>`)
	if req.CustomerName != "" {
		sb.WriteString(`<div><span class="bold">Cliente:</span> ` + html.EscapeString(req.CustomerName) + `</div>`)
	}
	if req.CustomerNit != "" {
		sb.WriteString(`<div><span class="bold">Doc/NIT:</span> ` + html.EscapeString(req.CustomerNit) + `</div>`)
	}
	if req.PaymentMethod != "" {
		sb.WriteString(`<div><span class="bold">Pago:</span> ` + html.EscapeString(req.PaymentMethod) + `</div>`)
	}

	if len(req.ExtraFields) > 0 {
		sb.WriteString(`<div class="sep"></div>`)
		for _, k := range sortedKeys(req.ExtraFields) {
			v := strings.TrimSpace(req.ExtraFields[k])
			if v != "" {
				sb.WriteString(`<div><span class="bold">` + html.EscapeString(k) + `:</span> ` + html.EscapeString(v) + `</div>`)
			}
		}
	}

	sb.WriteString(`<div class="sep"></div>`)
	sb.WriteString(`<table><thead><tr><th style="text-align:left;">Cant / Detalle</th><th class="right">Subtotal</th></tr></thead><tbody>`)
	subtotalCalc := 0.0
	for _, it := range req.Items {
		lineSub := it.Subtotal
		if lineSub == 0 {
			lineSub = it.Quantity * it.UnitPrice
		}
		subtotalCalc += lineSub
		sb.WriteString(`<tr><td>` + fmtQty(it.Quantity) + ` x ` + html.EscapeString(it.Description) + `<br><span style="font-size:10px;color:#475569;">@ ` + formatCOP(it.UnitPrice) + `</span></td><td class="right bold">` + formatCOP(lineSub) + `</td></tr>`)
	}
	sb.WriteString(`</tbody></table>`)

	subtotal := req.Subtotal
	if subtotal == 0 {
		subtotal = subtotalCalc
	}
	grand := req.GrandTotal
	if grand == 0 {
		grand = subtotal - req.DiscountTotal + req.TaxTotal
	}

	sb.WriteString(`<div class="sep"></div>`)
	sb.WriteString(`<table>`)
	sb.WriteString(`<tr><td>Subtotal:</td><td class="right">` + formatCOP(subtotal) + `</td></tr>`)
	if req.DiscountTotal > 0 {
		sb.WriteString(`<tr><td>Descuento:</td><td class="right">-` + formatCOP(req.DiscountTotal) + `</td></tr>`)
	}
	if req.TaxTotal > 0 {
		sb.WriteString(`<tr><td>IVA / Impuestos:</td><td class="right">` + formatCOP(req.TaxTotal) + `</td></tr>`)
	}
	sb.WriteString(`<tr><td class="bold" style="font-size:13.5px;">TOTAL:</td><td class="right bold" style="font-size:13.5px;">` + formatCOP(grand) + `</td></tr>`)
	if req.PendingBalance > 0 {
		sb.WriteString(`<tr><td class="bold">Saldo Pendiente:</td><td class="right bold">` + formatCOP(req.PendingBalance) + `</td></tr>`)
	}
	sb.WriteString(`</table>`)

	if strings.TrimSpace(req.Notes) != "" {
		sb.WriteString(`<div class="sep"></div><div><span class="bold">Notas:</span> ` + html.EscapeString(req.Notes) + `</div>`)
	}
	if strings.TrimSpace(b.FooterWarranty) != "" {
		sb.WriteString(`<div class="sep"></div><div class="center" style="font-size:10.5px;">` + html.EscapeString(b.FooterWarranty) + `</div>`)
	}
	sb.WriteString(`</div></body></html>`)
	return sb.String()
}

func renderWorkshopLetter(b tenantdb.BrandingConfig, req *printingv1.RenderDocumentRequest, docType, docNum, issueDate string) string {
	placa := pickExtra(req.ExtraFields, "Placa", "plate")
	vehiculo := pickExtra(req.ExtraFields, "Vehículo", "Vehiculo", "vehicleBrand")
	kilometraje := pickExtra(req.ExtraFields, "Kilometraje", "currentKm")
	proximoAceite := pickExtra(req.ExtraFields, "Próximo Aceite", "Proximo Aceite", "nextOilKm")
	mecanico := pickExtra(req.ExtraFields, "Técnico / Mecánico", "Mecánico", "Mecanico", "mechanicName")
	ordenServicio := pickExtra(req.ExtraFields, "Orden de Servicio", "workOrderId")

	workshopBlock := `<div style="margin:14px 0;padding:12px 14px;border:2px solid ` + html.EscapeString(b.PrimaryColor) + `;border-radius:10px;background:#f8fafc;">
		<div style="font-weight:800;font-size:12.5px;color:` + html.EscapeString(b.PrimaryColor) + `;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">
			🔧 Ficha Técnica Automotriz y Orden de Servicio
		</div>
		<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 14px;font-size:12.5px;">
			<div><strong>Placa:</strong> <span style="font-weight:800;background:#e2e8f0;padding:2px 7px;border-radius:4px;">` + fallbackDash(placa) + `</span></div>
			<div><strong>Vehículo:</strong> ` + fallbackDash(vehiculo) + `</div>
			<div><strong>Orden de Servicio:</strong> ` + fallbackDash(ordenServicio) + `</div>
			<div><strong>Kilometraje Actual:</strong> ` + fallbackDash(kilometraje) + `</div>
			<div><strong>Próximo Aceite:</strong> ` + fallbackDash(proximoAceite) + `</div>
			<div><strong>Técnico / Mecánico:</strong> ` + fallbackDash(mecanico) + `</div>
		</div>
	</div>`

	signaturesBlock := `<div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:34px;font-size:12px;color:#334155;">
		<div style="border-top:1px solid #475569;padding-top:6px;text-align:center;">
			<strong>Entrega Taller / Responsable Técnico</strong><br>` + html.EscapeString(mecanico) + `
		</div>
		<div style="border-top:1px solid #475569;padding-top:6px;text-align:center;">
			<strong>Recibe a Satisfacción — Cliente / Conductor</strong><br>` + html.EscapeString(req.CustomerName) + `
		</div>
	</div>`

	return buildLetterHTML(b, req, docType, docNum, issueDate, workshopBlock, signaturesBlock, true)
}

func renderStandardLetter(b tenantdb.BrandingConfig, req *printingv1.RenderDocumentRequest, docType, docNum, issueDate string) string {
	extraHTML := ""
	if len(req.ExtraFields) > 0 {
		var cells strings.Builder
		for _, k := range sortedKeys(req.ExtraFields) {
			v := strings.TrimSpace(req.ExtraFields[k])
			if v != "" {
				cells.WriteString(`<div><strong>` + html.EscapeString(k) + `:</strong> ` + html.EscapeString(v) + `</div>`)
			}
		}
		if cells.Len() > 0 {
			extraHTML = `<div style="margin:12px 0;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px;font-size:12px;">` + cells.String() + `</div>`
		}
	}
	return buildLetterHTML(b, req, docType, docNum, issueDate, extraHTML, "", false)
}

func buildLetterHTML(
	b tenantdb.BrandingConfig,
	req *printingv1.RenderDocumentRequest,
	docType, docNum, issueDate, customMiddleHTML, signaturesHTML string,
	skipKnownWorkshopExtras bool,
) string {
	var sb strings.Builder
	primary := html.EscapeString(b.PrimaryColor)
	title := html.EscapeString(docType + " " + docNum + " — " + b.CompanyName)

	sb.WriteString(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>` + title + `</title><style>
@page { size: letter; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #e2e8f0; color: #0f172a; margin: 0; padding: 20px; }
.toolbar { max-width: 820px; margin: 0 auto 12px; display: flex; justify-content: flex-end; gap: 8px; }
.btn-print { background: ` + primary + `; color: #ffffff; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 700; font-size: 13px; cursor: pointer; }
.sheet { max-width: 820px; margin: 0 auto; background: #ffffff; padding: 28px 32px; border-radius: 12px; box-shadow: 0 10px 25px rgba(15,23,42,0.12); }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom: 3px solid ` + primary + `; padding-bottom: 14px; }
.company-name { font-size: 21px; font-weight: 800; color: ` + primary + `; margin: 0 0 4px 0; }
.company-meta { font-size: 12px; color: #334155; line-height: 1.45; }
.doc-box { border: 2px solid ` + primary + `; border-radius: 10px; padding: 10px 16px; text-align: right; min-width: 220px; }
.doc-type { font-size: 11.5px; font-weight: 800; color: ` + primary + `; text-transform: uppercase; }
.doc-num { font-size: 18px; font-weight: 900; color: #0f172a; margin: 3px 0; }
.customer-box { margin-top: 14px; padding: 11px 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; display: grid; grid-template-columns: 1.4fr 1fr; gap: 6px 16px; font-size: 12.5px; }
table.items { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12.5px; }
table.items th { background: ` + primary + `; color: #ffffff; padding: 8px 10px; text-align: left; font-weight: 700; }
table.items td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
.right { text-align: right !important; }
.totals-wrap { display: flex; justify-content: flex-end; margin-top: 14px; }
.totals-table { width: 300px; border-collapse: collapse; font-size: 13px; }
.totals-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
.totals-table tr.grand td { font-size: 15px; font-weight: 800; background: #f1f5f9; color: ` + primary + `; border-top: 2px solid ` + primary + `; }
.warranty { margin-top: 20px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #475569; text-align: center; }
@media print {
  body { background: #ffffff; padding: 0; }
  .no-print { display: none !important; }
  .sheet { box-shadow: none; border-radius: 0; padding: 0; max-width: 100%; }
}
</style></head><body>`)

	sb.WriteString(`<div class="toolbar no-print"><button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button></div>`)
	sb.WriteString(`<div class="sheet">`)
	sb.WriteString(`<div class="header"><div>`)
	sb.WriteString(`<div class="company-name">` + html.EscapeString(b.CompanyName) + `</div>`)
	sb.WriteString(`<div class="company-meta">`)
	if b.Nit != "" {
		sb.WriteString(`<strong>NIT:</strong> ` + html.EscapeString(b.Nit) + ` &nbsp;|&nbsp; `)
	}
	sb.WriteString(html.EscapeString(b.TaxRegime) + `<br>`)
	if b.Address != "" {
		sb.WriteString(html.EscapeString(b.Address) + `<br>`)
	}
	if b.Phone != "" || b.Email != "" {
		sb.WriteString(`Tel: ` + html.EscapeString(b.Phone) + ` &nbsp;•&nbsp; ` + html.EscapeString(b.Email) + `<br>`)
	}
	if b.DianResolution != "" {
		sb.WriteString(`<span style="font-size:11px;color:#475569;">` + html.EscapeString(b.DianResolution) + `</span>`)
	}
	sb.WriteString(`</div></div>`)

	sb.WriteString(`<div class="doc-box">`)
	sb.WriteString(`<div class="doc-type">` + html.EscapeString(docType) + `</div>`)
	sb.WriteString(`<div class="doc-num">` + html.EscapeString(docNum) + `</div>`)
	sb.WriteString(`<div style="font-size:11.5px;color:#475569;">Fecha: ` + html.EscapeString(issueDate) + `</div>`)
	if req.PaymentMethod != "" {
		sb.WriteString(`<div style="font-size:11.5px;color:#334155;font-weight:600;">Pago: ` + html.EscapeString(req.PaymentMethod) + `</div>`)
	}
	sb.WriteString(`</div></div>`)

	sb.WriteString(`<div class="customer-box">`)
	sb.WriteString(`<div><strong>Cliente / Tercero:</strong> ` + fallbackDash(req.CustomerName) + `</div>`)
	sb.WriteString(`<div><strong>NIT / Documento:</strong> ` + fallbackDash(req.CustomerNit) + `</div>`)
	if req.CustomerAddress != "" || req.CustomerPhone != "" {
		sb.WriteString(`<div><strong>Dirección:</strong> ` + fallbackDash(req.CustomerAddress) + `</div>`)
		sb.WriteString(`<div><strong>Teléfono:</strong> ` + fallbackDash(req.CustomerPhone) + `</div>`)
	}
	sb.WriteString(`</div>`)

	sb.WriteString(customMiddleHTML)

	if skipKnownWorkshopExtras && req.ExtraFields["CUFE"] != "" {
		sb.WriteString(`<div style="font-size:10.5px;color:#475569;margin-bottom:8px;word-break:break-all;"><strong>CUFE DIAN:</strong> ` + html.EscapeString(req.ExtraFields["CUFE"]) + `</div>`)
	}

	sb.WriteString(`<table class="items"><thead><tr>
		<th style="width:14%;">Código</th>
		<th>Descripción del Producto / Servicio</th>
		<th class="right" style="width:10%;">Cant.</th>
		<th class="right" style="width:16%;">Vr. Unitario</th>
		<th class="right" style="width:10%;">IVA</th>
		<th class="right" style="width:18%;">Subtotal</th>
	</tr></thead><tbody>`)

	subtotalCalc := 0.0
	for _, it := range req.Items {
		lineSub := it.Subtotal
		if lineSub == 0 {
			lineSub = it.Quantity * it.UnitPrice
		}
		subtotalCalc += lineSub
		sb.WriteString(`<tr>
			<td>` + html.EscapeString(it.Code) + `</td>
			<td>` + html.EscapeString(it.Description) + `</td>
			<td class="right">` + fmtQty(it.Quantity) + `</td>
			<td class="right">` + formatCOP(it.UnitPrice) + `</td>
			<td class="right">` + fmtQty(it.TaxPct) + `%</td>
			<td class="right"><strong>` + formatCOP(lineSub) + `</strong></td>
		</tr>`)
	}
	if len(req.Items) == 0 {
		sb.WriteString(`<tr><td colspan="6" style="text-align:center;color:#64748b;">Sin ítems detallados</td></tr>`)
	}
	sb.WriteString(`</tbody></table>`)

	subtotal := req.Subtotal
	if subtotal == 0 {
		subtotal = subtotalCalc
	}
	grand := req.GrandTotal
	if grand == 0 {
		grand = subtotal - req.DiscountTotal + req.TaxTotal
	}

	sb.WriteString(`<div class="totals-wrap"><table class="totals-table">`)
	sb.WriteString(`<tr><td>Subtotal Bruto</td><td class="right">` + formatCOP(subtotal) + `</td></tr>`)
	if req.DiscountTotal > 0 {
		sb.WriteString(`<tr><td>Descuento Aplicado</td><td class="right" style="color:#dc2626;">-` + formatCOP(req.DiscountTotal) + `</td></tr>`)
	}
	sb.WriteString(`<tr><td>IVA / Impuestos</td><td class="right">` + formatCOP(req.TaxTotal) + `</td></tr>`)
	sb.WriteString(`<tr class="grand"><td>TOTAL DOCUMENTO</td><td class="right">` + formatCOP(grand) + `</td></tr>`)
	if req.PendingBalance > 0 {
		sb.WriteString(`<tr><td><strong>Saldo Pendiente CxC</strong></td><td class="right" style="color:#d97706;font-weight:800;">` + formatCOP(req.PendingBalance) + `</td></tr>`)
	}
	sb.WriteString(`</table></div>`)

	if strings.TrimSpace(req.Notes) != "" {
		sb.WriteString(`<div style="margin-top:14px;padding:10px 12px;background:#f8fafc;border-left:3px solid ` + primary + `;font-size:12px;"><strong>Observaciones:</strong> ` + html.EscapeString(req.Notes) + `</div>`)
	}

	sb.WriteString(signaturesHTML)

	if strings.TrimSpace(b.FooterWarranty) != "" {
		sb.WriteString(`<div class="warranty">` + html.EscapeString(b.FooterWarranty) + `</div>`)
	}
	sb.WriteString(`</div></body></html>`)
	return sb.String()
}

func pickExtra(fields map[string]string, keys ...string) string {
	if len(fields) == 0 {
		return ""
	}
	for _, k := range keys {
		if v := strings.TrimSpace(fields[k]); v != "" {
			return v
		}
	}
	return ""
}

func fallbackDash(v string) string {
	if strings.TrimSpace(v) == "" {
		return "—"
	}
	return html.EscapeString(v)
}

func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func fmtQty(v float64) string {
	if v == math.Trunc(v) {
		return fmt.Sprintf("%.0f", v)
	}
	return fmt.Sprintf("%.2f", v)
}

func formatCOP(amount float64) string {
	neg := amount < 0
	n := int64(math.Round(math.Abs(amount)))
	raw := fmt.Sprintf("%d", n)
	var parts []string
	for len(raw) > 3 {
		parts = append([]string{raw[len(raw)-3:]}, parts...)
		raw = raw[:len(raw)-3]
	}
	parts = append([]string{raw}, parts...)
	prefix := "$"
	if neg {
		prefix = "-$"
	}
	return prefix + strings.Join(parts, ".")
}
