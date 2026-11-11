package renderer

import (
	"bytes"
	"fmt"
	"html/template"
	"math"
	"sort"
	"strings"

	"ms-impresiones/internal/domain"
	"ms-impresiones/internal/platform/apperr"
	"ms-impresiones/internal/platform/money"
)

type extraPair struct {
	Key   string
	Value string
}

type formattedItem struct {
	Code        string
	Description string
	Qty         string
	UnitPrice   string
	TaxPct      string
	Subtotal    string
}

type workshopSpec struct {
	Plate     string
	Vehicle   string
	WorkOrder string
	CurrentKm string
	NextOilKm string
	Mechanic  string
}

type templateViewModel struct {
	Title           string
	PrimaryColor    string
	Branding        domain.BrandingConfig
	DocType         string
	DocNumber       string
	IssueDate       string
	CustomerName    string
	CustomerNit     string
	CustomerPhone   string
	CustomerAddress string
	PaymentMethod   string
	HasContactRow   bool
	Extras          []extraPair
	Cufe            string
	Workshop        workshopSpec
	Items           []formattedItem
	Subtotal        string
	HasDiscount     bool
	DiscountTotal   string
	HasTax          bool
	TaxTotal        string
	GrandTotal      string
	HasPending      bool
	PendingBalance  string
	Notes           string
	Compact         bool
}

var letterTmpl = template.Must(template.New("letter").Parse(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{{.Title}}</title>
<style>
{{if .Compact}}
@page { size: 8.5in 5.5in; margin: 8mm; }
{{else}}
@page { size: letter; margin: 12mm; }
{{end}}
* { box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #e2e8f0; color: #0f172a; margin: 0; padding: {{if .Compact}}12px{{else}}20px{{end}}; }
.toolbar { max-width: {{if .Compact}}680px{{else}}820px{{end}}; margin: 0 auto 10px; display: flex; justify-content: flex-end; gap: 8px; }
.btn-print { background-color: {{.PrimaryColor}}; color: #ffffff; border: none; border-radius: 8px; padding: 9px 18px; font-weight: 700; font-size: 13px; cursor: pointer; }
.sheet { max-width: {{if .Compact}}680px{{else}}820px{{end}}; margin: 0 auto; background-color: #ffffff; padding: {{if .Compact}}18px 22px{{else}}28px 32px{{end}}; border-radius: 12px; box-shadow: 0 10px 25px rgba(15,23,42,0.12); }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; border-bottom-width: 3px; border-bottom-style: solid; border-bottom-color: {{.PrimaryColor}}; padding-bottom: {{if .Compact}}10px{{else}}14px{{end}}; }
.company-name { font-size: {{if .Compact}}17px{{else}}21px{{end}}; font-weight: 800; color: {{.PrimaryColor}}; margin: 0 0 4px 0; }
.company-meta { font-size: {{if .Compact}}11px{{else}}12px{{end}}; color: #334155; line-height: 1.42; }
.resolution { font-size: 10.5px; color: #475569; }
.doc-box { border-width: 2px; border-style: solid; border-color: {{.PrimaryColor}}; border-radius: 10px; padding: {{if .Compact}}8px 12px{{else}}10px 16px{{end}}; text-align: right; min-width: {{if .Compact}}185px{{else}}220px{{end}}; }
.doc-type { font-size: 11px; font-weight: 800; color: {{.PrimaryColor}}; text-transform: uppercase; }
.doc-num { font-size: {{if .Compact}}15px{{else}}18px{{end}}; font-weight: 900; color: #0f172a; margin: 3px 0; }
.doc-sub { font-size: 11px; color: #475569; }
.customer-box { margin-top: {{if .Compact}}10px{{else}}14px{{end}}; padding: 10px 14px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; display: grid; grid-template-columns: 1.4fr 1fr; gap: 5px 16px; font-size: {{if .Compact}}11.5px{{else}}12.5px{{end}}; }
.extras-box { margin: 10px 0; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background-color: #f8fafc; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 14px; font-size: 11.5px; }
.cufe-line { font-size: 10.5px; color: #475569; margin-top: 8px; word-break: break-all; }
table.items { width: 100%; border-collapse: collapse; margin-top: {{if .Compact}}10px{{else}}14px{{end}}; font-size: {{if .Compact}}11.5px{{else}}12.5px{{end}}; }
table.items th { background-color: {{.PrimaryColor}}; color: #ffffff; padding: {{if .Compact}}6px 8px{{else}}8px 10px{{end}}; text-align: left; font-weight: 700; }
table.items td { padding: {{if .Compact}}6px 8px{{else}}8px 10px{{end}}; border-bottom: 1px solid #e2e8f0; }
.right { text-align: right !important; }
.empty-row { text-align: center; color: #64748b; }
.totals-wrap { display: flex; justify-content: flex-end; margin-top: {{if .Compact}}10px{{else}}14px{{end}}; }
.totals-table { width: 295px; border-collapse: collapse; font-size: {{if .Compact}}12px{{else}}13px{{end}}; }
.totals-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
.totals-table tr.grand td { font-size: {{if .Compact}}13.5px{{else}}15px{{end}}; font-weight: 800; background-color: #f1f5f9; color: {{.PrimaryColor}}; border-top-width: 2px; border-top-style: solid; border-top-color: {{.PrimaryColor}}; }
.discount-val { color: #dc2626; }
.pending-val { color: #d97706; font-weight: 800; }
.notes-box { margin-top: 12px; padding: 9px 12px; background-color: #f8fafc; border-left-width: 3px; border-left-style: solid; border-left-color: {{.PrimaryColor}}; font-size: 11.5px; }
.warranty { margin-top: {{if .Compact}}12px{{else}}20px{{end}}; padding-top: 9px; border-top: 1px solid #cbd5e1; font-size: 10.5px; color: #475569; text-align: center; }
@media print {
  body { background-color: #ffffff; padding: 0; }
  .no-print { display: none !important; }
  .sheet { box-shadow: none; border-radius: 0; padding: 0; max-width: 100%; }
}
</style>
</head>
<body>
<div class="toolbar no-print">
  <button type="button" class="btn-print" onclick="window.print()">Imprimir / Guardar PDF</button>
</div>
<div class="sheet">
  <div class="header">
    <div>
      <div class="company-name">{{.Branding.CompanyName}}</div>
      <div class="company-meta">
        {{if .Branding.Nit}}<strong>NIT:</strong> {{.Branding.Nit}}{{if .Branding.TaxRegime}} | {{end}}{{end}}{{.Branding.TaxRegime}}
        {{if .Branding.Address}}<br>{{.Branding.Address}}{{end}}
        {{if or .Branding.Phone .Branding.Email}}<br>Tel: {{.Branding.Phone}}{{if .Branding.Email}} • {{.Branding.Email}}{{end}}{{end}}
        {{if .Branding.DianResolution}}<br><span class="resolution">{{.Branding.DianResolution}}</span>{{end}}
      </div>
    </div>
    <div class="doc-box">
      <div class="doc-type">{{.DocType}}</div>
      <div class="doc-num">{{.DocNumber}}</div>
      <div class="doc-sub">Fecha: {{.IssueDate}}</div>
      {{if .PaymentMethod}}<div class="doc-sub"><strong>Pago:</strong> {{.PaymentMethod}}</div>{{end}}
    </div>
  </div>

  <div class="customer-box">
    <div><strong>Cliente / Tercero:</strong> {{.CustomerName}}</div>
    <div><strong>NIT / Documento:</strong> {{.CustomerNit}}</div>
    {{if .HasContactRow}}
    <div><strong>Dirección:</strong> {{.CustomerAddress}}</div>
    <div><strong>Teléfono:</strong> {{.CustomerPhone}}</div>
    {{end}}
  </div>

  {{if .Extras}}
  <div class="extras-box">
    {{range .Extras}}
    <div><strong>{{.Key}}:</strong> {{.Value}}</div>
    {{end}}
  </div>
  {{end}}

  {{if .Cufe}}
  <div class="cufe-line"><strong>CUFE DIAN:</strong> {{.Cufe}}</div>
  {{end}}

  <table class="items">
    <thead>
      <tr>
        <th style="width:14%;">Código</th>
        <th>Descripción del Producto / Servicio</th>
        <th class="right" style="width:10%;">Cant.</th>
        <th class="right" style="width:16%;">Vr. Unitario</th>
        <th class="right" style="width:10%;">IVA</th>
        <th class="right" style="width:18%;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      {{if .Items}}
        {{range .Items}}
        <tr>
          <td>{{.Code}}</td>
          <td>{{.Description}}</td>
          <td class="right">{{.Qty}}</td>
          <td class="right">{{.UnitPrice}}</td>
          <td class="right">{{.TaxPct}}%</td>
          <td class="right"><strong>{{.Subtotal}}</strong></td>
        </tr>
        {{end}}
      {{else}}
        <tr><td colspan="6" class="empty-row">Sin ítems detallados</td></tr>
      {{end}}
    </tbody>
  </table>

  <div class="totals-wrap">
    <table class="totals-table">
      <tr><td>Subtotal Bruto</td><td class="right">{{.Subtotal}}</td></tr>
      {{if .HasDiscount}}<tr><td>Descuento Aplicado</td><td class="right discount-val">-{{.DiscountTotal}}</td></tr>{{end}}
      <tr><td>IVA / Impuestos</td><td class="right">{{.TaxTotal}}</td></tr>
      <tr class="grand"><td>TOTAL DOCUMENTO</td><td class="right">{{.GrandTotal}}</td></tr>
      {{if .HasPending}}<tr><td><strong>Saldo Pendiente CxC</strong></td><td class="right pending-val">{{.PendingBalance}}</td></tr>{{end}}
    </table>
  </div>

  {{if .Notes}}
  <div class="notes-box"><strong>Observaciones:</strong> {{.Notes}}</div>
  {{end}}

  {{if .Branding.FooterWarranty}}
  <div class="warranty">{{.Branding.FooterWarranty}}</div>
  {{end}}
</div>
</body>
</html>`))

var workshopTmpl = template.Must(template.New("workshop").Parse(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{{.Title}}</title>
<style>
@page { size: letter; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #e2e8f0; color: #0f172a; margin: 0; padding: 20px; }
.toolbar { max-width: 820px; margin: 0 auto 12px; display: flex; justify-content: flex-end; gap: 8px; }
.btn-print { background-color: {{.PrimaryColor}}; color: #ffffff; border: none; border-radius: 8px; padding: 9px 18px; font-weight: 700; font-size: 13px; cursor: pointer; }
.sheet { max-width: 820px; margin: 0 auto; background-color: #ffffff; padding: 28px 32px; border-radius: 12px; box-shadow: 0 10px 25px rgba(15,23,42,0.12); }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom-width: 3px; border-bottom-style: solid; border-bottom-color: {{.PrimaryColor}}; padding-bottom: 14px; }
.company-name { font-size: 21px; font-weight: 800; color: {{.PrimaryColor}}; margin: 0 0 4px 0; }
.company-meta { font-size: 12px; color: #334155; line-height: 1.45; }
.resolution { font-size: 10.5px; color: #475569; }
.doc-box { border-width: 2px; border-style: solid; border-color: {{.PrimaryColor}}; border-radius: 10px; padding: 10px 16px; text-align: right; min-width: 220px; }
.doc-type { font-size: 11px; font-weight: 800; color: {{.PrimaryColor}}; text-transform: uppercase; }
.doc-num { font-size: 18px; font-weight: 900; color: #0f172a; margin: 3px 0; }
.doc-sub { font-size: 11px; color: #475569; }
.customer-box { margin-top: 14px; padding: 11px 14px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; display: grid; grid-template-columns: 1.4fr 1fr; gap: 6px 16px; font-size: 12.5px; }
.workshop-box { margin: 14px 0; padding: 12px 14px; border-width: 2px; border-style: solid; border-color: {{.PrimaryColor}}; border-radius: 10px; background-color: #f8fafc; }
.workshop-title { font-weight: 800; font-size: 12px; color: {{.PrimaryColor}}; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
.workshop-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 14px; font-size: 12.5px; }
.plate-badge { font-weight: 800; background-color: #e2e8f0; padding: 2px 8px; border-radius: 4px; }
.cufe-line { font-size: 10.5px; color: #475569; margin-bottom: 8px; word-break: break-all; }
table.items { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12.5px; }
table.items th { background-color: {{.PrimaryColor}}; color: #ffffff; padding: 8px 10px; text-align: left; font-weight: 700; }
table.items td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
.right { text-align: right !important; }
.empty-row { text-align: center; color: #64748b; }
.totals-wrap { display: flex; justify-content: flex-end; margin-top: 14px; }
.totals-table { width: 300px; border-collapse: collapse; font-size: 13px; }
.totals-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
.totals-table tr.grand td { font-size: 15px; font-weight: 800; background-color: #f1f5f9; color: {{.PrimaryColor}}; border-top-width: 2px; border-top-style: solid; border-top-color: {{.PrimaryColor}}; }
.discount-val { color: #dc2626; }
.pending-val { color: #d97706; font-weight: 800; }
.notes-box { margin-top: 14px; padding: 10px 12px; background-color: #f8fafc; border-left-width: 3px; border-left-style: solid; border-left-color: {{.PrimaryColor}}; font-size: 12px; }
.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 34px; font-size: 12px; color: #334155; }
.sig-line { border-top: 1px solid #475569; padding-top: 6px; text-align: center; }
.warranty { margin-top: 20px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #475569; text-align: center; }
@media print {
  body { background-color: #ffffff; padding: 0; }
  .no-print { display: none !important; }
  .sheet { box-shadow: none; border-radius: 0; padding: 0; max-width: 100%; }
}
</style>
</head>
<body>
<div class="toolbar no-print">
  <button type="button" class="btn-print" onclick="window.print()">Imprimir / Guardar PDF</button>
</div>
<div class="sheet">
  <div class="header">
    <div>
      <div class="company-name">{{.Branding.CompanyName}}</div>
      <div class="company-meta">
        {{if .Branding.Nit}}<strong>NIT:</strong> {{.Branding.Nit}}{{if .Branding.TaxRegime}} | {{end}}{{end}}{{.Branding.TaxRegime}}
        {{if .Branding.Address}}<br>{{.Branding.Address}}{{end}}
        {{if or .Branding.Phone .Branding.Email}}<br>Tel: {{.Branding.Phone}}{{if .Branding.Email}} • {{.Branding.Email}}{{end}}{{end}}
        {{if .Branding.DianResolution}}<br><span class="resolution">{{.Branding.DianResolution}}</span>{{end}}
      </div>
    </div>
    <div class="doc-box">
      <div class="doc-type">{{.DocType}}</div>
      <div class="doc-num">{{.DocNumber}}</div>
      <div class="doc-sub">Fecha: {{.IssueDate}}</div>
      {{if .PaymentMethod}}<div class="doc-sub"><strong>Pago:</strong> {{.PaymentMethod}}</div>{{end}}
    </div>
  </div>

  <div class="customer-box">
    <div><strong>Cliente / Propietario:</strong> {{.CustomerName}}</div>
    <div><strong>NIT / Documento:</strong> {{.CustomerNit}}</div>
    {{if .HasContactRow}}
    <div><strong>Dirección:</strong> {{.CustomerAddress}}</div>
    <div><strong>Teléfono:</strong> {{.CustomerPhone}}</div>
    {{end}}
  </div>

  <div class="workshop-box">
    <div class="workshop-title">Ficha Técnica Automotriz y Orden de Servicio</div>
    <div class="workshop-grid">
      <div><strong>Placa:</strong> <span class="plate-badge">{{.Workshop.Plate}}</span></div>
      <div><strong>Vehículo:</strong> {{.Workshop.Vehicle}}</div>
      <div><strong>Orden de Servicio:</strong> {{.Workshop.WorkOrder}}</div>
      <div><strong>Kilometraje:</strong> {{.Workshop.CurrentKm}}</div>
      <div><strong>Próximo Aceite:</strong> {{.Workshop.NextOilKm}}</div>
      <div><strong>Técnico:</strong> {{.Workshop.Mechanic}}</div>
    </div>
  </div>

  {{if .Cufe}}
  <div class="cufe-line"><strong>CUFE DIAN:</strong> {{.Cufe}}</div>
  {{end}}

  <table class="items">
    <thead>
      <tr>
        <th style="width:14%;">Código</th>
        <th>Descripción del Repuesto / Mano de Obra</th>
        <th class="right" style="width:10%;">Cant.</th>
        <th class="right" style="width:16%;">Vr. Unitario</th>
        <th class="right" style="width:10%;">IVA</th>
        <th class="right" style="width:18%;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      {{if .Items}}
        {{range .Items}}
        <tr>
          <td>{{.Code}}</td>
          <td>{{.Description}}</td>
          <td class="right">{{.Qty}}</td>
          <td class="right">{{.UnitPrice}}</td>
          <td class="right">{{.TaxPct}}%</td>
          <td class="right"><strong>{{.Subtotal}}</strong></td>
        </tr>
        {{end}}
      {{else}}
        <tr><td colspan="6" class="empty-row">Sin ítems detallados</td></tr>
      {{end}}
    </tbody>
  </table>

  <div class="totals-wrap">
    <table class="totals-table">
      <tr><td>Subtotal Bruto</td><td class="right">{{.Subtotal}}</td></tr>
      {{if .HasDiscount}}<tr><td>Descuento Aplicado</td><td class="right discount-val">-{{.DiscountTotal}}</td></tr>{{end}}
      <tr><td>IVA / Impuestos</td><td class="right">{{.TaxTotal}}</td></tr>
      <tr class="grand"><td>TOTAL FACTURA TALLER</td><td class="right">{{.GrandTotal}}</td></tr>
      {{if .HasPending}}<tr><td><strong>Saldo Pendiente CxC</strong></td><td class="right pending-val">{{.PendingBalance}}</td></tr>{{end}}
    </table>
  </div>

  {{if .Notes}}
  <div class="notes-box"><strong>Observaciones Técnicas:</strong> {{.Notes}}</div>
  {{end}}

  <div class="signatures">
    <div class="sig-line">
      <strong>Entrega Taller / Responsable Técnico</strong><br>{{.Workshop.Mechanic}}
    </div>
    <div class="sig-line">
      <strong>Recibe a Satisfacción — Cliente / Conductor</strong><br>{{.CustomerName}}
    </div>
  </div>

  {{if .Branding.FooterWarranty}}
  <div class="warranty">{{.Branding.FooterWarranty}}</div>
  {{end}}
</div>
</body>
</html>`))

var thermal80mmTmpl = template.Must(template.New("thermal80mm").Parse(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{{.Title}}</title>
<style>
@page { size: 80mm auto; margin: 2mm; }
* { box-sizing: border-box; }
body { font-family: 'Courier New', Courier, monospace; background-color: #f1f5f9; color: #0f172a; margin: 0; padding: 12px; }
.toolbar { max-width: 310px; margin: 0 auto 10px; text-align: center; }
.btn-print { background-color: {{.PrimaryColor}}; color: #ffffff; border: none; border-radius: 6px; padding: 9px 16px; font-weight: 700; font-size: 13px; cursor: pointer; width: 100%; }
.ticket { width: 302px; margin: 0 auto; background-color: #ffffff; padding: 12px 10px; border: 1px dashed #94a3b8; font-size: 12px; line-height: 1.35; }
.center { text-align: center; }
.bold { font-weight: 700; }
.title-line { font-size: 14px; font-weight: 700; text-align: center; }
.small-meta { font-size: 10.5px; margin-top: 4px; text-align: center; word-break: break-word; }
.sep { border-top: 1px dashed #334155; margin: 8px 0; }
table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
th, td { padding: 3px 0; vertical-align: top; }
.left { text-align: left; }
.right { text-align: right; }
.unit-note { font-size: 10px; color: #475569; }
.total-row { font-size: 13.5px; font-weight: 700; }
@media print {
  body { background-color: #ffffff; padding: 0; }
  .no-print { display: none !important; }
  .ticket { border: none; width: 100%; padding: 2px; }
}
</style>
</head>
<body>
<div class="toolbar no-print">
  <button type="button" class="btn-print" onclick="window.print()">Imprimir Tirilla 80mm</button>
</div>
<div class="ticket">
  <div class="title-line">{{.Branding.CompanyName}}</div>
  {{if .Branding.Nit}}<div class="center">NIT: {{.Branding.Nit}}</div>{{end}}
  {{if .Branding.TaxRegime}}<div class="center">{{.Branding.TaxRegime}}</div>{{end}}
  {{if .Branding.Address}}<div class="center">{{.Branding.Address}}</div>{{end}}
  {{if .Branding.Phone}}<div class="center">Tel: {{.Branding.Phone}}</div>{{end}}
  {{if .Branding.DianResolution}}<div class="small-meta">{{.Branding.DianResolution}}</div>{{end}}

  <div class="sep"></div>
  <div><span class="bold">{{.DocType}}:</span> {{.DocNumber}}</div>
  <div><span class="bold">Fecha:</span> {{.IssueDate}}</div>
  <div><span class="bold">Cliente:</span> {{.CustomerName}}</div>
  {{if ne .CustomerNit "—"}}<div><span class="bold">Doc/NIT:</span> {{.CustomerNit}}</div>{{end}}
  {{if .PaymentMethod}}<div><span class="bold">Pago:</span> {{.PaymentMethod}}</div>{{end}}

  {{if .Extras}}
  <div class="sep"></div>
  {{range .Extras}}
  <div><span class="bold">{{.Key}}:</span> {{.Value}}</div>
  {{end}}
  {{end}}

  <div class="sep"></div>
  <table>
    <thead>
      <tr><th class="left">Cant / Detalle</th><th class="right">Subtotal</th></tr>
    </thead>
    <tbody>
      {{range .Items}}
      <tr>
        <td>{{.Qty}} x {{.Description}}<br><span class="unit-note">@ {{.UnitPrice}}</span></td>
        <td class="right bold">{{.Subtotal}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>

  <div class="sep"></div>
  <table>
    <tr><td>Subtotal:</td><td class="right">{{.Subtotal}}</td></tr>
    {{if .HasDiscount}}<tr><td>Descuento:</td><td class="right">-{{.DiscountTotal}}</td></tr>{{end}}
    {{if .HasTax}}<tr><td>IVA / Impuestos:</td><td class="right">{{.TaxTotal}}</td></tr>{{end}}
    <tr class="total-row"><td>TOTAL:</td><td class="right">{{.GrandTotal}}</td></tr>
    {{if .HasPending}}<tr><td class="bold">Saldo Pendiente:</td><td class="right bold">{{.PendingBalance}}</td></tr>{{end}}
  </table>

  {{if .Cufe}}
  <div class="sep"></div>
  <div class="small-meta">CUFE: {{.Cufe}}</div>
  {{end}}

  {{if .Notes}}
  <div class="sep"></div>
  <div><span class="bold">Notas:</span> {{.Notes}}</div>
  {{end}}

  {{if .Branding.FooterWarranty}}
  <div class="sep"></div>
  <div class="small-meta">{{.Branding.FooterWarranty}}</div>
  {{end}}
</div>
</body>
</html>`))

type LetterStrategy struct{}

func (LetterStrategy) VariantKey() string { return domain.FormatCarta }

func (LetterStrategy) Render(branding domain.BrandingConfig, req domain.RenderRequest) (string, error) {
	vm := buildViewModel(branding, req, false)
	return executeTemplate(letterTmpl, vm)
}

type HalfLetterStrategy struct{}

func (HalfLetterStrategy) VariantKey() string { return domain.FormatMediaCarta }

func (HalfLetterStrategy) Render(branding domain.BrandingConfig, req domain.RenderRequest) (string, error) {
	vm := buildViewModel(branding, req, true)
	return executeTemplate(letterTmpl, vm)
}

type Thermal80mmStrategy struct{}

func (Thermal80mmStrategy) VariantKey() string { return domain.FormatTirilla80mm }

func (Thermal80mmStrategy) Render(branding domain.BrandingConfig, req domain.RenderRequest) (string, error) {
	vm := buildViewModel(branding, req, false)
	return executeTemplate(thermal80mmTmpl, vm)
}

type WorkshopInvoiceStrategy struct{}

func (WorkshopInvoiceStrategy) VariantKey() string { return domain.FormatFacturaTaller }

func (WorkshopInvoiceStrategy) Render(branding domain.BrandingConfig, req domain.RenderRequest) (string, error) {
	vm := buildViewModel(branding, req, false)
	vm.Workshop = workshopSpec{
		Plate:     dashIfEmpty(pickExtra(req.ExtraFields, "Placa", "placa", "plate")),
		Vehicle:   dashIfEmpty(pickExtra(req.ExtraFields, "Vehículo", "Vehiculo", "vehicle", "vehicleBrand")),
		WorkOrder: dashIfEmpty(pickExtra(req.ExtraFields, "Orden de Servicio", "ordenServicio", "workOrderId")),
		CurrentKm: dashIfEmpty(pickExtra(req.ExtraFields, "Kilometraje", "kilometraje", "currentKm")),
		NextOilKm: dashIfEmpty(pickExtra(req.ExtraFields, "Próximo Aceite", "Proximo Aceite", "nextOilKm")),
		Mechanic:  dashIfEmpty(pickExtra(req.ExtraFields, "Técnico", "Tecnico", "Técnico / Mecánico", "Mecánico", "Mecanico", "mechanicName")),
	}
	return executeTemplate(workshopTmpl, vm)
}

func NewDefaultStrategies() map[string]domain.LayoutStrategy {
	list := []domain.LayoutStrategy{
		LetterStrategy{},
		HalfLetterStrategy{},
		Thermal80mmStrategy{},
		WorkshopInvoiceStrategy{},
	}
	reg := make(map[string]domain.LayoutStrategy, len(list))
	for _, st := range list {
		reg[st.VariantKey()] = st
	}
	return reg
}

func executeTemplate(t *template.Template, vm templateViewModel) (string, error) {
	var buf bytes.Buffer
	if err := t.Execute(&buf, vm); err != nil {
		return "", apperr.Internal("No fue posible generar el documento imprimible")
	}
	return buf.String(), nil
}

func buildViewModel(branding domain.BrandingConfig, req domain.RenderRequest, compact bool) templateViewModel {
	safeBranding, _ := domain.NormalizeBranding(branding, false)
	primaryColor := domain.SanitizeHexColor(safeBranding.PrimaryColor)
	safeBranding.PrimaryColor = primaryColor

	cufe := strings.TrimSpace(pickExtra(req.ExtraFields, "CUFE", "cufe"))

	keys := make([]string, 0, len(req.ExtraFields))
	for k, v := range req.ExtraFields {
		if strings.EqualFold(k, "CUFE") || strings.TrimSpace(v) == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	extras := make([]extraPair, 0, len(keys))
	for _, k := range keys {
		extras = append(extras, extraPair{
			Key:   strings.TrimSpace(k),
			Value: strings.TrimSpace(req.ExtraFields[k]),
		})
	}

	items := make([]formattedItem, 0, len(req.Items))
	for _, it := range req.Items {
		code := it.Code
		if code == "" {
			code = "ITEM"
		}
		items = append(items, formattedItem{
			Code:        code,
			Description: dashIfEmpty(it.Description),
			Qty:         formatQuantity(it.Quantity),
			UnitPrice:   money.FormatCOP(it.UnitPrice),
			TaxPct:      formatQuantity(it.TaxPct),
			Subtotal:    money.FormatCOP(it.Subtotal),
		})
	}

	custName := dashIfEmpty(req.CustomerName)
	if custName == "—" {
		custName = "Consumidor Final Mostrador"
	}

	return templateViewModel{
		Title:           fmt.Sprintf("%s %s — %s", req.DocumentType, req.DocumentNumber, safeBranding.CompanyName),
		PrimaryColor:    primaryColor,
		Branding:        safeBranding,
		DocType:         req.DocumentType,
		DocNumber:       req.DocumentNumber,
		IssueDate:       req.IssueDate,
		CustomerName:    custName,
		CustomerNit:     dashIfEmpty(req.CustomerNit),
		CustomerPhone:   dashIfEmpty(req.CustomerPhone),
		CustomerAddress: dashIfEmpty(req.CustomerAddress),
		PaymentMethod:   req.PaymentMethod,
		HasContactRow:   req.CustomerAddress != "" || req.CustomerPhone != "",
		Extras:          extras,
		Cufe:            cufe,
		Items:           items,
		Subtotal:        money.FormatCOP(req.Subtotal),
		HasDiscount:     req.DiscountTotal > 0,
		DiscountTotal:   money.FormatCOP(req.DiscountTotal),
		HasTax:          req.TaxTotal > 0,
		TaxTotal:        money.FormatCOP(req.TaxTotal),
		GrandTotal:      money.FormatCOP(req.GrandTotal),
		HasPending:      req.PendingBalance > 0,
		PendingBalance:  money.FormatCOP(req.PendingBalance),
		Notes:           req.Notes,
		Compact:         compact,
	}
}

func pickExtra(fields map[string]string, candidates ...string) string {
	if len(fields) == 0 {
		return ""
	}
	for _, k := range candidates {
		if v := strings.TrimSpace(fields[k]); v != "" {
			return v
		}
	}
	return ""
}

func dashIfEmpty(v string) string {
	trimmed := strings.TrimSpace(v)
	if trimmed == "" {
		return "—"
	}
	return trimmed
}

func formatQuantity(v float64) string {
	if !money.IsFinite(v) {
		return "0"
	}
	if v == math.Trunc(v) {
		return fmt.Sprintf("%.0f", v)
	}
	return fmt.Sprintf("%.2f", v)
}
