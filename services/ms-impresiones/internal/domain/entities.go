package domain

import (
	"regexp"
	"strings"
	"time"

	"ms-impresiones/internal/platform/apperr"
	"ms-impresiones/internal/platform/money"
)

const (
	DefaultPrimaryColor = "#023047"
	FormatCarta         = "carta_membrete"
	FormatMediaCarta    = "media_carta"
	FormatTirilla80mm   = "tirilla_80mm"
	FormatFacturaTaller = "factura_taller"
)

var strictHexColorRegex = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type BrandingConfig struct {
	CompanyName    string `json:"companyName"`
	Nit            string `json:"nit"`
	TaxRegime      string `json:"taxRegime"`
	Address        string `json:"address"`
	Phone          string `json:"phone"`
	Email          string `json:"email"`
	DianResolution string `json:"dianResolution"`
	FooterWarranty string `json:"footerWarranty"`
	PrimaryColor   string `json:"primaryColor"`
	DefaultFormat  string `json:"defaultFormat"`
}

func (b BrandingConfig) Clone() BrandingConfig {
	return b
}

func SanitizeHexColor(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if strictHexColorRegex.MatchString(trimmed) {
		return strings.ToLower(trimmed)
	}
	return DefaultPrimaryColor
}

func DefaultSeedBranding() BrandingConfig {
	return BrandingConfig{
		CompanyName:    "Proveko Comercial & Servicios S.A.S.",
		Nit:            "901.482.190-4",
		TaxRegime:      "Responsable de IVA — Régimen Ordinario",
		Address:        "Av. El Dorado # 68C-61 Of. 504 — Bogotá D.C.",
		Phone:          "601 742 8890",
		Email:          "facturacion@empresa.local",
		DianResolution: "Resolución DIAN N° 18764049102938 — Prefijo FEVP del 1 al 50.000 Vigencia 24 meses",
		FooterWarranty: "Esta factura se asimila en todos sus efectos a una letra de cambio (Art. 774 C.Co). Garantía sujeta a políticas comerciales vigentes.",
		PrimaryColor:   DefaultPrimaryColor,
		DefaultFormat:  FormatCarta,
	}
}

func NormalizeBranding(in BrandingConfig, requireMandatory bool) (BrandingConfig, error) {
	out := BrandingConfig{
		CompanyName:    strings.TrimSpace(in.CompanyName),
		Nit:            strings.TrimSpace(in.Nit),
		TaxRegime:      strings.TrimSpace(in.TaxRegime),
		Address:        strings.TrimSpace(in.Address),
		Phone:          strings.TrimSpace(in.Phone),
		Email:          strings.TrimSpace(in.Email),
		DianResolution: strings.TrimSpace(in.DianResolution),
		FooterWarranty: strings.TrimSpace(in.FooterWarranty),
		PrimaryColor:   SanitizeHexColor(in.PrimaryColor),
		DefaultFormat:  strings.TrimSpace(in.DefaultFormat),
	}

	if requireMandatory {
		if out.CompanyName == "" {
			return BrandingConfig{}, apperr.Validation("La razón social o nombre comercial de la empresa es obligatorio")
		}
		if out.Nit == "" {
			return BrandingConfig{}, apperr.Validation("El NIT empresarial es obligatorio")
		}
	} else {
		if out.CompanyName == "" {
			out.CompanyName = "Empresa Comercial S.A.S."
		}
		if out.Nit == "" {
			out.Nit = "900.000.000-1"
		}
	}

	switch out.DefaultFormat {
	case FormatCarta, FormatMediaCarta, FormatTirilla80mm:
	default:
		out.DefaultFormat = FormatCarta
	}
	return out, nil
}

type PrintLineItem struct {
	Code        string  `json:"code"`
	Description string  `json:"description"`
	Quantity    float64 `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	TaxPct      float64 `json:"tax_pct"`
	Subtotal    float64 `json:"subtotal"`
}

func (i PrintLineItem) Clone() PrintLineItem {
	return i
}

type RenderRequest struct {
	DocumentType    string
	LayoutVariant   string
	DocumentNumber  string
	IssueDate       string
	CustomerName    string
	CustomerNit     string
	CustomerPhone   string
	CustomerAddress string
	PaymentMethod   string
	ExtraFields     map[string]string
	Items           []PrintLineItem
	Subtotal        float64
	DiscountTotal   float64
	TaxTotal        float64
	GrandTotal      float64
	PendingBalance  float64
	Notes           string
	Actor           string
}

func (r RenderRequest) Clone() RenderRequest {
	cp := r
	if r.ExtraFields != nil {
		cp.ExtraFields = make(map[string]string, len(r.ExtraFields))
		for k, v := range r.ExtraFields {
			cp.ExtraFields[k] = v
		}
	} else {
		cp.ExtraFields = map[string]string{}
	}
	if r.Items != nil {
		cp.Items = make([]PrintLineItem, len(r.Items))
		copy(cp.Items, r.Items)
	} else {
		cp.Items = []PrintLineItem{}
	}
	return cp
}

func NormalizeRenderRequest(in RenderRequest) (RenderRequest, error) {
	cp := in.Clone()
	cp.DocumentType = strings.TrimSpace(cp.DocumentType)
	if cp.DocumentType == "" {
		cp.DocumentType = "FACTURA DE VENTA"
	}
	cp.DocumentNumber = strings.TrimSpace(cp.DocumentNumber)
	if cp.DocumentNumber == "" {
		cp.DocumentNumber = "DOC-0001"
	}
	cp.IssueDate = strings.TrimSpace(cp.IssueDate)
	if cp.IssueDate == "" {
		cp.IssueDate = time.Now().Format("2006-01-02 15:04")
	}
	cp.LayoutVariant = strings.TrimSpace(cp.LayoutVariant)
	cp.CustomerName = strings.TrimSpace(cp.CustomerName)
	cp.CustomerNit = strings.TrimSpace(cp.CustomerNit)
	cp.CustomerPhone = strings.TrimSpace(cp.CustomerPhone)
	cp.CustomerAddress = strings.TrimSpace(cp.CustomerAddress)
	cp.PaymentMethod = strings.TrimSpace(cp.PaymentMethod)
	cp.Notes = strings.TrimSpace(cp.Notes)
	cp.Actor = strings.TrimSpace(cp.Actor)

	if !money.IsFinite(cp.Subtotal) || !money.IsFinite(cp.DiscountTotal) || !money.IsFinite(cp.TaxTotal) ||
		!money.IsFinite(cp.GrandTotal) || !money.IsFinite(cp.PendingBalance) {
		return RenderRequest{}, apperr.Validation("Los valores monetarios del documento contienen números no válidos")
	}

	if len(cp.Items) > 500 {
		return RenderRequest{}, apperr.Validation("El documento excede el límite máximo de 500 líneas imprimibles")
	}

	calcSub := 0.0
	cleanItems := make([]PrintLineItem, 0, len(cp.Items))
	for _, it := range cp.Items {
		if !money.IsFinite(it.Quantity) || !money.IsFinite(it.UnitPrice) || !money.IsFinite(it.TaxPct) || !money.IsFinite(it.Subtotal) {
			return RenderRequest{}, apperr.Validation("Los valores de la línea de impresión contienen números no válidos")
		}
		qty := money.RoundCents(it.Quantity)
		unit := money.RoundCents(it.UnitPrice)
		tax := money.RoundCents(it.TaxPct)
		sub := money.RoundCents(it.Subtotal)
		if sub == 0 && qty != 0 && unit != 0 {
			sub = money.RoundCents(qty * unit)
		}
		calcSub = money.RoundCents(calcSub + sub)
		cleanItems = append(cleanItems, PrintLineItem{
			Code:        strings.TrimSpace(it.Code),
			Description: strings.TrimSpace(it.Description),
			Quantity:    qty,
			UnitPrice:   unit,
			TaxPct:      tax,
			Subtotal:    sub,
		})
	}
	cp.Items = cleanItems

	cp.Subtotal = money.RoundCents(cp.Subtotal)
	if cp.Subtotal == 0 && calcSub > 0 {
		cp.Subtotal = calcSub
	}
	cp.DiscountTotal = money.RoundCents(cp.DiscountTotal)
	cp.TaxTotal = money.RoundCents(cp.TaxTotal)
	cp.GrandTotal = money.RoundCents(cp.GrandTotal)
	if cp.GrandTotal == 0 && (cp.Subtotal > 0 || cp.TaxTotal > 0) {
		cp.GrandTotal = money.RoundCents(cp.Subtotal - cp.DiscountTotal + cp.TaxTotal)
	}
	cp.PendingBalance = money.RoundCents(cp.PendingBalance)
	return cp, nil
}

type RenderOutput struct {
	Title         string `json:"title"`
	Format        string `json:"format"`
	HTMLPrintable string `json:"html_printable"`
}
