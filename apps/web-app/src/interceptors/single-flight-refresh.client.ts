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
 * Cliente HTTP de la Estación de Trabajo Proveko con *Single-Flight Silent Refresh* (`[P3-01]`):
 * Si 10 peticiones concurrentes reciben `401 ERR_SUB_VER_STALE` porque la empresa activó
 * un nuevo microservicio en caliente (ej. Facturación Electrónica DIAN), deduplica el refresh
 * en 1 sola llamada de red, reconcilia el carrito POS sin perder ningún producto y reintenta todas las peticiones.
 */
export class ProvekoWorkstationHttpClient {
  private currentAccessToken: string;
  private currentClaims: ProvekoJwtClaims;
  private inflightRefreshPromise: Promise<{
    newAccessToken: string;
    newClaims: ProvekoJwtClaims;
  }> | null = null;
  public refreshCallCount = 0;

  constructor(
    initialToken: string,
    initialClaims: ProvekoJwtClaims,
    private readonly refreshPort: TokenRefreshPort,
    private activePosCart?: PosCartStateSnapshot,
  ) {
    this.currentAccessToken = initialToken;
    this.currentClaims = initialClaims;
  }

  public getActivePosCart(): PosCartStateSnapshot | undefined {
    return this.activePosCart;
  }

  public getCurrentClaims(): ProvekoJwtClaims {
    return this.currentClaims;
  }

  public async executeWithSilentRefresh<T>(
    requestFn: (bearerToken: string) => Promise<GatewayHttpCallResponse<T>>,
  ): Promise<GatewayHttpCallResponse<T>> {
    const firstAttempt = await requestFn(`Bearer ${this.currentAccessToken}`);

    if (
      firstAttempt.status === 401 &&
      typeof firstAttempt.body === 'object' &&
      firstAttempt.body !== null &&
      (firstAttempt.body as { error_code?: string }).error_code ===
        PROVEKO_ERROR_CODES.ERR_SUB_VER_STALE
    ) {
      await this.performSingleFlightRefresh();
      return requestFn(`Bearer ${this.currentAccessToken}`);
    }

    return firstAttempt;
  }

  private async performSingleFlightRefresh(): Promise<void> {
    if (!this.inflightRefreshPromise) {
      this.refreshCallCount += 1;
      this.inflightRefreshPromise = this.refreshPort
        .refreshAccessToken()
        .then((res) => {
          this.currentAccessToken = res.newAccessToken;
          this.currentClaims = res.newClaims;
          if (this.activePosCart) {
            this.activePosCart = PosCartCapabilityReconciler.reconcileCartOnSubVerUpdate(
              this.activePosCart,
              res.newClaims,
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
