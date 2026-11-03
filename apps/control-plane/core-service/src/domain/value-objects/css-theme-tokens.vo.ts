import { PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface WorkstationThemeConfig {
  primaryColorHex: string;
  primaryHoverHex: string;
  sidebarBgHex: string;
  surfaceCanvasHex: string;
  surfaceCardHex: string;
  borderRadiusRem: string;
}

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const RADIUS_REM_REGEX = /^(0|0\.\d+|1(\.0+)?)(rem|px)$/;

/**
 * Value Object que blinda la Identidad Visual de la Estación de Trabajo Profesional [P3-02]:
 * 1. Bloquea cualquier intento de Stored XSS / CSS Injection (solo Hex #RRGGBB y rem/px numéricos).
 * 2. Prohíbe fondos de lienzo oscuros/neón (< 0.80 de luminancia relativa en surfaceCanvasHex) para garantizar legibilidad de 8h.
 * 3. Valida contraste WCAG AA (>= 4.5:1) del color primario frente a texto blanco (#FFFFFF).
 */
export class CssThemeTokensVo {
  private readonly props: Readonly<WorkstationThemeConfig>;

  private constructor(config: WorkstationThemeConfig) {
    this.props = Object.freeze({ ...config });
  }

  public static createDefaultCorporateTheme(): CssThemeTokensVo {
    return new CssThemeTokensVo({
      primaryColorHex: '#1D4ED8', // Azul Real Corporativo
      primaryHoverHex: '#1E40AF',
      sidebarBgHex: '#0F172A', // Azul Marino Institucional
      surfaceCanvasHex: '#F8FAFC', // Papel de Trabajo / Alabastro
      surfaceCardHex: '#FFFFFF', // Blanco Puro
      borderRadiusRem: '0.5rem',
    });
  }

  public static createCustomTenantTheme(
    partial: Partial<WorkstationThemeConfig>,
  ): CssThemeTokensVo {
    const base = this.createDefaultCorporateTheme().toConfig();
    const merged: WorkstationThemeConfig = {
      primaryColorHex: partial.primaryColorHex ?? base.primaryColorHex,
      primaryHoverHex: partial.primaryHoverHex ?? base.primaryHoverHex,
      sidebarBgHex: partial.sidebarBgHex ?? base.sidebarBgHex,
      surfaceCanvasHex: partial.surfaceCanvasHex ?? base.surfaceCanvasHex,
      surfaceCardHex: partial.surfaceCardHex ?? base.surfaceCardHex,
      borderRadiusRem: partial.borderRadiusRem ?? base.borderRadiusRem,
    };

    const hexFields: Array<[string, string]> = [
      ['primaryColorHex', merged.primaryColorHex],
      ['primaryHoverHex', merged.primaryHoverHex],
      ['sidebarBgHex', merged.sidebarBgHex],
      ['surfaceCanvasHex', merged.surfaceCanvasHex],
      ['surfaceCardHex', merged.surfaceCardHex],
    ];

    for (const [fieldName, value] of hexFields) {
      if (!HEX_COLOR_REGEX.test(value)) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_INVALID_THEME_TOKEN,
          422,
          `Invalid hex color in "${fieldName}": "${value}". CSS injection guard allows only #RRGGBB.`,
        );
      }
    }

    if (!RADIUS_REM_REGEX.test(merged.borderRadiusRem)) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_INVALID_THEME_TOKEN,
        422,
        `Invalid borderRadiusRem "${merged.borderRadiusRem}". Allowed range: 0rem to 1.0rem.`,
      );
    }

    // Regla del Tribunal de Producto: Prohibido el estilo oscuro/gamer en el lienzo de trabajo
    const canvasLum = this.computeRelativeLuminance(merged.surfaceCanvasHex);
    if (canvasLum < 0.8) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_INVALID_THEME_TOKEN,
        422,
        `Workstation canvas "${merged.surfaceCanvasHex}" is too dark (luminance ${canvasLum.toFixed(2)} < 0.80). Enterprise workstations require light paper surfaces (#F8FAFC / #FFFFFF).`,
      );
    }

    // Validar contraste WCAG AA (>= 4.5:1) del color primario frente a texto de botón blanco (#FFFFFF)
    const contrastWithWhite = this.computeContrastRatio(merged.primaryColorHex, '#FFFFFF');
    if (contrastWithWhite < 4.5) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_INVALID_THEME_TOKEN,
        422,
        `Primary color "${merged.primaryColorHex}" fails WCAG AA contrast with white text (${contrastWithWhite.toFixed(2)}:1 < 4.5:1).`,
      );
    }

    return new CssThemeTokensVo(merged);
  }

  public static computeRelativeLuminance(hex: string): number {
    const clean = hex.slice(1);
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;

    const toLinear = (c: number): number =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  public static computeContrastRatio(hex1: string, hex2: string): number {
    const l1 = this.computeRelativeLuminance(hex1);
    const l2 = this.computeRelativeLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  public toSsrInlineStyleObject(): Record<string, string> {
    return {
      '--pk-primary': this.props.primaryColorHex,
      '--pk-primary-hover': this.props.primaryHoverHex,
      '--pk-sidebar-bg': this.props.sidebarBgHex,
      '--pk-surface-canvas': this.props.surfaceCanvasHex,
      '--pk-surface-card': this.props.surfaceCardHex,
      '--pk-radius': this.props.borderRadiusRem,
    };
  }

  public toConfig(): WorkstationThemeConfig {
    return { ...this.props };
  }
}
