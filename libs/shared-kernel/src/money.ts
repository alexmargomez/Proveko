import { Decimal } from 'decimal.js';

// Configuración financiera estricta: NUMERIC(19, 4) con redondeo comercial HALF_UP
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export class MoneyDecimal {
  private readonly value: Decimal;

  private constructor(val: Decimal | string | number) {
    this.value = new Decimal(val);
  }

  public static from(val: Decimal | string | number): MoneyDecimal {
    return new MoneyDecimal(val);
  }

  public static zero(): MoneyDecimal {
    return new MoneyDecimal('0.0000');
  }

  public add(other: MoneyDecimal): MoneyDecimal {
    return new MoneyDecimal(this.value.plus(other.value));
  }

  public sub(other: MoneyDecimal): MoneyDecimal {
    return new MoneyDecimal(this.value.minus(other.value));
  }

  public mul(factor: MoneyDecimal | string | number): MoneyDecimal {
    const f = factor instanceof MoneyDecimal ? factor.value : new Decimal(factor);
    return new MoneyDecimal(this.value.times(f));
  }

  public applyTaxRatePercent(ratePercent: string | number): MoneyDecimal {
    const rate = new Decimal(ratePercent).dividedBy(100);
    return new MoneyDecimal(this.value.times(rate));
  }

  public isNegative(): boolean {
    return this.value.isNegative();
  }

  public equals(other: MoneyDecimal): boolean {
    return this.toFixed4() === other.toFixed4();
  }

  /**
   * Representación exacta NUMERIC(19, 4) para PostgreSQL e IndexedDB POS Cart
   */
  public toFixed4(): string {
    return this.value.toFixed(4, Decimal.ROUND_HALF_UP);
  }

  /**
   * Representación monetaria estándar de 2 decimales para visualización tabular-nums
   */
  public toCurrencyFixed2(): string {
    return this.value.toFixed(2, Decimal.ROUND_HALF_UP);
  }
}
