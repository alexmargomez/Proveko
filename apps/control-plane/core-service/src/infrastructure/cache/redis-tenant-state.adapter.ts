import type { EncryptedConnectionEnvelope } from '@proveko/crypto-vault';
import type { TenantStateCachePort } from '../../application/ports/outbound.ports.js';

/**
 * Script Lua Monotónico oficial para Redis [P1-04]
 * Garantiza que `tenant:{id}:sub_ver` solo avance hacia adelante (`math.max`),
 * impidiendo que eventos o workers rezagados reviertan la versión de permisos de un inquilino.
 */
export const MONOTONIC_SUB_VER_LUA_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current or tonumber(ARGV[1]) > tonumber(current) then
  redis.call('SET', KEYS[1], ARGV[1])
  return tonumber(ARGV[1])
end
return tonumber(current)
`.trim();

/**
 * Adaptador de estado de inquilinos con lógica monotónica idéntica al script Lua de Redis
 * y almacenamiento exclusivo del sobre cifrado KEK+DEK (`EncryptedConnectionEnvelope`).
 */
export class MonotonicTenantStateCacheAdapter implements TenantStateCachePort {
  private readonly subVerMap = new Map<string, number>();
  private readonly envelopeCache = new Map<string, string>();

  public async setMonotonicSubVer(tenantId: string, newSubVer: number): Promise<number> {
    const current = this.subVerMap.get(tenantId);
    if (current === undefined || newSubVer > current) {
      this.subVerMap.set(tenantId, newSubVer);
      return newSubVer;
    }
    return current;
  }

  public async getCurrentSubVer(tenantId: string): Promise<number | null> {
    return this.subVerMap.get(tenantId) ?? null;
  }

  public async cacheEncryptedEnvelope(
    tenantId: string,
    envelope: EncryptedConnectionEnvelope,
  ): Promise<void> {
    // Asegurar que NUNCA se guarde un objeto con contraseñas en texto plano en caché
    const serialized = JSON.stringify(envelope);
    this.envelopeCache.set(tenantId, serialized);
  }

  public async getCachedEncryptedEnvelope(
    tenantId: string,
  ): Promise<EncryptedConnectionEnvelope | null> {
    const raw = this.envelopeCache.get(tenantId);
    if (!raw) return null;
    return JSON.parse(raw) as EncryptedConnectionEnvelope;
  }
}
