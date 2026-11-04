import { PROVEKO_ERROR_CODES, type ProvekoJwtClaims } from '@proveko/shared-kernel';
import { PosCartCapabilityReconciler, type PosCartStateSnapshot } from '@proveko/ui-kit';

export interface GatewayHttpCallResponse<T = unknown> {
  status: number;
  body: T;
}

export interface TokenRefreshPort {
  refreshAccessToken(): Promise<{
    newAccessToken: string;
    newClaims: ProvekoJwtClaims;
  }>;
}

/**
 * Puerto de almacenamiento del carrito POS (SOLID DIP + SRP)
 * Permite persistir y reconciliar el carrito en memoria, IndexedDB o estado externo
 * sin acoplar el interceptor HTTP a la estructura interna del carrito.
 */
export interface CartStoragePort {
  getCart(): PosCartStateSnapshot | undefined;
  setCart(cart: PosCartStateSnapshot | undefined): void;
}

export class InMemoryCartStorageAdapter implements CartStoragePort {
  constructor(private cart?: PosCartStateSnapshot) {}

  public getCart(): PosCartStateSnapshot | undefined {
    return this.cart;
  }

  public setCart(cart: PosCartStateSnapshot | undefined): void {
    this.cart = cart;
  }
}

function isStaleSubVerErrorResponse(body: unknown): body is { error_code: string } {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.error_code === 'string' &&
    candidate.error_code === PROVEKO_ERROR_CODES.ERR_SUB_VER_STALE
  );
}

/**
 * Cliente HTTP de la Estación de Trabajo Proveko con *Single-Flight Silent Refresh* (`[P3-01]`):
 * Si 10 peticiones concurrentes reciben `401 ERR_SUB_VER_STALE` porque la empresa activó
 * un nuevo módulo en caliente (ej. Facturación Electrónica DIAN), deduplica el refresh
 * en 1 sola llamada de red, reconcilia el carrito POS sin perder ningún producto y reintenta todas las peticiones.
 */
export class ProvekoWorkstationHttpClient {
  private currentAccessToken: string;
  private currentClaims: ProvekoJwtClaims;
  private readonly cartStorage: CartStoragePort;
  private inflightRefreshPromise: Promise<{
    newAccessToken: string;
    newClaims: ProvekoJwtClaims;
  }> | null = null;
  public refreshCallCount = 0;

  constructor(
    initialToken: string,
    initialClaims: ProvekoJwtClaims,
    private readonly refreshPort: TokenRefreshPort,
    cartOrStorage?: PosCartStateSnapshot | CartStoragePort,
  ) {
    this.currentAccessToken = initialToken;
    this.currentClaims = initialClaims;
    if (
      cartOrStorage &&
      typeof (cartOrStorage as CartStoragePort).getCart === 'function' &&
      typeof (cartOrStorage as CartStoragePort).setCart === 'function'
    ) {
      this.cartStorage = cartOrStorage as CartStoragePort;
    } else {
      this.cartStorage = new InMemoryCartStorageAdapter(
        cartOrStorage as PosCartStateSnapshot | undefined,
      );
    }
  }

  public getActivePosCart(): PosCartStateSnapshot | undefined {
    return this.cartStorage.getCart();
  }

  public getCurrentClaims(): ProvekoJwtClaims {
    return this.currentClaims;
  }

  public async executeWithSilentRefresh<T>(
    requestFn: (bearerToken: string) => Promise<GatewayHttpCallResponse<T>>,
  ): Promise<GatewayHttpCallResponse<T>> {
    const tokenUsedInAttempt = this.currentAccessToken;
    const firstAttempt = await requestFn(`Bearer ${tokenUsedInAttempt}`);

    if (firstAttempt.status === 401 && isStaleSubVerErrorResponse(firstAttempt.body)) {
      await this.performSingleFlightRefresh(tokenUsedInAttempt);
      return requestFn(`Bearer ${this.currentAccessToken}`);
    }

    return firstAttempt;
  }

  private async performSingleFlightRefresh(staleTokenFromCaller: string): Promise<void> {
    // Si otra petición concurrente ya completó la rotación del token mientras esta fallaba,
    // no disparamos una segunda llamada innecesaria al servidor de identidad.
    if (this.currentAccessToken !== staleTokenFromCaller && !this.inflightRefreshPromise) {
      return;
    }

    if (!this.inflightRefreshPromise) {
      this.refreshCallCount += 1;
      this.inflightRefreshPromise = this.refreshPort
        .refreshAccessToken()
        .then((res) => {
          this.currentAccessToken = res.newAccessToken;
          this.currentClaims = res.newClaims;
          const currentCart = this.cartStorage.getCart();
          if (currentCart) {
            this.cartStorage.setCart(
              PosCartCapabilityReconciler.reconcileCartOnSubVerUpdate(currentCart, res.newClaims),
            );
          }
          return res;
        })
        .finally(() => {
          this.inflightRefreshPromise = null;
        });
    }

    await this.inflightRefreshPromise;
  }
}

