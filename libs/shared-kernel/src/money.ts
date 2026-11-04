import { Decimal } from 'decimal.js';
import { PROVEKO_ERROR_CODES, ProvekoDomainError } from './errors.js';

// Instancia aislada sin mutar el prototipo global de Decimal.js
const DecimalStrict = Decimal.clone({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export class MoneyDecimal {
  private readonly value: Decimal;

  private constructor(val: Decimal | string | number, fieldName: string = 'amount') {
    if (
      val === undefined ||
      val === null ||
      (typeof val === 'string' && val.trim().length === 0)
    ) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Invalid or missing numeric value for "${fieldName}".`,
        { field: fieldName },
      );
    }

    try {
      const parsed = new DecimalStrict(val);
      if (!parsed.isFinite() || parsed.isNaN()) {
        throw new Error('Non-finite decimal');
      }
      this.value = parsed;
    } catch {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Malformed numeric value "${String(val)}" for "${fieldName}".`,
        { field: fieldName, received: String(val) },
      );
    }
  }

  public static from(
    val: Decimal | string | number,
    fieldName: string = 'amount',
  ): MoneyDecimal {
    return new MoneyDecimal(val, fieldName);
  }

  public static zero(): MoneyDecimal {
    return new MoneyDecimal('0.0000');
  }

  public assertPositive(fieldName: string): MoneyDecimal {
    if (this.value.lte(0)) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Field "${fieldName}" must be strictly greater than zero (> 0), received ${this.toFixed4()}.`,
        { field: fieldName, value: this.toFixed4() },
      );
    }
    return this;
  }

  public assertNonNegative(fieldName: string): MoneyDecimal {
    if (this.value.isNegative()) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Field "${fieldName}" cannot be negative (< 0), received ${this.toFixed4()}.`,
        { field: fieldName, value: this.toFixed4() },
      );
    }
    return this;
  }

  public add(other: MoneyDecimal): MoneyDecimal {
    return new MoneyDecimal(this.value.plus(other.value));
  }

  public sub(other: MoneyDecimal): MoneyDecimal {
    return new MoneyDecimal(this.value.minus(other.value));
  }

  public mul(factor: MoneyDecimal | string | number, fieldName: string = 'factor'): MoneyDecimal {
    const f =
      factor instanceof MoneyDecimal
        ? factor.value
        : MoneyDecimal.from(factor, fieldName).value;
    return new MoneyDecimal(this.value.times(f));
  }

  public applyTaxRatePercent(
    ratePercent: string | number,
    fieldName: string = 'taxRatePercent',
  ): MoneyDecimal {
    const rateDecimal = MoneyDecimal.from(ratePercent, fieldName).assertNonNegative(fieldName);
    const rate = rateDecimal.value.dividedBy(100);
    return new MoneyDecimal(this.value.times(rate));
  }

  public isNegative(): boolean {
    return this.value.isNegative();
  }

  public isZero(): boolean {
    return this.value.isZero();
  }

  public gt(other: MoneyDecimal): boolean {
    return this.value.gt(other.value);
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
