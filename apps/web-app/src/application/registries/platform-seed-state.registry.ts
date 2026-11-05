import type { ClientDatabaseTenantRecord } from '../../domain/contracts/platform-hub.contract.js';

/**
 * Estado inicial limpio:
 * - Cero empresas random pre-creadas.
 * - En Día 0 solo existe `db_version_prueba` (usada exclusivamente por el apartado Demo)
 *   además de `proveko_control_db` (Base Principal con los 4 roles: superadmin, desarrollador, auxiliar, cliente).
 * - Cada cliente real se crea cuando completa "Registra tu Negocio" o cuando lo registra el SuperAdmin.
 */
export const INITIAL_CLIENT_DATABASES: readonly ClientDatabaseTenantRecord[] = [
  {
    tenantId: 'tnt-demo',
    companyName: 'Entorno Demo Oficial Proveko',
    nit: '900.000.000-1',
    businessTypeId: 'agro-logistica-bascula',
    businessTypeName: 'Entorno Demo Integral (Todos los Módulos Principales)',
    dbName: 'db_version_prueba',
    dbHost: 'db',
    dbPort: 5432,
    paymentStatus: 'DEMO',
    monthlyUsd: 0,
    adminUsername: 'demo',
    adminPasswordHint: 'DemoProveko2026!',
    maxRolesAllowed: 6,
    maxUsersAllowed: 15,
    activePrincipalServices: ['srv-invoicing', 'srv-inventory', 'srv-gastro', 'srv-hotel', 'srv-crm', 'srv-finance'],
    activeSubmodules: [
      'mod-pos', 'mod-dian', 'mod-quotes',
      'mod-stock', 'mod-warehouses', 'mod-transfers', 'mod-recipes', 'mod-lots', 'mod-scale',
      'mod-tables', 'mod-kds', 'mod-split',
      'mod-bookings', 'mod-tickets', 'mod-rooms',
      'mod-directory', 'mod-pipelines', 'mod-loyalty',
      'mod-cashbook', 'mod-arap', 'mod-puc',
    ],
    activeFeatures: [
      'comp-cashier-name', 'comp-tip', 'comp-line-discount',
      'comp-manager-signature', 'comp-carrier-select', 'comp-scale-tare',
      'comp-waiter-assign', 'comp-qr-ticket',
    ],
    internalRoles: [
      {
        roleId: 'rol-admin',
        name: 'Administrador General (Cuenta Admin)',
        description: 'Control completo de la base de datos de la empresa, roles internos y usuarios.',
        allowedSubmodules: ['*'],
      },
      {
        roleId: 'rol-cajero',
        name: 'Cajero y Facturador',
        description: 'Operación de Caja POS, Facturación Electrónica DIAN y Cotizaciones.',
        allowedSubmodules: ['mod-pos', 'mod-dian', 'mod-quotes', 'mod-directory'],
      },
      {
        roleId: 'rol-bodega',
        name: 'Encargado de Bodega y Báscula',
        description: 'Existencias, Bodegas, Solicitudes de Traslado, Lotes y Báscula Camionera.',
        allowedSubmodules: ['mod-stock', 'mod-warehouses', 'mod-transfers', 'mod-recipes', 'mod-lots', 'mod-scale'],
      },
      {
        roleId: 'rol-operador',
        name: 'Operador de Servicio / Taquilla',
        description: 'Salón de mesas, comandas KDS, reserva de cupos y emisión de tickets.',
        allowedSubmodules: ['mod-tables', 'mod-kds', 'mod-split', 'mod-bookings', 'mod-tickets', 'mod-rooms'],
      },
    ],
    internalUsers: [
      {
        userId: 'usr-demo-admin',
        username: 'demo',
        fullName: 'Administrador Demo Proveko',
        email: 'demo@proveko.com',
        internalRoleId: 'rol-admin',
        internalRoleName: 'Administrador General (Cuenta Admin)',
        passwordHint: 'DemoProveko2026!',
        isClientAdmin: true,
      },
    ],
  },
];

export const INITIAL_SUBMODULE_ROWS: Record<string, readonly (readonly string[])[]> = {
  'mod-pos': [
    ['POS-9001', 'Consumidor Final', 'Laura Gómez — Turno Mañana', 'Efectivo', '$ 148.500', 'Emitido'],
    ['POS-9002', 'Constructora Andina S.A.S.', 'Laura Gómez — Turno Mañana', 'Transferencia / QR', '$ 920.000', 'Emitido'],
  ],
  'mod-dian': [
    ['FEV-10421', 'Comercializadora del Valle S.A.S.', '901.452.110-4', '$ 4.850.000', 'CUFE Validado DIAN', 'Hoy 09:15'],
  ],
  'mod-quotes': [
    ['COT-308', 'Ingenios Unidos S.A.', '2026-11-30', 'Ing. Carlos Ruiz', '$ 12.400.000', 'Vigente'],
  ],
  'mod-stock': [
    ['INS-00104', 'Cemento Gris Estructural 50Kg', 'Bodega Central Principal', '420 Und', '50 Und', '$ 31.500'],
    ['INS-00219', 'Acero Figurado 1/2 Pulgada', 'Bodega Norte Punto Venta', '185 Und', '40 Und', '$ 42.000'],
  ],
  'mod-warehouses': [
    ['BOD-CENTRAL-01', 'Bodega Central Principal', 'Barranquilla — Vía 40', '800 Ton / 240 Estibas', 'Firmado: Jorge Pardo', 'Activa'],
    ['BOD-NORTE-02', 'Bodega Norte Punto Venta', 'Cartagena — Mamonal', '450 Ton / 120 Estibas', 'Firmado: Andrés Mejía', 'Activa'],
  ],
  'mod-transfers': [
    ['TR-501', 'Bodega Central Principal', 'Bodega Norte Punto Venta', '120 Sacos Cemento 50Kg', 'Transportes Rápidos del Norte S.A.S.', 'Autorizado: Jorge Pardo'],
  ],
  'mod-recipes': [
    ['BOM-101', 'Mortero Premezclado Seco x 40Kg', 'Cemento (12Kg) + Arena Sílice (28Kg) + Aditivo (0.2Kg)', '1 Saco', '$ 18.900'],
  ],
  'mod-lots': [
    ['LOT-2026-901', 'Aditivo Impermeabilizante Industrial', 'Bodega Central Principal', '2027-06-15', '95 Cuñetes', 'Óptimo FEFO'],
  ],
  'mod-scale': [
    ['BAS-7741', 'SXT-942 / R-4481', 'TransCarga Pesada — Hernando Valencia', '52.400 Kg', '16.800 Kg', '35.600 Kg (35.60 Ton)'],
  ],
  'mod-tables': [
    ['Mesa 05 — Terraza', '4 Comensales', 'Mateo Ríos', '$ 186.000', 'Ocupada'],
  ],
  'mod-kds': [
    ['CMD-409', 'Mesa 05 — Terraza', '2x Lomito término 3/4, 2x Jugo Natural', 'Parrilla y Calientes', 'En Preparación (6 min)'],
  ],
  'mod-split': [
    ['DIV-112', 'Mesa 05 — Terraza', 'Partes Iguales', '4 Pagadores', '$ 46.500 c/u'],
  ],
  'mod-bookings': [
    ['RES-801', 'Valeria Mendoza', 'Salón Auditorio Empresarial', '2026-11-12 08:00 - 12:00', '40 Cupos', 'Confirmada'],
  ],
  'mod-tickets': [
    ['TCK-99201', 'Pase General Día', 'Santiago Ospina', 'QR-PK-99201', '$ 45.000', 'Válido en Portería'],
  ],
  'mod-rooms': [
    ['Habitación 304 — Ejecutiva', 'Camila Restrepo', '2 Noches', '$ 210.000 / noche', 'Check-In Activo'],
  ],
  'mod-directory': [
    ['901.452.110-4', 'Comercializadora del Valle S.A.S.', 'Cliente Corporativo', 'Cali — 315 890 1122', '$ 25.000.000'],
    ['900.771.220-8', 'Transportes Rápidos del Norte S.A.S.', 'Empresa Transportista', 'Barranquilla — 300 441 9080', '$ 0'],
  ],
  'mod-pipelines': [
    ['OP-204', 'Ingenios Unidos S.A.', 'Propuesta Enviada', 'Carlos Ruiz', '$ 28.000.000'],
  ],
  'mod-loyalty': [
    ['Diana Marcela Pineda', 'Oro Preferencial', '2.450 Puntos', 'Hoy', '5% Descuento Directo'],
  ],
  'mod-cashbook': [
    ['EGR-2041', 'Bancolombia Cuenta Corriente', 'Egreso / Pago', 'Pago Flete Transporte Nacional', 'Autorizado: Tesorería', '$ 1.450.000'],
  ],
  'mod-arap': [
    ['CXC-8810', 'Comercializadora del Valle S.A.S.', 'Cuenta por Cobrar (Cliente)', '2026-11-30', '$ 4.850.000', 'Al Día'],
  ],
  'mod-puc': [
    ['AST-9901', '130505 - Clientes Nacionales', '901.452.110-4', 'Causación Factura FEV-10421', '$ 4.850.000', 'Asentado'],
  ],
};
