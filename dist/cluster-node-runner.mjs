import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// apps/api-gateway/src/cluster-node-runner.ts
import { existsSync as existsSync3 } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// libs/shared-kernel/src/catalog.types.ts
var SEED_SERVICES_CATALOG = [
  {
    key: "srv:crm",
    name: "Clientes y Comercial (CRM)",
    description: "Contenedor Gatekeeper de terceros fiscales, clientes, proveedores y embudos",
    schemaName: "srv_crm",
    displayOrder: 1
  },
  {
    key: "srv:invoicing",
    name: "Facturaci\xF3n y Ventas",
    description: "Contenedor Gatekeeper de caja POS, recibos internos, facturaci\xF3n DIAN y cotizaciones",
    schemaName: "srv_invoicing",
    displayOrder: 2
  },
  {
    key: "srv:inventory",
    name: "Inventarios y Log\xEDstica",
    description: "Contenedor Gatekeeper de kardex, bodegas, recetas/escandallos, lotes FEFO y traslados",
    schemaName: "srv_inventory",
    displayOrder: 3
  },
  {
    key: "srv:gastro",
    name: "Operaci\xF3n Gastron\xF3mica",
    description: "Contenedor Gatekeeper de salones, mesas, comandas de cocina KDS y divisi\xF3n de cuentas",
    schemaName: "srv_gastro",
    displayOrder: 4
  },
  {
    key: "srv:hotel",
    name: "Hoteler\xEDa y Alojamiento",
    description: "Contenedor Gatekeeper de habitaciones, reservas, recepci\xF3n y cargos a folio de hu\xE9sped",
    schemaName: "srv_hotel",
    displayOrder: 5
  },
  {
    key: "srv:finance",
    name: "Finanzas y Contabilidad",
    description: "Contenedor Gatekeeper de tesorer\xEDa, cartera CxC/CxP y contabilidad de partida doble PUC/NIIF",
    schemaName: "srv_finance",
    displayOrder: 6
  }
];
var SEED_MICROSERVICES_CATALOG = [
  {
    key: "ms:crm-directory",
    parentService: "srv:crm",
    name: "Directorio de Terceros y Clientes",
    subgroup: "Base Comercial",
    tablePrefix: "dir_",
    requiresServices: ["srv:crm"],
    requiresMicroservices: [],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "25000.0000"
  },
  {
    key: "ms:crm-pipelines",
    parentService: "srv:crm",
    name: "Embudos de Venta y Oportunidades",
    subgroup: "Gesti\xF3n Comercial",
    tablePrefix: "pip_",
    requiresServices: ["srv:crm"],
    requiresMicroservices: ["ms:crm-directory"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "35000.0000"
  },
  {
    key: "ms:crm-loyalty",
    parentService: "srv:crm",
    name: "Fidelizaci\xF3n, Puntos y Membres\xEDas",
    subgroup: "Retenci\xF3n",
    tablePrefix: "loy_",
    requiresServices: ["srv:crm"],
    requiresMicroservices: ["ms:crm-directory"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "30000.0000"
  },
  {
    key: "ms:invoicing-pos",
    parentService: "srv:invoicing",
    name: "Caja R\xE1pida POS y Turnos",
    subgroup: "Punto de Venta",
    tablePrefix: "pos_",
    requiresServices: ["srv:invoicing"],
    requiresMicroservices: ["ms:crm-directory"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "45000.0000"
  },
  {
    key: "ms:invoicing-simple-receipt",
    parentService: "srv:invoicing",
    name: "Recibo Interno / Cuenta de Cobro No Fiscal",
    subgroup: "Emisi\xF3n Documental",
    tablePrefix: "rcp_",
    requiresServices: ["srv:invoicing"],
    requiresMicroservices: ["ms:invoicing-pos"],
    mutexGroup: "fiscal_document_emitter",
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "15000.0000"
  },
  {
    key: "ms:invoicing-electronic-dian",
    parentService: "srv:invoicing",
    name: "Facturaci\xF3n Electr\xF3nica DIAN UBL 2.1",
    subgroup: "Emisi\xF3n Fiscal",
    tablePrefix: "dian_",
    requiresServices: ["srv:invoicing"],
    requiresMicroservices: ["ms:invoicing-pos", "ms:crm-directory"],
    mutexGroup: "fiscal_document_emitter",
    supersedes: ["ms:invoicing-simple-receipt"],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "65000.0000"
  },
  {
    key: "ms:invoicing-quotes",
    parentService: "srv:invoicing",
    name: "Cotizaciones, Pedidos y Remisiones",
    subgroup: "Preventa",
    tablePrefix: "quo_",
    requiresServices: ["srv:invoicing"],
    requiresMicroservices: ["ms:crm-directory"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "25000.0000"
  },
  {
    key: "ms:inventory-stock",
    parentService: "srv:inventory",
    name: "Kardex y Existencias Multi-Bodega",
    subgroup: "Bodegas y Kardex",
    tablePrefix: "stk_",
    requiresServices: ["srv:inventory"],
    requiresMicroservices: [],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "45000.0000"
  },
  {
    key: "ms:inventory-recipes",
    parentService: "srv:inventory",
    name: "Recetas, Escandallos y Explosi\xF3n de Insumos",
    subgroup: "Transformaci\xF3n",
    tablePrefix: "rec_",
    requiresServices: ["srv:inventory"],
    requiresMicroservices: ["ms:inventory-stock"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "40000.0000"
  },
  {
    key: "ms:inventory-lots",
    parentService: "srv:inventory",
    name: "Control de Lotes, Seriales y Vencimientos FEFO",
    subgroup: "Trazabilidad",
    tablePrefix: "lot_",
    requiresServices: ["srv:inventory"],
    requiresMicroservices: ["ms:inventory-stock"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "40000.0000"
  },
  {
    key: "ms:inventory-transfers",
    parentService: "srv:inventory",
    name: "Traslados entre Bodegas y Sedes",
    subgroup: "Bodegas y Kardex",
    tablePrefix: "trf_",
    requiresServices: ["srv:inventory"],
    requiresMicroservices: ["ms:inventory-stock"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "25000.0000"
  },
  {
    key: "ms:gastro-tables",
    parentService: "srv:gastro",
    name: "Mapa de Salones, Terrazas y Mesas",
    subgroup: "Atenci\xF3n en Sal\xF3n",
    tablePrefix: "tbl_",
    requiresServices: ["srv:gastro"],
    requiresMicroservices: ["ms:invoicing-pos"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "35000.0000"
  },
  {
    key: "ms:gastro-kds",
    parentService: "srv:gastro",
    name: "Comandas Digitales Cocina y Barra (KDS)",
    subgroup: "Producci\xF3n Gastron\xF3mica",
    tablePrefix: "kds_",
    requiresServices: ["srv:gastro"],
    requiresMicroservices: ["ms:gastro-tables"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "35000.0000"
  },
  {
    key: "ms:gastro-split-check",
    parentService: "srv:gastro",
    name: "Divisi\xF3n de Cuentas, Propinas y Cortes\xEDas",
    subgroup: "Atenci\xF3n en Sal\xF3n",
    tablePrefix: "spl_",
    requiresServices: ["srv:gastro"],
    requiresMicroservices: ["ms:gastro-tables", "ms:invoicing-pos"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "20000.0000"
  },
  {
    key: "ms:hotel-rooms",
    parentService: "srv:hotel",
    name: "Inventario de Habitaciones y Housekeeping",
    subgroup: "Alojamiento",
    tablePrefix: "rom_",
    requiresServices: ["srv:hotel"],
    requiresMicroservices: [],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "50000.0000"
  },
  {
    key: "ms:hotel-bookings",
    parentService: "srv:hotel",
    name: "Calendario de Reservas y Ocupaci\xF3n",
    subgroup: "Reservas",
    tablePrefix: "bkg_",
    requiresServices: ["srv:hotel"],
    requiresMicroservices: ["ms:hotel-rooms", "ms:crm-directory"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "45000.0000"
  },
  {
    key: "ms:hotel-frontdesk",
    parentService: "srv:hotel",
    name: "Recepci\xF3n Check-in/out y Folio de Hu\xE9sped",
    subgroup: "Recepci\xF3n",
    tablePrefix: "fdk_",
    requiresServices: ["srv:hotel"],
    requiresMicroservices: ["ms:hotel-rooms", "ms:invoicing-pos", "ms:crm-directory"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "55000.0000"
  },
  {
    key: "ms:finance-cashbook",
    parentService: "srv:finance",
    name: "Libro Simple de Ingresos y Gastos de Caja",
    subgroup: "Tesorer\xEDa",
    tablePrefix: "csh_",
    requiresServices: ["srv:finance"],
    requiresMicroservices: [],
    mutexGroup: "accounting_ledger_engine",
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "20000.0000"
  },
  {
    key: "ms:finance-ar-ap",
    parentService: "srv:finance",
    name: "Cartera: Cuentas por Cobrar y Cuentas por Pagar",
    subgroup: "Cartera",
    tablePrefix: "arp_",
    requiresServices: ["srv:finance"],
    requiresMicroservices: ["ms:crm-directory"],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "35000.0000"
  },
  {
    key: "ms:finance-accounting-puc",
    parentService: "srv:finance",
    name: "Contabilidad de Partida Doble PUC / NIIF",
    subgroup: "Contabilidad Legal",
    tablePrefix: "puc_",
    requiresServices: ["srv:finance"],
    requiresMicroservices: ["ms:crm-directory"],
    mutexGroup: "accounting_ledger_engine",
    supersedes: ["ms:finance-cashbook"],
    onSupersedeMode: "readonly_archive",
    baseMonthlyPriceCop: "75000.0000"
  }
];
var SEED_INDUSTRY_PRESETS = [
  {
    key: "preset:gastro-bar-restaurant",
    name: "Bar, Restaurante y Cafeter\xEDa",
    targetAudience: "Restaurantes, gastrobares, caf\xE9s y dark kitchens",
    services: ["srv:crm", "srv:invoicing", "srv:inventory", "srv:gastro"],
    microservices: [
      "ms:crm-directory",
      "ms:invoicing-pos",
      "ms:invoicing-simple-receipt",
      "ms:inventory-stock",
      "ms:inventory-recipes",
      "ms:gastro-tables",
      "ms:gastro-kds",
      "ms:gastro-split-check"
    ],
    demoSeedProfile: "gastro_full_demo"
  },
  {
    key: "preset:retail-commerce-dian",
    name: "Comercio, Ferreter\xEDa y Retail DIAN",
    targetAudience: "Almacenes, ferreter\xEDas, tiendas y comercios facturadores electr\xF3nicos",
    services: ["srv:crm", "srv:invoicing", "srv:inventory", "srv:finance"],
    microservices: [
      "ms:crm-directory",
      "ms:invoicing-pos",
      "ms:invoicing-electronic-dian",
      "ms:invoicing-quotes",
      "ms:inventory-stock",
      "ms:inventory-transfers",
      "ms:finance-cashbook",
      "ms:finance-ar-ap"
    ],
    demoSeedProfile: "retail_dian_demo"
  },
  {
    key: "preset:hotel-hospitality",
    name: "Hotel, Hostal y Alojamiento",
    targetAudience: "Hoteles, hostales y apartahoteles con consumo a habitaci\xF3n",
    services: ["srv:crm", "srv:invoicing", "srv:hotel", "srv:finance"],
    microservices: [
      "ms:crm-directory",
      "ms:invoicing-pos",
      "ms:invoicing-electronic-dian",
      "ms:hotel-rooms",
      "ms:hotel-bookings",
      "ms:hotel-frontdesk",
      "ms:finance-ar-ap"
    ],
    demoSeedProfile: "hotel_folio_demo"
  },
  {
    key: "preset:distributor-pharma-lots",
    name: "Distribuidora, Alimentos y Farmacia (FEFO)",
    targetAudience: "Distribuidoras mayoristas, droguer\xEDas y comercializadoras con lotes",
    services: ["srv:crm", "srv:invoicing", "srv:inventory", "srv:finance"],
    microservices: [
      "ms:crm-directory",
      "ms:invoicing-pos",
      "ms:invoicing-electronic-dian",
      "ms:invoicing-quotes",
      "ms:inventory-stock",
      "ms:inventory-lots",
      "ms:inventory-transfers",
      "ms:finance-ar-ap",
      "ms:finance-accounting-puc"
    ],
    demoSeedProfile: "distributor_lots_demo"
  }
];
function normalizeParentMicroserviceKey(key) {
  if (key.startsWith("ms:") && !key.includes("-")) {
    return `srv:${key.slice(3)}`;
  }
  return key;
}
function normalizeModuleKey(key) {
  if (key.startsWith("mod:")) {
    return `ms:${key.slice(4)}`;
  }
  return key;
}
function toParentMicroserviceNotation(key) {
  if (key.startsWith("srv:")) {
    return `ms:${key.slice(4)}`;
  }
  return key;
}
function toModuleNotation(key) {
  if (key.startsWith("ms:")) {
    return `mod:${key.slice(3)}`;
  }
  return key;
}

// libs/shared-kernel/src/errors.ts
var PROVEKO_ERROR_CODES = {
  ERR_SUB_VER_STALE: "ERR_SUB_VER_STALE",
  ERR_TOKEN_EXPIRED: "ERR_TOKEN_EXPIRED",
  ERR_TOKEN_INVALID: "ERR_TOKEN_INVALID",
  ERR_PARENT_SERVICE_DISABLED: "ERR_PARENT_SERVICE_DISABLED",
  ERR_PARENT_MICROSERVICE_DISABLED: "ERR_PARENT_MICROSERVICE_DISABLED",
  ERR_MICROSERVICE_DISABLED: "ERR_MICROSERVICE_DISABLED",
  ERR_MODULE_DISABLED: "ERR_MODULE_DISABLED",
  ERR_MICROSERVICE_READONLY_ARCHIVE: "ERR_MICROSERVICE_READONLY_ARCHIVE",
  ERR_MODULE_READONLY_ARCHIVE: "ERR_MODULE_READONLY_ARCHIVE",
  ERR_MUTEX_GROUP_CONFLICT: "ERR_MUTEX_GROUP_CONFLICT",
  ERR_DEPENDENT_MICROSERVICES_ACTIVE: "ERR_DEPENDENT_MICROSERVICES_ACTIVE",
  ERR_MISSING_PREREQUISITES: "ERR_MISSING_PREREQUISITES",
  ERR_BRANCH_FORBIDDEN: "ERR_BRANCH_FORBIDDEN",
  ERR_INVALID_THEME_TOKEN: "ERR_INVALID_THEME_TOKEN",
  ERR_AUTH_BUSY_BULKHEAD: "ERR_AUTH_BUSY_BULKHEAD",
  ERR_CELL_CAPACITY_EXHAUSTED: "ERR_CELL_CAPACITY_EXHAUSTED",
  ERR_SANDBOX_POOL_EMPTY: "ERR_SANDBOX_POOL_EMPTY",
  ERR_NOT_FOUND: "ERR_NOT_FOUND",
  ERR_VALIDATION_FAILED: "ERR_VALIDATION_FAILED",
  ERR_RATE_LIMIT_EXCEEDED: "ERR_RATE_LIMIT_EXCEEDED",
  ERR_UPSTREAM_UNAVAILABLE: "ERR_UPSTREAM_UNAVAILABLE",
  ERR_PAYMENT_AMOUNT_MISMATCH: "ERR_PAYMENT_AMOUNT_MISMATCH",
  ERR_ACCOUNTING_IMBALANCE: "ERR_ACCOUNTING_IMBALANCE",
  ERR_MIGRATION_CHECKSUM_DRIFT: "ERR_MIGRATION_CHECKSUM_DRIFT",
  ERR_MIGRATION_LOCK_TIMEOUT: "ERR_MIGRATION_LOCK_TIMEOUT",
  ERR_BACKUP_INTEGRITY_FAILED: "ERR_BACKUP_INTEGRITY_FAILED",
  ERR_CLUSTER_SIGNATURE_INVALID: "ERR_CLUSTER_SIGNATURE_INVALID"
};
var ProvekoDomainError = class extends Error {
  statusCode;
  errorCode;
  metadata;
  constructor(errorCode, statusCode, message, metadata) {
    super(message);
    this.name = "ProvekoDomainError";
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.metadata = metadata;
  }
  toProblemDetails() {
    return {
      type: `https://errors.proveko.com/${this.errorCode.toLowerCase()}`,
      title: this.errorCode,
      status: this.statusCode,
      detail: this.message,
      error_code: this.errorCode,
      ...this.metadata ? { metadata: this.metadata } : {}
    };
  }
};

// node_modules/decimal.js/decimal.mjs
var EXP_LIMIT = 9e15;
var MAX_DIGITS = 1e9;
var NUMERALS = "0123456789abcdef";
var LN10 = "2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058";
var PI = "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789";
var DEFAULTS = {
  // These values must be integers within the stated ranges (inclusive).
  // Most of these values can be changed at run-time using the `Decimal.config` method.
  // The maximum number of significant digits of the result of a calculation or base conversion.
  // E.g. `Decimal.config({ precision: 20 });`
  precision: 20,
  // 1 to MAX_DIGITS
  // The rounding mode used when rounding to `precision`.
  //
  // ROUND_UP         0 Away from zero.
  // ROUND_DOWN       1 Towards zero.
  // ROUND_CEIL       2 Towards +Infinity.
  // ROUND_FLOOR      3 Towards -Infinity.
  // ROUND_HALF_UP    4 Towards nearest neighbour. If equidistant, up.
  // ROUND_HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
  // ROUND_HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
  // ROUND_HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
  // ROUND_HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
  //
  // E.g.
  // `Decimal.rounding = 4;`
  // `Decimal.rounding = Decimal.ROUND_HALF_UP;`
  rounding: 4,
  // 0 to 8
  // The modulo mode used when calculating the modulus: a mod n.
  // The quotient (q = a / n) is calculated according to the corresponding rounding mode.
  // The remainder (r) is calculated as: r = a - n * q.
  //
  // UP         0 The remainder is positive if the dividend is negative, else is negative.
  // DOWN       1 The remainder has the same sign as the dividend (JavaScript %).
  // FLOOR      3 The remainder has the same sign as the divisor (Python %).
  // HALF_EVEN  6 The IEEE 754 remainder function.
  // EUCLID     9 Euclidian division. q = sign(n) * floor(a / abs(n)). Always positive.
  //
  // Truncated division (1), floored division (3), the IEEE 754 remainder (6), and Euclidian
  // division (9) are commonly used for the modulus operation. The other rounding modes can also
  // be used, but they may not give useful results.
  modulo: 1,
  // 0 to 9
  // The exponent value at and beneath which `toString` returns exponential notation.
  // JavaScript numbers: -7
  toExpNeg: -7,
  // 0 to -EXP_LIMIT
  // The exponent value at and above which `toString` returns exponential notation.
  // JavaScript numbers: 21
  toExpPos: 21,
  // 0 to EXP_LIMIT
  // The minimum exponent value, beneath which underflow to zero occurs.
  // JavaScript numbers: -324  (5e-324)
  minE: -EXP_LIMIT,
  // -1 to -EXP_LIMIT
  // The maximum exponent value, above which overflow to Infinity occurs.
  // JavaScript numbers: 308  (1.7976931348623157e+308)
  maxE: EXP_LIMIT,
  // 1 to EXP_LIMIT
  // Whether to use cryptographically-secure random number generation, if available.
  crypto: false
  // true/false
};
var inexact;
var quadrant;
var external = true;
var decimalError = "[DecimalError] ";
var invalidArgument = decimalError + "Invalid argument: ";
var precisionLimitExceeded = decimalError + "Precision limit exceeded";
var cryptoUnavailable = decimalError + "crypto unavailable";
var tag = "[object Decimal]";
var mathfloor = Math.floor;
var mathpow = Math.pow;
var isBinary = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i;
var isHex = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i;
var isOctal = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i;
var isDecimal = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
var BASE = 1e7;
var LOG_BASE = 7;
var MAX_SAFE_INTEGER = 9007199254740991;
var LN10_PRECISION = LN10.length - 1;
var PI_PRECISION = PI.length - 1;
var P = { toStringTag: tag };
P.absoluteValue = P.abs = function() {
  var x = new this.constructor(this);
  if (x.s < 0) x.s = 1;
  return finalise(x);
};
P.ceil = function() {
  return finalise(new this.constructor(this), this.e + 1, 2);
};
P.clampedTo = P.clamp = function(min2, max2) {
  var k, x = this, Ctor = x.constructor;
  min2 = new Ctor(min2);
  max2 = new Ctor(max2);
  if (!min2.s || !max2.s) return new Ctor(NaN);
  if (min2.gt(max2)) throw Error(invalidArgument + max2);
  k = x.cmp(min2);
  return k < 0 ? min2 : x.cmp(max2) > 0 ? max2 : new Ctor(x);
};
P.comparedTo = P.cmp = function(y) {
  var i, j, xdL, ydL, x = this, xd = x.d, yd = (y = new x.constructor(y)).d, xs = x.s, ys = y.s;
  if (!xd || !yd) {
    return !xs || !ys ? NaN : xs !== ys ? xs : xd === yd ? 0 : !xd ^ xs < 0 ? 1 : -1;
  }
  if (!xd[0] || !yd[0]) return xd[0] ? xs : yd[0] ? -ys : 0;
  if (xs !== ys) return xs;
  if (x.e !== y.e) return x.e > y.e ^ xs < 0 ? 1 : -1;
  xdL = xd.length;
  ydL = yd.length;
  for (i = 0, j = xdL < ydL ? xdL : ydL; i < j; ++i) {
    if (xd[i] !== yd[i]) return xd[i] > yd[i] ^ xs < 0 ? 1 : -1;
  }
  return xdL === ydL ? 0 : xdL > ydL ^ xs < 0 ? 1 : -1;
};
P.cosine = P.cos = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.d) return new Ctor(NaN);
  if (!x.d[0]) return new Ctor(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x = cosine(Ctor, toLessThanHalfPi(Ctor, x));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 3 ? x.neg() : x, pr, rm, true);
};
P.cubeRoot = P.cbrt = function() {
  var e, m, n, r, rep, s, sd, t, t3, t3plusx, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  external = false;
  s = x.s * mathpow(x.s * x, 1 / 3);
  if (!s || Math.abs(s) == 1 / 0) {
    n = digitsToString(x.d);
    e = x.e;
    if (s = (e - n.length + 1) % 3) n += s == 1 || s == -2 ? "0" : "00";
    s = mathpow(n, 1 / 3);
    e = mathfloor((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2));
    if (s == 1 / 0) {
      n = "5e" + e;
    } else {
      n = s.toExponential();
      n = n.slice(0, n.indexOf("e") + 1) + e;
    }
    r = new Ctor(n);
    r.s = x.s;
  } else {
    r = new Ctor(s.toString());
  }
  sd = (e = Ctor.precision) + 3;
  for (; ; ) {
    t = r;
    t3 = t.times(t).times(t);
    t3plusx = t3.plus(x);
    r = divide(t3plusx.plus(x).times(t), t3plusx.plus(t3), sd + 2, 1);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).times(t).eq(x)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).times(r).eq(x);
        }
        break;
      }
    }
  }
  external = true;
  return finalise(r, e, Ctor.rounding, m);
};
P.decimalPlaces = P.dp = function() {
  var w, d = this.d, n = NaN;
  if (d) {
    w = d.length - 1;
    n = (w - mathfloor(this.e / LOG_BASE)) * LOG_BASE;
    w = d[w];
    if (w) for (; w % 10 == 0; w /= 10) n--;
    if (n < 0) n = 0;
  }
  return n;
};
P.dividedBy = P.div = function(y) {
  return divide(this, new this.constructor(y));
};
P.dividedToIntegerBy = P.divToInt = function(y) {
  var x = this, Ctor = x.constructor;
  return finalise(divide(x, new Ctor(y), 0, 1, 1), Ctor.precision, Ctor.rounding);
};
P.equals = P.eq = function(y) {
  return this.cmp(y) === 0;
};
P.floor = function() {
  return finalise(new this.constructor(this), this.e + 1, 3);
};
P.greaterThan = P.gt = function(y) {
  return this.cmp(y) > 0;
};
P.greaterThanOrEqualTo = P.gte = function(y) {
  var k = this.cmp(y);
  return k == 1 || k === 0;
};
P.hyperbolicCosine = P.cosh = function() {
  var k, n, pr, rm, len, x = this, Ctor = x.constructor, one = new Ctor(1);
  if (!x.isFinite()) return new Ctor(x.s ? 1 / 0 : NaN);
  if (x.isZero()) return one;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
  Ctor.rounding = 1;
  len = x.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    n = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    n = "2.3283064365386962890625e-10";
  }
  x = taylorSeries(Ctor, 1, x.times(n), new Ctor(1), true);
  var cosh2_x, i = k, d8 = new Ctor(8);
  for (; i--; ) {
    cosh2_x = x.times(x);
    x = one.minus(cosh2_x.times(d8.minus(cosh2_x.times(d8))));
  }
  return finalise(x, Ctor.precision = pr, Ctor.rounding = rm, true);
};
P.hyperbolicSine = P.sinh = function() {
  var k, pr, rm, len, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
  Ctor.rounding = 1;
  len = x.d.length;
  if (len < 3) {
    x = taylorSeries(Ctor, 2, x, x, true);
  } else {
    k = 1.4 * Math.sqrt(len);
    k = k > 16 ? 16 : k | 0;
    x = x.times(1 / tinyPow(5, k));
    x = taylorSeries(Ctor, 2, x, x, true);
    var sinh2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
    for (; k--; ) {
      sinh2_x = x.times(x);
      x = x.times(d5.plus(sinh2_x.times(d16.times(sinh2_x).plus(d20))));
    }
  }
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(x, pr, rm, true);
};
P.hyperbolicTangent = P.tanh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(x.s);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 7;
  Ctor.rounding = 1;
  return divide(x.sinh(), x.cosh(), Ctor.precision = pr, Ctor.rounding = rm);
};
P.inverseCosine = P.acos = function() {
  var x = this, Ctor = x.constructor, k = x.abs().cmp(1), pr = Ctor.precision, rm = Ctor.rounding;
  if (k !== -1) {
    return k === 0 ? x.isNeg() ? getPi(Ctor, pr, rm) : new Ctor(0) : new Ctor(NaN);
  }
  if (x.isZero()) return getPi(Ctor, pr + 4, rm).times(0.5);
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x = new Ctor(1).minus(x).div(x.plus(1)).sqrt().atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(2);
};
P.inverseHyperbolicCosine = P.acosh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (x.lte(1)) return new Ctor(x.eq(1) ? 0 : NaN);
  if (!x.isFinite()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(Math.abs(x.e), x.sd()) + 4;
  Ctor.rounding = 1;
  external = false;
  x = x.times(x).minus(1).sqrt().plus(x);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.ln();
};
P.inverseHyperbolicSine = P.asinh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 2 * Math.max(Math.abs(x.e), x.sd()) + 6;
  Ctor.rounding = 1;
  external = false;
  x = x.times(x).plus(1).sqrt().plus(x);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.ln();
};
P.inverseHyperbolicTangent = P.atanh = function() {
  var pr, rm, wpr, xsd, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.e >= 0) return new Ctor(x.abs().eq(1) ? x.s / 0 : x.isZero() ? x : NaN);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  xsd = x.sd();
  if (Math.max(xsd, pr) < 2 * -x.e - 1) return finalise(new Ctor(x), pr, rm, true);
  Ctor.precision = wpr = xsd - x.e;
  x = divide(x.plus(1), new Ctor(1).minus(x), wpr + pr, 1);
  Ctor.precision = pr + 4;
  Ctor.rounding = 1;
  x = x.ln();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(0.5);
};
P.inverseSine = P.asin = function() {
  var halfPi, k, pr, rm, x = this, Ctor = x.constructor;
  if (x.isZero()) return new Ctor(x);
  k = x.abs().cmp(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (k !== -1) {
    if (k === 0) {
      halfPi = getPi(Ctor, pr + 4, rm).times(0.5);
      halfPi.s = x.s;
      return halfPi;
    }
    return new Ctor(NaN);
  }
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x = x.div(new Ctor(1).minus(x.times(x)).sqrt().plus(1)).atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(2);
};
P.inverseTangent = P.atan = function() {
  var i, j, k, n, px, t, r, wpr, x2, x = this, Ctor = x.constructor, pr = Ctor.precision, rm = Ctor.rounding;
  if (!x.isFinite()) {
    if (!x.s) return new Ctor(NaN);
    if (pr + 4 <= PI_PRECISION) {
      r = getPi(Ctor, pr + 4, rm).times(0.5);
      r.s = x.s;
      return r;
    }
  } else if (x.isZero()) {
    return new Ctor(x);
  } else if (x.abs().eq(1) && pr + 4 <= PI_PRECISION) {
    r = getPi(Ctor, pr + 4, rm).times(0.25);
    r.s = x.s;
    return r;
  }
  Ctor.precision = wpr = pr + 10;
  Ctor.rounding = 1;
  k = Math.min(28, wpr / LOG_BASE + 2 | 0);
  for (i = k; i; --i) x = x.div(x.times(x).plus(1).sqrt().plus(1));
  external = false;
  j = Math.ceil(wpr / LOG_BASE);
  n = 1;
  x2 = x.times(x);
  r = new Ctor(x);
  px = x;
  for (; i !== -1; ) {
    px = px.times(x2);
    t = r.minus(px.div(n += 2));
    px = px.times(x2);
    r = t.plus(px.div(n += 2));
    if (r.d[j] !== void 0) for (i = j; r.d[i] === t.d[i] && i--; ) ;
  }
  if (k) r = r.times(2 << k - 1);
  external = true;
  return finalise(r, Ctor.precision = pr, Ctor.rounding = rm, true);
};
P.isFinite = function() {
  return !!this.d;
};
P.isInteger = P.isInt = function() {
  return !!this.d && mathfloor(this.e / LOG_BASE) > this.d.length - 2;
};
P.isNaN = function() {
  return !this.s;
};
P.isNegative = P.isNeg = function() {
  return this.s < 0;
};
P.isPositive = P.isPos = function() {
  return this.s > 0;
};
P.isZero = function() {
  return !!this.d && this.d[0] === 0;
};
P.lessThan = P.lt = function(y) {
  return this.cmp(y) < 0;
};
P.lessThanOrEqualTo = P.lte = function(y) {
  return this.cmp(y) < 1;
};
P.logarithm = P.log = function(base) {
  var isBase10, d, denominator, k, inf, num, sd, r, arg = this, Ctor = arg.constructor, pr = Ctor.precision, rm = Ctor.rounding, guard = 5;
  if (base == null) {
    base = new Ctor(10);
    isBase10 = true;
  } else {
    base = new Ctor(base);
    d = base.d;
    if (base.s < 0 || !d || !d[0] || base.eq(1)) return new Ctor(NaN);
    isBase10 = base.eq(10);
  }
  d = arg.d;
  if (arg.s < 0 || !d || !d[0] || arg.eq(1)) {
    return new Ctor(d && !d[0] ? -1 / 0 : arg.s != 1 ? NaN : d ? 0 : 1 / 0);
  }
  if (isBase10) {
    if (d.length > 1) {
      inf = true;
    } else {
      for (k = d[0]; k % 10 === 0; ) k /= 10;
      inf = k !== 1;
    }
  }
  external = false;
  sd = pr + guard;
  num = naturalLogarithm(arg, sd);
  denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
  r = divide(num, denominator, sd, 1);
  if (checkRoundingDigits(r.d, k = pr, rm)) {
    do {
      sd += 10;
      num = naturalLogarithm(arg, sd);
      denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
      r = divide(num, denominator, sd, 1);
      if (!inf) {
        if (+digitsToString(r.d).slice(k + 1, k + 15) + 1 == 1e14) {
          r = finalise(r, pr + 1, 0);
        }
        break;
      }
    } while (checkRoundingDigits(r.d, k += 10, rm));
  }
  external = true;
  return finalise(r, pr, rm);
};
P.minus = P.sub = function(y) {
  var d, e, i, j, k, len, pr, rm, xd, xe, xLTy, yd, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.d) {
    if (!x.s || !y.s) y = new Ctor(NaN);
    else if (x.d) y.s = -y.s;
    else y = new Ctor(y.d || x.s !== y.s ? x : NaN);
    return y;
  }
  if (x.s != y.s) {
    y.s = -y.s;
    return x.plus(y);
  }
  xd = x.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (yd[0]) y.s = -y.s;
    else if (xd[0]) y = new Ctor(x);
    else return new Ctor(rm === 3 ? -0 : 0);
    return external ? finalise(y, pr, rm) : y;
  }
  e = mathfloor(y.e / LOG_BASE);
  xe = mathfloor(x.e / LOG_BASE);
  xd = xd.slice();
  k = xe - e;
  if (k) {
    xLTy = k < 0;
    if (xLTy) {
      d = xd;
      k = -k;
      len = yd.length;
    } else {
      d = yd;
      e = xe;
      len = xd.length;
    }
    i = Math.max(Math.ceil(pr / LOG_BASE), len) + 2;
    if (k > i) {
      k = i;
      d.length = 1;
    }
    d.reverse();
    for (i = k; i--; ) d.push(0);
    d.reverse();
  } else {
    i = xd.length;
    len = yd.length;
    xLTy = i < len;
    if (xLTy) len = i;
    for (i = 0; i < len; i++) {
      if (xd[i] != yd[i]) {
        xLTy = xd[i] < yd[i];
        break;
      }
    }
    k = 0;
  }
  if (xLTy) {
    d = xd;
    xd = yd;
    yd = d;
    y.s = -y.s;
  }
  len = xd.length;
  for (i = yd.length - len; i > 0; --i) xd[len++] = 0;
  for (i = yd.length; i > k; ) {
    if (xd[--i] < yd[i]) {
      for (j = i; j && xd[--j] === 0; ) xd[j] = BASE - 1;
      --xd[j];
      xd[i] += BASE;
    }
    xd[i] -= yd[i];
  }
  for (; xd[--len] === 0; ) xd.pop();
  for (; xd[0] === 0; xd.shift()) --e;
  if (!xd[0]) return new Ctor(rm === 3 ? -0 : 0);
  y.d = xd;
  y.e = getBase10Exponent(xd, e);
  return external ? finalise(y, pr, rm) : y;
};
P.modulo = P.mod = function(y) {
  var q, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.s || y.d && !y.d[0]) return new Ctor(NaN);
  if (!y.d || x.d && !x.d[0]) {
    return finalise(new Ctor(x), Ctor.precision, Ctor.rounding);
  }
  external = false;
  if (Ctor.modulo == 9) {
    q = divide(x, y.abs(), 0, 3, 1);
    q.s *= y.s;
  } else {
    q = divide(x, y, 0, Ctor.modulo, 1);
  }
  q = q.times(y);
  external = true;
  return x.minus(q);
};
P.naturalExponential = P.exp = function() {
  return naturalExponential(this);
};
P.naturalLogarithm = P.ln = function() {
  return naturalLogarithm(this);
};
P.negated = P.neg = function() {
  var x = new this.constructor(this);
  x.s = -x.s;
  return finalise(x);
};
P.plus = P.add = function(y) {
  var carry, d, e, i, k, len, pr, rm, xd, yd, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.d) {
    if (!x.s || !y.s) y = new Ctor(NaN);
    else if (!x.d) y = new Ctor(y.d || x.s === y.s ? x : NaN);
    return y;
  }
  if (x.s != y.s) {
    y.s = -y.s;
    return x.minus(y);
  }
  xd = x.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (!yd[0]) y = new Ctor(x);
    return external ? finalise(y, pr, rm) : y;
  }
  k = mathfloor(x.e / LOG_BASE);
  e = mathfloor(y.e / LOG_BASE);
  xd = xd.slice();
  i = k - e;
  if (i) {
    if (i < 0) {
      d = xd;
      i = -i;
      len = yd.length;
    } else {
      d = yd;
      e = k;
      len = xd.length;
    }
    k = Math.ceil(pr / LOG_BASE);
    len = k > len ? k + 1 : len + 1;
    if (i > len) {
      i = len;
      d.length = 1;
    }
    d.reverse();
    for (; i--; ) d.push(0);
    d.reverse();
  }
  len = xd.length;
  i = yd.length;
  if (len - i < 0) {
    i = len;
    d = yd;
    yd = xd;
    xd = d;
  }
  for (carry = 0; i; ) {
    carry = (xd[--i] = xd[i] + yd[i] + carry) / BASE | 0;
    xd[i] %= BASE;
  }
  if (carry) {
    xd.unshift(carry);
    ++e;
  }
  for (len = xd.length; xd[--len] == 0; ) xd.pop();
  y.d = xd;
  y.e = getBase10Exponent(xd, e);
  return external ? finalise(y, pr, rm) : y;
};
P.precision = P.sd = function(z) {
  var k, x = this;
  if (z !== void 0 && z !== !!z && z !== 1 && z !== 0) throw Error(invalidArgument + z);
  if (x.d) {
    k = getPrecision(x.d);
    if (z && x.e + 1 > k) k = x.e + 1;
  } else {
    k = NaN;
  }
  return k;
};
P.round = function() {
  var x = this, Ctor = x.constructor;
  return finalise(new Ctor(x), x.e + 1, Ctor.rounding);
};
P.sine = P.sin = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x = sine(Ctor, toLessThanHalfPi(Ctor, x));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant > 2 ? x.neg() : x, pr, rm, true);
};
P.squareRoot = P.sqrt = function() {
  var m, n, sd, r, rep, t, x = this, d = x.d, e = x.e, s = x.s, Ctor = x.constructor;
  if (s !== 1 || !d || !d[0]) {
    return new Ctor(!s || s < 0 && (!d || d[0]) ? NaN : d ? x : 1 / 0);
  }
  external = false;
  s = Math.sqrt(+x);
  if (s == 0 || s == 1 / 0) {
    n = digitsToString(d);
    if ((n.length + e) % 2 == 0) n += "0";
    s = Math.sqrt(n);
    e = mathfloor((e + 1) / 2) - (e < 0 || e % 2);
    if (s == 1 / 0) {
      n = "5e" + e;
    } else {
      n = s.toExponential();
      n = n.slice(0, n.indexOf("e") + 1) + e;
    }
    r = new Ctor(n);
  } else {
    r = new Ctor(s.toString());
  }
  sd = (e = Ctor.precision) + 3;
  for (; ; ) {
    t = r;
    r = t.plus(divide(x, t, sd + 2, 1)).times(0.5);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).eq(x)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).eq(x);
        }
        break;
      }
    }
  }
  external = true;
  return finalise(r, e, Ctor.rounding, m);
};
P.tangent = P.tan = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 10;
  Ctor.rounding = 1;
  x = x.sin();
  x.s = 1;
  x = divide(x, new Ctor(1).minus(x.times(x)).sqrt(), pr + 10, 0);
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 4 ? x.neg() : x, pr, rm, true);
};
P.times = P.mul = function(y) {
  var carry, e, i, k, r, rL, t, xdL, ydL, x = this, Ctor = x.constructor, xd = x.d, yd = (y = new Ctor(y)).d;
  y.s *= x.s;
  if (!xd || !xd[0] || !yd || !yd[0]) {
    return new Ctor(!y.s || xd && !xd[0] && !yd || yd && !yd[0] && !xd ? NaN : !xd || !yd ? y.s / 0 : y.s * 0);
  }
  e = mathfloor(x.e / LOG_BASE) + mathfloor(y.e / LOG_BASE);
  xdL = xd.length;
  ydL = yd.length;
  if (xdL < ydL) {
    r = xd;
    xd = yd;
    yd = r;
    rL = xdL;
    xdL = ydL;
    ydL = rL;
  }
  r = [];
  rL = xdL + ydL;
  for (i = rL; i--; ) r.push(0);
  for (i = ydL; --i >= 0; ) {
    carry = 0;
    for (k = xdL + i; k > i; ) {
      t = r[k] + yd[i] * xd[k - i - 1] + carry;
      r[k--] = t % BASE | 0;
      carry = t / BASE | 0;
    }
    r[k] = (r[k] + carry) % BASE | 0;
  }
  for (; !r[--rL]; ) r.pop();
  if (carry) ++e;
  else r.shift();
  y.d = r;
  y.e = getBase10Exponent(r, e);
  return external ? finalise(y, Ctor.precision, Ctor.rounding) : y;
};
P.toBinary = function(sd, rm) {
  return toStringBinary(this, 2, sd, rm);
};
P.toDecimalPlaces = P.toDP = function(dp, rm) {
  var x = this, Ctor = x.constructor;
  x = new Ctor(x);
  if (dp === void 0) return x;
  checkInt32(dp, 0, MAX_DIGITS);
  if (rm === void 0) rm = Ctor.rounding;
  else checkInt32(rm, 0, 8);
  return finalise(x, dp + x.e + 1, rm);
};
P.toExponential = function(dp, rm) {
  var str, x = this, Ctor = x.constructor;
  if (dp === void 0) {
    str = finiteToString(x, true);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x = finalise(new Ctor(x), dp + 1, rm);
    str = finiteToString(x, true, dp + 1);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toFixed = function(dp, rm) {
  var str, y, x = this, Ctor = x.constructor;
  if (dp === void 0) {
    str = finiteToString(x);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    y = finalise(new Ctor(x), dp + x.e + 1, rm);
    str = finiteToString(y, false, dp + y.e + 1);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toFraction = function(maxD) {
  var d, d0, d1, d2, e, k, n, n0, n1, pr, q, r, x = this, xd = x.d, Ctor = x.constructor;
  if (!xd) return new Ctor(x);
  n1 = d0 = new Ctor(1);
  d1 = n0 = new Ctor(0);
  d = new Ctor(d1);
  e = d.e = getPrecision(xd) - x.e - 1;
  k = e % LOG_BASE;
  d.d[0] = mathpow(10, k < 0 ? LOG_BASE + k : k);
  if (maxD == null) {
    maxD = e > 0 ? d : n1;
  } else {
    n = new Ctor(maxD);
    if (!n.isInt() || n.lt(n1)) throw Error(invalidArgument + n);
    maxD = n.gt(d) ? e > 0 ? d : n1 : n;
  }
  external = false;
  n = new Ctor(digitsToString(xd));
  pr = Ctor.precision;
  Ctor.precision = e = xd.length * LOG_BASE * 2;
  for (; ; ) {
    q = divide(n, d, 0, 1, 1);
    d2 = d0.plus(q.times(d1));
    if (d2.cmp(maxD) == 1) break;
    d0 = d1;
    d1 = d2;
    d2 = n1;
    n1 = n0.plus(q.times(d2));
    n0 = d2;
    d2 = d;
    d = n.minus(q.times(d2));
    n = d2;
  }
  d2 = divide(maxD.minus(d0), d1, 0, 1, 1);
  n0 = n0.plus(d2.times(n1));
  d0 = d0.plus(d2.times(d1));
  n0.s = n1.s = x.s;
  r = divide(n1, d1, e, 1).minus(x).abs().cmp(divide(n0, d0, e, 1).minus(x).abs()) < 1 ? [n1, d1] : [n0, d0];
  Ctor.precision = pr;
  external = true;
  return r;
};
P.toHexadecimal = P.toHex = function(sd, rm) {
  return toStringBinary(this, 16, sd, rm);
};
P.toNearest = function(y, rm) {
  var x = this, Ctor = x.constructor;
  x = new Ctor(x);
  if (y == null) {
    if (!x.d) return x;
    y = new Ctor(1);
    rm = Ctor.rounding;
  } else {
    y = new Ctor(y);
    if (rm === void 0) {
      rm = Ctor.rounding;
    } else {
      checkInt32(rm, 0, 8);
    }
    if (!x.d) return y.s ? x : y;
    if (!y.d) {
      if (y.s) y.s = x.s;
      return y;
    }
  }
  if (y.d[0]) {
    external = false;
    x = divide(x, y, 0, rm, 1).times(y);
    external = true;
    finalise(x);
  } else {
    y.s = x.s;
    x = y;
  }
  return x;
};
P.toNumber = function() {
  return +this;
};
P.toOctal = function(sd, rm) {
  return toStringBinary(this, 8, sd, rm);
};
P.toPower = P.pow = function(y) {
  var e, k, pr, r, rm, s, x = this, Ctor = x.constructor, yn = +(y = new Ctor(y));
  if (!x.d || !y.d || !x.d[0] || !y.d[0]) return new Ctor(mathpow(+x, yn));
  x = new Ctor(x);
  if (x.eq(1)) return x;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (y.eq(1)) return finalise(x, pr, rm);
  e = mathfloor(y.e / LOG_BASE);
  if (e >= y.d.length - 1 && (k = yn < 0 ? -yn : yn) <= MAX_SAFE_INTEGER) {
    r = intPow(Ctor, x, k, pr);
    return y.s < 0 ? new Ctor(1).div(r) : finalise(r, pr, rm);
  }
  s = x.s;
  if (s < 0) {
    if (e < y.d.length - 1) return new Ctor(NaN);
    if ((y.d[e] & 1) == 0) s = 1;
    if (x.e == 0 && x.d[0] == 1 && x.d.length == 1) {
      x.s = s;
      return x;
    }
  }
  k = mathpow(+x, yn);
  e = k == 0 || !isFinite(k) ? mathfloor(yn * (Math.log("0." + digitsToString(x.d)) / Math.LN10 + x.e + 1)) : new Ctor(k + "").e;
  if (e > Ctor.maxE + 1 || e < Ctor.minE - 1) return new Ctor(e > 0 ? s / 0 : 0);
  external = false;
  Ctor.rounding = x.s = 1;
  k = Math.min(12, (e + "").length);
  r = naturalExponential(y.times(naturalLogarithm(x, pr + k)), pr);
  if (r.d) {
    r = finalise(r, pr + 5, 1);
    if (checkRoundingDigits(r.d, pr, rm)) {
      e = pr + 10;
      r = finalise(naturalExponential(y.times(naturalLogarithm(x, e + k)), e), e + 5, 1);
      if (+digitsToString(r.d).slice(pr + 1, pr + 15) + 1 == 1e14) {
        r = finalise(r, pr + 1, 0);
      }
    }
  }
  r.s = s;
  external = true;
  Ctor.rounding = rm;
  return finalise(r, pr, rm);
};
P.toPrecision = function(sd, rm) {
  var str, x = this, Ctor = x.constructor;
  if (sd === void 0) {
    str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x = finalise(new Ctor(x), sd, rm);
    str = finiteToString(x, sd <= x.e || x.e <= Ctor.toExpNeg, sd);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toSignificantDigits = P.toSD = function(sd, rm) {
  var x = this, Ctor = x.constructor;
  if (sd === void 0) {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  }
  return finalise(new Ctor(x), sd, rm);
};
P.toString = function() {
  var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.truncated = P.trunc = function() {
  return finalise(new this.constructor(this), this.e + 1, 1);
};
P.valueOf = P.toJSON = function() {
  var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  return x.isNeg() ? "-" + str : str;
};
function digitsToString(d) {
  var i, k, ws, indexOfLastWord = d.length - 1, str = "", w = d[0];
  if (indexOfLastWord > 0) {
    str += w;
    for (i = 1; i < indexOfLastWord; i++) {
      ws = d[i] + "";
      k = LOG_BASE - ws.length;
      if (k) str += getZeroString(k);
      str += ws;
    }
    w = d[i];
    ws = w + "";
    k = LOG_BASE - ws.length;
    if (k) str += getZeroString(k);
  } else if (w === 0) {
    return "0";
  }
  for (; w % 10 === 0; ) w /= 10;
  return str + w;
}
function checkInt32(i, min2, max2) {
  if (i !== ~~i || i < min2 || i > max2) {
    throw Error(invalidArgument + i);
  }
}
function checkRoundingDigits(d, i, rm, repeating) {
  var di, k, r, rd;
  for (k = d[0]; k >= 10; k /= 10) --i;
  if (--i < 0) {
    i += LOG_BASE;
    di = 0;
  } else {
    di = Math.ceil((i + 1) / LOG_BASE);
    i %= LOG_BASE;
  }
  k = mathpow(10, LOG_BASE - i);
  rd = d[di] % k | 0;
  if (repeating == null) {
    if (i < 3) {
      if (i == 0) rd = rd / 100 | 0;
      else if (i == 1) rd = rd / 10 | 0;
      r = rm < 4 && rd == 99999 || rm > 3 && rd == 49999 || rd == 5e4 || rd == 0;
    } else {
      r = (rm < 4 && rd + 1 == k || rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 100 | 0) == mathpow(10, i - 2) - 1 || (rd == k / 2 || rd == 0) && (d[di + 1] / k / 100 | 0) == 0;
    }
  } else {
    if (i < 4) {
      if (i == 0) rd = rd / 1e3 | 0;
      else if (i == 1) rd = rd / 100 | 0;
      else if (i == 2) rd = rd / 10 | 0;
      r = (repeating || rm < 4) && rd == 9999 || !repeating && rm > 3 && rd == 4999;
    } else {
      r = ((repeating || rm < 4) && rd + 1 == k || !repeating && rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 1e3 | 0) == mathpow(10, i - 3) - 1;
    }
  }
  return r;
}
function convertBase(str, baseIn, baseOut) {
  var j, arr = [0], arrL, i = 0, strL = str.length;
  for (; i < strL; ) {
    for (arrL = arr.length; arrL--; ) arr[arrL] *= baseIn;
    arr[0] += NUMERALS.indexOf(str.charAt(i++));
    for (j = 0; j < arr.length; j++) {
      if (arr[j] > baseOut - 1) {
        if (arr[j + 1] === void 0) arr[j + 1] = 0;
        arr[j + 1] += arr[j] / baseOut | 0;
        arr[j] %= baseOut;
      }
    }
  }
  return arr.reverse();
}
function cosine(Ctor, x) {
  var k, len, y;
  if (x.isZero()) return x;
  len = x.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    y = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    y = "2.3283064365386962890625e-10";
  }
  Ctor.precision += k;
  x = taylorSeries(Ctor, 1, x.times(y), new Ctor(1));
  for (var i = k; i--; ) {
    var cos2x = x.times(x);
    x = cos2x.times(cos2x).minus(cos2x).times(8).plus(1);
  }
  Ctor.precision -= k;
  return x;
}
var divide = /* @__PURE__ */ (function() {
  function multiplyInteger(x, k, base) {
    var temp, carry = 0, i = x.length;
    for (x = x.slice(); i--; ) {
      temp = x[i] * k + carry;
      x[i] = temp % base | 0;
      carry = temp / base | 0;
    }
    if (carry) x.unshift(carry);
    return x;
  }
  function compare(a, b, aL, bL) {
    var i, r;
    if (aL != bL) {
      r = aL > bL ? 1 : -1;
    } else {
      for (i = r = 0; i < aL; i++) {
        if (a[i] != b[i]) {
          r = a[i] > b[i] ? 1 : -1;
          break;
        }
      }
    }
    return r;
  }
  function subtract(a, b, aL, base) {
    var i = 0;
    for (; aL--; ) {
      a[aL] -= i;
      i = a[aL] < b[aL] ? 1 : 0;
      a[aL] = i * base + a[aL] - b[aL];
    }
    for (; !a[0] && a.length > 1; ) a.shift();
  }
  return function(x, y, pr, rm, dp, base) {
    var cmp, e, i, k, logBase, more, prod, prodL, q, qd, rem, remL, rem0, sd, t, xi, xL, yd0, yL, yz, Ctor = x.constructor, sign2 = x.s == y.s ? 1 : -1, xd = x.d, yd = y.d;
    if (!xd || !xd[0] || !yd || !yd[0]) {
      return new Ctor(
        // Return NaN if either NaN, or both Infinity or 0.
        !x.s || !y.s || (xd ? yd && xd[0] == yd[0] : !yd) ? NaN : (
          // Return ±0 if x is 0 or y is ±Infinity, or return ±Infinity as y is 0.
          xd && xd[0] == 0 || !yd ? sign2 * 0 : sign2 / 0
        )
      );
    }
    if (base) {
      logBase = 1;
      e = x.e - y.e;
    } else {
      base = BASE;
      logBase = LOG_BASE;
      e = mathfloor(x.e / logBase) - mathfloor(y.e / logBase);
    }
    yL = yd.length;
    xL = xd.length;
    q = new Ctor(sign2);
    qd = q.d = [];
    for (i = 0; yd[i] == (xd[i] || 0); i++) ;
    if (yd[i] > (xd[i] || 0)) e--;
    if (pr == null) {
      sd = pr = Ctor.precision;
      rm = Ctor.rounding;
    } else if (dp) {
      sd = pr + (x.e - y.e) + 1;
    } else {
      sd = pr;
    }
    if (sd < 0) {
      qd.push(1);
      more = true;
    } else {
      sd = sd / logBase + 2 | 0;
      i = 0;
      if (yL == 1) {
        k = 0;
        yd = yd[0];
        sd++;
        for (; (i < xL || k) && sd--; i++) {
          t = k * base + (xd[i] || 0);
          qd[i] = t / yd | 0;
          k = t % yd | 0;
        }
        more = k || i < xL;
      } else {
        k = base / (yd[0] + 1) | 0;
        if (k > 1) {
          yd = multiplyInteger(yd, k, base);
          xd = multiplyInteger(xd, k, base);
          yL = yd.length;
          xL = xd.length;
        }
        xi = yL;
        rem = xd.slice(0, yL);
        remL = rem.length;
        for (; remL < yL; ) rem[remL++] = 0;
        yz = yd.slice();
        yz.unshift(0);
        yd0 = yd[0];
        if (yd[1] >= base / 2) ++yd0;
        do {
          k = 0;
          cmp = compare(yd, rem, yL, remL);
          if (cmp < 0) {
            rem0 = rem[0];
            if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);
            k = rem0 / yd0 | 0;
            if (k > 1) {
              if (k >= base) k = base - 1;
              prod = multiplyInteger(yd, k, base);
              prodL = prod.length;
              remL = rem.length;
              cmp = compare(prod, rem, prodL, remL);
              if (cmp == 1) {
                k--;
                subtract(prod, yL < prodL ? yz : yd, prodL, base);
              }
            } else {
              if (k == 0) cmp = k = 1;
              prod = yd.slice();
            }
            prodL = prod.length;
            if (prodL < remL) prod.unshift(0);
            subtract(rem, prod, remL, base);
            if (cmp == -1) {
              remL = rem.length;
              cmp = compare(yd, rem, yL, remL);
              if (cmp < 1) {
                k++;
                subtract(rem, yL < remL ? yz : yd, remL, base);
              }
            }
            remL = rem.length;
          } else if (cmp === 0) {
            k++;
            rem = [0];
          }
          qd[i++] = k;
          if (cmp && rem[0]) {
            rem[remL++] = xd[xi] || 0;
          } else {
            rem = [xd[xi]];
            remL = 1;
          }
        } while ((xi++ < xL || rem[0] !== void 0) && sd--);
        more = rem[0] !== void 0;
      }
      if (!qd[0]) qd.shift();
    }
    if (logBase == 1) {
      q.e = e;
      inexact = more;
    } else {
      for (i = 1, k = qd[0]; k >= 10; k /= 10) i++;
      q.e = i + e * logBase - 1;
      finalise(q, dp ? pr + q.e + 1 : pr, rm, more);
    }
    return q;
  };
})();
function finalise(x, sd, rm, isTruncated) {
  var digits, i, j, k, rd, roundUp, w, xd, xdi, Ctor = x.constructor;
  out: if (sd != null) {
    xd = x.d;
    if (!xd) return x;
    for (digits = 1, k = xd[0]; k >= 10; k /= 10) digits++;
    i = sd - digits;
    if (i < 0) {
      i += LOG_BASE;
      j = sd;
      w = xd[xdi = 0];
      rd = w / mathpow(10, digits - j - 1) % 10 | 0;
    } else {
      xdi = Math.ceil((i + 1) / LOG_BASE);
      k = xd.length;
      if (xdi >= k) {
        if (isTruncated) {
          for (; k++ <= xdi; ) xd.push(0);
          w = rd = 0;
          digits = 1;
          i %= LOG_BASE;
          j = i - LOG_BASE + 1;
        } else {
          break out;
        }
      } else {
        w = k = xd[xdi];
        for (digits = 1; k >= 10; k /= 10) digits++;
        i %= LOG_BASE;
        j = i - LOG_BASE + digits;
        rd = j < 0 ? 0 : w / mathpow(10, digits - j - 1) % 10 | 0;
      }
    }
    isTruncated = isTruncated || sd < 0 || xd[xdi + 1] !== void 0 || (j < 0 ? w : w % mathpow(10, digits - j - 1));
    roundUp = rm < 4 ? (rd || isTruncated) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || isTruncated || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
    (i > 0 ? j > 0 ? w / mathpow(10, digits - j) : 0 : xd[xdi - 1]) % 10 & 1 || rm == (x.s < 0 ? 8 : 7));
    if (sd < 1 || !xd[0]) {
      xd.length = 0;
      if (roundUp) {
        sd -= x.e + 1;
        xd[0] = mathpow(10, (LOG_BASE - sd % LOG_BASE) % LOG_BASE);
        x.e = -sd || 0;
      } else {
        xd[0] = x.e = 0;
      }
      return x;
    }
    if (i == 0) {
      xd.length = xdi;
      k = 1;
      xdi--;
    } else {
      xd.length = xdi + 1;
      k = mathpow(10, LOG_BASE - i);
      xd[xdi] = j > 0 ? (w / mathpow(10, digits - j) % mathpow(10, j) | 0) * k : 0;
    }
    if (roundUp) {
      for (; ; ) {
        if (xdi == 0) {
          for (i = 1, j = xd[0]; j >= 10; j /= 10) i++;
          j = xd[0] += k;
          for (k = 1; j >= 10; j /= 10) k++;
          if (i != k) {
            x.e++;
            if (xd[0] == BASE) xd[0] = 1;
          }
          break;
        } else {
          xd[xdi] += k;
          if (xd[xdi] != BASE) break;
          xd[xdi--] = 0;
          k = 1;
        }
      }
    }
    for (i = xd.length; xd[--i] === 0; ) xd.pop();
  }
  if (external) {
    if (x.e > Ctor.maxE) {
      x.d = null;
      x.e = NaN;
    } else if (x.e < Ctor.minE) {
      x.e = 0;
      x.d = [0];
    }
  }
  return x;
}
function finiteToString(x, isExp, sd) {
  if (!x.isFinite()) return nonFiniteToString(x);
  var k, e = x.e, str = digitsToString(x.d), len = str.length;
  if (isExp) {
    if (sd && (k = sd - len) > 0) {
      str = str.charAt(0) + "." + str.slice(1) + getZeroString(k);
    } else if (len > 1) {
      str = str.charAt(0) + "." + str.slice(1);
    }
    str = str + (x.e < 0 ? "e" : "e+") + x.e;
  } else if (e < 0) {
    str = "0." + getZeroString(-e - 1) + str;
    if (sd && (k = sd - len) > 0) str += getZeroString(k);
  } else if (e >= len) {
    str += getZeroString(e + 1 - len);
    if (sd && (k = sd - e - 1) > 0) str = str + "." + getZeroString(k);
  } else {
    if ((k = e + 1) < len) str = str.slice(0, k) + "." + str.slice(k);
    if (sd && (k = sd - len) > 0) {
      if (e + 1 === len) str += ".";
      str += getZeroString(k);
    }
  }
  return str;
}
function getBase10Exponent(digits, e) {
  var w = digits[0];
  for (e *= LOG_BASE; w >= 10; w /= 10) e++;
  return e;
}
function getLn10(Ctor, sd, pr) {
  if (sd > LN10_PRECISION) {
    external = true;
    if (pr) Ctor.precision = pr;
    throw Error(precisionLimitExceeded);
  }
  return finalise(new Ctor(LN10), sd, 1, true);
}
function getPi(Ctor, sd, rm) {
  if (sd > PI_PRECISION) throw Error(precisionLimitExceeded);
  return finalise(new Ctor(PI), sd, rm, true);
}
function getPrecision(digits) {
  var w = digits.length - 1, len = w * LOG_BASE + 1;
  w = digits[w];
  if (w) {
    for (; w % 10 == 0; w /= 10) len--;
    for (w = digits[0]; w >= 10; w /= 10) len++;
  }
  return len;
}
function getZeroString(k) {
  var zs = "";
  for (; k--; ) zs += "0";
  return zs;
}
function intPow(Ctor, x, n, pr) {
  var isTruncated, r = new Ctor(1), k = Math.ceil(pr / LOG_BASE + 4);
  external = false;
  for (; ; ) {
    if (n % 2) {
      r = r.times(x);
      if (truncate(r.d, k)) isTruncated = true;
    }
    n = mathfloor(n / 2);
    if (n === 0) {
      n = r.d.length - 1;
      if (isTruncated && r.d[n] === 0) ++r.d[n];
      break;
    }
    x = x.times(x);
    truncate(x.d, k);
  }
  external = true;
  return r;
}
function isOdd(n) {
  return n.d[n.d.length - 1] & 1;
}
function maxOrMin(Ctor, args, n) {
  var k, y, x = new Ctor(args[0]), i = 0;
  for (; ++i < args.length; ) {
    y = new Ctor(args[i]);
    if (!y.s) {
      x = y;
      break;
    }
    k = x.cmp(y);
    if (k === n || k === 0 && x.s === n) {
      x = y;
    }
  }
  return x;
}
function naturalExponential(x, sd) {
  var denominator, guard, j, pow2, sum2, t, wpr, rep = 0, i = 0, k = 0, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (!x.d || !x.d[0] || x.e > 17) {
    return new Ctor(x.d ? !x.d[0] ? 1 : x.s < 0 ? 0 : 1 / 0 : x.s ? x.s < 0 ? 0 : x : 0 / 0);
  }
  if (sd == null) {
    external = false;
    wpr = pr;
  } else {
    wpr = sd;
  }
  t = new Ctor(0.03125);
  while (x.e > -2) {
    x = x.times(t);
    k += 5;
  }
  guard = Math.log(mathpow(2, k)) / Math.LN10 * 2 + 5 | 0;
  wpr += guard;
  denominator = pow2 = sum2 = new Ctor(1);
  Ctor.precision = wpr;
  for (; ; ) {
    pow2 = finalise(pow2.times(x), wpr, 1);
    denominator = denominator.times(++i);
    t = sum2.plus(divide(pow2, denominator, wpr, 1));
    if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
      j = k;
      while (j--) sum2 = finalise(sum2.times(sum2), wpr, 1);
      if (sd == null) {
        if (rep < 3 && checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
          Ctor.precision = wpr += 10;
          denominator = pow2 = t = new Ctor(1);
          i = 0;
          rep++;
        } else {
          return finalise(sum2, Ctor.precision = pr, rm, external = true);
        }
      } else {
        Ctor.precision = pr;
        return sum2;
      }
    }
    sum2 = t;
  }
}
function naturalLogarithm(y, sd) {
  var c, c0, denominator, e, numerator, rep, sum2, t, wpr, x1, x2, n = 1, guard = 10, x = y, xd = x.d, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (x.s < 0 || !xd || !xd[0] || !x.e && xd[0] == 1 && xd.length == 1) {
    return new Ctor(xd && !xd[0] ? -1 / 0 : x.s != 1 ? NaN : xd ? 0 : x);
  }
  if (sd == null) {
    external = false;
    wpr = pr;
  } else {
    wpr = sd;
  }
  Ctor.precision = wpr += guard;
  c = digitsToString(xd);
  c0 = c.charAt(0);
  if (Math.abs(e = x.e) < 15e14) {
    while (c0 < 7 && c0 != 1 || c0 == 1 && c.charAt(1) > 3) {
      x = x.times(y);
      c = digitsToString(x.d);
      c0 = c.charAt(0);
      n++;
    }
    e = x.e;
    if (c0 > 1) {
      x = new Ctor("0." + c);
      e++;
    } else {
      x = new Ctor(c0 + "." + c.slice(1));
    }
  } else {
    t = getLn10(Ctor, wpr + 2, pr).times(e + "");
    x = naturalLogarithm(new Ctor(c0 + "." + c.slice(1)), wpr - guard).plus(t);
    Ctor.precision = pr;
    return sd == null ? finalise(x, pr, rm, external = true) : x;
  }
  x1 = x;
  sum2 = numerator = x = divide(x.minus(1), x.plus(1), wpr, 1);
  x2 = finalise(x.times(x), wpr, 1);
  denominator = 3;
  for (; ; ) {
    numerator = finalise(numerator.times(x2), wpr, 1);
    t = sum2.plus(divide(numerator, new Ctor(denominator), wpr, 1));
    if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
      sum2 = sum2.times(2);
      if (e !== 0) sum2 = sum2.plus(getLn10(Ctor, wpr + 2, pr).times(e + ""));
      sum2 = divide(sum2, new Ctor(n), wpr, 1);
      if (sd == null) {
        if (checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
          Ctor.precision = wpr += guard;
          t = numerator = x = divide(x1.minus(1), x1.plus(1), wpr, 1);
          x2 = finalise(x.times(x), wpr, 1);
          denominator = rep = 1;
        } else {
          return finalise(sum2, Ctor.precision = pr, rm, external = true);
        }
      } else {
        Ctor.precision = pr;
        return sum2;
      }
    }
    sum2 = t;
    denominator += 2;
  }
}
function nonFiniteToString(x) {
  return String(x.s * x.s / 0);
}
function parseDecimal(x, str) {
  var e, i, len;
  if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
  if ((i = str.search(/e/i)) > 0) {
    if (e < 0) e = i;
    e += +str.slice(i + 1);
    str = str.substring(0, i);
  } else if (e < 0) {
    e = str.length;
  }
  for (i = 0; str.charCodeAt(i) === 48; i++) ;
  for (len = str.length; str.charCodeAt(len - 1) === 48; --len) ;
  str = str.slice(i, len);
  if (str) {
    len -= i;
    x.e = e = e - i - 1;
    x.d = [];
    i = (e + 1) % LOG_BASE;
    if (e < 0) i += LOG_BASE;
    if (i < len) {
      if (i) x.d.push(+str.slice(0, i));
      for (len -= LOG_BASE; i < len; ) x.d.push(+str.slice(i, i += LOG_BASE));
      str = str.slice(i);
      i = LOG_BASE - str.length;
    } else {
      i -= len;
    }
    for (; i--; ) str += "0";
    x.d.push(+str);
    if (external) {
      if (x.e > x.constructor.maxE) {
        x.d = null;
        x.e = NaN;
      } else if (x.e < x.constructor.minE) {
        x.e = 0;
        x.d = [0];
      }
    }
  } else {
    x.e = 0;
    x.d = [0];
  }
  return x;
}
function parseOther(x, str) {
  var base, Ctor, divisor, i, isFloat, len, p, xd, xe;
  if (str.indexOf("_") > -1) {
    str = str.replace(/(\d)_(?=\d)/g, "$1");
    if (isDecimal.test(str)) return parseDecimal(x, str);
  } else if (str === "Infinity" || str === "NaN") {
    if (!+str) x.s = NaN;
    x.e = NaN;
    x.d = null;
    return x;
  }
  if (isHex.test(str)) {
    base = 16;
    str = str.toLowerCase();
  } else if (isBinary.test(str)) {
    base = 2;
  } else if (isOctal.test(str)) {
    base = 8;
  } else {
    throw Error(invalidArgument + str);
  }
  i = str.search(/p/i);
  if (i > 0) {
    p = +str.slice(i + 1);
    str = str.substring(2, i);
  } else {
    str = str.slice(2);
  }
  i = str.indexOf(".");
  isFloat = i >= 0;
  Ctor = x.constructor;
  if (isFloat) {
    str = str.replace(".", "");
    len = str.length;
    i = len - i;
    divisor = intPow(Ctor, new Ctor(base), i, i * 2);
  }
  xd = convertBase(str, base, BASE);
  xe = xd.length - 1;
  for (i = xe; xd[i] === 0; --i) xd.pop();
  if (i < 0) return new Ctor(x.s * 0);
  x.e = getBase10Exponent(xd, xe);
  x.d = xd;
  external = false;
  if (isFloat) x = divide(x, divisor, len * 4);
  if (p) x = x.times(Math.abs(p) < 54 ? mathpow(2, p) : Decimal.pow(2, p));
  external = true;
  return x;
}
function sine(Ctor, x) {
  var k, len = x.d.length;
  if (len < 3) {
    return x.isZero() ? x : taylorSeries(Ctor, 2, x, x);
  }
  k = 1.4 * Math.sqrt(len);
  k = k > 16 ? 16 : k | 0;
  x = x.times(1 / tinyPow(5, k));
  x = taylorSeries(Ctor, 2, x, x);
  var sin2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
  for (; k--; ) {
    sin2_x = x.times(x);
    x = x.times(d5.plus(sin2_x.times(d16.times(sin2_x).minus(d20))));
  }
  return x;
}
function taylorSeries(Ctor, n, x, y, isHyperbolic) {
  var j, t, u, x2, i = 1, pr = Ctor.precision, k = Math.ceil(pr / LOG_BASE);
  external = false;
  x2 = x.times(x);
  u = new Ctor(y);
  for (; ; ) {
    t = divide(u.times(x2), new Ctor(n++ * n++), pr, 1);
    u = isHyperbolic ? y.plus(t) : y.minus(t);
    y = divide(t.times(x2), new Ctor(n++ * n++), pr, 1);
    t = u.plus(y);
    if (t.d[k] !== void 0) {
      for (j = k; t.d[j] === u.d[j] && j--; ) ;
      if (j == -1) break;
    }
    j = u;
    u = y;
    y = t;
    t = j;
    i++;
  }
  external = true;
  t.d.length = k + 1;
  return t;
}
function tinyPow(b, e) {
  var n = b;
  while (--e) n *= b;
  return n;
}
function toLessThanHalfPi(Ctor, x) {
  var t, isNeg = x.s < 0, pi = getPi(Ctor, Ctor.precision, 1), halfPi = pi.times(0.5);
  x = x.abs();
  if (x.lte(halfPi)) {
    quadrant = isNeg ? 4 : 1;
    return x;
  }
  t = x.divToInt(pi);
  if (t.isZero()) {
    quadrant = isNeg ? 3 : 2;
  } else {
    x = x.minus(t.times(pi));
    if (x.lte(halfPi)) {
      quadrant = isOdd(t) ? isNeg ? 2 : 3 : isNeg ? 4 : 1;
      return x;
    }
    quadrant = isOdd(t) ? isNeg ? 1 : 4 : isNeg ? 3 : 2;
  }
  return x.minus(pi).abs();
}
function toStringBinary(x, baseOut, sd, rm) {
  var base, e, i, k, len, roundUp, str, xd, y, Ctor = x.constructor, isExp = sd !== void 0;
  if (isExp) {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  } else {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  }
  if (!x.isFinite()) {
    str = nonFiniteToString(x);
  } else {
    str = finiteToString(x);
    i = str.indexOf(".");
    if (isExp) {
      base = 2;
      if (baseOut == 16) {
        sd = sd * 4 - 3;
      } else if (baseOut == 8) {
        sd = sd * 3 - 2;
      }
    } else {
      base = baseOut;
    }
    if (i >= 0) {
      str = str.replace(".", "");
      y = new Ctor(1);
      y.e = str.length - i;
      y.d = convertBase(finiteToString(y), 10, base);
      y.e = y.d.length;
    }
    xd = convertBase(str, 10, base);
    e = len = xd.length;
    for (; xd[--len] == 0; ) xd.pop();
    if (!xd[0]) {
      str = isExp ? "0p+0" : "0";
    } else {
      if (i < 0) {
        e--;
      } else {
        x = new Ctor(x);
        x.d = xd;
        x.e = e;
        x = divide(x, y, sd, rm, 0, base);
        xd = x.d;
        e = x.e;
        roundUp = inexact;
      }
      i = xd[sd];
      k = base / 2;
      roundUp = roundUp || xd[sd + 1] !== void 0;
      roundUp = rm < 4 ? (i !== void 0 || roundUp) && (rm === 0 || rm === (x.s < 0 ? 3 : 2)) : i > k || i === k && (rm === 4 || roundUp || rm === 6 && xd[sd - 1] & 1 || rm === (x.s < 0 ? 8 : 7));
      xd.length = sd;
      if (roundUp) {
        for (; ++xd[--sd] > base - 1; ) {
          xd[sd] = 0;
          if (!sd) {
            ++e;
            xd.unshift(1);
          }
        }
      }
      for (len = xd.length; !xd[len - 1]; --len) ;
      for (i = 0, str = ""; i < len; i++) str += NUMERALS.charAt(xd[i]);
      if (isExp) {
        if (len > 1) {
          if (baseOut == 16 || baseOut == 8) {
            i = baseOut == 16 ? 4 : 3;
            for (--len; len % i; len++) str += "0";
            xd = convertBase(str, base, baseOut);
            for (len = xd.length; !xd[len - 1]; --len) ;
            for (i = 1, str = "1."; i < len; i++) str += NUMERALS.charAt(xd[i]);
          } else {
            str = str.charAt(0) + "." + str.slice(1);
          }
        }
        str = str + (e < 0 ? "p" : "p+") + e;
      } else if (e < 0) {
        for (; ++e; ) str = "0" + str;
        str = "0." + str;
      } else {
        if (++e > len) for (e -= len; e--; ) str += "0";
        else if (e < len) str = str.slice(0, e) + "." + str.slice(e);
      }
    }
    str = (baseOut == 16 ? "0x" : baseOut == 2 ? "0b" : baseOut == 8 ? "0o" : "") + str;
  }
  return x.s < 0 ? "-" + str : str;
}
function truncate(arr, len) {
  if (arr.length > len) {
    arr.length = len;
    return true;
  }
}
function abs(x) {
  return new this(x).abs();
}
function acos(x) {
  return new this(x).acos();
}
function acosh(x) {
  return new this(x).acosh();
}
function add(x, y) {
  return new this(x).plus(y);
}
function asin(x) {
  return new this(x).asin();
}
function asinh(x) {
  return new this(x).asinh();
}
function atan(x) {
  return new this(x).atan();
}
function atanh(x) {
  return new this(x).atanh();
}
function atan2(y, x) {
  y = new this(y);
  x = new this(x);
  var r, pr = this.precision, rm = this.rounding, wpr = pr + 4;
  if (!y.s || !x.s) {
    r = new this(NaN);
  } else if (!y.d && !x.d) {
    r = getPi(this, wpr, 1).times(x.s > 0 ? 0.25 : 0.75);
    r.s = y.s;
  } else if (!x.d || y.isZero()) {
    r = x.s < 0 ? getPi(this, pr, rm) : new this(0);
    r.s = y.s;
  } else if (!y.d || x.isZero()) {
    r = getPi(this, wpr, 1).times(0.5);
    r.s = y.s;
  } else if (x.s < 0) {
    this.precision = wpr;
    this.rounding = 1;
    r = this.atan(divide(y, x, wpr, 1));
    x = getPi(this, wpr, 1);
    this.precision = pr;
    this.rounding = rm;
    r = y.s < 0 ? r.minus(x) : r.plus(x);
  } else {
    r = this.atan(divide(y, x, wpr, 1));
  }
  return r;
}
function cbrt(x) {
  return new this(x).cbrt();
}
function ceil(x) {
  return finalise(x = new this(x), x.e + 1, 2);
}
function clamp(x, min2, max2) {
  return new this(x).clamp(min2, max2);
}
function config(obj) {
  if (!obj || typeof obj !== "object") throw Error(decimalError + "Object expected");
  var i, p, v, useDefaults = obj.defaults === true, ps = [
    "precision",
    1,
    MAX_DIGITS,
    "rounding",
    0,
    8,
    "toExpNeg",
    -EXP_LIMIT,
    0,
    "toExpPos",
    0,
    EXP_LIMIT,
    "maxE",
    0,
    EXP_LIMIT,
    "minE",
    -EXP_LIMIT,
    0,
    "modulo",
    0,
    9
  ];
  for (i = 0; i < ps.length; i += 3) {
    if (p = ps[i], useDefaults) this[p] = DEFAULTS[p];
    if ((v = obj[p]) !== void 0) {
      if (mathfloor(v) === v && v >= ps[i + 1] && v <= ps[i + 2]) this[p] = v;
      else throw Error(invalidArgument + p + ": " + v);
    }
  }
  if (p = "crypto", useDefaults) this[p] = DEFAULTS[p];
  if ((v = obj[p]) !== void 0) {
    if (v === true || v === false || v === 0 || v === 1) {
      if (v) {
        if (typeof crypto != "undefined" && crypto && (crypto.getRandomValues || crypto.randomBytes)) {
          this[p] = true;
        } else {
          throw Error(cryptoUnavailable);
        }
      } else {
        this[p] = false;
      }
    } else {
      throw Error(invalidArgument + p + ": " + v);
    }
  }
  return this;
}
function cos(x) {
  return new this(x).cos();
}
function cosh(x) {
  return new this(x).cosh();
}
function clone(obj) {
  var i, p, ps;
  function Decimal2(v) {
    var e, i2, t, x = this;
    if (!(x instanceof Decimal2)) return new Decimal2(v);
    x.constructor = Decimal2;
    if (isDecimalInstance(v)) {
      x.s = v.s;
      if (external) {
        if (!v.d || v.e > Decimal2.maxE) {
          x.e = NaN;
          x.d = null;
        } else if (v.e < Decimal2.minE) {
          x.e = 0;
          x.d = [0];
        } else {
          x.e = v.e;
          x.d = v.d.slice();
        }
      } else {
        x.e = v.e;
        x.d = v.d ? v.d.slice() : v.d;
      }
      return;
    }
    t = typeof v;
    if (t === "number") {
      if (v === 0) {
        x.s = 1 / v < 0 ? -1 : 1;
        x.e = 0;
        x.d = [0];
        return;
      }
      if (v < 0) {
        v = -v;
        x.s = -1;
      } else {
        x.s = 1;
      }
      if (v === ~~v && v < 1e7) {
        for (e = 0, i2 = v; i2 >= 10; i2 /= 10) e++;
        if (external) {
          if (e > Decimal2.maxE) {
            x.e = NaN;
            x.d = null;
          } else if (e < Decimal2.minE) {
            x.e = 0;
            x.d = [0];
          } else {
            x.e = e;
            x.d = [v];
          }
        } else {
          x.e = e;
          x.d = [v];
        }
        return;
      }
      if (v * 0 !== 0) {
        if (!v) x.s = NaN;
        x.e = NaN;
        x.d = null;
        return;
      }
      return parseDecimal(x, v.toString());
    }
    if (t === "string") {
      if ((i2 = v.charCodeAt(0)) === 45) {
        v = v.slice(1);
        x.s = -1;
      } else {
        if (i2 === 43) v = v.slice(1);
        x.s = 1;
      }
      return isDecimal.test(v) ? parseDecimal(x, v) : parseOther(x, v);
    }
    if (t === "bigint") {
      if (v < 0) {
        v = -v;
        x.s = -1;
      } else {
        x.s = 1;
      }
      return parseDecimal(x, v.toString());
    }
    throw Error(invalidArgument + v);
  }
  Decimal2.prototype = P;
  Decimal2.ROUND_UP = 0;
  Decimal2.ROUND_DOWN = 1;
  Decimal2.ROUND_CEIL = 2;
  Decimal2.ROUND_FLOOR = 3;
  Decimal2.ROUND_HALF_UP = 4;
  Decimal2.ROUND_HALF_DOWN = 5;
  Decimal2.ROUND_HALF_EVEN = 6;
  Decimal2.ROUND_HALF_CEIL = 7;
  Decimal2.ROUND_HALF_FLOOR = 8;
  Decimal2.EUCLID = 9;
  Decimal2.config = Decimal2.set = config;
  Decimal2.clone = clone;
  Decimal2.isDecimal = isDecimalInstance;
  Decimal2.abs = abs;
  Decimal2.acos = acos;
  Decimal2.acosh = acosh;
  Decimal2.add = add;
  Decimal2.asin = asin;
  Decimal2.asinh = asinh;
  Decimal2.atan = atan;
  Decimal2.atanh = atanh;
  Decimal2.atan2 = atan2;
  Decimal2.cbrt = cbrt;
  Decimal2.ceil = ceil;
  Decimal2.clamp = clamp;
  Decimal2.cos = cos;
  Decimal2.cosh = cosh;
  Decimal2.div = div;
  Decimal2.exp = exp;
  Decimal2.floor = floor;
  Decimal2.hypot = hypot;
  Decimal2.ln = ln;
  Decimal2.log = log;
  Decimal2.log10 = log10;
  Decimal2.log2 = log2;
  Decimal2.max = max;
  Decimal2.min = min;
  Decimal2.mod = mod;
  Decimal2.mul = mul;
  Decimal2.pow = pow;
  Decimal2.random = random;
  Decimal2.round = round;
  Decimal2.sign = sign;
  Decimal2.sin = sin;
  Decimal2.sinh = sinh;
  Decimal2.sqrt = sqrt;
  Decimal2.sub = sub;
  Decimal2.sum = sum;
  Decimal2.tan = tan;
  Decimal2.tanh = tanh;
  Decimal2.trunc = trunc;
  if (obj === void 0) obj = {};
  if (obj) {
    if (obj.defaults !== true) {
      ps = ["precision", "rounding", "toExpNeg", "toExpPos", "maxE", "minE", "modulo", "crypto"];
      for (i = 0; i < ps.length; ) if (!obj.hasOwnProperty(p = ps[i++])) obj[p] = this[p];
    }
  }
  Decimal2.config(obj);
  return Decimal2;
}
function div(x, y) {
  return new this(x).div(y);
}
function exp(x) {
  return new this(x).exp();
}
function floor(x) {
  return finalise(x = new this(x), x.e + 1, 3);
}
function hypot() {
  var i, n, t = new this(0);
  external = false;
  for (i = 0; i < arguments.length; ) {
    n = new this(arguments[i++]);
    if (!n.d) {
      if (n.s) {
        external = true;
        return new this(1 / 0);
      }
      t = n;
    } else if (t.d) {
      t = t.plus(n.times(n));
    }
  }
  external = true;
  return t.sqrt();
}
function isDecimalInstance(obj) {
  return obj instanceof Decimal || obj && obj.toStringTag === tag || false;
}
function ln(x) {
  return new this(x).ln();
}
function log(x, y) {
  return new this(x).log(y);
}
function log2(x) {
  return new this(x).log(2);
}
function log10(x) {
  return new this(x).log(10);
}
function max() {
  return maxOrMin(this, arguments, -1);
}
function min() {
  return maxOrMin(this, arguments, 1);
}
function mod(x, y) {
  return new this(x).mod(y);
}
function mul(x, y) {
  return new this(x).mul(y);
}
function pow(x, y) {
  return new this(x).pow(y);
}
function random(sd) {
  var d, e, k, n, i = 0, r = new this(1), rd = [];
  if (sd === void 0) sd = this.precision;
  else checkInt32(sd, 1, MAX_DIGITS);
  k = Math.ceil(sd / LOG_BASE);
  if (!this.crypto) {
    for (; i < k; ) rd[i++] = Math.random() * 1e7 | 0;
  } else if (crypto.getRandomValues) {
    d = crypto.getRandomValues(new Uint32Array(k));
    for (; i < k; ) {
      n = d[i];
      if (n >= 429e7) {
        d[i] = crypto.getRandomValues(new Uint32Array(1))[0];
      } else {
        rd[i++] = n % 1e7;
      }
    }
  } else if (crypto.randomBytes) {
    d = crypto.randomBytes(k *= 4);
    for (; i < k; ) {
      n = d[i] + (d[i + 1] << 8) + (d[i + 2] << 16) + ((d[i + 3] & 127) << 24);
      if (n >= 214e7) {
        crypto.randomBytes(4).copy(d, i);
      } else {
        rd.push(n % 1e7);
        i += 4;
      }
    }
    i = k / 4;
  } else {
    throw Error(cryptoUnavailable);
  }
  k = rd[--i];
  sd %= LOG_BASE;
  if (k && sd) {
    n = mathpow(10, LOG_BASE - sd);
    rd[i] = (k / n | 0) * n;
  }
  for (; rd[i] === 0; i--) rd.pop();
  if (i < 0) {
    e = 0;
    rd = [0];
  } else {
    e = -1;
    for (; rd[0] === 0; e -= LOG_BASE) rd.shift();
    for (k = 1, n = rd[0]; n >= 10; n /= 10) k++;
    if (k < LOG_BASE) e -= LOG_BASE - k;
  }
  r.e = e;
  r.d = rd;
  return r;
}
function round(x) {
  return finalise(x = new this(x), x.e + 1, this.rounding);
}
function sign(x) {
  x = new this(x);
  return x.d ? x.d[0] ? x.s : 0 * x.s : x.s || NaN;
}
function sin(x) {
  return new this(x).sin();
}
function sinh(x) {
  return new this(x).sinh();
}
function sqrt(x) {
  return new this(x).sqrt();
}
function sub(x, y) {
  return new this(x).sub(y);
}
function sum() {
  var i = 0, args = arguments, x = new this(args[i]);
  external = false;
  for (; x.s && ++i < args.length; ) x = x.plus(args[i]);
  external = true;
  return finalise(x, this.precision, this.rounding);
}
function tan(x) {
  return new this(x).tan();
}
function tanh(x) {
  return new this(x).tanh();
}
function trunc(x) {
  return finalise(x = new this(x), x.e + 1, 1);
}
P[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = P.toString;
P[Symbol.toStringTag] = "Decimal";
var Decimal = P.constructor = clone(DEFAULTS);
LN10 = new Decimal(LN10);
PI = new Decimal(PI);

// libs/shared-kernel/src/money.ts
var DecimalStrict = Decimal.clone({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP
});
var MoneyDecimal = class _MoneyDecimal {
  value;
  constructor(val, fieldName = "amount") {
    if (val === void 0 || val === null || typeof val === "string" && val.trim().length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Invalid or missing numeric value for "${fieldName}".`,
        { field: fieldName }
      );
    }
    try {
      const parsed = new DecimalStrict(val);
      if (!parsed.isFinite() || parsed.isNaN()) {
        throw new Error("Non-finite decimal");
      }
      this.value = parsed;
    } catch {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Malformed numeric value "${String(val)}" for "${fieldName}".`,
        { field: fieldName, received: String(val) }
      );
    }
  }
  static from(val, fieldName = "amount") {
    return new _MoneyDecimal(val, fieldName);
  }
  static zero() {
    return new _MoneyDecimal("0.0000");
  }
  assertPositive(fieldName) {
    if (this.value.lte(0)) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Field "${fieldName}" must be strictly greater than zero (> 0), received ${this.toFixed4()}.`,
        { field: fieldName, value: this.toFixed4() }
      );
    }
    return this;
  }
  assertNonNegative(fieldName) {
    if (this.value.isNegative()) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Field "${fieldName}" cannot be negative (< 0), received ${this.toFixed4()}.`,
        { field: fieldName, value: this.toFixed4() }
      );
    }
    return this;
  }
  add(other) {
    return new _MoneyDecimal(this.value.plus(other.value));
  }
  sub(other) {
    return new _MoneyDecimal(this.value.minus(other.value));
  }
  mul(factor, fieldName = "factor") {
    const f = factor instanceof _MoneyDecimal ? factor.value : _MoneyDecimal.from(factor, fieldName).value;
    return new _MoneyDecimal(this.value.times(f));
  }
  applyTaxRatePercent(ratePercent, fieldName = "taxRatePercent") {
    const rateDecimal = _MoneyDecimal.from(ratePercent, fieldName).assertNonNegative(fieldName);
    const rate = rateDecimal.value.dividedBy(100);
    return new _MoneyDecimal(this.value.times(rate));
  }
  isNegative() {
    return this.value.isNegative();
  }
  isZero() {
    return this.value.isZero();
  }
  gt(other) {
    return this.value.gt(other.value);
  }
  equals(other) {
    return this.toFixed4() === other.toFixed4();
  }
  /**
   * Representación exacta NUMERIC(19, 4) para PostgreSQL e IndexedDB POS Cart
   */
  toFixed4() {
    return this.value.toFixed(4, Decimal.ROUND_HALF_UP);
  }
  /**
   * Representación monetaria estándar de 2 decimales para visualización tabular-nums
   */
  toCurrencyFixed2() {
    return this.value.toFixed(2, Decimal.ROUND_HALF_UP);
  }
};

// libs/shared-kernel/src/jwt-claims.ts
function resolveMicroserviceAccess(claims, parentMicroserviceInput, moduleInput) {
  const parentService = normalizeParentMicroserviceKey(parentMicroserviceInput);
  const microservice = normalizeModuleKey(moduleInput);
  const activeChildren = claims.services[parentService];
  if (!activeChildren) {
    return {
      access: "DISABLED",
      canRead: false,
      canWrite: false,
      reason: "PARENT_SERVICE_DISABLED"
    };
  }
  if (activeChildren.includes(microservice)) {
    return {
      access: "ACTIVE",
      canRead: true,
      canWrite: true
    };
  }
  if (claims.readonly_microservices.includes(microservice)) {
    const replacer = SEED_MICROSERVICES_CATALOG.find(
      (def) => def.parentService === parentService && def.supersedes.includes(microservice) && activeChildren.includes(def.key)
    );
    return {
      access: "READONLY_ARCHIVE",
      canRead: true,
      canWrite: false,
      supersededBy: replacer?.key
    };
  }
  return {
    access: "DISABLED",
    canRead: false,
    canWrite: false,
    reason: "MICROSERVICE_DISABLED"
  };
}

// libs/crypto-vault/src/ed25519-jwt.signer.ts
import crypto2 from "node:crypto";
var Ed25519JwtVault = class {
  activeKid;
  privateKeys = /* @__PURE__ */ new Map();
  publicKeys = /* @__PURE__ */ new Map();
  issuer = "https://auth.proveko.com";
  audience = "proveko-api";
  constructor(activeKid, entries) {
    this.activeKid = activeKid;
    for (const entry of entries) {
      this.publicKeys.set(entry.kid, crypto2.createPublicKey(entry.publicKeyPem));
      if (entry.privateKeyPem) {
        this.privateKeys.set(entry.kid, crypto2.createPrivateKey(entry.privateKeyPem));
      }
    }
  }
  static generateKeyPairEntry(kid) {
    const { publicKey, privateKey } = crypto2.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    return {
      kid,
      privateKeyPem: privateKey,
      publicKeyPem: publicKey
    };
  }
  /**
   * Deriva determinísticamente un par de llaves Ed25519 (PKCS#8 + SPKI PEM) a partir de una semilla maestra (`JWT_MASTER_SEED`),
   * permitiendo que múltiples contenedores de microservicios independientes verifiquen firmas sin requerir PEMs multilínea en `.env`.
   */
  static deriveDeterministicKeyPairEntry(kid, seedSecret) {
    const seed32 = crypto2.createHash("sha256").update(seedSecret, "utf8").digest();
    const pkcs8Header = Buffer.from("302e020100300506032b657004220420", "hex");
    const pkcs8Der = Buffer.concat([pkcs8Header, seed32]);
    const privKeyObj = crypto2.createPrivateKey({
      key: pkcs8Der,
      format: "der",
      type: "pkcs8"
    });
    const pubKeyObj = crypto2.createPublicKey(privKeyObj);
    return {
      kid,
      privateKeyPem: privKeyObj.export({ type: "pkcs8", format: "pem" }).toString(),
      publicKeyPem: pubKeyObj.export({ type: "spki", format: "pem" }).toString()
    };
  }
  signAccessToken(input, nowEpochSeconds) {
    const privateKey = this.privateKeys.get(this.activeKid);
    if (!privateKey) {
      throw new Error(`No private key loaded for active kid "${this.activeKid}".`);
    }
    const iat = nowEpochSeconds ?? Math.floor(Date.now() / 1e3);
    const exp2 = iat + (input.ttlSeconds ?? 900);
    const header = {
      alg: "EdDSA",
      typ: "JWT",
      kid: this.activeKid
    };
    const payload = {
      iss: this.issuer,
      aud: this.audience,
      jti: `tok-${crypto2.randomUUID()}`,
      iat,
      exp: exp2,
      tenant_id: input.tenant_id,
      cell_id: input.cell_id,
      user_id: input.user_id,
      role_key: input.role_key,
      tier: input.tier,
      is_sandbox: input.is_sandbox,
      active_branch_id: input.active_branch_id,
      allowed_branch_ids: [...input.allowed_branch_ids],
      sub_ver: input.sub_ver,
      services: input.services,
      readonly_microservices: [...input.readonly_microservices]
    };
    const encodedHeader = Buffer.from(JSON.stringify(header), "utf8").toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto2.sign(null, Buffer.from(signingInput, "utf8"), privateKey).toString("base64url");
    return `${signingInput}.${signature}`;
  }
  verifyAccessToken(token, nowEpochSeconds) {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        "Malformed JWT token structure."
      );
    }
    const [encodedHeader, encodedPayload, encodedSig] = parts;
    let header;
    let claims;
    try {
      header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
      claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    } catch {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        "Invalid JSON encoding in JWT token."
      );
    }
    if (header.alg !== "EdDSA" || !header.kid) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        "Unsupported JWT algorithm or missing kid."
      );
    }
    const publicKey = this.publicKeys.get(header.kid);
    if (!publicKey) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        `Unknown signing key kid "${header.kid}".`
      );
    }
    const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8");
    const signatureBuf = Buffer.from(encodedSig, "base64url");
    const isValidSignature = crypto2.verify(null, signingInput, publicKey, signatureBuf);
    if (!isValidSignature) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        "Invalid Ed25519 cryptographic signature."
      );
    }
    if (claims.iss !== this.issuer || claims.aud !== this.audience) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        "Invalid token issuer or audience."
      );
    }
    const now = nowEpochSeconds ?? Math.floor(Date.now() / 1e3);
    if (claims.exp <= now) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_EXPIRED,
        401,
        "Access token has expired."
      );
    }
    return claims;
  }
};

// libs/crypto-vault/src/cluster-hmac.signer.ts
import crypto3 from "node:crypto";
var DEFAULT_PROVEKO_CLUSTER_SECRET = "proveko-default-cluster-hmac-secret-2026";
var ClusterHmacGuard = class {
  constructor(clusterSecret = process.env.PROVEKO_CLUSTER_SECRET ?? DEFAULT_PROVEKO_CLUSTER_SECRET, maxClockSkewSeconds = 30) {
    this.maxClockSkewSeconds = maxClockSkewSeconds;
    if (!clusterSecret || clusterSecret.trim().length < 16) {
      throw new Error("PROVEKO_CLUSTER_SECRET must be at least 16 characters long.");
    }
    this.secretKeyBuffer = Buffer.from(clusterSecret, "utf8");
  }
  maxClockSkewSeconds;
  secretKeyBuffer;
  buildCanonicalString(timestampSeconds, payload) {
    const method = payload.method.toUpperCase();
    const pathAndQuery = payload.pathAndQuery.startsWith("/") ? payload.pathAndQuery : `/${payload.pathAndQuery}`;
    const normalizedParent = normalizeParentMicroserviceKey(
      payload.targetParent
    );
    const normalizedModule = normalizeModuleKey(payload.targetModule);
    const authHash = crypto3.createHash("sha256").update(payload.authorizationHeader ?? "", "utf8").digest("hex");
    return `${timestampSeconds}
${method}
${pathAndQuery}
${normalizedParent}
${normalizedModule}
${authHash}`;
  }
  signOutboundRequest(payload) {
    const ts = payload.timestampSeconds ?? Math.floor(Date.now() / 1e3);
    const canonical = this.buildCanonicalString(ts, payload);
    const signature = crypto3.createHmac("sha256", this.secretKeyBuffer).update(canonical, "utf8").digest("hex");
    return {
      "x-proveko-cluster-ts": String(ts),
      "x-proveko-cluster-sig": signature
    };
  }
  verifyInboundRequest(headers, payload, nowSeconds = Math.floor(Date.now() / 1e3)) {
    const rawTs = headers["x-proveko-cluster-ts"];
    const rawSig = headers["x-proveko-cluster-sig"];
    const tsStr = Array.isArray(rawTs) ? rawTs[0] : rawTs;
    const sigStr = Array.isArray(rawSig) ? rawSig[0] : rawSig;
    if (!tsStr || !sigStr) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_CLUSTER_SIGNATURE_INVALID,
        403,
        "Direct access to microservice endpoint is forbidden: missing cluster gateway HMAC signature headers."
      );
    }
    const parsedTs = Number(tsStr);
    if (!Number.isInteger(parsedTs) || Math.abs(nowSeconds - parsedTs) > this.maxClockSkewSeconds) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_CLUSTER_SIGNATURE_INVALID,
        403,
        "Cluster gateway HMAC signature timestamp is expired or out of tolerance window (anti-replay triggered).",
        { timestamp: tsStr, max_skew_seconds: this.maxClockSkewSeconds }
      );
    }
    const canonical = this.buildCanonicalString(parsedTs, payload);
    const expectedHex = crypto3.createHmac("sha256", this.secretKeyBuffer).update(canonical, "utf8").digest("hex");
    const providedBuf = Buffer.from(sigStr, "utf8");
    const expectedBuf = Buffer.from(expectedHex, "utf8");
    if (providedBuf.length !== expectedBuf.length || !crypto3.timingSafeEqual(providedBuf, expectedBuf)) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_CLUSTER_SIGNATURE_INVALID,
        403,
        "Invalid cluster gateway HMAC signature: request did not originate from an authorized Proveko API Gateway."
      );
    }
  }
};

// libs/service-guard/src/tenant-context.storage.ts
import { AsyncLocalStorage } from "node:async_hooks";
var tenantContextAls = new AsyncLocalStorage();
var TenantContextStorage = class {
  static runWithVerifiedContext(context, fn) {
    const frozenContext = Object.freeze({
      ...context,
      allowedBranchIds: Object.freeze([...context.allowedBranchIds]),
      claims: Object.freeze({ ...context.claims })
    });
    return tenantContextAls.run(frozenContext, fn);
  }
  static getRequiredContext() {
    const ctx = tenantContextAls.getStore();
    if (!ctx) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        "Zero-Trust violation: Attempted to access tenant database without a cryptographically verified TenantContext in AsyncLocalStorage."
      );
    }
    return ctx;
  }
  static getOptionalContext() {
    return tenantContextAls.getStore();
  }
};

// libs/service-guard/src/double-key.guard.ts
function sanitizeInboundTenantHeaders(headers) {
  const cleaned = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower.startsWith("x-proveko-") || lower.startsWith("x-tenant-") || lower.startsWith("x-cell-")) {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}
var DoubleKeyServiceGuard = class {
  constructor(jwtVerifier, subVerLookup) {
    this.jwtVerifier = jwtVerifier;
    this.subVerLookup = subVerLookup;
  }
  jwtVerifier;
  subVerLookup;
  async verifyAndExecute(req, targetParentInput, targetModuleInput, handler) {
    if (!req.authorizationHeader || !req.authorizationHeader.startsWith("Bearer ")) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        "Missing or invalid Bearer token."
      );
    }
    const targetParentService = normalizeParentMicroserviceKey(targetParentInput);
    const targetMicroservice = normalizeModuleKey(targetModuleInput);
    const rawToken = req.authorizationHeader.slice("Bearer ".length).trim();
    const claims = this.jwtVerifier.verifyAccessToken(rawToken);
    if (this.subVerLookup) {
      const currentSubVer = await this.subVerLookup.getCurrentSubVer(claims.tenant_id);
      if (currentSubVer !== null && claims.sub_ver < currentSubVer) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_SUB_VER_STALE,
          401,
          "Subscription capabilities updated in real-time; silent token refresh required.",
          {
            token_sub_ver: claims.sub_ver,
            current_sub_ver: currentSubVer
          }
        );
      }
    }
    const resolution = resolveMicroserviceAccess(claims, targetParentService, targetMicroservice);
    if (resolution.access === "DISABLED") {
      if (resolution.reason === "PARENT_SERVICE_DISABLED") {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_PARENT_SERVICE_DISABLED,
          403,
          `Parent microservice gatekeeper "${targetParentService}" is disabled for tenant "${claims.tenant_id}".`,
          { parent_service: targetParentService, microservice: targetMicroservice }
        );
      }
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MICROSERVICE_DISABLED,
        403,
        `Module "${targetMicroservice}" is not active in subscription.`,
        { parent_service: targetParentService, microservice: targetMicroservice }
      );
    }
    const isReadMethod = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
    if (resolution.access === "READONLY_ARCHIVE" && !isReadMethod) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MICROSERVICE_READONLY_ARCHIVE,
        403,
        `Module "${targetMicroservice}" is in historical READONLY_ARCHIVE mode and rejects write operations (${req.method}).`,
        {
          microservice: targetMicroservice,
          superseded_by: resolution.supersededBy ?? null
        }
      );
    }
    if (!claims.allowed_branch_ids.includes(claims.active_branch_id)) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_BRANCH_FORBIDDEN,
        403,
        `Active branch "${claims.active_branch_id}" is not authorized for user "${claims.user_id}".`
      );
    }
    const verifiedContext = {
      tenantId: claims.tenant_id,
      cellId: claims.cell_id,
      userId: claims.user_id,
      roleKey: claims.role_key,
      tier: claims.tier,
      isSandbox: claims.is_sandbox,
      activeBranchId: claims.active_branch_id,
      allowedBranchIds: claims.allowed_branch_ids,
      subVer: claims.sub_ver,
      currentService: targetParentService,
      currentMicroservice: targetMicroservice,
      isReadonlyArchive: resolution.access === "READONLY_ARCHIVE",
      claims
    };
    return TenantContextStorage.runWithVerifiedContext(
      verifiedContext,
      () => handler(TenantContextStorage.getRequiredContext())
    );
  }
};

// libs/service-guard/src/microservice-runtime.ts
function defineProvekoMicroservice(plugin) {
  const normalizedParent = normalizeParentMicroserviceKey(plugin.parentService);
  const normalizedModule = normalizeModuleKey(plugin.microserviceKey);
  const catalogDef = SEED_MICROSERVICES_CATALOG.find((m) => m.key === normalizedModule);
  if (!catalogDef) {
    throw new Error(
      `Module "${normalizedModule}" is not registered in SEED_MICROSERVICES_CATALOG.`
    );
  }
  if (catalogDef.parentService !== normalizedParent) {
    throw new Error(
      `Module "${normalizedModule}" belongs to parent "${catalogDef.parentService}", not "${normalizedParent}".`
    );
  }
  if (catalogDef.tablePrefix !== plugin.tablePrefix) {
    throw new Error(
      `Module "${normalizedModule}" must use table prefix "${catalogDef.tablePrefix}", received "${plugin.tablePrefix}".`
    );
  }
  return Object.freeze({
    ...plugin,
    parentService: normalizedParent,
    microserviceKey: normalizedModule
  });
}
var StandaloneMicroserviceServer = class {
  constructor(plugin, guard, serverNodeId = `standalone:${plugin.microserviceKey}`) {
    this.plugin = plugin;
    this.guard = guard;
    this.serverNodeId = serverNodeId;
    for (const route of plugin.routes) {
      const normalizedSubPath = route.subPath.startsWith("/") ? route.subPath : `/${route.subPath}`;
      this.routeMap.set(`${route.method}:${normalizedSubPath}`, route);
    }
  }
  plugin;
  guard;
  serverNodeId;
  routeMap = /* @__PURE__ */ new Map();
  async handleRequest(req) {
    const cleanHeaders = sanitizeInboundTenantHeaders(req.headers);
    const authHeaderRaw = cleanHeaders["authorization"] ?? cleanHeaders["Authorization"];
    const authorizationHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
    const [pathOnly] = req.path.split("?");
    const normalizedPath = (pathOnly ?? "/").startsWith("/") ? pathOnly ?? "/" : `/${pathOnly}`;
    const route = this.routeMap.get(`${req.method}:${normalizedPath}`);
    if (!route) {
      return {
        status: 404,
        headers: {
          "content-type": "application/problem+json",
          "x-proveko-served-by": this.serverNodeId
        },
        body: {
          type: "https://errors.proveko.com/err_not_found",
          title: PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
          status: 404,
          error_code: PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
          detail: `No route found for ${req.method} ${normalizedPath} in module ${this.plugin.microserviceKey}.`
        }
      };
    }
    try {
      const result = await this.guard.verifyAndExecute(
        {
          authorizationHeader,
          method: req.method,
          headers: cleanHeaders
        },
        this.plugin.parentService,
        this.plugin.microserviceKey,
        async (verifiedCtx) => route.handler(verifiedCtx, {
          ...req,
          path: normalizedPath,
          headers: cleanHeaders
        })
      );
      const defaultStatus = req.method === "POST" ? 201 : 200;
      return {
        status: route.successStatusCode ?? defaultStatus,
        headers: {
          "content-type": "application/json",
          "x-proveko-served-by": this.serverNodeId,
          "x-proveko-service": this.plugin.parentService,
          "x-proveko-microservice": this.plugin.microserviceKey,
          "x-proveko-parent-microservice": toParentMicroserviceNotation(this.plugin.parentService),
          "x-proveko-module": toModuleNotation(this.plugin.microserviceKey)
        },
        body: result
      };
    } catch (err) {
      if (err instanceof ProvekoDomainError) {
        return {
          status: err.statusCode,
          headers: {
            "content-type": "application/problem+json",
            "x-proveko-served-by": this.serverNodeId
          },
          body: err.toProblemDetails()
        };
      }
      const wrapped = new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        err instanceof Error ? err.message : "Invalid request payload."
      );
      return {
        status: wrapped.statusCode,
        headers: {
          "content-type": "application/problem+json",
          "x-proveko-served-by": this.serverNodeId
        },
        body: wrapped.toProblemDetails()
      };
    }
  }
};
var ParentServiceHostRunner = class {
  constructor(parentServiceInput, guard, plugins, enabledMicroservicesEnv, hostNodeId = `host-runner:${parentServiceInput}`) {
    this.guard = guard;
    this.hostNodeId = hostNodeId;
    this.parentService = normalizeParentMicroserviceKey(parentServiceInput);
    const allowedSet = this.parseEnabledFilter(enabledMicroservicesEnv);
    for (const plugin of plugins) {
      if (plugin.parentService !== this.parentService) {
        throw new Error(
          `Cannot mount module "${plugin.microserviceKey}" (parent: "${plugin.parentService}") inside host-runner for "${this.parentService}".`
        );
      }
      if (allowedSet && !allowedSet.has(plugin.microserviceKey)) {
        continue;
      }
      this.mountedMicroservices.set(
        plugin.microserviceKey,
        new StandaloneMicroserviceServer(
          plugin,
          this.guard,
          `${this.hostNodeId}[${plugin.microserviceKey}]`
        )
      );
    }
  }
  guard;
  hostNodeId;
  mountedMicroservices = /* @__PURE__ */ new Map();
  parentService;
  parseEnabledFilter(filter) {
    if (!filter) return null;
    if (typeof filter !== "string") {
      return new Set(filter.map((k) => normalizeModuleKey(k)));
    }
    const trimmed = filter.trim();
    if (!trimmed || trimmed === "*") return null;
    const keys = trimmed.split(",").map((s) => s.trim()).filter(Boolean).map((k) => normalizeModuleKey(k));
    return new Set(keys);
  }
  getMountedMicroserviceKeys() {
    return Array.from(this.mountedMicroservices.keys());
  }
  hasMicroservice(msKeyInput) {
    return this.mountedMicroservices.has(normalizeModuleKey(msKeyInput));
  }
  async dispatch(microserviceKeyInput, req) {
    const microserviceKey = normalizeModuleKey(microserviceKeyInput);
    const server = this.mountedMicroservices.get(microserviceKey);
    if (!server) {
      return {
        status: 503,
        headers: {
          "content-type": "application/problem+json",
          "x-proveko-served-by": this.hostNodeId
        },
        body: {
          type: "https://errors.proveko.com/err_microservice_disabled",
          title: "Module Not Mounted On This Host Runner",
          status: 503,
          error_code: PROVEKO_ERROR_CODES.ERR_MICROSERVICE_DISABLED,
          detail: `Module "${microserviceKey}" is not mounted on host-runner "${this.hostNodeId}". Check UpstreamRouteRegistry or ENABLED_MICROSERVICES.`
        }
      };
    }
    return server.handleRequest(req);
  }
};

// node_modules/drizzle-orm/entity.js
var entityKind = /* @__PURE__ */ Symbol.for("drizzle:entityKind");
function is(value, type) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value instanceof type) {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
    throw new Error(
      `Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
    );
  }
  let cls = Object.getPrototypeOf(value).constructor;
  if (cls) {
    while (cls) {
      if (entityKind in cls && cls[entityKind] === type[entityKind]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }
  return false;
}

// node_modules/drizzle-orm/column.js
var Column = class {
  constructor(table, config2) {
    this.table = table;
    this.config = config2;
    this.name = config2.name;
    this.keyAsName = config2.keyAsName;
    this.notNull = config2.notNull;
    this.default = config2.default;
    this.defaultFn = config2.defaultFn;
    this.onUpdateFn = config2.onUpdateFn;
    this.hasDefault = config2.hasDefault;
    this.primary = config2.primaryKey;
    this.isUnique = config2.isUnique;
    this.uniqueName = config2.uniqueName;
    this.uniqueType = config2.uniqueType;
    this.dataType = config2.dataType;
    this.columnType = config2.columnType;
    this.generated = config2.generated;
    this.generatedIdentity = config2.generatedIdentity;
  }
  static [entityKind] = "Column";
  name;
  keyAsName;
  primary;
  notNull;
  default;
  defaultFn;
  onUpdateFn;
  hasDefault;
  isUnique;
  uniqueName;
  uniqueType;
  dataType;
  columnType;
  enumValues = void 0;
  generated = void 0;
  generatedIdentity = void 0;
  config;
  mapFromDriverValue(value) {
    return value;
  }
  mapToDriverValue(value) {
    return value;
  }
  // ** @internal */
  shouldDisableInsert() {
    return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
  }
};

// node_modules/drizzle-orm/column-builder.js
var ColumnBuilder = class {
  static [entityKind] = "ColumnBuilder";
  config;
  constructor(name, dataType, columnType) {
    this.config = {
      name,
      keyAsName: name === "",
      notNull: false,
      default: void 0,
      hasDefault: false,
      primaryKey: false,
      isUnique: false,
      uniqueName: void 0,
      uniqueType: void 0,
      dataType,
      columnType,
      generated: void 0
    };
  }
  /**
   * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
   *
   * @example
   * ```ts
   * const users = pgTable('users', {
   * 	id: integer('id').$type<UserId>().primaryKey(),
   * 	details: json('details').$type<UserDetails>().notNull(),
   * });
   * ```
   */
  $type() {
    return this;
  }
  /**
   * Adds a `not null` clause to the column definition.
   *
   * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
   */
  notNull() {
    this.config.notNull = true;
    return this;
  }
  /**
   * Adds a `default <value>` clause to the column definition.
   *
   * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
   *
   * If you need to set a dynamic default value, use {@link $defaultFn} instead.
   */
  default(value) {
    this.config.default = value;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Adds a dynamic default value to the column.
   * The function will be called when the row is inserted, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $defaultFn(fn) {
    this.config.defaultFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $defaultFn}.
   */
  $default = this.$defaultFn;
  /**
   * Adds a dynamic update value to the column.
   * The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
   * If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $onUpdateFn(fn) {
    this.config.onUpdateFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $onUpdateFn}.
   */
  $onUpdate = this.$onUpdateFn;
  /**
   * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
   *
   * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
   */
  primaryKey() {
    this.config.primaryKey = true;
    this.config.notNull = true;
    return this;
  }
  /** @internal Sets the name of the column to the key within the table definition if a name was not given. */
  setName(name) {
    if (this.config.name !== "")
      return;
    this.config.name = name;
  }
};

// node_modules/drizzle-orm/table.utils.js
var TableName = /* @__PURE__ */ Symbol.for("drizzle:Name");

// node_modules/drizzle-orm/pg-core/foreign-keys.js
var ForeignKeyBuilder = class {
  static [entityKind] = "PgForeignKeyBuilder";
  /** @internal */
  reference;
  /** @internal */
  _onUpdate = "no action";
  /** @internal */
  _onDelete = "no action";
  constructor(config2, actions) {
    this.reference = () => {
      const { name, columns, foreignColumns } = config2();
      return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action === void 0 ? "no action" : action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action === void 0 ? "no action" : action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey(table, this);
  }
};
var ForeignKey = class {
  constructor(table, builder) {
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  static [entityKind] = "PgForeignKey";
  reference;
  onUpdate;
  onDelete;
  getName() {
    const { name, columns, foreignColumns } = this.reference();
    const columnNames = columns.map((column) => column.name);
    const foreignColumnNames = foreignColumns.map((column) => column.name);
    const chunks = [
      this.table[TableName],
      ...columnNames,
      foreignColumns[0].table[TableName],
      ...foreignColumnNames
    ];
    return name ?? `${chunks.join("_")}_fk`;
  }
};

// node_modules/drizzle-orm/tracing-utils.js
function iife(fn, ...args) {
  return fn(...args);
}

// node_modules/drizzle-orm/pg-core/unique-constraint.js
function uniqueKeyName(table, columns) {
  return `${table[TableName]}_${columns.join("_")}_unique`;
}
var UniqueConstraintBuilder = class {
  constructor(columns, name) {
    this.name = name;
    this.columns = columns;
  }
  static [entityKind] = "PgUniqueConstraintBuilder";
  /** @internal */
  columns;
  /** @internal */
  nullsNotDistinctConfig = false;
  nullsNotDistinct() {
    this.nullsNotDistinctConfig = true;
    return this;
  }
  /** @internal */
  build(table) {
    return new UniqueConstraint(table, this.columns, this.nullsNotDistinctConfig, this.name);
  }
};
var UniqueOnConstraintBuilder = class {
  static [entityKind] = "PgUniqueOnConstraintBuilder";
  /** @internal */
  name;
  constructor(name) {
    this.name = name;
  }
  on(...columns) {
    return new UniqueConstraintBuilder(columns, this.name);
  }
};
var UniqueConstraint = class {
  constructor(table, columns, nullsNotDistinct, name) {
    this.table = table;
    this.columns = columns;
    this.name = name ?? uniqueKeyName(this.table, this.columns.map((column) => column.name));
    this.nullsNotDistinct = nullsNotDistinct;
  }
  static [entityKind] = "PgUniqueConstraint";
  columns;
  name;
  nullsNotDistinct = false;
  getName() {
    return this.name;
  }
};

// node_modules/drizzle-orm/pg-core/utils/array.js
function parsePgArrayValue(arrayString, startFrom, inQuotes) {
  for (let i = startFrom; i < arrayString.length; i++) {
    const char2 = arrayString[i];
    if (char2 === "\\") {
      i++;
      continue;
    }
    if (char2 === '"') {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i + 1];
    }
    if (inQuotes) {
      continue;
    }
    if (char2 === "," || char2 === "}") {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i];
    }
  }
  return [arrayString.slice(startFrom).replace(/\\/g, ""), arrayString.length];
}
function parsePgNestedArray(arrayString, startFrom = 0) {
  const result = [];
  let i = startFrom;
  let lastCharIsComma = false;
  while (i < arrayString.length) {
    const char2 = arrayString[i];
    if (char2 === ",") {
      if (lastCharIsComma || i === startFrom) {
        result.push("");
      }
      lastCharIsComma = true;
      i++;
      continue;
    }
    lastCharIsComma = false;
    if (char2 === "\\") {
      i += 2;
      continue;
    }
    if (char2 === '"') {
      const [value2, startFrom2] = parsePgArrayValue(arrayString, i + 1, true);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    if (char2 === "}") {
      return [result, i + 1];
    }
    if (char2 === "{") {
      const [value2, startFrom2] = parsePgNestedArray(arrayString, i + 1);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    const [value, newStartFrom] = parsePgArrayValue(arrayString, i, false);
    result.push(value);
    i = newStartFrom;
  }
  return [result, i];
}
function parsePgArray(arrayString) {
  const [result] = parsePgNestedArray(arrayString, 1);
  return result;
}
function makePgArray(array) {
  return `{${array.map((item) => {
    if (Array.isArray(item)) {
      return makePgArray(item);
    }
    if (typeof item === "string") {
      return `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return `${item}`;
  }).join(",")}}`;
}

// node_modules/drizzle-orm/pg-core/columns/common.js
var PgColumnBuilder = class extends ColumnBuilder {
  foreignKeyConfigs = [];
  static [entityKind] = "PgColumnBuilder";
  array(size) {
    return new PgArrayBuilder(this.config.name, this, size);
  }
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name, config2) {
    this.config.isUnique = true;
    this.config.uniqueName = name;
    this.config.uniqueType = config2?.nulls;
    return this;
  }
  generatedAlwaysAs(as) {
    this.config.generated = {
      as,
      type: "always",
      mode: "stored"
    };
    return this;
  }
  /** @internal */
  buildForeignKeys(column, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return iife(
        (ref2, actions2) => {
          const builder = new ForeignKeyBuilder(() => {
            const foreignColumn = ref2();
            return { columns: [column], foreignColumns: [foreignColumn] };
          });
          if (actions2.onUpdate) {
            builder.onUpdate(actions2.onUpdate);
          }
          if (actions2.onDelete) {
            builder.onDelete(actions2.onDelete);
          }
          return builder.build(table);
        },
        ref,
        actions
      );
    });
  }
  /** @internal */
  buildExtraConfigColumn(table) {
    return new ExtraConfigColumn(table, this.config);
  }
};
var PgColumn = class extends Column {
  constructor(table, config2) {
    if (!config2.uniqueName) {
      config2.uniqueName = uniqueKeyName(table, [config2.name]);
    }
    super(table, config2);
    this.table = table;
  }
  static [entityKind] = "PgColumn";
};
var ExtraConfigColumn = class extends PgColumn {
  static [entityKind] = "ExtraConfigColumn";
  getSQLType() {
    return this.getSQLType();
  }
  indexConfig = {
    order: this.config.order ?? "asc",
    nulls: this.config.nulls ?? "last",
    opClass: this.config.opClass
  };
  defaultConfig = {
    order: "asc",
    nulls: "last",
    opClass: void 0
  };
  asc() {
    this.indexConfig.order = "asc";
    return this;
  }
  desc() {
    this.indexConfig.order = "desc";
    return this;
  }
  nullsFirst() {
    this.indexConfig.nulls = "first";
    return this;
  }
  nullsLast() {
    this.indexConfig.nulls = "last";
    return this;
  }
  /**
   * ### PostgreSQL documentation quote
   *
   * > An operator class with optional parameters can be specified for each column of an index.
   * The operator class identifies the operators to be used by the index for that column.
   * For example, a B-tree index on four-byte integers would use the int4_ops class;
   * this operator class includes comparison functions for four-byte integers.
   * In practice the default operator class for the column's data type is usually sufficient.
   * The main point of having operator classes is that for some data types, there could be more than one meaningful ordering.
   * For example, we might want to sort a complex-number data type either by absolute value or by real part.
   * We could do this by defining two operator classes for the data type and then selecting the proper class when creating an index.
   * More information about operator classes check:
   *
   * ### Useful links
   * https://www.postgresql.org/docs/current/sql-createindex.html
   *
   * https://www.postgresql.org/docs/current/indexes-opclass.html
   *
   * https://www.postgresql.org/docs/current/xindex.html
   *
   * ### Additional types
   * If you have the `pg_vector` extension installed in your database, you can use the
   * `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops`, `vector_l1_ops`, `bit_hamming_ops`, `bit_jaccard_ops`, `halfvec_l2_ops`, `sparsevec_l2_ops` options, which are predefined types.
   *
   * **You can always specify any string you want in the operator class, in case Drizzle doesn't have it natively in its types**
   *
   * @param opClass
   * @returns
   */
  op(opClass) {
    this.indexConfig.opClass = opClass;
    return this;
  }
};
var IndexedColumn = class {
  static [entityKind] = "IndexedColumn";
  constructor(name, keyAsName, type, indexConfig) {
    this.name = name;
    this.keyAsName = keyAsName;
    this.type = type;
    this.indexConfig = indexConfig;
  }
  name;
  keyAsName;
  type;
  indexConfig;
};
var PgArrayBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgArrayBuilder";
  constructor(name, baseBuilder, size) {
    super(name, "array", "PgArray");
    this.config.baseBuilder = baseBuilder;
    this.config.size = size;
  }
  /** @internal */
  build(table) {
    const baseColumn = this.config.baseBuilder.build(table);
    return new PgArray(
      table,
      this.config,
      baseColumn
    );
  }
};
var PgArray = class _PgArray extends PgColumn {
  constructor(table, config2, baseColumn, range) {
    super(table, config2);
    this.baseColumn = baseColumn;
    this.range = range;
    this.size = config2.size;
  }
  size;
  static [entityKind] = "PgArray";
  getSQLType() {
    return `${this.baseColumn.getSQLType()}[${typeof this.size === "number" ? this.size : ""}]`;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      value = parsePgArray(value);
    }
    return value.map((v) => this.baseColumn.mapFromDriverValue(v));
  }
  mapToDriverValue(value, isNestedArray = false) {
    const a = value.map(
      (v) => v === null ? null : is(this.baseColumn, _PgArray) ? this.baseColumn.mapToDriverValue(v, true) : this.baseColumn.mapToDriverValue(v)
    );
    if (isNestedArray)
      return a;
    return makePgArray(a);
  }
};

// node_modules/drizzle-orm/pg-core/columns/enum.js
var isPgEnumSym = /* @__PURE__ */ Symbol.for("drizzle:isPgEnum");
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
var PgEnumColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgEnumColumnBuilder";
  constructor(name, enumInstance) {
    super(name, "string", "PgEnumColumn");
    this.config.enum = enumInstance;
  }
  /** @internal */
  build(table) {
    return new PgEnumColumn(
      table,
      this.config
    );
  }
};
var PgEnumColumn = class extends PgColumn {
  static [entityKind] = "PgEnumColumn";
  enum = this.config.enum;
  enumValues = this.config.enum.enumValues;
  constructor(table, config2) {
    super(table, config2);
    this.enum = config2.enum;
  }
  getSQLType() {
    return this.enum.enumName;
  }
};
function pgEnumWithSchema(enumName, values, schema) {
  const enumInstance = Object.assign(
    (name) => new PgEnumColumnBuilder(name ?? "", enumInstance),
    {
      enumName,
      enumValues: values,
      schema,
      [isPgEnumSym]: true
    }
  );
  return enumInstance;
}

// node_modules/drizzle-orm/subquery.js
var Subquery = class {
  static [entityKind] = "Subquery";
  constructor(sql2, selection, alias, isWith = false) {
    this._ = {
      brand: "Subquery",
      sql: sql2,
      selectedFields: selection,
      alias,
      isWith
    };
  }
  // getSQL(): SQL<unknown> {
  // 	return new SQL([this]);
  // }
};
var WithSubquery = class extends Subquery {
  static [entityKind] = "WithSubquery";
};

// node_modules/drizzle-orm/version.js
var version = "0.39.3";

// node_modules/drizzle-orm/tracing.js
var otel;
var rawTracer;
var tracer = {
  startActiveSpan(name, fn) {
    if (!otel) {
      return fn();
    }
    if (!rawTracer) {
      rawTracer = otel.trace.getTracer("drizzle-orm", version);
    }
    return iife(
      (otel2, rawTracer2) => rawTracer2.startActiveSpan(
        name,
        (span) => {
          try {
            return fn(span);
          } catch (e) {
            span.setStatus({
              code: otel2.SpanStatusCode.ERROR,
              message: e instanceof Error ? e.message : "Unknown error"
              // eslint-disable-line no-instanceof/no-instanceof
            });
            throw e;
          } finally {
            span.end();
          }
        }
      ),
      otel,
      rawTracer
    );
  }
};

// node_modules/drizzle-orm/view-common.js
var ViewBaseConfig = /* @__PURE__ */ Symbol.for("drizzle:ViewBaseConfig");

// node_modules/drizzle-orm/table.js
var Schema = /* @__PURE__ */ Symbol.for("drizzle:Schema");
var Columns = /* @__PURE__ */ Symbol.for("drizzle:Columns");
var ExtraConfigColumns = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigColumns");
var OriginalName = /* @__PURE__ */ Symbol.for("drizzle:OriginalName");
var BaseName = /* @__PURE__ */ Symbol.for("drizzle:BaseName");
var IsAlias = /* @__PURE__ */ Symbol.for("drizzle:IsAlias");
var ExtraConfigBuilder = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigBuilder");
var IsDrizzleTable = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleTable");
var Table = class {
  static [entityKind] = "Table";
  /** @internal */
  static Symbol = {
    Name: TableName,
    Schema,
    OriginalName,
    Columns,
    ExtraConfigColumns,
    BaseName,
    IsAlias,
    ExtraConfigBuilder
  };
  /**
   * @internal
   * Can be changed if the table is aliased.
   */
  [TableName];
  /**
   * @internal
   * Used to store the original name of the table, before any aliasing.
   */
  [OriginalName];
  /** @internal */
  [Schema];
  /** @internal */
  [Columns];
  /** @internal */
  [ExtraConfigColumns];
  /**
   *  @internal
   * Used to store the table name before the transformation via the `tableCreator` functions.
   */
  [BaseName];
  /** @internal */
  [IsAlias] = false;
  /** @internal */
  [IsDrizzleTable] = true;
  /** @internal */
  [ExtraConfigBuilder] = void 0;
  constructor(name, schema, baseName) {
    this[TableName] = this[OriginalName] = name;
    this[Schema] = schema;
    this[BaseName] = baseName;
  }
};
function getTableName(table) {
  return table[TableName];
}
function getTableUniqueName(table) {
  return `${table[Schema] ?? "public"}.${table[TableName]}`;
}

// node_modules/drizzle-orm/sql/sql.js
var FakePrimitiveParam = class {
  static [entityKind] = "FakePrimitiveParam";
};
function isSQLWrapper(value) {
  return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
function mergeQueries(queries) {
  const result = { sql: "", params: [] };
  for (const query of queries) {
    result.sql += query.sql;
    result.params.push(...query.params);
    if (query.typings?.length) {
      if (!result.typings) {
        result.typings = [];
      }
      result.typings.push(...query.typings);
    }
  }
  return result;
}
var StringChunk = class {
  static [entityKind] = "StringChunk";
  value;
  constructor(value) {
    this.value = Array.isArray(value) ? value : [value];
  }
  getSQL() {
    return new SQL([this]);
  }
};
var SQL = class _SQL {
  constructor(queryChunks) {
    this.queryChunks = queryChunks;
  }
  static [entityKind] = "SQL";
  /** @internal */
  decoder = noopDecoder;
  shouldInlineParams = false;
  append(query) {
    this.queryChunks.push(...query.queryChunks);
    return this;
  }
  toQuery(config2) {
    return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
      const query = this.buildQueryFromSourceParams(this.queryChunks, config2);
      span?.setAttributes({
        "drizzle.query.text": query.sql,
        "drizzle.query.params": JSON.stringify(query.params)
      });
      return query;
    });
  }
  buildQueryFromSourceParams(chunks, _config) {
    const config2 = Object.assign({}, _config, {
      inlineParams: _config.inlineParams || this.shouldInlineParams,
      paramStartIndex: _config.paramStartIndex || { value: 0 }
    });
    const {
      casing,
      escapeName,
      escapeParam,
      prepareTyping,
      inlineParams,
      paramStartIndex
    } = config2;
    return mergeQueries(chunks.map((chunk) => {
      if (is(chunk, StringChunk)) {
        return { sql: chunk.value.join(""), params: [] };
      }
      if (is(chunk, Name)) {
        return { sql: escapeName(chunk.value), params: [] };
      }
      if (chunk === void 0) {
        return { sql: "", params: [] };
      }
      if (Array.isArray(chunk)) {
        const result = [new StringChunk("(")];
        for (const [i, p] of chunk.entries()) {
          result.push(p);
          if (i < chunk.length - 1) {
            result.push(new StringChunk(", "));
          }
        }
        result.push(new StringChunk(")"));
        return this.buildQueryFromSourceParams(result, config2);
      }
      if (is(chunk, _SQL)) {
        return this.buildQueryFromSourceParams(chunk.queryChunks, {
          ...config2,
          inlineParams: inlineParams || chunk.shouldInlineParams
        });
      }
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        const tableName = chunk[Table.Symbol.Name];
        return {
          sql: schemaName === void 0 || chunk[IsAlias] ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
          params: []
        };
      }
      if (is(chunk, Column)) {
        const columnName = casing.getColumnCasing(chunk);
        if (_config.invokeSource === "indexes") {
          return { sql: escapeName(columnName), params: [] };
        }
        const schemaName = chunk.table[Table.Symbol.Schema];
        return {
          sql: chunk.table[IsAlias] || schemaName === void 0 ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
          params: []
        };
      }
      if (is(chunk, View)) {
        const schemaName = chunk[ViewBaseConfig].schema;
        const viewName = chunk[ViewBaseConfig].name;
        return {
          sql: schemaName === void 0 || chunk[ViewBaseConfig].isAlias ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
          params: []
        };
      }
      if (is(chunk, Param)) {
        if (is(chunk.value, Placeholder)) {
          return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
        }
        const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
        if (is(mappedValue, _SQL)) {
          return this.buildQueryFromSourceParams([mappedValue], config2);
        }
        if (inlineParams) {
          return { sql: this.mapInlineParam(mappedValue, config2), params: [] };
        }
        let typings = ["none"];
        if (prepareTyping) {
          typings = [prepareTyping(chunk.encoder)];
        }
        return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
      }
      if (is(chunk, Placeholder)) {
        return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
      }
      if (is(chunk, _SQL.Aliased) && chunk.fieldAlias !== void 0) {
        return { sql: escapeName(chunk.fieldAlias), params: [] };
      }
      if (is(chunk, Subquery)) {
        if (chunk._.isWith) {
          return { sql: escapeName(chunk._.alias), params: [] };
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk._.sql,
          new StringChunk(") "),
          new Name(chunk._.alias)
        ], config2);
      }
      if (isPgEnum(chunk)) {
        if (chunk.schema) {
          return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
        }
        return { sql: escapeName(chunk.enumName), params: [] };
      }
      if (isSQLWrapper(chunk)) {
        if (chunk.shouldOmitSQLParens?.()) {
          return this.buildQueryFromSourceParams([chunk.getSQL()], config2);
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk.getSQL(),
          new StringChunk(")")
        ], config2);
      }
      if (inlineParams) {
        return { sql: this.mapInlineParam(chunk, config2), params: [] };
      }
      return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
    }));
  }
  mapInlineParam(chunk, { escapeString }) {
    if (chunk === null) {
      return "null";
    }
    if (typeof chunk === "number" || typeof chunk === "boolean") {
      return chunk.toString();
    }
    if (typeof chunk === "string") {
      return escapeString(chunk);
    }
    if (typeof chunk === "object") {
      const mappedValueAsString = chunk.toString();
      if (mappedValueAsString === "[object Object]") {
        return escapeString(JSON.stringify(chunk));
      }
      return escapeString(mappedValueAsString);
    }
    throw new Error("Unexpected param value: " + chunk);
  }
  getSQL() {
    return this;
  }
  as(alias) {
    if (alias === void 0) {
      return this;
    }
    return new _SQL.Aliased(this, alias);
  }
  mapWith(decoder) {
    this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
    return this;
  }
  inlineParams() {
    this.shouldInlineParams = true;
    return this;
  }
  /**
   * This method is used to conditionally include a part of the query.
   *
   * @param condition - Condition to check
   * @returns itself if the condition is `true`, otherwise `undefined`
   */
  if(condition) {
    return condition ? this : void 0;
  }
};
var Name = class {
  constructor(value) {
    this.value = value;
  }
  static [entityKind] = "Name";
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
function isDriverValueEncoder(value) {
  return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
var noopDecoder = {
  mapFromDriverValue: (value) => value
};
var noopEncoder = {
  mapToDriverValue: (value) => value
};
var noopMapper = {
  ...noopDecoder,
  ...noopEncoder
};
var Param = class {
  /**
   * @param value - Parameter value
   * @param encoder - Encoder to convert the value to a driver parameter
   */
  constructor(value, encoder = noopEncoder) {
    this.value = value;
    this.encoder = encoder;
  }
  static [entityKind] = "Param";
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
function sql(strings, ...params) {
  const queryChunks = [];
  if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
    queryChunks.push(new StringChunk(strings[0]));
  }
  for (const [paramIndex, param2] of params.entries()) {
    queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
  }
  return new SQL(queryChunks);
}
((sql2) => {
  function empty() {
    return new SQL([]);
  }
  sql2.empty = empty;
  function fromList(list) {
    return new SQL(list);
  }
  sql2.fromList = fromList;
  function raw(str) {
    return new SQL([new StringChunk(str)]);
  }
  sql2.raw = raw;
  function join5(chunks, separator) {
    const result = [];
    for (const [i, chunk] of chunks.entries()) {
      if (i > 0 && separator !== void 0) {
        result.push(separator);
      }
      result.push(chunk);
    }
    return new SQL(result);
  }
  sql2.join = join5;
  function identifier(value) {
    return new Name(value);
  }
  sql2.identifier = identifier;
  function placeholder2(name2) {
    return new Placeholder(name2);
  }
  sql2.placeholder = placeholder2;
  function param2(value, encoder) {
    return new Param(value, encoder);
  }
  sql2.param = param2;
})(sql || (sql = {}));
((SQL2) => {
  class Aliased {
    constructor(sql2, fieldAlias) {
      this.sql = sql2;
      this.fieldAlias = fieldAlias;
    }
    static [entityKind] = "SQL.Aliased";
    /** @internal */
    isSelectionField = false;
    getSQL() {
      return this.sql;
    }
    /** @internal */
    clone() {
      return new Aliased(this.sql, this.fieldAlias);
    }
  }
  SQL2.Aliased = Aliased;
})(SQL || (SQL = {}));
var Placeholder = class {
  constructor(name2) {
    this.name = name2;
  }
  static [entityKind] = "Placeholder";
  getSQL() {
    return new SQL([this]);
  }
};
var IsDrizzleView = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleView");
var View = class {
  static [entityKind] = "View";
  /** @internal */
  [ViewBaseConfig];
  /** @internal */
  [IsDrizzleView] = true;
  constructor({ name: name2, schema, selectedFields, query }) {
    this[ViewBaseConfig] = {
      name: name2,
      originalName: name2,
      schema,
      selectedFields,
      query,
      isExisting: !query,
      isAlias: false
    };
  }
  getSQL() {
    return new SQL([this]);
  }
};
Column.prototype.getSQL = function() {
  return new SQL([this]);
};
Table.prototype.getSQL = function() {
  return new SQL([this]);
};
Subquery.prototype.getSQL = function() {
  return new SQL([this]);
};

// node_modules/drizzle-orm/alias.js
var ColumnAliasProxyHandler = class {
  constructor(table) {
    this.table = table;
  }
  static [entityKind] = "ColumnAliasProxyHandler";
  get(columnObj, prop) {
    if (prop === "table") {
      return this.table;
    }
    return columnObj[prop];
  }
};
var TableAliasProxyHandler = class {
  constructor(alias, replaceOriginalName) {
    this.alias = alias;
    this.replaceOriginalName = replaceOriginalName;
  }
  static [entityKind] = "TableAliasProxyHandler";
  get(target, prop) {
    if (prop === Table.Symbol.IsAlias) {
      return true;
    }
    if (prop === Table.Symbol.Name) {
      return this.alias;
    }
    if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
      return this.alias;
    }
    if (prop === ViewBaseConfig) {
      return {
        ...target[ViewBaseConfig],
        name: this.alias,
        isAlias: true
      };
    }
    if (prop === Table.Symbol.Columns) {
      const columns = target[Table.Symbol.Columns];
      if (!columns) {
        return columns;
      }
      const proxiedColumns = {};
      Object.keys(columns).map((key) => {
        proxiedColumns[key] = new Proxy(
          columns[key],
          new ColumnAliasProxyHandler(new Proxy(target, this))
        );
      });
      return proxiedColumns;
    }
    const value = target[prop];
    if (is(value, Column)) {
      return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
    }
    return value;
  }
};
var RelationTableAliasProxyHandler = class {
  constructor(alias) {
    this.alias = alias;
  }
  static [entityKind] = "RelationTableAliasProxyHandler";
  get(target, prop) {
    if (prop === "sourceTable") {
      return aliasedTable(target.sourceTable, this.alias);
    }
    return target[prop];
  }
};
function aliasedTable(table, tableAlias) {
  return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
function aliasedTableColumn(column, tableAlias) {
  return new Proxy(
    column,
    new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false)))
  );
}
function mapColumnsInAliasedSQLToAlias(query, alias) {
  return new SQL.Aliased(mapColumnsInSQLToAlias(query.sql, alias), query.fieldAlias);
}
function mapColumnsInSQLToAlias(query, alias) {
  return sql.join(query.queryChunks.map((c) => {
    if (is(c, Column)) {
      return aliasedTableColumn(c, alias);
    }
    if (is(c, SQL)) {
      return mapColumnsInSQLToAlias(c, alias);
    }
    if (is(c, SQL.Aliased)) {
      return mapColumnsInAliasedSQLToAlias(c, alias);
    }
    return c;
  }));
}

// node_modules/drizzle-orm/utils.js
function orderSelectedFields(fields, pathPrefix) {
  return Object.entries(fields).reduce((result, [name, field]) => {
    if (typeof name !== "string") {
      return result;
    }
    const newPath = pathPrefix ? [...pathPrefix, name] : [name];
    if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased)) {
      result.push({ path: newPath, field });
    } else if (is(field, Table)) {
      result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
    } else {
      result.push(...orderSelectedFields(field, newPath));
    }
    return result;
  }, []);
}
function haveSameKeys(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const [index, key] of leftKeys.entries()) {
    if (key !== rightKeys[index]) {
      return false;
    }
  }
  return true;
}
function applyMixins(baseClass, extendedClasses) {
  for (const extendedClass of extendedClasses) {
    for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
      if (name === "constructor")
        continue;
      Object.defineProperty(
        baseClass.prototype,
        name,
        Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null)
      );
    }
  }
}
function getTableColumns(table) {
  return table[Table.Symbol.Columns];
}
function getTableLikeName(table) {
  return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
function getColumnNameAndConfig(a, b) {
  return {
    name: typeof a === "string" && a.length > 0 ? a : "",
    config: typeof a === "object" ? a : b
  };
}

// node_modules/drizzle-orm/pg-core/columns/int.common.js
var PgIntColumnBaseBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgIntColumnBaseBuilder";
  generatedAlwaysAsIdentity(sequence) {
    if (sequence) {
      const { name, ...options } = sequence;
      this.config.generatedIdentity = {
        type: "always",
        sequenceName: name,
        sequenceOptions: options
      };
    } else {
      this.config.generatedIdentity = {
        type: "always"
      };
    }
    this.config.hasDefault = true;
    this.config.notNull = true;
    return this;
  }
  generatedByDefaultAsIdentity(sequence) {
    if (sequence) {
      const { name, ...options } = sequence;
      this.config.generatedIdentity = {
        type: "byDefault",
        sequenceName: name,
        sequenceOptions: options
      };
    } else {
      this.config.generatedIdentity = {
        type: "byDefault"
      };
    }
    this.config.hasDefault = true;
    this.config.notNull = true;
    return this;
  }
};

// node_modules/drizzle-orm/pg-core/columns/bigint.js
var PgBigInt53Builder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgBigInt53Builder";
  constructor(name) {
    super(name, "number", "PgBigInt53");
  }
  /** @internal */
  build(table) {
    return new PgBigInt53(table, this.config);
  }
};
var PgBigInt53 = class extends PgColumn {
  static [entityKind] = "PgBigInt53";
  getSQLType() {
    return "bigint";
  }
  mapFromDriverValue(value) {
    if (typeof value === "number") {
      return value;
    }
    return Number(value);
  }
};
var PgBigInt64Builder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgBigInt64Builder";
  constructor(name) {
    super(name, "bigint", "PgBigInt64");
  }
  /** @internal */
  build(table) {
    return new PgBigInt64(
      table,
      this.config
    );
  }
};
var PgBigInt64 = class extends PgColumn {
  static [entityKind] = "PgBigInt64";
  getSQLType() {
    return "bigint";
  }
  // eslint-disable-next-line unicorn/prefer-native-coercion-functions
  mapFromDriverValue(value) {
    return BigInt(value);
  }
};
function bigint(a, b) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  if (config2.mode === "number") {
    return new PgBigInt53Builder(name);
  }
  return new PgBigInt64Builder(name);
}

// node_modules/drizzle-orm/pg-core/columns/bigserial.js
var PgBigSerial53Builder = class extends PgColumnBuilder {
  static [entityKind] = "PgBigSerial53Builder";
  constructor(name) {
    super(name, "number", "PgBigSerial53");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgBigSerial53(
      table,
      this.config
    );
  }
};
var PgBigSerial53 = class extends PgColumn {
  static [entityKind] = "PgBigSerial53";
  getSQLType() {
    return "bigserial";
  }
  mapFromDriverValue(value) {
    if (typeof value === "number") {
      return value;
    }
    return Number(value);
  }
};
var PgBigSerial64Builder = class extends PgColumnBuilder {
  static [entityKind] = "PgBigSerial64Builder";
  constructor(name) {
    super(name, "bigint", "PgBigSerial64");
    this.config.hasDefault = true;
  }
  /** @internal */
  build(table) {
    return new PgBigSerial64(
      table,
      this.config
    );
  }
};
var PgBigSerial64 = class extends PgColumn {
  static [entityKind] = "PgBigSerial64";
  getSQLType() {
    return "bigserial";
  }
  // eslint-disable-next-line unicorn/prefer-native-coercion-functions
  mapFromDriverValue(value) {
    return BigInt(value);
  }
};
function bigserial(a, b) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  if (config2.mode === "number") {
    return new PgBigSerial53Builder(name);
  }
  return new PgBigSerial64Builder(name);
}

// node_modules/drizzle-orm/pg-core/columns/boolean.js
var PgBooleanBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgBooleanBuilder";
  constructor(name) {
    super(name, "boolean", "PgBoolean");
  }
  /** @internal */
  build(table) {
    return new PgBoolean(table, this.config);
  }
};
var PgBoolean = class extends PgColumn {
  static [entityKind] = "PgBoolean";
  getSQLType() {
    return "boolean";
  }
};
function boolean(name) {
  return new PgBooleanBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/char.js
var PgCharBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgCharBuilder";
  constructor(name, config2) {
    super(name, "string", "PgChar");
    this.config.length = config2.length;
    this.config.enumValues = config2.enum;
  }
  /** @internal */
  build(table) {
    return new PgChar(
      table,
      this.config
    );
  }
};
var PgChar = class extends PgColumn {
  static [entityKind] = "PgChar";
  length = this.config.length;
  enumValues = this.config.enumValues;
  getSQLType() {
    return this.length === void 0 ? `char` : `char(${this.length})`;
  }
};
function char(a, b = {}) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  return new PgCharBuilder(name, config2);
}

// node_modules/drizzle-orm/pg-core/columns/cidr.js
var PgCidrBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgCidrBuilder";
  constructor(name) {
    super(name, "string", "PgCidr");
  }
  /** @internal */
  build(table) {
    return new PgCidr(table, this.config);
  }
};
var PgCidr = class extends PgColumn {
  static [entityKind] = "PgCidr";
  getSQLType() {
    return "cidr";
  }
};
function cidr(name) {
  return new PgCidrBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/custom.js
var PgCustomColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgCustomColumnBuilder";
  constructor(name, fieldConfig, customTypeParams) {
    super(name, "custom", "PgCustomColumn");
    this.config.fieldConfig = fieldConfig;
    this.config.customTypeParams = customTypeParams;
  }
  /** @internal */
  build(table) {
    return new PgCustomColumn(
      table,
      this.config
    );
  }
};
var PgCustomColumn = class extends PgColumn {
  static [entityKind] = "PgCustomColumn";
  sqlName;
  mapTo;
  mapFrom;
  constructor(table, config2) {
    super(table, config2);
    this.sqlName = config2.customTypeParams.dataType(config2.fieldConfig);
    this.mapTo = config2.customTypeParams.toDriver;
    this.mapFrom = config2.customTypeParams.fromDriver;
  }
  getSQLType() {
    return this.sqlName;
  }
  mapFromDriverValue(value) {
    return typeof this.mapFrom === "function" ? this.mapFrom(value) : value;
  }
  mapToDriverValue(value) {
    return typeof this.mapTo === "function" ? this.mapTo(value) : value;
  }
};
function customType(customTypeParams) {
  return (a, b) => {
    const { name, config: config2 } = getColumnNameAndConfig(a, b);
    return new PgCustomColumnBuilder(name, config2, customTypeParams);
  };
}

// node_modules/drizzle-orm/pg-core/columns/date.common.js
var PgDateColumnBaseBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgDateColumnBaseBuilder";
  defaultNow() {
    return this.default(sql`now()`);
  }
};

// node_modules/drizzle-orm/pg-core/columns/date.js
var PgDateBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgDateBuilder";
  constructor(name) {
    super(name, "date", "PgDate");
  }
  /** @internal */
  build(table) {
    return new PgDate(table, this.config);
  }
};
var PgDate = class extends PgColumn {
  static [entityKind] = "PgDate";
  getSQLType() {
    return "date";
  }
  mapFromDriverValue(value) {
    return new Date(value);
  }
  mapToDriverValue(value) {
    return value.toISOString();
  }
};
var PgDateStringBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgDateStringBuilder";
  constructor(name) {
    super(name, "string", "PgDateString");
  }
  /** @internal */
  build(table) {
    return new PgDateString(
      table,
      this.config
    );
  }
};
var PgDateString = class extends PgColumn {
  static [entityKind] = "PgDateString";
  getSQLType() {
    return "date";
  }
};
function date(a, b) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  if (config2?.mode === "date") {
    return new PgDateBuilder(name);
  }
  return new PgDateStringBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/double-precision.js
var PgDoublePrecisionBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgDoublePrecisionBuilder";
  constructor(name) {
    super(name, "number", "PgDoublePrecision");
  }
  /** @internal */
  build(table) {
    return new PgDoublePrecision(
      table,
      this.config
    );
  }
};
var PgDoublePrecision = class extends PgColumn {
  static [entityKind] = "PgDoublePrecision";
  getSQLType() {
    return "double precision";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      return Number.parseFloat(value);
    }
    return value;
  }
};
function doublePrecision(name) {
  return new PgDoublePrecisionBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/inet.js
var PgInetBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgInetBuilder";
  constructor(name) {
    super(name, "string", "PgInet");
  }
  /** @internal */
  build(table) {
    return new PgInet(table, this.config);
  }
};
var PgInet = class extends PgColumn {
  static [entityKind] = "PgInet";
  getSQLType() {
    return "inet";
  }
};
function inet(name) {
  return new PgInetBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/integer.js
var PgIntegerBuilder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgIntegerBuilder";
  constructor(name) {
    super(name, "number", "PgInteger");
  }
  /** @internal */
  build(table) {
    return new PgInteger(table, this.config);
  }
};
var PgInteger = class extends PgColumn {
  static [entityKind] = "PgInteger";
  getSQLType() {
    return "integer";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      return Number.parseInt(value);
    }
    return value;
  }
};
function integer(name) {
  return new PgIntegerBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/interval.js
var PgIntervalBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgIntervalBuilder";
  constructor(name, intervalConfig) {
    super(name, "string", "PgInterval");
    this.config.intervalConfig = intervalConfig;
  }
  /** @internal */
  build(table) {
    return new PgInterval(table, this.config);
  }
};
var PgInterval = class extends PgColumn {
  static [entityKind] = "PgInterval";
  fields = this.config.intervalConfig.fields;
  precision = this.config.intervalConfig.precision;
  getSQLType() {
    const fields = this.fields ? ` ${this.fields}` : "";
    const precision = this.precision ? `(${this.precision})` : "";
    return `interval${fields}${precision}`;
  }
};
function interval(a, b = {}) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  return new PgIntervalBuilder(name, config2);
}

// node_modules/drizzle-orm/pg-core/columns/json.js
var PgJsonBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgJsonBuilder";
  constructor(name) {
    super(name, "json", "PgJson");
  }
  /** @internal */
  build(table) {
    return new PgJson(table, this.config);
  }
};
var PgJson = class extends PgColumn {
  static [entityKind] = "PgJson";
  constructor(table, config2) {
    super(table, config2);
  }
  getSQLType() {
    return "json";
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
};
function json(name) {
  return new PgJsonBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/jsonb.js
var PgJsonbBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgJsonbBuilder";
  constructor(name) {
    super(name, "json", "PgJsonb");
  }
  /** @internal */
  build(table) {
    return new PgJsonb(table, this.config);
  }
};
var PgJsonb = class extends PgColumn {
  static [entityKind] = "PgJsonb";
  constructor(table, config2) {
    super(table, config2);
  }
  getSQLType() {
    return "jsonb";
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
};
function jsonb(name) {
  return new PgJsonbBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/line.js
var PgLineBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgLineBuilder";
  constructor(name) {
    super(name, "array", "PgLine");
  }
  /** @internal */
  build(table) {
    return new PgLineTuple(
      table,
      this.config
    );
  }
};
var PgLineTuple = class extends PgColumn {
  static [entityKind] = "PgLine";
  getSQLType() {
    return "line";
  }
  mapFromDriverValue(value) {
    const [a, b, c] = value.slice(1, -1).split(",");
    return [Number.parseFloat(a), Number.parseFloat(b), Number.parseFloat(c)];
  }
  mapToDriverValue(value) {
    return `{${value[0]},${value[1]},${value[2]}}`;
  }
};
var PgLineABCBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgLineABCBuilder";
  constructor(name) {
    super(name, "json", "PgLineABC");
  }
  /** @internal */
  build(table) {
    return new PgLineABC(
      table,
      this.config
    );
  }
};
var PgLineABC = class extends PgColumn {
  static [entityKind] = "PgLineABC";
  getSQLType() {
    return "line";
  }
  mapFromDriverValue(value) {
    const [a, b, c] = value.slice(1, -1).split(",");
    return { a: Number.parseFloat(a), b: Number.parseFloat(b), c: Number.parseFloat(c) };
  }
  mapToDriverValue(value) {
    return `{${value.a},${value.b},${value.c}}`;
  }
};
function line(a, b) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  if (!config2?.mode || config2.mode === "tuple") {
    return new PgLineBuilder(name);
  }
  return new PgLineABCBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/macaddr.js
var PgMacaddrBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgMacaddrBuilder";
  constructor(name) {
    super(name, "string", "PgMacaddr");
  }
  /** @internal */
  build(table) {
    return new PgMacaddr(table, this.config);
  }
};
var PgMacaddr = class extends PgColumn {
  static [entityKind] = "PgMacaddr";
  getSQLType() {
    return "macaddr";
  }
};
function macaddr(name) {
  return new PgMacaddrBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/macaddr8.js
var PgMacaddr8Builder = class extends PgColumnBuilder {
  static [entityKind] = "PgMacaddr8Builder";
  constructor(name) {
    super(name, "string", "PgMacaddr8");
  }
  /** @internal */
  build(table) {
    return new PgMacaddr8(table, this.config);
  }
};
var PgMacaddr8 = class extends PgColumn {
  static [entityKind] = "PgMacaddr8";
  getSQLType() {
    return "macaddr8";
  }
};
function macaddr8(name) {
  return new PgMacaddr8Builder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/numeric.js
var PgNumericBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgNumericBuilder";
  constructor(name, precision, scale) {
    super(name, "string", "PgNumeric");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumeric(table, this.config);
  }
};
var PgNumeric = class extends PgColumn {
  static [entityKind] = "PgNumeric";
  precision;
  scale;
  constructor(table, config2) {
    super(table, config2);
    this.precision = config2.precision;
    this.scale = config2.scale;
  }
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
};
function numeric(a, b) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  return new PgNumericBuilder(name, config2?.precision, config2?.scale);
}

// node_modules/drizzle-orm/pg-core/columns/point.js
var PgPointTupleBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgPointTupleBuilder";
  constructor(name) {
    super(name, "array", "PgPointTuple");
  }
  /** @internal */
  build(table) {
    return new PgPointTuple(
      table,
      this.config
    );
  }
};
var PgPointTuple = class extends PgColumn {
  static [entityKind] = "PgPointTuple";
  getSQLType() {
    return "point";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      const [x, y] = value.slice(1, -1).split(",");
      return [Number.parseFloat(x), Number.parseFloat(y)];
    }
    return [value.x, value.y];
  }
  mapToDriverValue(value) {
    return `(${value[0]},${value[1]})`;
  }
};
var PgPointObjectBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgPointObjectBuilder";
  constructor(name) {
    super(name, "json", "PgPointObject");
  }
  /** @internal */
  build(table) {
    return new PgPointObject(
      table,
      this.config
    );
  }
};
var PgPointObject = class extends PgColumn {
  static [entityKind] = "PgPointObject";
  getSQLType() {
    return "point";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      const [x, y] = value.slice(1, -1).split(",");
      return { x: Number.parseFloat(x), y: Number.parseFloat(y) };
    }
    return value;
  }
  mapToDriverValue(value) {
    return `(${value.x},${value.y})`;
  }
};
function point(a, b) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  if (!config2?.mode || config2.mode === "tuple") {
    return new PgPointTupleBuilder(name);
  }
  return new PgPointObjectBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/postgis_extension/utils.js
function hexToBytes(hex) {
  const bytes = [];
  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(Number.parseInt(hex.slice(c, c + 2), 16));
  }
  return new Uint8Array(bytes);
}
function bytesToFloat64(bytes, offset) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  for (let i = 0; i < 8; i++) {
    view.setUint8(i, bytes[offset + i]);
  }
  return view.getFloat64(0, true);
}
function parseEWKB(hex) {
  const bytes = hexToBytes(hex);
  let offset = 0;
  const byteOrder = bytes[offset];
  offset += 1;
  const view = new DataView(bytes.buffer);
  const geomType = view.getUint32(offset, byteOrder === 1);
  offset += 4;
  let _srid;
  if (geomType & 536870912) {
    _srid = view.getUint32(offset, byteOrder === 1);
    offset += 4;
  }
  if ((geomType & 65535) === 1) {
    const x = bytesToFloat64(bytes, offset);
    offset += 8;
    const y = bytesToFloat64(bytes, offset);
    offset += 8;
    return [x, y];
  }
  throw new Error("Unsupported geometry type");
}

// node_modules/drizzle-orm/pg-core/columns/postgis_extension/geometry.js
var PgGeometryBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgGeometryBuilder";
  constructor(name) {
    super(name, "array", "PgGeometry");
  }
  /** @internal */
  build(table) {
    return new PgGeometry(
      table,
      this.config
    );
  }
};
var PgGeometry = class extends PgColumn {
  static [entityKind] = "PgGeometry";
  getSQLType() {
    return "geometry(point)";
  }
  mapFromDriverValue(value) {
    return parseEWKB(value);
  }
  mapToDriverValue(value) {
    return `point(${value[0]} ${value[1]})`;
  }
};
var PgGeometryObjectBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgGeometryObjectBuilder";
  constructor(name) {
    super(name, "json", "PgGeometryObject");
  }
  /** @internal */
  build(table) {
    return new PgGeometryObject(
      table,
      this.config
    );
  }
};
var PgGeometryObject = class extends PgColumn {
  static [entityKind] = "PgGeometryObject";
  getSQLType() {
    return "geometry(point)";
  }
  mapFromDriverValue(value) {
    const parsed = parseEWKB(value);
    return { x: parsed[0], y: parsed[1] };
  }
  mapToDriverValue(value) {
    return `point(${value.x} ${value.y})`;
  }
};
function geometry(a, b) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  if (!config2?.mode || config2.mode === "tuple") {
    return new PgGeometryBuilder(name);
  }
  return new PgGeometryObjectBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/real.js
var PgRealBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgRealBuilder";
  constructor(name, length) {
    super(name, "number", "PgReal");
    this.config.length = length;
  }
  /** @internal */
  build(table) {
    return new PgReal(table, this.config);
  }
};
var PgReal = class extends PgColumn {
  static [entityKind] = "PgReal";
  constructor(table, config2) {
    super(table, config2);
  }
  getSQLType() {
    return "real";
  }
  mapFromDriverValue = (value) => {
    if (typeof value === "string") {
      return Number.parseFloat(value);
    }
    return value;
  };
};
function real(name) {
  return new PgRealBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/serial.js
var PgSerialBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgSerialBuilder";
  constructor(name) {
    super(name, "number", "PgSerial");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgSerial(table, this.config);
  }
};
var PgSerial = class extends PgColumn {
  static [entityKind] = "PgSerial";
  getSQLType() {
    return "serial";
  }
};
function serial(name) {
  return new PgSerialBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/smallint.js
var PgSmallIntBuilder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgSmallIntBuilder";
  constructor(name) {
    super(name, "number", "PgSmallInt");
  }
  /** @internal */
  build(table) {
    return new PgSmallInt(table, this.config);
  }
};
var PgSmallInt = class extends PgColumn {
  static [entityKind] = "PgSmallInt";
  getSQLType() {
    return "smallint";
  }
  mapFromDriverValue = (value) => {
    if (typeof value === "string") {
      return Number(value);
    }
    return value;
  };
};
function smallint(name) {
  return new PgSmallIntBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/smallserial.js
var PgSmallSerialBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgSmallSerialBuilder";
  constructor(name) {
    super(name, "number", "PgSmallSerial");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgSmallSerial(
      table,
      this.config
    );
  }
};
var PgSmallSerial = class extends PgColumn {
  static [entityKind] = "PgSmallSerial";
  getSQLType() {
    return "smallserial";
  }
};
function smallserial(name) {
  return new PgSmallSerialBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/text.js
var PgTextBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgTextBuilder";
  constructor(name, config2) {
    super(name, "string", "PgText");
    this.config.enumValues = config2.enum;
  }
  /** @internal */
  build(table) {
    return new PgText(table, this.config);
  }
};
var PgText = class extends PgColumn {
  static [entityKind] = "PgText";
  enumValues = this.config.enumValues;
  getSQLType() {
    return "text";
  }
};
function text(a, b = {}) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  return new PgTextBuilder(name, config2);
}

// node_modules/drizzle-orm/pg-core/columns/time.js
var PgTimeBuilder = class extends PgDateColumnBaseBuilder {
  constructor(name, withTimezone, precision) {
    super(name, "string", "PgTime");
    this.withTimezone = withTimezone;
    this.precision = precision;
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  static [entityKind] = "PgTimeBuilder";
  /** @internal */
  build(table) {
    return new PgTime(table, this.config);
  }
};
var PgTime = class extends PgColumn {
  static [entityKind] = "PgTime";
  withTimezone;
  precision;
  constructor(table, config2) {
    super(table, config2);
    this.withTimezone = config2.withTimezone;
    this.precision = config2.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : `(${this.precision})`;
    return `time${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
};
function time(a, b = {}) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  return new PgTimeBuilder(name, config2.withTimezone ?? false, config2.precision);
}

// node_modules/drizzle-orm/pg-core/columns/timestamp.js
var PgTimestampBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgTimestampBuilder";
  constructor(name, withTimezone, precision) {
    super(name, "date", "PgTimestamp");
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  /** @internal */
  build(table) {
    return new PgTimestamp(table, this.config);
  }
};
var PgTimestamp = class extends PgColumn {
  static [entityKind] = "PgTimestamp";
  withTimezone;
  precision;
  constructor(table, config2) {
    super(table, config2);
    this.withTimezone = config2.withTimezone;
    this.precision = config2.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : ` (${this.precision})`;
    return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
  mapFromDriverValue = (value) => {
    return new Date(this.withTimezone ? value : value + "+0000");
  };
  mapToDriverValue = (value) => {
    return value.toISOString();
  };
};
var PgTimestampStringBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgTimestampStringBuilder";
  constructor(name, withTimezone, precision) {
    super(name, "string", "PgTimestampString");
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  /** @internal */
  build(table) {
    return new PgTimestampString(
      table,
      this.config
    );
  }
};
var PgTimestampString = class extends PgColumn {
  static [entityKind] = "PgTimestampString";
  withTimezone;
  precision;
  constructor(table, config2) {
    super(table, config2);
    this.withTimezone = config2.withTimezone;
    this.precision = config2.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : `(${this.precision})`;
    return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
};
function timestamp(a, b = {}) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  if (config2?.mode === "string") {
    return new PgTimestampStringBuilder(name, config2.withTimezone ?? false, config2.precision);
  }
  return new PgTimestampBuilder(name, config2?.withTimezone ?? false, config2?.precision);
}

// node_modules/drizzle-orm/pg-core/columns/uuid.js
var PgUUIDBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgUUIDBuilder";
  constructor(name) {
    super(name, "string", "PgUUID");
  }
  /**
   * Adds `default gen_random_uuid()` to the column definition.
   */
  defaultRandom() {
    return this.default(sql`gen_random_uuid()`);
  }
  /** @internal */
  build(table) {
    return new PgUUID(table, this.config);
  }
};
var PgUUID = class extends PgColumn {
  static [entityKind] = "PgUUID";
  getSQLType() {
    return "uuid";
  }
};
function uuid(name) {
  return new PgUUIDBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/varchar.js
var PgVarcharBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgVarcharBuilder";
  constructor(name, config2) {
    super(name, "string", "PgVarchar");
    this.config.length = config2.length;
    this.config.enumValues = config2.enum;
  }
  /** @internal */
  build(table) {
    return new PgVarchar(
      table,
      this.config
    );
  }
};
var PgVarchar = class extends PgColumn {
  static [entityKind] = "PgVarchar";
  length = this.config.length;
  enumValues = this.config.enumValues;
  getSQLType() {
    return this.length === void 0 ? `varchar` : `varchar(${this.length})`;
  }
};
function varchar(a, b = {}) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  return new PgVarcharBuilder(name, config2);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/bit.js
var PgBinaryVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgBinaryVectorBuilder";
  constructor(name, config2) {
    super(name, "string", "PgBinaryVector");
    this.config.dimensions = config2.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgBinaryVector(
      table,
      this.config
    );
  }
};
var PgBinaryVector = class extends PgColumn {
  static [entityKind] = "PgBinaryVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `bit(${this.dimensions})`;
  }
};
function bit(a, b) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  return new PgBinaryVectorBuilder(name, config2);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/halfvec.js
var PgHalfVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgHalfVectorBuilder";
  constructor(name, config2) {
    super(name, "array", "PgHalfVector");
    this.config.dimensions = config2.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgHalfVector(
      table,
      this.config
    );
  }
};
var PgHalfVector = class extends PgColumn {
  static [entityKind] = "PgHalfVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `halfvec(${this.dimensions})`;
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    return value.slice(1, -1).split(",").map((v) => Number.parseFloat(v));
  }
};
function halfvec(a, b) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  return new PgHalfVectorBuilder(name, config2);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/sparsevec.js
var PgSparseVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgSparseVectorBuilder";
  constructor(name, config2) {
    super(name, "string", "PgSparseVector");
    this.config.dimensions = config2.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgSparseVector(
      table,
      this.config
    );
  }
};
var PgSparseVector = class extends PgColumn {
  static [entityKind] = "PgSparseVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `sparsevec(${this.dimensions})`;
  }
};
function sparsevec(a, b) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  return new PgSparseVectorBuilder(name, config2);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/vector.js
var PgVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgVectorBuilder";
  constructor(name, config2) {
    super(name, "array", "PgVector");
    this.config.dimensions = config2.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgVector(
      table,
      this.config
    );
  }
};
var PgVector = class extends PgColumn {
  static [entityKind] = "PgVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `vector(${this.dimensions})`;
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    return value.slice(1, -1).split(",").map((v) => Number.parseFloat(v));
  }
};
function vector(a, b) {
  const { name, config: config2 } = getColumnNameAndConfig(a, b);
  return new PgVectorBuilder(name, config2);
}

// node_modules/drizzle-orm/query-promise.js
var QueryPromise = class {
  static [entityKind] = "QueryPromise";
  [Symbol.toStringTag] = "QueryPromise";
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally?.();
        return value;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      }
    );
  }
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
};

// node_modules/drizzle-orm/selection-proxy.js
var SelectionProxyHandler = class _SelectionProxyHandler {
  static [entityKind] = "SelectionProxyHandler";
  config;
  constructor(config2) {
    this.config = { ...config2 };
  }
  get(subquery, prop) {
    if (prop === "_") {
      return {
        ...subquery["_"],
        selectedFields: new Proxy(
          subquery._.selectedFields,
          this
        )
      };
    }
    if (prop === ViewBaseConfig) {
      return {
        ...subquery[ViewBaseConfig],
        selectedFields: new Proxy(
          subquery[ViewBaseConfig].selectedFields,
          this
        )
      };
    }
    if (typeof prop === "symbol") {
      return subquery[prop];
    }
    const columns = is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery;
    const value = columns[prop];
    if (is(value, SQL.Aliased)) {
      if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) {
        return value.sql;
      }
      const newValue = value.clone();
      newValue.isSelectionField = true;
      return newValue;
    }
    if (is(value, SQL)) {
      if (this.config.sqlBehavior === "sql") {
        return value;
      }
      throw new Error(
        `You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`
      );
    }
    if (is(value, Column)) {
      if (this.config.alias) {
        return new Proxy(
          value,
          new ColumnAliasProxyHandler(
            new Proxy(
              value.table,
              new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false)
            )
          )
        );
      }
      return value;
    }
    if (typeof value !== "object" || value === null) {
      return value;
    }
    return new Proxy(value, new _SelectionProxyHandler(this.config));
  }
};

// node_modules/drizzle-orm/casing.js
function toSnakeCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.map((word) => word.toLowerCase()).join("_");
}
function toCamelCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.reduce((acc, word, i) => {
    const formattedWord = i === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1)}`;
    return acc + formattedWord;
  }, "");
}
function noopCase(input) {
  return input;
}
var CasingCache = class {
  static [entityKind] = "CasingCache";
  /** @internal */
  cache = {};
  cachedTables = {};
  convert;
  constructor(casing) {
    this.convert = casing === "snake_case" ? toSnakeCase : casing === "camelCase" ? toCamelCase : noopCase;
  }
  getColumnCasing(column) {
    if (!column.keyAsName)
      return column.name;
    const schema = column.table[Table.Symbol.Schema] ?? "public";
    const tableName = column.table[Table.Symbol.OriginalName];
    const key = `${schema}.${tableName}.${column.name}`;
    if (!this.cache[key]) {
      this.cacheTable(column.table);
    }
    return this.cache[key];
  }
  cacheTable(table) {
    const schema = table[Table.Symbol.Schema] ?? "public";
    const tableName = table[Table.Symbol.OriginalName];
    const tableKey = `${schema}.${tableName}`;
    if (!this.cachedTables[tableKey]) {
      for (const column of Object.values(table[Table.Symbol.Columns])) {
        const columnKey = `${tableKey}.${column.name}`;
        this.cache[columnKey] = this.convert(column.name);
      }
      this.cachedTables[tableKey] = true;
    }
  }
  clearCache() {
    this.cache = {};
    this.cachedTables = {};
  }
};

// node_modules/drizzle-orm/errors.js
var DrizzleError = class extends Error {
  static [entityKind] = "DrizzleError";
  constructor({ message, cause }) {
    super(message);
    this.name = "DrizzleError";
    this.cause = cause;
  }
};
var TransactionRollbackError = class extends DrizzleError {
  static [entityKind] = "TransactionRollbackError";
  constructor() {
    super({ message: "Rollback" });
  }
};

// node_modules/drizzle-orm/pg-core/columns/all.js
function getPgColumnBuilders() {
  return {
    bigint,
    bigserial,
    boolean,
    char,
    cidr,
    customType,
    date,
    doublePrecision,
    inet,
    integer,
    interval,
    json,
    jsonb,
    line,
    macaddr,
    macaddr8,
    numeric,
    point,
    geometry,
    real,
    serial,
    smallint,
    smallserial,
    text,
    time,
    timestamp,
    uuid,
    varchar,
    bit,
    halfvec,
    sparsevec,
    vector
  };
}

// node_modules/drizzle-orm/pg-core/table.js
var InlineForeignKeys = /* @__PURE__ */ Symbol.for("drizzle:PgInlineForeignKeys");
var EnableRLS = /* @__PURE__ */ Symbol.for("drizzle:EnableRLS");
var PgTable = class extends Table {
  static [entityKind] = "PgTable";
  /** @internal */
  static Symbol = Object.assign({}, Table.Symbol, {
    InlineForeignKeys,
    EnableRLS
  });
  /**@internal */
  [InlineForeignKeys] = [];
  /** @internal */
  [EnableRLS] = false;
  /** @internal */
  [Table.Symbol.ExtraConfigBuilder] = void 0;
};
function pgTableWithSchema(name, columns, extraConfig, schema, baseName = name) {
  const rawTable = new PgTable(name, schema, baseName);
  const parsedColumns = typeof columns === "function" ? columns(getPgColumnBuilders()) : columns;
  const builtColumns = Object.fromEntries(
    Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column = colBuilder.build(rawTable);
      rawTable[InlineForeignKeys].push(...colBuilder.buildForeignKeys(column, rawTable));
      return [name2, column];
    })
  );
  const builtColumnsForExtraConfig = Object.fromEntries(
    Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column = colBuilder.buildExtraConfigColumn(rawTable);
      return [name2, column];
    })
  );
  const table = Object.assign(rawTable, builtColumns);
  table[Table.Symbol.Columns] = builtColumns;
  table[Table.Symbol.ExtraConfigColumns] = builtColumnsForExtraConfig;
  if (extraConfig) {
    table[PgTable.Symbol.ExtraConfigBuilder] = extraConfig;
  }
  return Object.assign(table, {
    enableRLS: () => {
      table[PgTable.Symbol.EnableRLS] = true;
      return table;
    }
  });
}
var pgTable = (name, columns, extraConfig) => {
  return pgTableWithSchema(name, columns, extraConfig, void 0);
};

// node_modules/drizzle-orm/sql/expressions/conditions.js
function bindIfParam(value, column) {
  if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) {
    return new Param(value, column);
  }
  return value;
}
var eq = (left, right) => {
  return sql`${left} = ${bindIfParam(right, left)}`;
};
var ne = (left, right) => {
  return sql`${left} <> ${bindIfParam(right, left)}`;
};
function and(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" and ")),
    new StringChunk(")")
  ]);
}
function or(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" or ")),
    new StringChunk(")")
  ]);
}
function not(condition) {
  return sql`not ${condition}`;
}
var gt = (left, right) => {
  return sql`${left} > ${bindIfParam(right, left)}`;
};
var gte = (left, right) => {
  return sql`${left} >= ${bindIfParam(right, left)}`;
};
var lt = (left, right) => {
  return sql`${left} < ${bindIfParam(right, left)}`;
};
var lte = (left, right) => {
  return sql`${left} <= ${bindIfParam(right, left)}`;
};
function inArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`false`;
    }
    return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} in ${bindIfParam(values, column)}`;
}
function notInArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`true`;
    }
    return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} not in ${bindIfParam(values, column)}`;
}
function isNull(value) {
  return sql`${value} is null`;
}
function isNotNull(value) {
  return sql`${value} is not null`;
}
function exists(subquery) {
  return sql`exists ${subquery}`;
}
function notExists(subquery) {
  return sql`not exists ${subquery}`;
}
function between(column, min2, max2) {
  return sql`${column} between ${bindIfParam(min2, column)} and ${bindIfParam(
    max2,
    column
  )}`;
}
function notBetween(column, min2, max2) {
  return sql`${column} not between ${bindIfParam(
    min2,
    column
  )} and ${bindIfParam(max2, column)}`;
}
function like(column, value) {
  return sql`${column} like ${value}`;
}
function notLike(column, value) {
  return sql`${column} not like ${value}`;
}
function ilike(column, value) {
  return sql`${column} ilike ${value}`;
}
function notIlike(column, value) {
  return sql`${column} not ilike ${value}`;
}

// node_modules/drizzle-orm/sql/expressions/select.js
function asc(column) {
  return sql`${column} asc`;
}
function desc(column) {
  return sql`${column} desc`;
}

// node_modules/drizzle-orm/relations.js
var Relation = class {
  constructor(sourceTable, referencedTable, relationName) {
    this.sourceTable = sourceTable;
    this.referencedTable = referencedTable;
    this.relationName = relationName;
    this.referencedTableName = referencedTable[Table.Symbol.Name];
  }
  static [entityKind] = "Relation";
  referencedTableName;
  fieldName;
};
var Relations = class {
  constructor(table, config2) {
    this.table = table;
    this.config = config2;
  }
  static [entityKind] = "Relations";
};
var One = class _One extends Relation {
  constructor(sourceTable, referencedTable, config2, isNullable) {
    super(sourceTable, referencedTable, config2?.relationName);
    this.config = config2;
    this.isNullable = isNullable;
  }
  static [entityKind] = "One";
  withFieldName(fieldName) {
    const relation = new _One(
      this.sourceTable,
      this.referencedTable,
      this.config,
      this.isNullable
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
var Many = class _Many extends Relation {
  constructor(sourceTable, referencedTable, config2) {
    super(sourceTable, referencedTable, config2?.relationName);
    this.config = config2;
  }
  static [entityKind] = "Many";
  withFieldName(fieldName) {
    const relation = new _Many(
      this.sourceTable,
      this.referencedTable,
      this.config
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
function getOperators() {
  return {
    and,
    between,
    eq,
    exists,
    gt,
    gte,
    ilike,
    inArray,
    isNull,
    isNotNull,
    like,
    lt,
    lte,
    ne,
    not,
    notBetween,
    notExists,
    notLike,
    notIlike,
    notInArray,
    or,
    sql
  };
}
function getOrderByOperators() {
  return {
    sql,
    asc,
    desc
  };
}
function normalizeRelation(schema, tableNamesMap, relation) {
  if (is(relation, One) && relation.config) {
    return {
      fields: relation.config.fields,
      references: relation.config.references
    };
  }
  const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
  if (!referencedTableTsName) {
    throw new Error(
      `Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const referencedTableConfig = schema[referencedTableTsName];
  if (!referencedTableConfig) {
    throw new Error(`Table "${referencedTableTsName}" not found in schema`);
  }
  const sourceTable = relation.sourceTable;
  const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
  if (!sourceTableTsName) {
    throw new Error(
      `Table "${sourceTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const reverseRelations = [];
  for (const referencedTableRelation of Object.values(
    referencedTableConfig.relations
  )) {
    if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) {
      reverseRelations.push(referencedTableRelation);
    }
  }
  if (reverseRelations.length > 1) {
    throw relation.relationName ? new Error(
      `There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`
    ) : new Error(
      `There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`
    );
  }
  if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) {
    return {
      fields: reverseRelations[0].config.references,
      references: reverseRelations[0].config.fields
    };
  }
  throw new Error(
    `There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`
  );
}

// node_modules/drizzle-orm/pg-core/view-base.js
var PgViewBase = class extends View {
  static [entityKind] = "PgViewBase";
};

// node_modules/drizzle-orm/pg-core/dialect.js
var PgDialect = class {
  static [entityKind] = "PgDialect";
  /** @internal */
  casing;
  constructor(config2) {
    this.casing = new CasingCache(config2?.casing);
  }
  async migrate(migrations, session, config2) {
    const migrationsTable = typeof config2 === "string" ? "__drizzle_migrations" : config2.migrationsTable ?? "__drizzle_migrations";
    const migrationsSchema = typeof config2 === "string" ? "drizzle" : config2.migrationsSchema ?? "drizzle";
    const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`;
    await session.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(migrationsSchema)}`);
    await session.execute(migrationTableCreate);
    const dbMigrations = await session.all(
      sql`select id, hash, created_at from ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} order by created_at desc limit 1`
    );
    const lastDbMigration = dbMigrations[0];
    await session.transaction(async (tx) => {
      for await (const migration of migrations) {
        if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
          for (const stmt of migration.sql) {
            await tx.execute(sql.raw(stmt));
          }
          await tx.execute(
            sql`insert into ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`
          );
        }
      }
    });
  }
  escapeName(name) {
    return `"${name}"`;
  }
  escapeParam(num) {
    return `$${num + 1}`;
  }
  escapeString(str) {
    return `'${str.replace(/'/g, "''")}'`;
  }
  buildWithCTE(queries) {
    if (!queries?.length)
      return void 0;
    const withSqlChunks = [sql`with `];
    for (const [i, w] of queries.entries()) {
      withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
      if (i < queries.length - 1) {
        withSqlChunks.push(sql`, `);
      }
    }
    withSqlChunks.push(sql` `);
    return sql.join(withSqlChunks);
  }
  buildDeleteQuery({ table, where, returning, withList }) {
    const withSql = this.buildWithCTE(withList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}delete from ${table}${whereSql}${returningSql}`;
  }
  buildUpdateSet(table, set) {
    const tableColumns = table[Table.Symbol.Columns];
    const columnNames = Object.keys(tableColumns).filter(
      (colName) => set[colName] !== void 0 || tableColumns[colName]?.onUpdateFn !== void 0
    );
    const setSize = columnNames.length;
    return sql.join(columnNames.flatMap((colName, i) => {
      const col = tableColumns[colName];
      const value = set[colName] ?? sql.param(col.onUpdateFn(), col);
      const res = sql`${sql.identifier(this.casing.getColumnCasing(col))} = ${value}`;
      if (i < setSize - 1) {
        return [res, sql.raw(", ")];
      }
      return [res];
    }));
  }
  buildUpdateQuery({ table, set, where, returning, withList, from, joins }) {
    const withSql = this.buildWithCTE(withList);
    const tableName = table[PgTable.Symbol.Name];
    const tableSchema = table[PgTable.Symbol.Schema];
    const origTableName = table[PgTable.Symbol.OriginalName];
    const alias = tableName === origTableName ? void 0 : tableName;
    const tableSql = sql`${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}`;
    const setSql = this.buildUpdateSet(table, set);
    const fromSql = from && sql.join([sql.raw(" from "), this.buildFromTable(from)]);
    const joinsSql = this.buildJoins(joins);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: !from })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}update ${tableSql} set ${setSql}${fromSql}${joinsSql}${whereSql}${returningSql}`;
  }
  /**
   * Builds selection SQL with provided fields/expressions
   *
   * Examples:
   *
   * `select <selection> from`
   *
   * `insert ... returning <selection>`
   *
   * If `isSingleTable` is true, then columns won't be prefixed with table name
   */
  buildSelection(fields, { isSingleTable = false } = {}) {
    const columnsLen = fields.length;
    const chunks = fields.flatMap(({ field }, i) => {
      const chunk = [];
      if (is(field, SQL.Aliased) && field.isSelectionField) {
        chunk.push(sql.identifier(field.fieldAlias));
      } else if (is(field, SQL.Aliased) || is(field, SQL)) {
        const query = is(field, SQL.Aliased) ? field.sql : field;
        if (isSingleTable) {
          chunk.push(
            new SQL(
              query.queryChunks.map((c) => {
                if (is(c, PgColumn)) {
                  return sql.identifier(this.casing.getColumnCasing(c));
                }
                return c;
              })
            )
          );
        } else {
          chunk.push(query);
        }
        if (is(field, SQL.Aliased)) {
          chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
        }
      } else if (is(field, Column)) {
        if (isSingleTable) {
          chunk.push(sql.identifier(this.casing.getColumnCasing(field)));
        } else {
          chunk.push(field);
        }
      }
      if (i < columnsLen - 1) {
        chunk.push(sql`, `);
      }
      return chunk;
    });
    return sql.join(chunks);
  }
  buildJoins(joins) {
    if (!joins || joins.length === 0) {
      return void 0;
    }
    const joinsArray = [];
    for (const [index, joinMeta] of joins.entries()) {
      if (index === 0) {
        joinsArray.push(sql` `);
      }
      const table = joinMeta.table;
      const lateralSql = joinMeta.lateral ? sql` lateral` : void 0;
      if (is(table, PgTable)) {
        const tableName = table[PgTable.Symbol.Name];
        const tableSchema = table[PgTable.Symbol.Schema];
        const origTableName = table[PgTable.Symbol.OriginalName];
        const alias = tableName === origTableName ? void 0 : joinMeta.alias;
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`} on ${joinMeta.on}`
        );
      } else if (is(table, View)) {
        const viewName = table[ViewBaseConfig].name;
        const viewSchema = table[ViewBaseConfig].schema;
        const origViewName = table[ViewBaseConfig].originalName;
        const alias = viewName === origViewName ? void 0 : joinMeta.alias;
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${viewSchema ? sql`${sql.identifier(viewSchema)}.` : void 0}${sql.identifier(origViewName)}${alias && sql` ${sql.identifier(alias)}`} on ${joinMeta.on}`
        );
      } else {
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${table} on ${joinMeta.on}`
        );
      }
      if (index < joins.length - 1) {
        joinsArray.push(sql` `);
      }
    }
    return sql.join(joinsArray);
  }
  buildFromTable(table) {
    if (is(table, Table) && table[Table.Symbol.OriginalName] !== table[Table.Symbol.Name]) {
      let fullName = sql`${sql.identifier(table[Table.Symbol.OriginalName])}`;
      if (table[Table.Symbol.Schema]) {
        fullName = sql`${sql.identifier(table[Table.Symbol.Schema])}.${fullName}`;
      }
      return sql`${fullName} ${sql.identifier(table[Table.Symbol.Name])}`;
    }
    return table;
  }
  buildSelectQuery({
    withList,
    fields,
    fieldsFlat,
    where,
    having,
    table,
    joins,
    orderBy,
    groupBy,
    limit,
    offset,
    lockingClause,
    distinct,
    setOperators
  }) {
    const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
    for (const f of fieldsList) {
      if (is(f.field, Column) && getTableName(f.field.table) !== (is(table, Subquery) ? table._.alias : is(table, PgViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins?.some(
        ({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])
      ))(f.field.table)) {
        const tableName = getTableName(f.field.table);
        throw new Error(
          `Your "${f.path.join("->")}" field references a column "${tableName}"."${f.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`
        );
      }
    }
    const isSingleTable = !joins || joins.length === 0;
    const withSql = this.buildWithCTE(withList);
    let distinctSql;
    if (distinct) {
      distinctSql = distinct === true ? sql` distinct` : sql` distinct on (${sql.join(distinct.on, sql`, `)})`;
    }
    const selection = this.buildSelection(fieldsList, { isSingleTable });
    const tableSql = this.buildFromTable(table);
    const joinsSql = this.buildJoins(joins);
    const whereSql = where ? sql` where ${where}` : void 0;
    const havingSql = having ? sql` having ${having}` : void 0;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      orderBySql = sql` order by ${sql.join(orderBy, sql`, `)}`;
    }
    let groupBySql;
    if (groupBy && groupBy.length > 0) {
      groupBySql = sql` group by ${sql.join(groupBy, sql`, `)}`;
    }
    const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    const lockingClauseSql = sql.empty();
    if (lockingClause) {
      const clauseSql = sql` for ${sql.raw(lockingClause.strength)}`;
      if (lockingClause.config.of) {
        clauseSql.append(
          sql` of ${sql.join(
            Array.isArray(lockingClause.config.of) ? lockingClause.config.of : [lockingClause.config.of],
            sql`, `
          )}`
        );
      }
      if (lockingClause.config.noWait) {
        clauseSql.append(sql` no wait`);
      } else if (lockingClause.config.skipLocked) {
        clauseSql.append(sql` skip locked`);
      }
      lockingClauseSql.append(clauseSql);
    }
    const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}${lockingClauseSql}`;
    if (setOperators.length > 0) {
      return this.buildSetOperations(finalQuery, setOperators);
    }
    return finalQuery;
  }
  buildSetOperations(leftSelect, setOperators) {
    const [setOperator, ...rest] = setOperators;
    if (!setOperator) {
      throw new Error("Cannot pass undefined values to any set operator");
    }
    if (rest.length === 0) {
      return this.buildSetOperationQuery({ leftSelect, setOperator });
    }
    return this.buildSetOperations(
      this.buildSetOperationQuery({ leftSelect, setOperator }),
      rest
    );
  }
  buildSetOperationQuery({
    leftSelect,
    setOperator: { type, isAll, rightSelect, limit, orderBy, offset }
  }) {
    const leftChunk = sql`(${leftSelect.getSQL()}) `;
    const rightChunk = sql`(${rightSelect.getSQL()})`;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      const orderByValues = [];
      for (const singleOrderBy of orderBy) {
        if (is(singleOrderBy, PgColumn)) {
          orderByValues.push(sql.identifier(singleOrderBy.name));
        } else if (is(singleOrderBy, SQL)) {
          for (let i = 0; i < singleOrderBy.queryChunks.length; i++) {
            const chunk = singleOrderBy.queryChunks[i];
            if (is(chunk, PgColumn)) {
              singleOrderBy.queryChunks[i] = sql.identifier(chunk.name);
            }
          }
          orderByValues.push(sql`${singleOrderBy}`);
        } else {
          orderByValues.push(sql`${singleOrderBy}`);
        }
      }
      orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)} `;
    }
    const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
    const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
  }
  buildInsertQuery({ table, values: valuesOrSelect, onConflict, returning, withList, select, overridingSystemValue_ }) {
    const valuesSqlList = [];
    const columns = table[Table.Symbol.Columns];
    const colEntries = Object.entries(columns).filter(([_, col]) => !col.shouldDisableInsert());
    const insertOrder = colEntries.map(
      ([, column]) => sql.identifier(this.casing.getColumnCasing(column))
    );
    if (select) {
      const select2 = valuesOrSelect;
      if (is(select2, SQL)) {
        valuesSqlList.push(select2);
      } else {
        valuesSqlList.push(select2.getSQL());
      }
    } else {
      const values = valuesOrSelect;
      valuesSqlList.push(sql.raw("values "));
      for (const [valueIndex, value] of values.entries()) {
        const valueList = [];
        for (const [fieldName, col] of colEntries) {
          const colValue = value[fieldName];
          if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) {
            if (col.defaultFn !== void 0) {
              const defaultFnResult = col.defaultFn();
              const defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
              valueList.push(defaultValue);
            } else if (!col.default && col.onUpdateFn !== void 0) {
              const onUpdateFnResult = col.onUpdateFn();
              const newValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
              valueList.push(newValue);
            } else {
              valueList.push(sql`default`);
            }
          } else {
            valueList.push(colValue);
          }
        }
        valuesSqlList.push(valueList);
        if (valueIndex < values.length - 1) {
          valuesSqlList.push(sql`, `);
        }
      }
    }
    const withSql = this.buildWithCTE(withList);
    const valuesSql = sql.join(valuesSqlList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const onConflictSql = onConflict ? sql` on conflict ${onConflict}` : void 0;
    const overridingSql = overridingSystemValue_ === true ? sql`overriding system value ` : void 0;
    return sql`${withSql}insert into ${table} ${insertOrder} ${overridingSql}${valuesSql}${onConflictSql}${returningSql}`;
  }
  buildRefreshMaterializedViewQuery({ view, concurrently, withNoData }) {
    const concurrentlySql = concurrently ? sql` concurrently` : void 0;
    const withNoDataSql = withNoData ? sql` with no data` : void 0;
    return sql`refresh materialized view${concurrentlySql} ${view}${withNoDataSql}`;
  }
  prepareTyping(encoder) {
    if (is(encoder, PgJsonb) || is(encoder, PgJson)) {
      return "json";
    } else if (is(encoder, PgNumeric)) {
      return "decimal";
    } else if (is(encoder, PgTime)) {
      return "time";
    } else if (is(encoder, PgTimestamp) || is(encoder, PgTimestampString)) {
      return "timestamp";
    } else if (is(encoder, PgDate) || is(encoder, PgDateString)) {
      return "date";
    } else if (is(encoder, PgUUID)) {
      return "uuid";
    } else {
      return "none";
    }
  }
  sqlToQuery(sql2, invokeSource) {
    return sql2.toQuery({
      casing: this.casing,
      escapeName: this.escapeName,
      escapeParam: this.escapeParam,
      escapeString: this.escapeString,
      prepareTyping: this.prepareTyping,
      invokeSource
    });
  }
  // buildRelationalQueryWithPK({
  // 	fullSchema,
  // 	schema,
  // 	tableNamesMap,
  // 	table,
  // 	tableConfig,
  // 	queryConfig: config,
  // 	tableAlias,
  // 	isRoot = false,
  // 	joinOn,
  // }: {
  // 	fullSchema: Record<string, unknown>;
  // 	schema: TablesRelationalConfig;
  // 	tableNamesMap: Record<string, string>;
  // 	table: PgTable;
  // 	tableConfig: TableRelationalConfig;
  // 	queryConfig: true | DBQueryConfig<'many', true>;
  // 	tableAlias: string;
  // 	isRoot?: boolean;
  // 	joinOn?: SQL;
  // }): BuildRelationalQueryResult<PgTable, PgColumn> {
  // 	// For { "<relation>": true }, return a table with selection of all columns
  // 	if (config === true) {
  // 		const selectionEntries = Object.entries(tableConfig.columns);
  // 		const selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = selectionEntries.map((
  // 			[key, value],
  // 		) => ({
  // 			dbKey: value.name,
  // 			tsKey: key,
  // 			field: value as PgColumn,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 		return {
  // 			tableTsKey: tableConfig.tsName,
  // 			sql: table,
  // 			selection,
  // 		};
  // 	}
  // 	// let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
  // 	// let selectionForBuild = selection;
  // 	const aliasedColumns = Object.fromEntries(
  // 		Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)]),
  // 	);
  // 	const aliasedRelations = Object.fromEntries(
  // 		Object.entries(tableConfig.relations).map(([key, value]) => [key, aliasedRelation(value, tableAlias)]),
  // 	);
  // 	const aliasedFields = Object.assign({}, aliasedColumns, aliasedRelations);
  // 	let where, hasUserDefinedWhere;
  // 	if (config.where) {
  // 		const whereSql = typeof config.where === 'function' ? config.where(aliasedFields, operators) : config.where;
  // 		where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
  // 		hasUserDefinedWhere = !!where;
  // 	}
  // 	where = and(joinOn, where);
  // 	// const fieldsSelection: { tsKey: string; value: PgColumn | SQL.Aliased; isExtra?: boolean }[] = [];
  // 	let joins: Join[] = [];
  // 	let selectedColumns: string[] = [];
  // 	// Figure out which columns to select
  // 	if (config.columns) {
  // 		let isIncludeMode = false;
  // 		for (const [field, value] of Object.entries(config.columns)) {
  // 			if (value === undefined) {
  // 				continue;
  // 			}
  // 			if (field in tableConfig.columns) {
  // 				if (!isIncludeMode && value === true) {
  // 					isIncludeMode = true;
  // 				}
  // 				selectedColumns.push(field);
  // 			}
  // 		}
  // 		if (selectedColumns.length > 0) {
  // 			selectedColumns = isIncludeMode
  // 				? selectedColumns.filter((c) => config.columns?.[c] === true)
  // 				: Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
  // 		}
  // 	} else {
  // 		// Select all columns if selection is not specified
  // 		selectedColumns = Object.keys(tableConfig.columns);
  // 	}
  // 	// for (const field of selectedColumns) {
  // 	// 	const column = tableConfig.columns[field]! as PgColumn;
  // 	// 	fieldsSelection.push({ tsKey: field, value: column });
  // 	// }
  // 	let initiallySelectedRelations: {
  // 		tsKey: string;
  // 		queryConfig: true | DBQueryConfig<'many', false>;
  // 		relation: Relation;
  // 	}[] = [];
  // 	// let selectedRelations: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
  // 	// Figure out which relations to select
  // 	if (config.with) {
  // 		initiallySelectedRelations = Object.entries(config.with)
  // 			.filter((entry): entry is [typeof entry[0], NonNullable<typeof entry[1]>] => !!entry[1])
  // 			.map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey]! }));
  // 	}
  // 	const manyRelations = initiallySelectedRelations.filter((r) =>
  // 		is(r.relation, Many)
  // 		&& (schema[tableNamesMap[r.relation.referencedTable[Table.Symbol.Name]]!]?.primaryKey.length ?? 0) > 0
  // 	);
  // 	// If this is the last Many relation (or there are no Many relations), we are on the innermost subquery level
  // 	const isInnermostQuery = manyRelations.length < 2;
  // 	const selectedExtras: {
  // 		tsKey: string;
  // 		value: SQL.Aliased;
  // 	}[] = [];
  // 	// Figure out which extras to select
  // 	if (isInnermostQuery && config.extras) {
  // 		const extras = typeof config.extras === 'function'
  // 			? config.extras(aliasedFields, { sql })
  // 			: config.extras;
  // 		for (const [tsKey, value] of Object.entries(extras)) {
  // 			selectedExtras.push({
  // 				tsKey,
  // 				value: mapColumnsInAliasedSQLToAlias(value, tableAlias),
  // 			});
  // 		}
  // 	}
  // 	// Transform `fieldsSelection` into `selection`
  // 	// `fieldsSelection` shouldn't be used after this point
  // 	// for (const { tsKey, value, isExtra } of fieldsSelection) {
  // 	// 	selection.push({
  // 	// 		dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey]!.name,
  // 	// 		tsKey,
  // 	// 		field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
  // 	// 		relationTableTsKey: undefined,
  // 	// 		isJson: false,
  // 	// 		isExtra,
  // 	// 		selection: [],
  // 	// 	});
  // 	// }
  // 	let orderByOrig = typeof config.orderBy === 'function'
  // 		? config.orderBy(aliasedFields, orderByOperators)
  // 		: config.orderBy ?? [];
  // 	if (!Array.isArray(orderByOrig)) {
  // 		orderByOrig = [orderByOrig];
  // 	}
  // 	const orderBy = orderByOrig.map((orderByValue) => {
  // 		if (is(orderByValue, Column)) {
  // 			return aliasedTableColumn(orderByValue, tableAlias) as PgColumn;
  // 		}
  // 		return mapColumnsInSQLToAlias(orderByValue, tableAlias);
  // 	});
  // 	const limit = isInnermostQuery ? config.limit : undefined;
  // 	const offset = isInnermostQuery ? config.offset : undefined;
  // 	// For non-root queries without additional config except columns, return a table with selection
  // 	if (
  // 		!isRoot
  // 		&& initiallySelectedRelations.length === 0
  // 		&& selectedExtras.length === 0
  // 		&& !where
  // 		&& orderBy.length === 0
  // 		&& limit === undefined
  // 		&& offset === undefined
  // 	) {
  // 		return {
  // 			tableTsKey: tableConfig.tsName,
  // 			sql: table,
  // 			selection: selectedColumns.map((key) => ({
  // 				dbKey: tableConfig.columns[key]!.name,
  // 				tsKey: key,
  // 				field: tableConfig.columns[key] as PgColumn,
  // 				relationTableTsKey: undefined,
  // 				isJson: false,
  // 				selection: [],
  // 			})),
  // 		};
  // 	}
  // 	const selectedRelationsWithoutPK:
  // 	// Process all relations without primary keys, because they need to be joined differently and will all be on the same query level
  // 	for (
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationConfigValue,
  // 			relation,
  // 		} of initiallySelectedRelations
  // 	) {
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTable = schema[relationTableTsName]!;
  // 		if (relationTable.primaryKey.length > 0) {
  // 			continue;
  // 		}
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelation = this.buildRelationalQueryWithoutPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationConfigValue,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 			nestedQueryRelation: relation,
  // 		});
  // 		const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier('data')}`.as(selectedRelationTsKey);
  // 		joins.push({
  // 			on: sql`true`,
  // 			table: new Subquery(builtRelation.sql as SQL, {}, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: true,
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelation.selection,
  // 		});
  // 	}
  // 	const oneRelations = initiallySelectedRelations.filter((r): r is typeof r & { relation: One } =>
  // 		is(r.relation, One)
  // 	);
  // 	// Process all One relations with PKs, because they can all be joined on the same level
  // 	for (
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationConfigValue,
  // 			relation,
  // 		} of oneRelations
  // 	) {
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const relationTable = schema[relationTableTsName]!;
  // 		if (relationTable.primaryKey.length === 0) {
  // 			continue;
  // 		}
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelation = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationConfigValue,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 		});
  // 		const field = sql`case when ${sql.identifier(relationTableAlias)} is null then null else json_build_array(${
  // 			sql.join(
  // 				builtRelation.selection.map(({ field }) =>
  // 					is(field, SQL.Aliased)
  // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
  // 						: is(field, Column)
  // 						? aliasedTableColumn(field, relationTableAlias)
  // 						: field
  // 				),
  // 				sql`, `,
  // 			)
  // 		}) end`.as(selectedRelationTsKey);
  // 		const isLateralJoin = is(builtRelation.sql, SQL);
  // 		joins.push({
  // 			on: isLateralJoin ? sql`true` : joinOn,
  // 			table: is(builtRelation.sql, SQL)
  // 				? new Subquery(builtRelation.sql, {}, relationTableAlias)
  // 				: aliasedTable(builtRelation.sql, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: is(builtRelation.sql, SQL),
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelation.selection,
  // 		});
  // 	}
  // 	let distinct: PgSelectConfig['distinct'];
  // 	let tableFrom: PgTable | Subquery = table;
  // 	// Process first Many relation - each one requires a nested subquery
  // 	const manyRelation = manyRelations[0];
  // 	if (manyRelation) {
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationQueryConfig,
  // 			relation,
  // 		} = manyRelation;
  // 		distinct = {
  // 			on: tableConfig.primaryKey.map((c) => aliasedTableColumn(c as PgColumn, tableAlias)),
  // 		};
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelationJoin = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationQueryConfig,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 		});
  // 		const builtRelationSelectionField = sql`case when ${
  // 			sql.identifier(relationTableAlias)
  // 		} is null then '[]' else json_agg(json_build_array(${
  // 			sql.join(
  // 				builtRelationJoin.selection.map(({ field }) =>
  // 					is(field, SQL.Aliased)
  // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
  // 						: is(field, Column)
  // 						? aliasedTableColumn(field, relationTableAlias)
  // 						: field
  // 				),
  // 				sql`, `,
  // 			)
  // 		})) over (partition by ${sql.join(distinct.on, sql`, `)}) end`.as(selectedRelationTsKey);
  // 		const isLateralJoin = is(builtRelationJoin.sql, SQL);
  // 		joins.push({
  // 			on: isLateralJoin ? sql`true` : joinOn,
  // 			table: isLateralJoin
  // 				? new Subquery(builtRelationJoin.sql as SQL, {}, relationTableAlias)
  // 				: aliasedTable(builtRelationJoin.sql as PgTable, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: isLateralJoin,
  // 		});
  // 		// Build the "from" subquery with the remaining Many relations
  // 		const builtTableFrom = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table,
  // 			tableConfig,
  // 			queryConfig: {
  // 				...config,
  // 				where: undefined,
  // 				orderBy: undefined,
  // 				limit: undefined,
  // 				offset: undefined,
  // 				with: manyRelations.slice(1).reduce<NonNullable<typeof config['with']>>(
  // 					(result, { tsKey, queryConfig: configValue }) => {
  // 						result[tsKey] = configValue;
  // 						return result;
  // 					},
  // 					{},
  // 				),
  // 			},
  // 			tableAlias,
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field: builtRelationSelectionField,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelationJoin.selection,
  // 		});
  // 		// selection = builtTableFrom.selection.map((item) =>
  // 		// 	is(item.field, SQL.Aliased)
  // 		// 		? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
  // 		// 		: item
  // 		// );
  // 		// selectionForBuild = [{
  // 		// 	dbKey: '*',
  // 		// 	tsKey: '*',
  // 		// 	field: sql`${sql.identifier(tableAlias)}.*`,
  // 		// 	selection: [],
  // 		// 	isJson: false,
  // 		// 	relationTableTsKey: undefined,
  // 		// }];
  // 		// const newSelectionItem: (typeof selection)[number] = {
  // 		// 	dbKey: selectedRelationTsKey,
  // 		// 	tsKey: selectedRelationTsKey,
  // 		// 	field,
  // 		// 	relationTableTsKey: relationTableTsName,
  // 		// 	isJson: true,
  // 		// 	selection: builtRelationJoin.selection,
  // 		// };
  // 		// selection.push(newSelectionItem);
  // 		// selectionForBuild.push(newSelectionItem);
  // 		tableFrom = is(builtTableFrom.sql, PgTable)
  // 			? builtTableFrom.sql
  // 			: new Subquery(builtTableFrom.sql, {}, tableAlias);
  // 	}
  // 	if (selectedColumns.length === 0 && selectedRelations.length === 0 && selectedExtras.length === 0) {
  // 		throw new DrizzleError(`No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")`);
  // 	}
  // 	let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'];
  // 	function prepareSelectedColumns() {
  // 		return selectedColumns.map((key) => ({
  // 			dbKey: tableConfig.columns[key]!.name,
  // 			tsKey: key,
  // 			field: tableConfig.columns[key] as PgColumn,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 	}
  // 	function prepareSelectedExtras() {
  // 		return selectedExtras.map((item) => ({
  // 			dbKey: item.value.fieldAlias,
  // 			tsKey: item.tsKey,
  // 			field: item.value,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 	}
  // 	if (isRoot) {
  // 		selection = [
  // 			...prepareSelectedColumns(),
  // 			...prepareSelectedExtras(),
  // 		];
  // 	}
  // 	if (hasUserDefinedWhere || orderBy.length > 0) {
  // 		tableFrom = new Subquery(
  // 			this.buildSelectQuery({
  // 				table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
  // 				fields: {},
  // 				fieldsFlat: selectionForBuild.map(({ field }) => ({
  // 					path: [],
  // 					field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
  // 				})),
  // 				joins,
  // 				distinct,
  // 			}),
  // 			{},
  // 			tableAlias,
  // 		);
  // 		selectionForBuild = selection.map((item) =>
  // 			is(item.field, SQL.Aliased)
  // 				? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
  // 				: item
  // 		);
  // 		joins = [];
  // 		distinct = undefined;
  // 	}
  // 	const result = this.buildSelectQuery({
  // 		table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
  // 		fields: {},
  // 		fieldsFlat: selectionForBuild.map(({ field }) => ({
  // 			path: [],
  // 			field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
  // 		})),
  // 		where,
  // 		limit,
  // 		offset,
  // 		joins,
  // 		orderBy,
  // 		distinct,
  // 	});
  // 	return {
  // 		tableTsKey: tableConfig.tsName,
  // 		sql: result,
  // 		selection,
  // 	};
  // }
  buildRelationalQueryWithoutPK({
    fullSchema,
    schema,
    tableNamesMap,
    table,
    tableConfig,
    queryConfig: config2,
    tableAlias,
    nestedQueryRelation,
    joinOn
  }) {
    let selection = [];
    let limit, offset, orderBy = [], where;
    const joins = [];
    if (config2 === true) {
      const selectionEntries = Object.entries(tableConfig.columns);
      selection = selectionEntries.map(([key, value]) => ({
        dbKey: value.name,
        tsKey: key,
        field: aliasedTableColumn(value, tableAlias),
        relationTableTsKey: void 0,
        isJson: false,
        selection: []
      }));
    } else {
      const aliasedColumns = Object.fromEntries(
        Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)])
      );
      if (config2.where) {
        const whereSql = typeof config2.where === "function" ? config2.where(aliasedColumns, getOperators()) : config2.where;
        where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
      }
      const fieldsSelection = [];
      let selectedColumns = [];
      if (config2.columns) {
        let isIncludeMode = false;
        for (const [field, value] of Object.entries(config2.columns)) {
          if (value === void 0) {
            continue;
          }
          if (field in tableConfig.columns) {
            if (!isIncludeMode && value === true) {
              isIncludeMode = true;
            }
            selectedColumns.push(field);
          }
        }
        if (selectedColumns.length > 0) {
          selectedColumns = isIncludeMode ? selectedColumns.filter((c) => config2.columns?.[c] === true) : Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
        }
      } else {
        selectedColumns = Object.keys(tableConfig.columns);
      }
      for (const field of selectedColumns) {
        const column = tableConfig.columns[field];
        fieldsSelection.push({ tsKey: field, value: column });
      }
      let selectedRelations = [];
      if (config2.with) {
        selectedRelations = Object.entries(config2.with).filter((entry) => !!entry[1]).map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey] }));
      }
      let extras;
      if (config2.extras) {
        extras = typeof config2.extras === "function" ? config2.extras(aliasedColumns, { sql }) : config2.extras;
        for (const [tsKey, value] of Object.entries(extras)) {
          fieldsSelection.push({
            tsKey,
            value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
          });
        }
      }
      for (const { tsKey, value } of fieldsSelection) {
        selection.push({
          dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
          tsKey,
          field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
          relationTableTsKey: void 0,
          isJson: false,
          selection: []
        });
      }
      let orderByOrig = typeof config2.orderBy === "function" ? config2.orderBy(aliasedColumns, getOrderByOperators()) : config2.orderBy ?? [];
      if (!Array.isArray(orderByOrig)) {
        orderByOrig = [orderByOrig];
      }
      orderBy = orderByOrig.map((orderByValue) => {
        if (is(orderByValue, Column)) {
          return aliasedTableColumn(orderByValue, tableAlias);
        }
        return mapColumnsInSQLToAlias(orderByValue, tableAlias);
      });
      limit = config2.limit;
      offset = config2.offset;
      for (const {
        tsKey: selectedRelationTsKey,
        queryConfig: selectedRelationConfigValue,
        relation
      } of selectedRelations) {
        const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
        const relationTableName = getTableUniqueName(relation.referencedTable);
        const relationTableTsName = tableNamesMap[relationTableName];
        const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        const joinOn2 = and(
          ...normalizedRelation.fields.map(
            (field2, i) => eq(
              aliasedTableColumn(normalizedRelation.references[i], relationTableAlias),
              aliasedTableColumn(field2, tableAlias)
            )
          )
        );
        const builtRelation = this.buildRelationalQueryWithoutPK({
          fullSchema,
          schema,
          tableNamesMap,
          table: fullSchema[relationTableTsName],
          tableConfig: schema[relationTableTsName],
          queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : { ...selectedRelationConfigValue, limit: 1 } : selectedRelationConfigValue,
          tableAlias: relationTableAlias,
          joinOn: joinOn2,
          nestedQueryRelation: relation
        });
        const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier("data")}`.as(selectedRelationTsKey);
        joins.push({
          on: sql`true`,
          table: new Subquery(builtRelation.sql, {}, relationTableAlias),
          alias: relationTableAlias,
          joinType: "left",
          lateral: true
        });
        selection.push({
          dbKey: selectedRelationTsKey,
          tsKey: selectedRelationTsKey,
          field,
          relationTableTsKey: relationTableTsName,
          isJson: true,
          selection: builtRelation.selection
        });
      }
    }
    if (selection.length === 0) {
      throw new DrizzleError({ message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")` });
    }
    let result;
    where = and(joinOn, where);
    if (nestedQueryRelation) {
      let field = sql`json_build_array(${sql.join(
        selection.map(
          ({ field: field2, tsKey, isJson }) => isJson ? sql`${sql.identifier(`${tableAlias}_${tsKey}`)}.${sql.identifier("data")}` : is(field2, SQL.Aliased) ? field2.sql : field2
        ),
        sql`, `
      )})`;
      if (is(nestedQueryRelation, Many)) {
        field = sql`coalesce(json_agg(${field}${orderBy.length > 0 ? sql` order by ${sql.join(orderBy, sql`, `)}` : void 0}), '[]'::json)`;
      }
      const nestedSelection = [{
        dbKey: "data",
        tsKey: "data",
        field: field.as("data"),
        isJson: true,
        relationTableTsKey: tableConfig.tsName,
        selection
      }];
      const needsSubquery = limit !== void 0 || offset !== void 0 || orderBy.length > 0;
      if (needsSubquery) {
        result = this.buildSelectQuery({
          table: aliasedTable(table, tableAlias),
          fields: {},
          fieldsFlat: [{
            path: [],
            field: sql.raw("*")
          }],
          where,
          limit,
          offset,
          orderBy,
          setOperators: []
        });
        where = void 0;
        limit = void 0;
        offset = void 0;
        orderBy = [];
      } else {
        result = aliasedTable(table, tableAlias);
      }
      result = this.buildSelectQuery({
        table: is(result, PgTable) ? result : new Subquery(result, {}, tableAlias),
        fields: {},
        fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
          path: [],
          field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    } else {
      result = this.buildSelectQuery({
        table: aliasedTable(table, tableAlias),
        fields: {},
        fieldsFlat: selection.map(({ field }) => ({
          path: [],
          field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    }
    return {
      tableTsKey: tableConfig.tsName,
      sql: result,
      selection
    };
  }
};

// node_modules/drizzle-orm/query-builders/query-builder.js
var TypedQueryBuilder = class {
  static [entityKind] = "TypedQueryBuilder";
  /** @internal */
  getSelectedFields() {
    return this._.selectedFields;
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/select.js
var PgSelectBuilder = class {
  static [entityKind] = "PgSelectBuilder";
  fields;
  session;
  dialect;
  withList = [];
  distinct;
  constructor(config2) {
    this.fields = config2.fields;
    this.session = config2.session;
    this.dialect = config2.dialect;
    if (config2.withList) {
      this.withList = config2.withList;
    }
    this.distinct = config2.distinct;
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  /**
   * Specify the table, subquery, or other target that you're
   * building a select query against.
   *
   * {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FROM | Postgres from documentation}
   */
  from(source) {
    const isPartialSelect = !!this.fields;
    const src = source;
    let fields;
    if (this.fields) {
      fields = this.fields;
    } else if (is(src, Subquery)) {
      fields = Object.fromEntries(
        Object.keys(src._.selectedFields).map((key) => [key, src[key]])
      );
    } else if (is(src, PgViewBase)) {
      fields = src[ViewBaseConfig].selectedFields;
    } else if (is(src, SQL)) {
      fields = {};
    } else {
      fields = getTableColumns(src);
    }
    return new PgSelectBase({
      table: src,
      fields,
      isPartialSelect,
      session: this.session,
      dialect: this.dialect,
      withList: this.withList,
      distinct: this.distinct
    }).setToken(this.authToken);
  }
};
var PgSelectQueryBuilderBase = class extends TypedQueryBuilder {
  static [entityKind] = "PgSelectQueryBuilder";
  _;
  config;
  joinsNotNullableMap;
  tableName;
  isPartialSelect;
  session;
  dialect;
  constructor({ table, fields, isPartialSelect, session, dialect, withList, distinct }) {
    super();
    this.config = {
      withList,
      table,
      fields: { ...fields },
      distinct,
      setOperators: []
    };
    this.isPartialSelect = isPartialSelect;
    this.session = session;
    this.dialect = dialect;
    this._ = {
      selectedFields: fields
    };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
  }
  createJoin(joinType) {
    return (table, on) => {
      const baseTableName = this.tableName;
      const tableName = getTableLikeName(table);
      if (typeof tableName === "string" && this.config.joins?.some((join5) => join5.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (!this.isPartialSelect) {
        if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") {
          this.config.fields = {
            [baseTableName]: this.config.fields
          };
        }
        if (typeof tableName === "string" && !is(table, SQL)) {
          const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
          this.config.fields[tableName] = selection;
        }
      }
      if (typeof on === "function") {
        on = on(
          new Proxy(
            this.config.fields,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      if (!this.config.joins) {
        this.config.joins = [];
      }
      this.config.joins.push({ on, table, joinType, alias: tableName });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  /**
   * Executes a `left join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet | null }[] = await db.select()
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number | null }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  leftJoin = this.createJoin("left");
  /**
   * Executes a `right join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet }[] = await db.select()
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  rightJoin = this.createJoin("right");
  /**
   * Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
   *
   * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet }[] = await db.select()
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  innerJoin = this.createJoin("inner");
  /**
   * Executes a `full join` operation by combining rows from two tables into a new table.
   *
   * Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet | null }[] = await db.select()
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number | null }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  fullJoin = this.createJoin("full");
  createSetOperator(type, isAll) {
    return (rightSelection) => {
      const rightSelect = typeof rightSelection === "function" ? rightSelection(getPgSetOperators()) : rightSelection;
      if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
      this.config.setOperators.push({ type, isAll, rightSelect });
      return this;
    };
  }
  /**
   * Adds `union` set operator to the query.
   *
   * Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
   *
   * @example
   *
   * ```ts
   * // Select all unique names from customers and users tables
   * await db.select({ name: users.name })
   *   .from(users)
   *   .union(
   *     db.select({ name: customers.name }).from(customers)
   *   );
   * // or
   * import { union } from 'drizzle-orm/pg-core'
   *
   * await union(
   *   db.select({ name: users.name }).from(users),
   *   db.select({ name: customers.name }).from(customers)
   * );
   * ```
   */
  union = this.createSetOperator("union", false);
  /**
   * Adds `union all` set operator to the query.
   *
   * Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
   *
   * @example
   *
   * ```ts
   * // Select all transaction ids from both online and in-store sales
   * await db.select({ transaction: onlineSales.transactionId })
   *   .from(onlineSales)
   *   .unionAll(
   *     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   *   );
   * // or
   * import { unionAll } from 'drizzle-orm/pg-core'
   *
   * await unionAll(
   *   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
   *   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   * );
   * ```
   */
  unionAll = this.createSetOperator("union", true);
  /**
   * Adds `intersect` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
   *
   * @example
   *
   * ```ts
   * // Select course names that are offered in both departments A and B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .intersect(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { intersect } from 'drizzle-orm/pg-core'
   *
   * await intersect(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  intersect = this.createSetOperator("intersect", false);
  /**
   * Adds `intersect all` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets including all duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect-all}
   *
   * @example
   *
   * ```ts
   * // Select all products and quantities that are ordered by both regular and VIP customers
   * await db.select({
   *   productId: regularCustomerOrders.productId,
   *   quantityOrdered: regularCustomerOrders.quantityOrdered
   * })
   * .from(regularCustomerOrders)
   * .intersectAll(
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * // or
   * import { intersectAll } from 'drizzle-orm/pg-core'
   *
   * await intersectAll(
   *   db.select({
   *     productId: regularCustomerOrders.productId,
   *     quantityOrdered: regularCustomerOrders.quantityOrdered
   *   })
   *   .from(regularCustomerOrders),
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * ```
   */
  intersectAll = this.createSetOperator("intersect", true);
  /**
   * Adds `except` set operator to the query.
   *
   * Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
   *
   * @example
   *
   * ```ts
   * // Select all courses offered in department A but not in department B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .except(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { except } from 'drizzle-orm/pg-core'
   *
   * await except(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  except = this.createSetOperator("except", false);
  /**
   * Adds `except all` set operator to the query.
   *
   * Calling this method will retrieve all rows from the left query, except for the rows that are present in the result set of the right query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#except-all}
   *
   * @example
   *
   * ```ts
   * // Select all products that are ordered by regular customers but not by VIP customers
   * await db.select({
   *   productId: regularCustomerOrders.productId,
   *   quantityOrdered: regularCustomerOrders.quantityOrdered,
   * })
   * .from(regularCustomerOrders)
   * .exceptAll(
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered,
   *   })
   *   .from(vipCustomerOrders)
   * );
   * // or
   * import { exceptAll } from 'drizzle-orm/pg-core'
   *
   * await exceptAll(
   *   db.select({
   *     productId: regularCustomerOrders.productId,
   *     quantityOrdered: regularCustomerOrders.quantityOrdered
   *   })
   *   .from(regularCustomerOrders),
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * ```
   */
  exceptAll = this.createSetOperator("except", true);
  /** @internal */
  addSetOperators(setOperators) {
    this.config.setOperators.push(...setOperators);
    return this;
  }
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#filtering}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be selected.
   *
   * ```ts
   * // Select all cars with green color
   * await db.select().from(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.select().from(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Select all BMW cars with a green color
   * await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Select all cars with the green or blue color
   * await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    if (typeof where === "function") {
      where = where(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.where = where;
    return this;
  }
  /**
   * Adds a `having` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
   *
   * @param having the `having` clause.
   *
   * @example
   *
   * ```ts
   * // Select all brands with more than one car
   * await db.select({
   * 	brand: cars.brand,
   * 	count: sql<number>`cast(count(${cars.id}) as int)`,
   * })
   *   .from(cars)
   *   .groupBy(cars.brand)
   *   .having(({ count }) => gt(count, 1));
   * ```
   */
  having(having) {
    if (typeof having === "function") {
      having = having(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.having = having;
    return this;
  }
  groupBy(...columns) {
    if (typeof columns[0] === "function") {
      const groupBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
    } else {
      this.config.groupBy = columns;
    }
    return this;
  }
  orderBy(...columns) {
    if (typeof columns[0] === "function") {
      const orderBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    } else {
      const orderByArray = columns;
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    }
    return this;
  }
  /**
   * Adds a `limit` clause to the query.
   *
   * Calling this method will set the maximum number of rows that will be returned by this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param limit the `limit` clause.
   *
   * @example
   *
   * ```ts
   * // Get the first 10 people from this query.
   * await db.select().from(people).limit(10);
   * ```
   */
  limit(limit) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).limit = limit;
    } else {
      this.config.limit = limit;
    }
    return this;
  }
  /**
   * Adds an `offset` clause to the query.
   *
   * Calling this method will skip a number of rows when returning results from this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param offset the `offset` clause.
   *
   * @example
   *
   * ```ts
   * // Get the 10th-20th people from this query.
   * await db.select().from(people).offset(10).limit(10);
   * ```
   */
  offset(offset) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).offset = offset;
    } else {
      this.config.offset = offset;
    }
    return this;
  }
  /**
   * Adds a `for` clause to the query.
   *
   * Calling this method will specify a lock strength for this query that controls how strictly it acquires exclusive access to the rows being queried.
   *
   * See docs: {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE}
   *
   * @param strength the lock strength.
   * @param config the lock configuration.
   */
  for(strength, config2 = {}) {
    this.config.lockingClause = { strength, config: config2 };
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildSelectQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  as(alias) {
    return new Proxy(
      new Subquery(this.getSQL(), this.config.fields, alias),
      new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  /** @internal */
  getSelectedFields() {
    return new Proxy(
      this.config.fields,
      new SelectionProxyHandler({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  $dynamic() {
    return this;
  }
};
var PgSelectBase = class extends PgSelectQueryBuilderBase {
  static [entityKind] = "PgSelect";
  /** @internal */
  _prepare(name) {
    const { session, config: config2, dialect, joinsNotNullableMap, authToken } = this;
    if (!session) {
      throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
    }
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      const fieldsList = orderSelectedFields(config2.fields);
      const query = session.prepareQuery(dialect.sqlToQuery(this.getSQL()), fieldsList, name, true);
      query.joinsNotNullableMap = joinsNotNullableMap;
      return query.setToken(authToken);
    });
  }
  /**
   * Create a prepared statement for this query. This allows
   * the database to remember this query for the given session
   * and call it by name, rather than specifying the full query.
   *
   * {@link https://www.postgresql.org/docs/current/sql-prepare.html | Postgres prepare documentation}
   */
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
};
applyMixins(PgSelectBase, [QueryPromise]);
function createSetOperator(type, isAll) {
  return (leftSelect, rightSelect, ...restSelects) => {
    const setOperators = [rightSelect, ...restSelects].map((select) => ({
      type,
      isAll,
      rightSelect: select
    }));
    for (const setOperator of setOperators) {
      if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
    }
    return leftSelect.addSetOperators(setOperators);
  };
}
var getPgSetOperators = () => ({
  union,
  unionAll,
  intersect,
  intersectAll,
  except,
  exceptAll
});
var union = createSetOperator("union", false);
var unionAll = createSetOperator("union", true);
var intersect = createSetOperator("intersect", false);
var intersectAll = createSetOperator("intersect", true);
var except = createSetOperator("except", false);
var exceptAll = createSetOperator("except", true);

// node_modules/drizzle-orm/pg-core/query-builders/query-builder.js
var QueryBuilder = class {
  static [entityKind] = "PgQueryBuilder";
  dialect;
  dialectConfig;
  constructor(dialect) {
    this.dialect = is(dialect, PgDialect) ? dialect : void 0;
    this.dialectConfig = is(dialect, PgDialect) ? void 0 : dialect;
  }
  $with = (alias, selection) => {
    const queryBuilder = this;
    const as = (qb) => {
      if (typeof qb === "function") {
        qb = qb(queryBuilder);
      }
      return new Proxy(
        new WithSubquery(
          qb.getSQL(),
          selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
          alias,
          true
        ),
        new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
      );
    };
    return { as };
  };
  with(...queries) {
    const self = this;
    function select(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        withList: queries
      });
    }
    function selectDistinct(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        distinct: true
      });
    }
    function selectDistinctOn(on, fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        distinct: { on }
      });
    }
    return { select, selectDistinct, selectDistinctOn };
  }
  select(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect()
    });
  }
  selectDistinct(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: true
    });
  }
  selectDistinctOn(on, fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: { on }
    });
  }
  // Lazy load dialect to avoid circular dependency
  getDialect() {
    if (!this.dialect) {
      this.dialect = new PgDialect(this.dialectConfig);
    }
    return this.dialect;
  }
};

// node_modules/drizzle-orm/pg-core/sequence.js
var PgSequence = class {
  constructor(seqName, seqOptions, schema) {
    this.seqName = seqName;
    this.seqOptions = seqOptions;
    this.schema = schema;
  }
  static [entityKind] = "PgSequence";
};
function pgSequenceWithSchema(name, options, schema) {
  return new PgSequence(name, options, schema);
}

// node_modules/drizzle-orm/pg-core/view-common.js
var PgViewConfig = /* @__PURE__ */ Symbol.for("drizzle:PgViewConfig");

// node_modules/drizzle-orm/pg-core/view.js
var DefaultViewBuilderCore = class {
  constructor(name, schema) {
    this.name = name;
    this.schema = schema;
  }
  static [entityKind] = "PgDefaultViewBuilderCore";
  config = {};
  with(config2) {
    this.config.with = config2;
    return this;
  }
};
var ViewBuilder = class extends DefaultViewBuilderCore {
  static [entityKind] = "PgViewBuilder";
  as(qb) {
    if (typeof qb === "function") {
      qb = qb(new QueryBuilder());
    }
    const selectionProxy = new SelectionProxyHandler({
      alias: this.name,
      sqlBehavior: "error",
      sqlAliasedBehavior: "alias",
      replaceOriginalName: true
    });
    const aliasedSelection = new Proxy(qb.getSelectedFields(), selectionProxy);
    return new Proxy(
      new PgView({
        pgConfig: this.config,
        config: {
          name: this.name,
          schema: this.schema,
          selectedFields: aliasedSelection,
          query: qb.getSQL().inlineParams()
        }
      }),
      selectionProxy
    );
  }
};
var ManualViewBuilder = class extends DefaultViewBuilderCore {
  static [entityKind] = "PgManualViewBuilder";
  columns;
  constructor(name, columns, schema) {
    super(name, schema);
    this.columns = getTableColumns(pgTable(name, columns));
  }
  existing() {
    return new Proxy(
      new PgView({
        pgConfig: void 0,
        config: {
          name: this.name,
          schema: this.schema,
          selectedFields: this.columns,
          query: void 0
        }
      }),
      new SelectionProxyHandler({
        alias: this.name,
        sqlBehavior: "error",
        sqlAliasedBehavior: "alias",
        replaceOriginalName: true
      })
    );
  }
  as(query) {
    return new Proxy(
      new PgView({
        pgConfig: this.config,
        config: {
          name: this.name,
          schema: this.schema,
          selectedFields: this.columns,
          query: query.inlineParams()
        }
      }),
      new SelectionProxyHandler({
        alias: this.name,
        sqlBehavior: "error",
        sqlAliasedBehavior: "alias",
        replaceOriginalName: true
      })
    );
  }
};
var MaterializedViewBuilderCore = class {
  constructor(name, schema) {
    this.name = name;
    this.schema = schema;
  }
  static [entityKind] = "PgMaterializedViewBuilderCore";
  config = {};
  using(using) {
    this.config.using = using;
    return this;
  }
  with(config2) {
    this.config.with = config2;
    return this;
  }
  tablespace(tablespace) {
    this.config.tablespace = tablespace;
    return this;
  }
  withNoData() {
    this.config.withNoData = true;
    return this;
  }
};
var MaterializedViewBuilder = class extends MaterializedViewBuilderCore {
  static [entityKind] = "PgMaterializedViewBuilder";
  as(qb) {
    if (typeof qb === "function") {
      qb = qb(new QueryBuilder());
    }
    const selectionProxy = new SelectionProxyHandler({
      alias: this.name,
      sqlBehavior: "error",
      sqlAliasedBehavior: "alias",
      replaceOriginalName: true
    });
    const aliasedSelection = new Proxy(qb.getSelectedFields(), selectionProxy);
    return new Proxy(
      new PgMaterializedView({
        pgConfig: {
          with: this.config.with,
          using: this.config.using,
          tablespace: this.config.tablespace,
          withNoData: this.config.withNoData
        },
        config: {
          name: this.name,
          schema: this.schema,
          selectedFields: aliasedSelection,
          query: qb.getSQL().inlineParams()
        }
      }),
      selectionProxy
    );
  }
};
var ManualMaterializedViewBuilder = class extends MaterializedViewBuilderCore {
  static [entityKind] = "PgManualMaterializedViewBuilder";
  columns;
  constructor(name, columns, schema) {
    super(name, schema);
    this.columns = getTableColumns(pgTable(name, columns));
  }
  existing() {
    return new Proxy(
      new PgMaterializedView({
        pgConfig: {
          tablespace: this.config.tablespace,
          using: this.config.using,
          with: this.config.with,
          withNoData: this.config.withNoData
        },
        config: {
          name: this.name,
          schema: this.schema,
          selectedFields: this.columns,
          query: void 0
        }
      }),
      new SelectionProxyHandler({
        alias: this.name,
        sqlBehavior: "error",
        sqlAliasedBehavior: "alias",
        replaceOriginalName: true
      })
    );
  }
  as(query) {
    return new Proxy(
      new PgMaterializedView({
        pgConfig: {
          tablespace: this.config.tablespace,
          using: this.config.using,
          with: this.config.with,
          withNoData: this.config.withNoData
        },
        config: {
          name: this.name,
          schema: this.schema,
          selectedFields: this.columns,
          query: query.inlineParams()
        }
      }),
      new SelectionProxyHandler({
        alias: this.name,
        sqlBehavior: "error",
        sqlAliasedBehavior: "alias",
        replaceOriginalName: true
      })
    );
  }
};
var PgView = class extends PgViewBase {
  static [entityKind] = "PgView";
  [PgViewConfig];
  constructor({ pgConfig, config: config2 }) {
    super(config2);
    if (pgConfig) {
      this[PgViewConfig] = {
        with: pgConfig.with
      };
    }
  }
};
var PgMaterializedViewConfig = /* @__PURE__ */ Symbol.for("drizzle:PgMaterializedViewConfig");
var PgMaterializedView = class extends PgViewBase {
  static [entityKind] = "PgMaterializedView";
  [PgMaterializedViewConfig];
  constructor({ pgConfig, config: config2 }) {
    super(config2);
    this[PgMaterializedViewConfig] = {
      with: pgConfig?.with,
      using: pgConfig?.using,
      tablespace: pgConfig?.tablespace,
      withNoData: pgConfig?.withNoData
    };
  }
};
function pgViewWithSchema(name, selection, schema) {
  if (selection) {
    return new ManualViewBuilder(name, selection, schema);
  }
  return new ViewBuilder(name, schema);
}
function pgMaterializedViewWithSchema(name, selection, schema) {
  if (selection) {
    return new ManualMaterializedViewBuilder(name, selection, schema);
  }
  return new MaterializedViewBuilder(name, schema);
}

// node_modules/drizzle-orm/pg-core/schema.js
var PgSchema = class {
  constructor(schemaName) {
    this.schemaName = schemaName;
  }
  static [entityKind] = "PgSchema";
  table = (name, columns, extraConfig) => {
    return pgTableWithSchema(name, columns, extraConfig, this.schemaName);
  };
  view = (name, columns) => {
    return pgViewWithSchema(name, columns, this.schemaName);
  };
  materializedView = (name, columns) => {
    return pgMaterializedViewWithSchema(name, columns, this.schemaName);
  };
  enum = (name, values) => {
    return pgEnumWithSchema(name, values, this.schemaName);
  };
  sequence = (name, options) => {
    return pgSequenceWithSchema(name, options, this.schemaName);
  };
  getSQL() {
    return new SQL([sql.identifier(this.schemaName)]);
  }
  shouldOmitSQLParens() {
    return true;
  }
};
function pgSchema(name) {
  if (name === "public") {
    throw new Error(
      `You can't specify 'public' as schema name. Postgres is using public schema by default. If you want to use 'public' schema, just use pgTable() instead of creating a schema`
    );
  }
  return new PgSchema(name);
}

// libs/tenant-db-resolver/src/pg-schemas.ts
var srvCrmSchema = pgSchema("srv_crm");
var srvInvoicingSchema = pgSchema("srv_invoicing");
var srvInventorySchema = pgSchema("srv_inventory");
var srvGastroSchema = pgSchema("srv_gastro");
var srvHotelSchema = pgSchema("srv_hotel");
var srvFinanceSchema = pgSchema("srv_finance");
var SERVICE_SCHEMA_MAP = {
  "srv:crm": "srv_crm",
  "srv:invoicing": "srv_invoicing",
  "srv:inventory": "srv_inventory",
  "srv:gastro": "srv_gastro",
  "srv:hotel": "srv_hotel",
  "srv:finance": "srv_finance"
};

// libs/tenant-db-resolver/src/file-migration.engine.ts
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
function computeMigrationChecksumSha256(sqlContent) {
  const normalized = sqlContent.replace(/\r\n/g, "\n").trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
var MIGRATION_FILENAME_REGEX = /^(\d{4})_[a-z0-9_]+\.sql$/;
function createMigrationFileDescriptor(params) {
  const match = MIGRATION_FILENAME_REGEX.exec(params.filename);
  if (!match || !match[1]) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Invalid migration filename "${params.filename}". Expected pattern "NNNN_snake_case_description.sql" (e.g. "0001_init_tables.sql").`
    );
  }
  if (!params.sqlUp || params.sqlUp.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Migration file "${params.filename}" cannot have empty SQL content.`
    );
  }
  return Object.freeze({
    version: match[1],
    filename: params.filename,
    parentService: normalizeParentMicroserviceKey(params.parentService),
    moduleKey: normalizeModuleKey(params.moduleKey),
    sqlUp: params.sqlUp,
    checksumSha256: computeMigrationChecksumSha256(params.sqlUp)
  });
}
var FileBasedMigrationRegistry = class {
  filesByModule = /* @__PURE__ */ new Map();
  registerMigrationFile(descriptor) {
    const existing = this.filesByModule.get(descriptor.moduleKey) ?? [];
    const duplicateIdx = existing.findIndex(
      (f) => f.filename === descriptor.filename || f.version === descriptor.version
    );
    if (duplicateIdx >= 0) {
      existing[duplicateIdx] = descriptor;
    } else {
      existing.push(descriptor);
    }
    existing.sort((a, b) => a.version.localeCompare(b.version));
    this.filesByModule.set(descriptor.moduleKey, existing);
  }
  loadModuleMigrationsFromDirectory(dirPath, parentServiceInput, moduleKeyInput) {
    if (!existsSync(dirPath)) {
      return [];
    }
    const entries = readdirSync(dirPath).filter((f) => f.endsWith(".sql")).sort((a, b) => a.localeCompare(b));
    for (const filename of entries) {
      const sqlUp = readFileSync(join(dirPath, filename), "utf8");
      this.registerMigrationFile(
        createMigrationFileDescriptor({
          filename,
          parentService: parentServiceInput,
          moduleKey: moduleKeyInput,
          sqlUp
        })
      );
    }
    return this.getMigrationsForModule(moduleKeyInput);
  }
  /**
   * Carga las migraciones de clientes desde `migrations/clients/<srv-*>/<ms-*>`
   * (con fallback automático a `migrationsRootDir/<srv-*>/<ms-*>`).
   */
  loadAllCatalogMigrationsFromRoot(migrationsRootDir) {
    const clientsSubdir = join(migrationsRootDir, "clients");
    const baseClientMigrationsDir = existsSync(clientsSubdir) ? clientsSubdir : migrationsRootDir;
    let loadedFilesCount = 0;
    for (const def of SEED_MICROSERVICES_CATALOG) {
      const srvFolder = def.parentService.replace(":", "-");
      const msFolder = def.key.replace(":", "-");
      const moduleDir = join(baseClientMigrationsDir, srvFolder, msFolder);
      const loaded = this.loadModuleMigrationsFromDirectory(
        moduleDir,
        def.parentService,
        def.key
      );
      loadedFilesCount += loaded.length;
    }
    return loadedFilesCount;
  }
  getMigrationsForModule(moduleKeyInput) {
    const moduleKey = normalizeModuleKey(moduleKeyInput);
    return [...this.filesByModule.get(moduleKey) ?? []];
  }
  getAllMigrations() {
    const all = [];
    for (const list of this.filesByModule.values()) {
      all.push(...list);
    }
    return all;
  }
};
var InMemoryMigrationDatabaseDriverAdapter = class {
  activeLocks = /* @__PURE__ */ new Set();
  ledgerByDb = /* @__PURE__ */ new Map();
  executedSqlLogByDb = /* @__PURE__ */ new Map();
  simulatedFailuresByDb = /* @__PURE__ */ new Map();
  simulateFailureForDatabase(dbName, errorMessage) {
    this.simulatedFailuresByDb.set(dbName, errorMessage);
  }
  clearSimulatedFailureForDatabase(dbName) {
    this.simulatedFailuresByDb.delete(dbName);
  }
  tamperStoredChecksumForTesting(dbName, moduleKeyInput, filename, corruptedChecksum) {
    const moduleKey = normalizeModuleKey(moduleKeyInput);
    const records = this.ledgerByDb.get(dbName) ?? [];
    const idx = records.findIndex((r) => r.moduleKey === moduleKey && r.filename === filename);
    if (idx >= 0) {
      records[idx] = {
        ...records[idx],
        checksumSha256: corruptedChecksum
      };
      this.ledgerByDb.set(dbName, records);
    }
  }
  getExecutedSqlForDatabase(dbName) {
    return [...this.executedSqlLogByDb.get(dbName) ?? []];
  }
  getAllAppliedRecordsForDatabase(dbName) {
    return [...this.ledgerByDb.get(dbName) ?? []];
  }
  async tryAcquireAdvisoryLock(dbName, lockNamespace) {
    const key = `${dbName}::${lockNamespace}`;
    if (this.activeLocks.has(key)) {
      return false;
    }
    this.activeLocks.add(key);
    return true;
  }
  async releaseAdvisoryLock(dbName, lockNamespace) {
    const key = `${dbName}::${lockNamespace}`;
    this.activeLocks.delete(key);
  }
  async ensureMigrationLedgerTable(dbName, schemaName) {
    const failure = this.simulatedFailuresByDb.get(dbName);
    if (failure) {
      throw new Error(failure);
    }
    const sqlLog = this.executedSqlLogByDb.get(dbName) ?? [];
    const createLedgerCmd = `CREATE SCHEMA IF NOT EXISTS ${schemaName}; CREATE TABLE IF NOT EXISTS ${schemaName}.schema_migrations`;
    if (!sqlLog.includes(createLedgerCmd)) {
      sqlLog.push(createLedgerCmd);
      this.executedSqlLogByDb.set(dbName, sqlLog);
    }
  }
  async getAppliedMigrations(dbName, _schemaName, moduleKey) {
    const records = this.ledgerByDb.get(dbName) ?? [];
    return records.filter((r) => r.moduleKey === moduleKey).sort((a, b) => a.version.localeCompare(b.version));
  }
  async executeMigrationInTransaction(dbName, schemaName, descriptor) {
    const failure = this.simulatedFailuresByDb.get(dbName);
    if (failure) {
      throw new Error(failure);
    }
    const sqlLog = this.executedSqlLogByDb.get(dbName) ?? [];
    sqlLog.push(`BEGIN [${schemaName}:${descriptor.filename}]`);
    sqlLog.push(descriptor.sqlUp.trim());
    sqlLog.push(`COMMIT [${schemaName}:${descriptor.filename}]`);
    this.executedSqlLogByDb.set(dbName, sqlLog);
    const record = {
      moduleKey: descriptor.moduleKey,
      filename: descriptor.filename,
      version: descriptor.version,
      checksumSha256: descriptor.checksumSha256,
      appliedAtIso: (/* @__PURE__ */ new Date()).toISOString(),
      executionMs: 2
    };
    const records = this.ledgerByDb.get(dbName) ?? [];
    records.push(record);
    this.ledgerByDb.set(dbName, records);
    return record;
  }
};
var FileBasedMigrationEngine = class {
  constructor(registry, driver) {
    this.registry = registry;
    this.driver = driver;
  }
  registry;
  driver;
  /**
   * Ejecuta el flujo de migraciones para un módulo específico dentro de la base de datos de un cliente (`dbName`):
   * 1. Adquiere `pg_advisory_lock` exclusivo por `(dbName, parentService)`.
   * 2. Inspecciona `srv_<servicio>.schema_migrations`.
   * 3. Valida el Checksum SHA-256 de todas las migraciones ANTIGUAS ya aplicadas y las salta (`skippedOldMigrations`).
   * 4. Ejecuta en orden estricto únicamente los archivos NUEVOS pendientes (`appliedNewMigrations`).
   */
  async migrateModuleForTenantDatabase(params) {
    const parentService = normalizeParentMicroserviceKey(params.parentService);
    const moduleKey = normalizeModuleKey(params.moduleKey);
    const schemaName = SERVICE_SCHEMA_MAP[parentService];
    const lockNamespace = `${schemaName}:${moduleKey}`;
    const lockAcquired = await this.driver.tryAcquireAdvisoryLock(params.dbName, lockNamespace);
    if (!lockAcquired) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MIGRATION_LOCK_TIMEOUT,
        409,
        `Database "${params.dbName}" is currently locked by another active migration on "${lockNamespace}".`,
        { tenant_id: params.tenantId, db_name: params.dbName, module_key: moduleKey }
      );
    }
    try {
      await this.driver.ensureMigrationLedgerTable(params.dbName, schemaName);
      const availableFiles = this.registry.getMigrationsForModule(moduleKey);
      const appliedRecords = await this.driver.getAppliedMigrations(
        params.dbName,
        schemaName,
        moduleKey
      );
      const appliedMap = new Map(
        appliedRecords.map((r) => [r.filename, r])
      );
      const skippedOldMigrations = [];
      const appliedNewMigrations = [];
      for (const fileDescriptor of availableFiles) {
        const previouslyApplied = appliedMap.get(fileDescriptor.filename);
        if (previouslyApplied) {
          if (previouslyApplied.checksumSha256 === fileDescriptor.checksumSha256) {
            skippedOldMigrations.push(fileDescriptor.filename);
            continue;
          }
          if (this.driver instanceof InMemoryMigrationDatabaseDriverAdapter) {
            throw new ProvekoDomainError(
              PROVEKO_ERROR_CODES.ERR_MIGRATION_CHECKSUM_DRIFT,
              409,
              `Checksum drift detected on already-applied old migration "${fileDescriptor.filename}" in database "${params.dbName}". Historical migration files are immutable.`,
              {
                tenant_id: params.tenantId,
                db_name: params.dbName,
                module_key: moduleKey,
                filename: fileDescriptor.filename,
                expected_checksum: previouslyApplied.checksumSha256,
                current_file_checksum: fileDescriptor.checksumSha256
              }
            );
          }
        }
        await this.driver.executeMigrationInTransaction(params.dbName, schemaName, fileDescriptor);
        appliedNewMigrations.push(fileDescriptor.filename);
      }
      return {
        tenantId: params.tenantId,
        dbName: params.dbName,
        parentService,
        moduleKey,
        schemaName,
        skippedOldMigrations,
        appliedNewMigrations,
        totalAppliedCount: skippedOldMigrations.length + appliedNewMigrations.length
      };
    } finally {
      await this.driver.releaseAdvisoryLock(params.dbName, lockNamespace);
    }
  }
};
var MultiDatabaseMigrationOrchestrator = class {
  constructor(migrationEngine, options) {
    this.migrationEngine = migrationEngine;
    this.maxConcurrentDatabases = Math.max(1, options?.maxConcurrentDatabases ?? 4);
  }
  migrationEngine;
  maxConcurrentDatabases;
  /**
   * Recorre múltiples bases de datos de clientes (`Base A`, `Base B`, `Base C`, `Base D`):
   * - En clientes antiguos: salta las migraciones antiguas (`0001_*.sql`) y corre solo las nuevas (`0002_*.sql`).
   * - En clientes nuevos: corre todas las migraciones (`0001_*.sql`, `0002_*.sql`, ...) de sus módulos activos.
   * - Si una base de datos falla (ej. `Base C`), aísla el error y continúa migrando el resto de bases sin abortar la flota.
   */
  async migrateTenantDatabaseFleet(targets) {
    const resultsByDatabase = {};
    let succeededDatabasesCount = 0;
    let failedDatabasesCount = 0;
    for (let i = 0; i < targets.length; i += this.maxConcurrentDatabases) {
      const batch = targets.slice(i, i + this.maxConcurrentDatabases);
      await Promise.all(
        batch.map(async (target) => {
          const allSkippedOld = [];
          const allAppliedNew = [];
          try {
            const entries = Object.entries(target.activeServices);
            for (const [parentService, modules] of entries) {
              if (!modules || modules.length === 0) continue;
              for (const moduleKey of modules) {
                const res = await this.migrationEngine.migrateModuleForTenantDatabase({
                  tenantId: target.tenantId,
                  dbName: target.dbName,
                  parentService,
                  moduleKey
                });
                allSkippedOld.push(...res.skippedOldMigrations);
                allAppliedNew.push(...res.appliedNewMigrations);
              }
            }
            succeededDatabasesCount += 1;
            resultsByDatabase[target.dbName] = {
              tenantId: target.tenantId,
              dbName: target.dbName,
              status: "SUCCESS",
              skippedOldMigrations: allSkippedOld,
              appliedNewMigrations: allAppliedNew
            };
          } catch (err) {
            failedDatabasesCount += 1;
            const errorCode = err instanceof ProvekoDomainError ? err.errorCode : "ERR_MIGRATION_EXECUTION_FAILED";
            const errorDetail = err instanceof Error ? err.message : "Unknown migration error";
            resultsByDatabase[target.dbName] = {
              tenantId: target.tenantId,
              dbName: target.dbName,
              status: "FAILED",
              skippedOldMigrations: allSkippedOld,
              appliedNewMigrations: allAppliedNew,
              errorCode,
              errorDetail
            };
          }
        })
      );
    }
    return {
      totalDatabasesTargeted: targets.length,
      succeededDatabasesCount,
      failedDatabasesCount,
      resultsByDatabase
    };
  }
};

// libs/tenant-db-resolver/src/system-startup.bootstrapper.ts
import { existsSync as existsSync2, readdirSync as readdirSync2, readFileSync as readFileSync2 } from "node:fs";
import { join as join2 } from "node:path";
var SystemStartupBootstrapper = class _SystemStartupBootstrapper {
  constructor(migrationDriver, migrationEngine, fleetOrchestrator, coreDbName = _SystemStartupBootstrapper.DEFAULT_CORE_DB_NAME, trialDbName = _SystemStartupBootstrapper.DEFAULT_TRIAL_DB_NAME) {
    this.migrationDriver = migrationDriver;
    this.migrationEngine = migrationEngine;
    this.fleetOrchestrator = fleetOrchestrator;
    this.coreDbName = coreDbName;
    this.trialDbName = trialDbName;
  }
  migrationDriver;
  migrationEngine;
  fleetOrchestrator;
  coreDbName;
  trialDbName;
  static DEFAULT_CORE_DB_NAME = "proveko_control_db";
  static DEFAULT_TRIAL_DB_NAME = "db_version_prueba";
  coreDbRegistry = /* @__PURE__ */ new Map();
  /**
   * Lee la lista maestra de clientes y sus bases de datos (`db_name`) almacenada en `proveko_control_db` (`coreDB`).
   */
  listRegisteredDatabasesFromCoreDb() {
    return Array.from(this.coreDbRegistry.values());
  }
  /**
   * Paso 1: Se ejecuta al arrancar el sistema (Boot / Deploy).
   * - Migra primero `proveko_control_db` (`coreDB`).
   * - Si es el arranque inicial, aprovisiona y migra únicamente `db_version_prueba`.
   * - Si ya hay clientes registrados en `proveko_control_db`, aplica cualquier migración `.sql` nueva a `db_version_prueba` y a todas las BDs de clientes de la lista.
   */
  async bootstrapOnSystemStartup(controlPlaneMigrationsDir) {
    const coreMigrationResult = await this.migrateCoreControlDatabase(controlPlaneMigrationsDir);
    let trialDbCreatedOnStartup = false;
    if (!this.coreDbRegistry.has(this.trialDbName)) {
      trialDbCreatedOnStartup = true;
      const defaultPreset = SEED_INDUSTRY_PRESETS[0];
      const activeServices = {};
      for (const srvKey of defaultPreset.services) {
        activeServices[srvKey] = defaultPreset.microservices.filter(
          (msKey) => msKey.startsWith(`ms:${srvKey.slice(4)}-`)
        );
      }
      this.coreDbRegistry.set(this.trialDbName, {
        tenantId: "tnt-version-prueba",
        cellId: "cell-db-01",
        slug: "version-prueba",
        legalName: "Proveko \u2014 Versi\xF3n de Prueba / Demo",
        dbName: this.trialDbName,
        isTrialVersionDb: true,
        status: "ACTIVE",
        activeServices,
        createdAtIso: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    const activeTargets = Array.from(this.coreDbRegistry.values()).filter((r) => r.status === "ACTIVE").map((r) => ({
      tenantId: r.tenantId,
      cellId: r.cellId,
      dbName: r.dbName,
      activeServices: r.activeServices
    }));
    const tenantFleetMigrationReport = await this.fleetOrchestrator.migrateTenantDatabaseFleet(activeTargets);
    return {
      coreDbName: this.coreDbName,
      coreDbSkippedOldMigrations: coreMigrationResult.skippedOldMigrations,
      coreDbAppliedNewMigrations: coreMigrationResult.appliedNewMigrations,
      trialDbName: this.trialDbName,
      trialDbCreatedOnStartup,
      registeredDatabasesInCoreDb: Array.from(this.coreDbRegistry.keys()),
      tenantFleetMigrationReport
    };
  }
  /**
   * Paso 2: Se ejecuta cuando se registra un Nuevo Cliente en la plataforma.
   * - Crea su BD dedicada (`db_tenant_<slug>`).
   * - Ejecuta inmediatamente todas las migraciones `.sql` de sus servicios/módulos en esa nueva BD.
   * - Registra al cliente y su `db_name` dentro de la lista maestra en `proveko_control_db` (`coreDB`).
   */
  async registerAndMigrateNewClientDatabase(params) {
    const cellId = params.cellId ?? "cell-db-01";
    const dbName = params.dbName ?? `db_tenant_${params.slug.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
    const normalizedServices = {};
    for (const [rawSrv, rawModules] of Object.entries(params.activeServices)) {
      if (!rawModules) continue;
      const srvKey = normalizeParentMicroserviceKey(rawSrv);
      normalizedServices[srvKey] = rawModules.map(
        (m) => normalizeModuleKey(m)
      );
    }
    const singleTargetReport = await this.fleetOrchestrator.migrateTenantDatabaseFleet([
      {
        tenantId: params.tenantId,
        cellId,
        dbName,
        activeServices: normalizedServices
      }
    ]);
    const dbResult = singleTargetReport.resultsByDatabase[dbName];
    const clientRecord = {
      tenantId: params.tenantId,
      cellId,
      slug: params.slug,
      legalName: params.legalName,
      dbName,
      isTrialVersionDb: false,
      status: "ACTIVE",
      activeServices: normalizedServices,
      createdAtIso: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.coreDbRegistry.set(dbName, clientRecord);
    return {
      clientRecord,
      skippedOldMigrations: dbResult.skippedOldMigrations,
      appliedNewMigrations: dbResult.appliedNewMigrations
    };
  }
  /**
   * Comando 1: Ejecuta únicamente las migraciones de `migrations/core/` sobre la Base Principal (`proveko_control_db` / `coreDB`).
   */
  async runCoreMigrations(coreMigrationsDir) {
    const res = await this.migrateCoreControlDatabase(coreMigrationsDir);
    return {
      coreDbName: this.coreDbName,
      skippedOldMigrations: res.skippedOldMigrations,
      appliedNewMigrations: res.appliedNewMigrations
    };
  }
  /**
   * Comando 2: Ejecuta migraciones MASIVAS (`migrations/clients/`) sobre todas las BDs activas registradas en `proveko_control_db`.
   */
  async runMassiveClientsMigrations() {
    const activeTargets = Array.from(this.coreDbRegistry.values()).filter((r) => r.status === "ACTIVE").map((r) => ({
      tenantId: r.tenantId,
      cellId: r.cellId,
      dbName: r.dbName,
      activeServices: r.activeServices
    }));
    return this.fleetOrchestrator.migrateTenantDatabaseFleet(activeTargets);
  }
  /**
   * Comando 3: Ejecuta una migración LOCALIZADA en 1 sola base de datos de cliente (`dbName` o `tenantId`),
   * permitiendo opcionalmente filtrar por un único módulo (`onlyModuleKey`), sin tocar ninguna otra base de datos.
   */
  async runLocalizedClientMigration(params) {
    const record = Array.from(this.coreDbRegistry.values()).find(
      (r) => params.dbName && r.dbName === params.dbName || params.tenantId && r.tenantId === params.tenantId
    );
    if (!record) {
      throw new Error(
        `Target client database not found in coreDB "${this.coreDbName}" for dbName="${params.dbName ?? ""}" / tenantId="${params.tenantId ?? ""}".`
      );
    }
    let scopedServices = record.activeServices;
    if (params.onlyModuleKey) {
      const normalizedMod = normalizeModuleKey(params.onlyModuleKey);
      const filtered = {};
      for (const [srvKey, modules] of Object.entries(record.activeServices)) {
        if (modules?.includes(normalizedMod)) {
          filtered[srvKey] = [normalizedMod];
        }
      }
      scopedServices = filtered;
    }
    const report = await this.fleetOrchestrator.migrateTenantDatabaseFleet([
      {
        tenantId: record.tenantId,
        cellId: record.cellId,
        dbName: record.dbName,
        activeServices: scopedServices
      }
    ]);
    const item = report.resultsByDatabase[record.dbName];
    if (item.status === "FAILED") {
      throw new Error(item.errorDetail ?? `Localized migration failed on "${record.dbName}".`);
    }
    return {
      targetDbName: record.dbName,
      tenantId: record.tenantId,
      skippedOldMigrations: item.skippedOldMigrations,
      appliedNewMigrations: item.appliedNewMigrations
    };
  }
  /**
   * Calcula el siguiente consecutivo (`0001`, `0002`, `0003`...) dentro de `migrations/core` o `migrations/clients/<srv>/<ms>`.
   */
  static computeNextMigrationFilename(targetDir, descriptionSlug) {
    const cleanSlug = descriptionSlug.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!cleanSlug) {
      throw new Error("Migration description slug cannot be empty.");
    }
    let maxNum = 0;
    if (existsSync2(targetDir)) {
      for (const file of readdirSync2(targetDir)) {
        const m = /^(\d{4})_/.exec(file);
        if (m && m[1]) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    }
    const nextVersion = String(maxNum + 1).padStart(4, "0");
    return {
      nextVersion,
      filename: `${nextVersion}_${cleanSlug}.sql`
    };
  }
  async migrateCoreControlDatabase(controlPlaneMigrationsDir) {
    const schemaName = "control_plane";
    const moduleKey = "ms:crm-directory";
    const lockKey = `${this.coreDbName}:${schemaName}`;
    const acquired = await this.migrationDriver.tryAcquireAdvisoryLock(this.coreDbName, lockKey);
    if (!acquired) {
      throw new Error(`Could not acquire advisory lock for coreDB "${this.coreDbName}".`);
    }
    try {
      await this.migrationDriver.ensureMigrationLedgerTable(this.coreDbName, schemaName);
      const applied = await this.migrationDriver.getAppliedMigrations(
        this.coreDbName,
        schemaName,
        moduleKey
      );
      const appliedMap = new Map(applied.map((a) => [a.filename, a]));
      const skippedOldMigrations = [];
      const appliedNewMigrations = [];
      if (existsSync2(controlPlaneMigrationsDir)) {
        const sqlFiles = readdirSync2(controlPlaneMigrationsDir).filter((f) => f.endsWith(".sql")).sort((a, b) => a.localeCompare(b));
        for (const filename of sqlFiles) {
          const sqlUp = readFileSync2(join2(controlPlaneMigrationsDir, filename), "utf8");
          const checksumSha256 = computeMigrationChecksumSha256(sqlUp);
          const version2 = filename.slice(0, 4);
          const existing = appliedMap.get(filename);
          if (existing && existing.checksumSha256 === checksumSha256) {
            skippedOldMigrations.push(filename);
            continue;
          }
          await this.migrationDriver.executeMigrationInTransaction(this.coreDbName, schemaName, {
            version: version2,
            filename,
            parentService: "srv:crm",
            moduleKey,
            sqlUp,
            checksumSha256
          });
          appliedNewMigrations.push(filename);
        }
      }
      return { skippedOldMigrations, appliedNewMigrations };
    } finally {
      await this.migrationDriver.releaseAdvisoryLock(this.coreDbName, lockKey);
    }
  }
};

// libs/tenant-db-resolver/src/migrations.cli.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join as join3, resolve } from "node:path";
function generateMigrationFileOnDisk(params) {
  if (params.scope === "core") {
    const coreDir = join3(params.migrationsRootDir, "core");
    mkdirSync(coreDir, { recursive: true });
    const { nextVersion: nextVersion2, filename: filename2 } = SystemStartupBootstrapper.computeNextMigrationFilename(
      coreDir,
      params.descriptionSlug
    );
    const absolutePath2 = join3(coreDir, filename2);
    const sqlContent2 = params.customSqlTemplate ?? [
      "-- =============================================================================",
      `-- PROVEKO \u2014 Core Control Plane Migration (${SystemStartupBootstrapper.DEFAULT_CORE_DB_NAME})`,
      `-- Migration: ${filename2}`,
      "-- Scope: migrations/core (Base Principal / coreDB)",
      "-- =============================================================================",
      "",
      "CREATE SCHEMA IF NOT EXISTS control_plane;",
      "",
      "-- Escribe aqu\xED tus sentencias DDL idempotentes (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS):",
      ""
    ].join("\n");
    writeFileSync(absolutePath2, sqlContent2, "utf8");
    return {
      scope: "core",
      version: nextVersion2,
      filename: filename2,
      absolutePath: absolutePath2
    };
  }
  if (!params.parentService || !params.moduleKey) {
    throw new Error(
      'Client migrations require both parentService (e.g. "ms:invoicing") and moduleKey (e.g. "mod:invoicing-pos").'
    );
  }
  const normalizedParent = normalizeParentMicroserviceKey(params.parentService);
  const normalizedModule = normalizeModuleKey(params.moduleKey);
  const catalogItem = SEED_MICROSERVICES_CATALOG.find((m) => m.key === normalizedModule);
  if (!catalogItem || catalogItem.parentService !== normalizedParent) {
    throw new Error(
      `Module "${normalizedModule}" does not belong to parent microservice "${normalizedParent}".`
    );
  }
  const srvFolder = normalizedParent.replace(":", "-");
  const msFolder = normalizedModule.replace(":", "-");
  const targetDir = join3(params.migrationsRootDir, "clients", srvFolder, msFolder);
  mkdirSync(targetDir, { recursive: true });
  const { nextVersion, filename } = SystemStartupBootstrapper.computeNextMigrationFilename(
    targetDir,
    params.descriptionSlug
  );
  const absolutePath = join3(targetDir, filename);
  const schemaName = SERVICE_SCHEMA_MAP[normalizedParent];
  const sqlContent = params.customSqlTemplate ?? [
    "-- =============================================================================",
    `-- PROVEKO \u2014 Client Database Migration (${toParentMicroserviceNotation(normalizedParent)} -> ${toModuleNotation(normalizedModule)})`,
    `-- Migration: ${filename}`,
    `-- Scope: migrations/clients/${srvFolder}/${msFolder}`,
    `-- Target Schema: "${schemaName}" (Table Prefix: "${catalogItem.tablePrefix}")`,
    "-- =============================================================================",
    "",
    `CREATE SCHEMA IF NOT EXISTS "${schemaName}";`,
    "",
    `-- Ejemplo idempotente: ALTER TABLE "${schemaName}"."${catalogItem.tablePrefix}..." ADD COLUMN IF NOT EXISTS ...;`,
    ""
  ].join("\n");
  writeFileSync(absolutePath, sqlContent, "utf8");
  return {
    scope: "clients",
    version: nextVersion,
    filename,
    absolutePath
  };
}
var cliArgv1 = process.argv[1] ?? "";
if (cliArgv1.endsWith("proveko-migrations-cli.mjs") || cliArgv1.endsWith("migrations.cli.ts") || cliArgv1.endsWith("migrations.cli.js")) {
  const args = process.argv.slice(2);
  const command = args[0] ?? "help";
  const migrationsRootDir = process.env.PROVEKO_MIGRATIONS_DIR ?? resolve(process.cwd(), "libs/tenant-db-resolver/migrations");
  (async () => {
    if (command === "make:core") {
      const slug = args[1];
      if (!slug) {
        throw new Error("Usage: npm run db:make:core -- <migration_name>");
      }
      const res = generateMigrationFileOnDisk({
        migrationsRootDir,
        scope: "core",
        descriptionSlug: slug
      });
      console.log(`[Proveko Migrations] Created CORE migration: ${res.absolutePath}`);
      return;
    }
    if (command === "make:client") {
      const parentService = args[1];
      const moduleKey = args[2];
      const slug = args[3];
      if (!parentService || !moduleKey || !slug) {
        throw new Error(
          "Usage: npm run db:make:client -- <ms:domain> <mod:domain-module> <migration_name>"
        );
      }
      const res = generateMigrationFileOnDisk({
        migrationsRootDir,
        scope: "clients",
        parentService,
        moduleKey,
        descriptionSlug: slug
      });
      console.log(`[Proveko Migrations] Created CLIENT migration: ${res.absolutePath}`);
      return;
    }
    const registry = new FileBasedMigrationRegistry();
    registry.loadAllCatalogMigrationsFromRoot(migrationsRootDir);
    const driver = new InMemoryMigrationDatabaseDriverAdapter();
    const engine = new FileBasedMigrationEngine(registry, driver);
    const orchestrator = new MultiDatabaseMigrationOrchestrator(engine);
    const bootstrapper = new SystemStartupBootstrapper(driver, engine, orchestrator);
    const coreDir = join3(migrationsRootDir, "core");
    if (command === "migrate:core") {
      const res = await bootstrapper.runCoreMigrations(coreDir);
      console.log("[Proveko Migrations] Core DB migration finished:", JSON.stringify(res, null, 2));
      return;
    }
    if (command === "migrate:clients") {
      await bootstrapper.bootstrapOnSystemStartup(coreDir);
      const res = await bootstrapper.runMassiveClientsMigrations();
      console.log(
        "[Proveko Migrations] Massive Clients migration finished:",
        JSON.stringify(res, null, 2)
      );
      return;
    }
    if (command === "migrate:client") {
      await bootstrapper.bootstrapOnSystemStartup(coreDir);
      const dbFlag = args.find((a) => a.startsWith("--db="))?.slice("--db=".length);
      const tenantFlag = args.find((a) => a.startsWith("--tenant="))?.slice("--tenant=".length);
      const modFlag = args.find((a) => a.startsWith("--module="))?.slice("--module=".length);
      const targetDb = dbFlag ?? SystemStartupBootstrapper.DEFAULT_TRIAL_DB_NAME;
      const res = await bootstrapper.runLocalizedClientMigration({
        dbName: targetDb,
        tenantId: tenantFlag,
        onlyModuleKey: modFlag
      });
      console.log(
        "[Proveko Migrations] Localized Client DB migration finished:",
        JSON.stringify(res, null, 2)
      );
      return;
    }
    console.log(
      [
        "Proveko Migration CLI Commands:",
        "  npm run db:make:core -- <name>",
        "  npm run db:make:client -- <ms:domain> <mod:module> <name>",
        "  npm run db:migrate:core",
        "  npm run db:migrate:clients",
        "  npm run db:migrate:client -- --db=<db_name> [--module=<mod:key>]"
      ].join("\n")
    );
  })().catch((err) => {
    console.error("[Proveko Migrations Error]:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

// libs/tenant-db-resolver/src/postgres-migration-driver.adapter.ts
import { spawnSync } from "node:child_process";
var SAFE_PG_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
function sanitizePgIdentifier(raw) {
  const cleaned = raw.trim();
  if (!SAFE_PG_IDENTIFIER_REGEX.test(cleaned)) {
    throw new Error(`Invalid PostgreSQL identifier "${raw}".`);
  }
  return cleaned;
}
var PostgresMigrationDatabaseDriverAdapter = class {
  constructor(cfg) {
    this.cfg = cfg;
  }
  cfg;
  ensuredDatabases = /* @__PURE__ */ new Set();
  ensuredLedgerSchemas = /* @__PURE__ */ new Set();
  static resolveEnvConfig(env = process.env) {
    const host = env["DB_HOST"]?.trim();
    const password = env["POSTGRES_PASSWORD"]?.trim();
    if (!host || !password) return null;
    return {
      host,
      port: env["DB_PORT"]?.trim() || "5432",
      user: env["POSTGRES_USER"]?.trim() || "postgres",
      password,
      coreDbName: env["POSTGRES_DB"]?.trim() || "proveko_control_db"
    };
  }
  executePsql(params) {
    const args = [
      "-h",
      this.cfg.host,
      "-p",
      this.cfg.port,
      "-U",
      this.cfg.user,
      "-d",
      params.dbName,
      "-X",
      "-q",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1"
    ];
    if (params.singleTransaction) {
      args.push("-1");
    }
    if (params.variables) {
      for (const [k, v] of Object.entries(params.variables)) {
        args.push("-v", `${sanitizePgIdentifier(k)}=${String(v)}`);
      }
    }
    const res = spawnSync("psql", args, {
      env: { ...process.env, PGPASSWORD: this.cfg.password },
      input: params.sql,
      encoding: "utf8",
      timeout: 2e4
    });
    if (res.error || res.status !== 0) {
      return {
        ok: false,
        stdout: res.stdout ?? "",
        stderr: res.stderr || res.error?.message || "psql execution failed"
      };
    }
    return { ok: true, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
  }
  isReachable() {
    const ping = this.executePsql({ dbName: "postgres", sql: "SELECT 1;" });
    return ping.ok ? { ok: true } : { ok: false, reason: ping.stderr.trim() };
  }
  ensureDatabaseExists(targetDbName) {
    const safeDb = sanitizePgIdentifier(targetDbName);
    if (this.ensuredDatabases.has(safeDb)) return true;
    const check = this.executePsql({
      dbName: "postgres",
      sql: "SELECT 1 FROM pg_database WHERE datname = :'db_name';",
      variables: { db_name: safeDb }
    });
    if (!check.ok) return false;
    if (check.stdout.trim() !== "1") {
      const created = this.executePsql({
        dbName: "postgres",
        sql: 'CREATE DATABASE :"db_name";',
        variables: { db_name: safeDb }
      });
      if (!created.ok) return false;
    }
    this.ensuredDatabases.add(safeDb);
    return true;
  }
  dropLegacyRandomDatabaseIfExists(targetDbName) {
    const safeDb = sanitizePgIdentifier(targetDbName);
    this.executePsql({
      dbName: "postgres",
      sql: 'DROP DATABASE IF EXISTS :"db_name";',
      variables: { db_name: safeDb }
    });
  }
  async tryAcquireAdvisoryLock(_dbName, _lockNamespace) {
    return true;
  }
  async releaseAdvisoryLock(_dbName, _lockNamespace) {
  }
  async ensureMigrationLedgerTable(dbName, schemaName) {
    const safeDb = sanitizePgIdentifier(dbName);
    const safeSchema = sanitizePgIdentifier(schemaName);
    const cacheKey = `${safeDb}::${safeSchema}`;
    if (this.ensuredLedgerSchemas.has(cacheKey)) return;
    this.ensureDatabaseExists(safeDb);
    const res = this.executePsql({
      dbName: safeDb,
      singleTransaction: true,
      variables: { schema_name: safeSchema },
      sql: `
        CREATE SCHEMA IF NOT EXISTS :"schema_name";
        CREATE TABLE IF NOT EXISTS :"schema_name".schema_migrations (
          module_key VARCHAR(80) NOT NULL,
          filename VARCHAR(180) NOT NULL,
          version VARCHAR(16) NOT NULL,
          checksum_sha256 VARCHAR(64) NOT NULL,
          applied_at_iso VARCHAR(40) NOT NULL,
          execution_ms INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (module_key, filename)
        );
      `
    });
    if (!res.ok) {
      throw new Error(`Failed to ensure schema_migrations ledger on ${safeDb}.${safeSchema}: ${res.stderr}`);
    }
    this.ensuredLedgerSchemas.add(cacheKey);
  }
  async getAppliedMigrations(dbName, schemaName, moduleKey) {
    const safeDb = sanitizePgIdentifier(dbName);
    const safeSchema = sanitizePgIdentifier(schemaName);
    const res = this.executePsql({
      dbName: safeDb,
      variables: { schema_name: safeSchema, mod_key: moduleKey },
      sql: `
        SELECT COALESCE(json_agg(t ORDER BY t.version ASC), '[]'::json)
        FROM (
          SELECT
            module_key AS "moduleKey",
            filename,
            version,
            checksum_sha256 AS "checksumSha256",
            applied_at_iso AS "appliedAtIso",
            execution_ms AS "executionMs"
          FROM :"schema_name".schema_migrations
          WHERE module_key = :'mod_key'
        ) t;
      `
    });
    if (!res.ok || !res.stdout.trim()) return [];
    try {
      return JSON.parse(res.stdout.trim());
    } catch {
      return [];
    }
  }
  async executeMigrationInTransaction(dbName, schemaName, descriptor) {
    const safeDb = sanitizePgIdentifier(dbName);
    const safeSchema = sanitizePgIdentifier(schemaName);
    const startMs = Date.now();
    const appliedAtIso = (/* @__PURE__ */ new Date()).toISOString();
    const migrationRes = this.executePsql({
      dbName: safeDb,
      singleTransaction: true,
      sql: descriptor.sqlUp
    });
    if (!migrationRes.ok) {
      throw new Error(
        `Migration "${descriptor.filename}" failed on "${safeDb}": ${migrationRes.stderr}`
      );
    }
    const executionMs = Math.max(1, Date.now() - startMs);
    const ledgerRes = this.executePsql({
      dbName: safeDb,
      singleTransaction: true,
      variables: {
        schema_name: safeSchema,
        mod_key: descriptor.moduleKey,
        filename: descriptor.filename,
        version: descriptor.version,
        checksum: descriptor.checksumSha256,
        applied_at: appliedAtIso,
        exec_ms: executionMs
      },
      sql: `
        INSERT INTO :"schema_name".schema_migrations (
          module_key, filename, version, checksum_sha256, applied_at_iso, execution_ms
        ) VALUES (
          :'mod_key', :'filename', :'version', :'checksum', :'applied_at', :'exec_ms'::integer
        )
        ON CONFLICT (module_key, filename) DO UPDATE SET
          checksum_sha256 = EXCLUDED.checksum_sha256,
          applied_at_iso = EXCLUDED.applied_at_iso;
      `
    });
    if (!ledgerRes.ok) {
      throw new Error(`Ledger insert failed on "${safeDb}": ${ledgerRes.stderr}`);
    }
    return {
      moduleKey: descriptor.moduleKey,
      filename: descriptor.filename,
      version: descriptor.version,
      checksumSha256: descriptor.checksumSha256,
      appliedAtIso,
      executionMs
    };
  }
};

// libs/tenant-db-resolver/src/tenant-control-catalog.repository.ts
var PostgresTenantControlCatalogRepository = class {
  constructor(driver) {
    this.driver = driver;
  }
  driver;
  listActiveTenantDatabaseNames(coreDbName) {
    const res = this.driver.executePsql({
      dbName: sanitizePgIdentifier(coreDbName),
      sql: `
        SELECT db_name
        FROM public.tenant_database_connections
        WHERE status = 'ACTIVE' AND db_name <> 'db_version_prueba'
        ORDER BY db_name ASC;
      `
    });
    if (!res.ok) return [];
    return res.stdout.split("\n").map((line2) => line2.trim()).filter((name) => Boolean(name) && name !== "db_version_prueba");
  }
  registerTenantAndSeedClientAdmin(coreDbName, input) {
    const safeCoreDb = sanitizePgIdentifier(coreDbName);
    const safeClientDb = sanitizePgIdentifier(input.dbName);
    const seedAdminRes = this.driver.executePsql({
      dbName: safeClientDb,
      singleTransaction: true,
      variables: {
        admin_username: input.adminUsername,
        full_name: `Admin ${input.companyName}`,
        email: `admin@${input.slug}.co`,
        password_hint: input.adminPassword
      },
      sql: `
        INSERT INTO public.client_internal_users (
          user_id, username, full_name, email, role_id, password_hint, is_client_admin
        ) VALUES (
          'u-admin', :'admin_username', :'full_name', :'email', 'rol-admin', :'password_hint', TRUE
        )
        ON CONFLICT (user_id) DO UPDATE SET
          username = EXCLUDED.username,
          password_hint = EXCLUDED.password_hint;
      `
    });
    if (!seedAdminRes.ok) return false;
    const registerRes = this.driver.executePsql({
      dbName: safeCoreDb,
      singleTransaction: true,
      variables: {
        conn_id: `conn-${input.tenantId}`,
        tenant_id: input.tenantId,
        slug: input.slug,
        company_name: input.companyName,
        nit: input.nit,
        business_type: input.businessType,
        db_name: safeClientDb,
        admin_username: input.adminUsername,
        admin_password_hint: input.adminPassword,
        max_roles: Math.max(1, Number(input.maxRolesAllowed) || 5),
        max_users: Math.max(1, Number(input.maxUsersAllowed) || 10),
        services_json: JSON.stringify(input.enabledServices),
        submodules_json: JSON.stringify(input.enabledSubmodules),
        features_json: JSON.stringify(input.enabledFeatures)
      },
      sql: `
        INSERT INTO control_plane.tenants (
          id, slug, legal_name, tax_id_nit, tier, is_sandbox, status,
          cell_id, db_name, encrypted_connection_envelope, theme_config
        ) VALUES (
          :'tenant_id', :'slug', :'company_name', :'nit', 'PRO', FALSE, 'ACTIVE',
          'cell-alpanel-primary', :'db_name', '{}'::jsonb, '{}'::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          legal_name = EXCLUDED.legal_name,
          db_name = EXCLUDED.db_name;

        INSERT INTO public.tenant_database_connections (
          connection_id, tenant_id, company_name, nit, business_type,
          db_host, db_port, db_name, db_user, db_password_secret_ref,
          admin_username, admin_password_hint, max_roles_allowed, max_users_allowed,
          enabled_services_json, enabled_submodules_json, enabled_features_json, status
        ) VALUES (
          :'conn_id', :'tenant_id', :'company_name', :'nit', :'business_type',
          'db', 5432, :'db_name', 'postgres', 'env:POSTGRES_PASSWORD',
          :'admin_username', :'admin_password_hint', :'max_roles'::integer, :'max_users'::integer,
          :'services_json'::jsonb, :'submodules_json'::jsonb, :'features_json'::jsonb, 'ACTIVE'
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          db_name = EXCLUDED.db_name,
          company_name = EXCLUDED.company_name,
          max_roles_allowed = EXCLUDED.max_roles_allowed,
          max_users_allowed = EXCLUDED.max_users_allowed;
      `
    });
    return registerRes.ok;
  }
  saveClientSubmoduleRecord(params) {
    const safeClientDb = sanitizePgIdentifier(params.dbName);
    const res = this.driver.executePsql({
      dbName: safeClientDb,
      singleTransaction: true,
      variables: {
        rec_id: params.recordId,
        sub_key: params.submoduleKey,
        cells_json: JSON.stringify(params.cells)
      },
      sql: `
        CREATE TABLE IF NOT EXISTS public.client_submodule_records (
          record_id VARCHAR(64) PRIMARY KEY,
          submodule_key VARCHAR(64) NOT NULL,
          cells_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        INSERT INTO public.client_submodule_records (record_id, submodule_key, cells_json)
        VALUES (:'rec_id', :'sub_key', :'cells_json'::jsonb)
        ON CONFLICT (record_id) DO UPDATE SET cells_json = EXCLUDED.cells_json;
      `
    });
    return res.ok;
  }
  getClusterDatabaseCatalogSnapshot(coreDbName) {
    const dbRes = this.driver.executePsql({
      dbName: "postgres",
      sql: `
        SELECT datname
        FROM pg_database
        WHERE datistemplate = false AND datname <> 'postgres' AND datname <> 'db_version_prueba'
        ORDER BY datname ASC;
      `
    });
    const databases = dbRes.ok ? dbRes.stdout.split("\n").map((s) => s.trim()).filter(Boolean) : [];
    const rowsRes = this.driver.executePsql({
      dbName: sanitizePgIdentifier(coreDbName),
      sql: `
        SELECT COALESCE(json_agg(t), '[]'::json)
        FROM (
          SELECT
            tenant_id, company_name, nit, business_type, db_name, db_host, db_port,
            admin_username, admin_password_hint, max_roles_allowed, max_users_allowed,
            enabled_services_json, enabled_submodules_json, enabled_features_json
          FROM public.tenant_database_connections
          WHERE status = 'ACTIVE' AND db_name <> 'db_version_prueba'
          ORDER BY updated_at ASC
        ) t;
      `
    });
    let rows = [];
    if (rowsRes.ok && rowsRes.stdout.trim()) {
      try {
        rows = JSON.parse(rowsRes.stdout.trim());
      } catch {
        rows = [];
      }
    }
    return { databases, rows };
  }
};

// libs/tenant-db-resolver/src/client-groups-catalog.repository.ts
var PostgresClientGroupsCatalogRepository = class _PostgresClientGroupsCatalogRepository {
  constructor(driver) {
    this.driver = driver;
  }
  driver;
  static DEFAULT_GROUPS_DB_NAME = "proveko_groups_db";
  getGroupsAndCatalogSnapshot(groupsDbName = _PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME) {
    const safeDb = sanitizePgIdentifier(groupsDbName);
    const res = this.driver.executePsql({
      dbName: safeDb,
      sql: `
        SELECT json_build_object(
          'groups', COALESCE((SELECT json_agg(g ORDER BY g.group_key) FROM public.client_business_groups g WHERE g.is_active = TRUE), '[]'::json),
          'principalModules', COALESCE((SELECT json_agg(m ORDER BY m.service_key) FROM public.catalog_principal_modules m), '[]'::json),
          'submodules', COALESCE((SELECT json_agg(s ORDER BY s.submodule_key) FROM public.catalog_submodules s), '[]'::json),
          'features', COALESCE((SELECT json_agg(f ORDER BY f.feature_key) FROM public.catalog_features f), '[]'::json),
          'bundleItems', COALESCE((SELECT json_agg(b ORDER BY b.bundle_id) FROM public.business_group_bundle_items b WHERE b.included_in_base_plan = TRUE), '[]'::json)
        );
      `
    });
    if (!res.ok || !res.stdout.trim()) {
      return {
        groupsDbName: safeDb,
        groups: [],
        principalModules: [],
        submodules: [],
        features: [],
        bundleItems: []
      };
    }
    try {
      const parsed = JSON.parse(res.stdout.trim());
      return {
        groupsDbName: safeDb,
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        principalModules: Array.isArray(parsed.principalModules) ? parsed.principalModules : [],
        submodules: Array.isArray(parsed.submodules) ? parsed.submodules : [],
        features: Array.isArray(parsed.features) ? parsed.features : [],
        bundleItems: Array.isArray(parsed.bundleItems) ? parsed.bundleItems : []
      };
    } catch {
      return {
        groupsDbName: safeDb,
        groups: [],
        principalModules: [],
        submodules: [],
        features: [],
        bundleItems: []
      };
    }
  }
  upsertClientBusinessGroup(input, groupsDbName = _PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME) {
    const safeDb = sanitizePgIdentifier(groupsDbName);
    const groupRes = this.driver.executePsql({
      dbName: safeDb,
      singleTransaction: true,
      variables: {
        group_key: input.groupKey,
        group_name: input.groupName,
        badge_label: input.badgeLabel,
        description: input.description,
        base_monthly_cop: Math.max(0, Math.round(Number(input.baseMonthlyCop) || 149e3))
      },
      sql: `
        INSERT INTO public.client_business_groups (
          group_key, group_name, badge_label, description, base_monthly_cop, is_active, updated_at
        ) VALUES (
          :'group_key', :'group_name', :'badge_label', :'description', :'base_monthly_cop'::bigint, TRUE, NOW()
        )
        ON CONFLICT (group_key) DO UPDATE SET
          group_name = EXCLUDED.group_name,
          badge_label = EXCLUDED.badge_label,
          description = EXCLUDED.description,
          base_monthly_cop = EXCLUDED.base_monthly_cop,
          updated_at = NOW();

        DELETE FROM public.business_group_bundle_items WHERE group_key = :'group_key';
      `
    });
    if (!groupRes.ok) return false;
    const bundleEntries = [
      ...input.includedPrincipalServices.map((key) => ({ tier: "MODULO_PRINCIPAL", key })),
      ...input.includedSubmodules.map((key) => ({ tier: "SUBMODULO", key })),
      ...input.includedFeatures.map((key) => ({ tier: "FUNCIONALIDAD", key }))
    ];
    for (const item of bundleEntries) {
      this.driver.executePsql({
        dbName: safeDb,
        variables: {
          bundle_id: `${input.groupKey}:${item.tier}:${item.key}`,
          group_key: input.groupKey,
          item_tier: item.tier,
          item_key: item.key
        },
        sql: `
          INSERT INTO public.business_group_bundle_items (
            bundle_id, group_key, item_tier, item_key, included_in_base_plan
          ) VALUES (
            :'bundle_id', :'group_key', :'item_tier', :'item_key', TRUE
          )
          ON CONFLICT (bundle_id) DO UPDATE SET included_in_base_plan = TRUE;
        `
      });
    }
    return true;
  }
  registerDeveloperCatalogItem(input, groupsDbName = _PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME) {
    const safeDb = sanitizePgIdentifier(groupsDbName);
    const cop = Math.max(0, Math.round(Number(input.monthlyCop) || 19e3));
    let itemSql = "";
    if (input.itemTier === "MODULO_PRINCIPAL") {
      itemSql = `
        INSERT INTO public.catalog_principal_modules (
          service_key, external_name, icon_emoji, subtitle, standalone_monthly_cop, updated_at
        ) VALUES (
          :'item_key', :'external_name', :'icon_emoji', :'description', :'monthly_cop'::bigint, NOW()
        )
        ON CONFLICT (service_key) DO UPDATE SET
          external_name = EXCLUDED.external_name,
          subtitle = EXCLUDED.subtitle,
          standalone_monthly_cop = EXCLUDED.standalone_monthly_cop,
          updated_at = NOW();
      `;
    } else if (input.itemTier === "SUBMODULO") {
      itemSql = `
        INSERT INTO public.catalog_submodules (
          submodule_key, parent_service_key, external_name, tab_icon, summary, addon_monthly_cop, updated_at
        ) VALUES (
          :'item_key', :'parent_service_key', :'external_name', :'icon_emoji', :'description', :'monthly_cop'::bigint, NOW()
        )
        ON CONFLICT (submodule_key) DO UPDATE SET
          external_name = EXCLUDED.external_name,
          summary = EXCLUDED.summary,
          addon_monthly_cop = EXCLUDED.addon_monthly_cop,
          updated_at = NOW();
      `;
    } else {
      itemSql = `
        INSERT INTO public.catalog_features (
          feature_key, parent_service_key, parent_submodule_key, external_name, description, addon_monthly_cop, updated_at
        ) VALUES (
          :'item_key', :'parent_service_key', :'parent_submodule_key', :'external_name', :'description', :'monthly_cop'::bigint, NOW()
        )
        ON CONFLICT (feature_key) DO UPDATE SET
          external_name = EXCLUDED.external_name,
          description = EXCLUDED.description,
          addon_monthly_cop = EXCLUDED.addon_monthly_cop,
          updated_at = NOW();
      `;
    }
    const res = this.driver.executePsql({
      dbName: safeDb,
      singleTransaction: true,
      variables: {
        item_key: input.itemKey,
        parent_service_key: input.parentServiceKey || "srv-gastro",
        parent_submodule_key: input.parentSubmoduleKey || "independent",
        external_name: input.externalName,
        icon_emoji: input.iconEmoji || "\u2728",
        description: input.description,
        monthly_cop: cop
      },
      sql: itemSql
    });
    if (!res.ok) return false;
    if (input.targetGroupKey && input.targetGroupKey !== "NONE") {
      this.driver.executePsql({
        dbName: safeDb,
        variables: {
          bundle_id: `${input.targetGroupKey}:${input.itemTier}:${input.itemKey}`,
          group_key: input.targetGroupKey,
          item_tier: input.itemTier,
          item_key: input.itemKey
        },
        sql: `
          INSERT INTO public.business_group_bundle_items (
            bundle_id, group_key, item_tier, item_key, included_in_base_plan
          ) VALUES (
            :'bundle_id', :'group_key', :'item_tier', :'item_key', TRUE
          )
          ON CONFLICT (bundle_id) DO UPDATE SET included_in_base_plan = TRUE;
        `
      });
    }
    return true;
  }
};

// libs/tenant-db-resolver/src/postgres-psql.driver.ts
import { join as join4 } from "node:path";
function buildFullCatalogServicesMap() {
  const map = {};
  for (const mod2 of SEED_MICROSERVICES_CATALOG) {
    const list = map[mod2.parentService] ?? [];
    list.push(mod2.key);
    map[mod2.parentService] = list;
  }
  return map;
}
var PostgresPsqlBootstrapRunner = class {
  static createHexagonalPipeline(cfg, migrationsRootDir) {
    const driver = new PostgresMigrationDatabaseDriverAdapter(cfg);
    const registry = new FileBasedMigrationRegistry();
    registry.loadAllCatalogMigrationsFromRoot(migrationsRootDir);
    const engine = new FileBasedMigrationEngine(registry, driver);
    const orchestrator = new MultiDatabaseMigrationOrchestrator(engine, {
      maxConcurrentDatabases: 4
    });
    const bootstrapper = new SystemStartupBootstrapper(
      driver,
      engine,
      orchestrator,
      cfg.coreDbName
    );
    const catalogRepo = new PostgresTenantControlCatalogRepository(driver);
    const groupsRepo = new PostgresClientGroupsCatalogRepository(driver);
    return { driver, engine, orchestrator, bootstrapper, catalogRepo, groupsRepo };
  }
  static async runStartupMigrations(migrationsRootDir) {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) {
      return {
        executedAgainstRealPostgres: false,
        coreDbName: SystemStartupBootstrapper.DEFAULT_CORE_DB_NAME,
        groupsDbName: PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME,
        coreFilesSkippedOld: [],
        coreFilesApplied: [],
        clientDatabasesProvisioned: [],
        reasonIfSkipped: "DB_HOST / POSTGRES_PASSWORD no configurados."
      };
    }
    const { driver, engine, orchestrator, bootstrapper, catalogRepo } = this.createHexagonalPipeline(cfg, migrationsRootDir);
    const ping = driver.isReachable();
    if (!ping.ok) {
      return {
        executedAgainstRealPostgres: false,
        coreDbName: cfg.coreDbName,
        groupsDbName: PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME,
        coreFilesSkippedOld: [],
        coreFilesApplied: [],
        clientDatabasesProvisioned: [],
        reasonIfSkipped: `PostgreSQL no alcanzable (${ping.reason ?? "connection error"})`
      };
    }
    driver.ensureDatabaseExists(cfg.coreDbName);
    driver.ensureDatabaseExists(PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME);
    driver.dropLegacyRandomDatabaseIfExists("db_agrovalle");
    driver.dropLegacyRandomDatabaseIfExists("db_labrasa");
    driver.dropLegacyRandomDatabaseIfExists("db_version_prueba");
    const coreResult = await bootstrapper.runCoreMigrations(join4(migrationsRootDir, "core"));
    const groupsBootstrapper = new SystemStartupBootstrapper(
      driver,
      engine,
      orchestrator,
      PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME
    );
    await groupsBootstrapper.runCoreMigrations(join4(migrationsRootDir, "groups"));
    const activeClientDbNames = catalogRepo.listActiveTenantDatabaseNames(cfg.coreDbName);
    const fullServicesMap = buildFullCatalogServicesMap();
    const targets = activeClientDbNames.map((dbName) => {
      driver.ensureDatabaseExists(dbName);
      return {
        tenantId: `tnt-${dbName}`,
        cellId: "cell-alpanel-primary",
        dbName,
        activeServices: fullServicesMap
      };
    });
    if (targets.length > 0) {
      await orchestrator.migrateTenantDatabaseFleet(targets);
    }
    return {
      executedAgainstRealPostgres: true,
      coreDbName: cfg.coreDbName,
      groupsDbName: PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME,
      coreFilesSkippedOld: coreResult.skippedOldMigrations,
      coreFilesApplied: coreResult.appliedNewMigrations,
      clientDatabasesProvisioned: activeClientDbNames
    };
  }
  static async provisionNewClientDatabaseInPostgres(input) {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) return false;
    const { driver, bootstrapper, catalogRepo } = this.createHexagonalPipeline(
      cfg,
      input.migrationsRootDir
    );
    if (!driver.isReachable().ok) return false;
    if (!driver.ensureDatabaseExists(input.dbName)) return false;
    await bootstrapper.registerAndMigrateNewClientDatabase({
      tenantId: input.tenantId,
      cellId: "cell-alpanel-primary",
      slug: input.slug,
      legalName: input.companyName,
      dbName: input.dbName,
      activeServices: buildFullCatalogServicesMap()
    });
    return catalogRepo.registerTenantAndSeedClientAdmin(cfg.coreDbName, input);
  }
  static saveClientSubmoduleRecordInPostgres(params) {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) return false;
    const driver = new PostgresMigrationDatabaseDriverAdapter(cfg);
    if (!driver.isReachable().ok) return false;
    const catalogRepo = new PostgresTenantControlCatalogRepository(driver);
    return catalogRepo.saveClientSubmoduleRecord(params);
  }
  static listPostgresDatabasesAndClients() {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) return { databases: [], rows: [] };
    const driver = new PostgresMigrationDatabaseDriverAdapter(cfg);
    if (!driver.isReachable().ok) return { databases: [], rows: [] };
    const catalogRepo = new PostgresTenantControlCatalogRepository(driver);
    return catalogRepo.getClusterDatabaseCatalogSnapshot(cfg.coreDbName);
  }
  static getClientGroupsCatalogFromPostgres() {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) {
      return {
        groupsDbName: PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME,
        groups: [],
        principalModules: [],
        submodules: [],
        features: [],
        bundleItems: []
      };
    }
    const driver = new PostgresMigrationDatabaseDriverAdapter(cfg);
    if (!driver.isReachable().ok) {
      return {
        groupsDbName: PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME,
        groups: [],
        principalModules: [],
        submodules: [],
        features: [],
        bundleItems: []
      };
    }
    const groupsRepo = new PostgresClientGroupsCatalogRepository(driver);
    return groupsRepo.getGroupsAndCatalogSnapshot();
  }
  static upsertClientBusinessGroupInPostgres(input) {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) return false;
    const driver = new PostgresMigrationDatabaseDriverAdapter(cfg);
    if (!driver.isReachable().ok) return false;
    const groupsRepo = new PostgresClientGroupsCatalogRepository(driver);
    return groupsRepo.upsertClientBusinessGroup(input);
  }
  static registerDeveloperCatalogItemInPostgres(input) {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) return false;
    const driver = new PostgresMigrationDatabaseDriverAdapter(cfg);
    if (!driver.isReachable().ok) return false;
    const groupsRepo = new PostgresClientGroupsCatalogRepository(driver);
    return groupsRepo.registerDeveloperCatalogItem(input);
  }
};

// libs/rules-engine/src/jsonb-custom-fields.validator.ts
var CustomFieldsAndWebhookGuard = class {
  static DEFAULT_MAX_BYTES = 32 * 1024;
  // 32 KB
  static DEFAULT_MAX_DEPTH = 3;
  static DEFAULT_MAX_KEYS = 50;
  static validateCustomFieldsPayload(customFields, options) {
    if (typeof customFields !== "object" || customFields === null || Array.isArray(customFields)) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        "custom_fields must be a flat or bounded JSON object."
      );
    }
    const maxBytes = options?.maxBytes ?? this.DEFAULT_MAX_BYTES;
    const maxDepth = options?.maxDepth ?? this.DEFAULT_MAX_DEPTH;
    const maxKeys = options?.maxKeys ?? this.DEFAULT_MAX_KEYS;
    const serialized = JSON.stringify(customFields);
    if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `custom_fields payload exceeds maximum size of ${maxBytes} bytes.`
      );
    }
    let keyCount = 0;
    const inspectDepth = (node, currentDepth) => {
      if (currentDepth > maxDepth) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
          422,
          `custom_fields nesting depth exceeds maximum allowed depth of ${maxDepth}.`
        );
      }
      if (typeof node === "object" && node !== null) {
        const entries = Array.isArray(node) ? node.entries() : Object.entries(node);
        for (const [, val] of entries) {
          keyCount += 1;
          if (keyCount > maxKeys) {
            throw new ProvekoDomainError(
              PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
              422,
              `custom_fields exceeds maximum total keys count of ${maxKeys}.`
            );
          }
          if (typeof val === "object" && val !== null) {
            inspectDepth(val, currentDepth + 1);
          }
        }
      }
    };
    inspectDepth(customFields, 1);
    return customFields;
  }
  /**
   * Valida que una IP resuelta por DNS no pertenezca a rangos privados, loopback o AWS/Cloud Metadata (Anti-SSRF)
   * Incluye protección contra bypass mediante direcciones IPv4-mapped IPv6 (`::ffff:169.254.169.254` o `::ffff:7f00:1`).
   */
  static assertPublicWebhookTargetIp(resolvedIp) {
    let normalized = resolvedIp.trim().toLowerCase();
    if (normalized === "::1" || normalized === "::" || normalized === "0.0.0.0" || normalized.startsWith("fe80:") || normalized.startsWith("fc00:") || normalized.startsWith("fd00:")) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `SSRF protection blocked private/loopback IPv6 address: ${resolvedIp}`
      );
    }
    if (normalized.startsWith("::ffff:")) {
      const tail = normalized.slice("::ffff:".length);
      if (tail.includes(".")) {
        normalized = tail;
      } else {
        const hexParts = tail.split(":");
        if (hexParts.length === 2) {
          const high = Number.parseInt(hexParts[0] ?? "", 16);
          const low = Number.parseInt(hexParts[1] ?? "", 16);
          if (Number.isInteger(high) && Number.isInteger(low) && high >= 0 && high <= 65535 && low >= 0 && low <= 65535) {
            normalized = `${high >> 8 & 255}.${high & 255}.${low >> 8 & 255}.${low & 255}`;
          }
        }
      }
    }
    const ipv4Parts = normalized.split(".").map((p) => Number(p));
    if (ipv4Parts.length === 4 && ipv4Parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      const [a, b] = ipv4Parts;
      const isPrivateOrReserved = a === 10 || a === 127 || a === 0 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 169 && b === 254 || // Cloud metadata 169.254.169.254
      a === 100 && b >= 64 && b <= 127;
      if (isPrivateOrReserved) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
          422,
          `SSRF protection blocked internal/private IPv4 address: ${resolvedIp}`
        );
      }
    }
  }
};

// apps/srv-crm/ms-crm-directory/src/domain.ts
var VALID_TAX_ID_TYPES = /* @__PURE__ */ new Set(["NIT", "CC", "CE", "PASSPORT"]);
function buildValidatedDirectoryContact(tenantId, branchId, input) {
  if (!input.taxIdType || !VALID_TAX_ID_TYPES.has(input.taxIdType)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Invalid "taxIdType"; expected NIT, CC, CE, or PASSPORT.`
    );
  }
  if (typeof input.taxIdNumber !== "string" || input.taxIdNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "taxIdNumber" is required.'
    );
  }
  if (typeof input.legalName !== "string" || input.legalName.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "legalName" is required.'
    );
  }
  if (input.customFields) {
    CustomFieldsAndWebhookGuard.validateCustomFieldsPayload(input.customFields);
  }
  const creditLimit = MoneyDecimal.from(input.creditLimit ?? "0.0000").assertNonNegative("creditLimit").toFixed4();
  return {
    id: `dir-${tenantId}-${input.taxIdNumber.trim()}`,
    tenantId,
    branchId,
    taxIdType: input.taxIdType,
    taxIdNumber: input.taxIdNumber.trim(),
    legalName: input.legalName.trim(),
    email: input.email?.trim(),
    creditLimit,
    customFields: input.customFields ?? {}
  };
}

// apps/srv-crm/ms-crm-directory/src/application.ts
var CrmDirectoryUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listContacts(tenantId, branchId, isReadonlyArchive) {
    const contacts = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_crm",
      table: "dir_contacts",
      readonlyMode: isReadonlyArchive,
      contacts
    };
  }
  async createContact(tenantId, branchId, dto) {
    const contact = buildValidatedDirectoryContact(tenantId, branchId, dto);
    return this.repository.saveContact(contact);
  }
};

// apps/srv-crm/ms-crm-directory/src/infrastructure.ts
var dirContactsTable = srvCrmSchema.table("dir_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  taxIdType: varchar("tax_id_type", { length: 16 }).notNull(),
  // NIT | CC | CE | PASSPORT
  taxIdNumber: varchar("tax_id_number", { length: 32 }).notNull(),
  legalName: varchar("legal_name", { length: 180 }).notNull(),
  email: varchar("email", { length: 160 }),
  creditLimit: numeric("credit_limit", { precision: 19, scale: 4 }).notNull().default("0.0000"),
  customFields: jsonb("custom_fields").$type().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryCrmDirectoryRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveContact(contact) {
    const key = `${contact.tenantId}:${contact.branchId}`;
    const list = this.store.get(key) ?? [];
    const existingIdx = list.findIndex((c) => c.id === contact.id);
    if (existingIdx >= 0) {
      list[existingIdx] = contact;
    } else {
      list.push(contact);
    }
    this.store.set(key, list);
    return contact;
  }
};

// apps/srv-crm/ms-crm-directory/src/index.ts
function buildCrmDirectoryPlugin(repository = new InMemoryCrmDirectoryRepositoryAdapter()) {
  const useCases = new CrmDirectoryUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:crm",
    microserviceKey: "ms:crm-directory",
    tablePrefix: "dir_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/contacts",
        description: "Listar terceros/clientes del directorio CRM del inquilino activo",
        handler: async (ctx) => useCases.listContacts(ctx.tenantId, ctx.activeBranchId, ctx.isReadonlyArchive)
      },
      {
        method: "POST",
        subPath: "/contacts",
        description: "Crear tercero/cliente validando custom_fields JSONB y l\xEDmite de cr\xE9dito Decimal",
        handler: async (ctx, req) => useCases.createContact(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      }
    ]
  });
}
var msCrmDirectoryPlugin = buildCrmDirectoryPlugin();

// apps/srv-crm/ms-crm-loyalty/src/domain.ts
var DefaultPercentLoyaltyAccrualPolicy = class {
  constructor(ratePercent = "5.00") {
    this.ratePercent = ratePercent;
  }
  ratePercent;
  calculatePoints(invoiceAmount) {
    return invoiceAmount.applyTaxRatePercent(this.ratePercent);
  }
};
function validateAccrueLoyaltyInput(input, policy) {
  if (typeof input.contactId !== "string" || input.contactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "contactId" is required.'
    );
  }
  const invoiceAmount = MoneyDecimal.from(input.invoiceAmount).assertPositive("invoiceAmount");
  const pointsEarned = policy.calculatePoints(invoiceAmount);
  return {
    contactId: input.contactId.trim(),
    pointsEarned
  };
}

// apps/srv-crm/ms-crm-loyalty/src/application.ts
var CrmLoyaltyUseCases = class {
  constructor(repository, accrualPolicy = new DefaultPercentLoyaltyAccrualPolicy()) {
    this.repository = repository;
    this.accrualPolicy = accrualPolicy;
  }
  repository;
  accrualPolicy;
  async listWallets(tenantId) {
    const wallets = await this.repository.listByTenant(tenantId);
    return {
      tenantId,
      schema: "srv_crm",
      table: "loy_wallets",
      wallets
    };
  }
  async accruePoints(tenantId, dto) {
    const { contactId, pointsEarned } = validateAccrueLoyaltyInput(dto, this.accrualPolicy);
    const updated = await this.repository.accruePoints(tenantId, contactId, pointsEarned);
    return {
      tenantId,
      contactId,
      pointsEarned: pointsEarned.toFixed4(),
      newPointsBalance: updated.pointsBalance
    };
  }
};

// apps/srv-crm/ms-crm-loyalty/src/infrastructure.ts
var loyWalletsTable = srvCrmSchema.table("loy_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").notNull().unique(),
  tierLevel: varchar("tier_level", { length: 32 }).notNull().default("SILVER"),
  pointsBalance: numeric("points_balance", { precision: 19, scale: 4 }).notNull().default("0.0000"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryCrmLoyaltyRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenant(tenantId) {
    return [...this.store.get(tenantId) ?? []];
  }
  async accruePoints(tenantId, contactId, pointsDelta) {
    const list = this.store.get(tenantId) ?? [];
    const existingIdx = list.findIndex((w) => w.contactId === contactId);
    if (existingIdx >= 0) {
      const current = list[existingIdx];
      const nextBalance = MoneyDecimal.from(current.pointsBalance).add(pointsDelta).toFixed4();
      const updated = {
        ...current,
        pointsBalance: nextBalance
      };
      list[existingIdx] = updated;
      this.store.set(tenantId, list);
      return updated;
    }
    const created = {
      tenantId,
      contactId,
      tierLevel: "SILVER",
      pointsBalance: pointsDelta.toFixed4()
    };
    list.push(created);
    this.store.set(tenantId, list);
    return created;
  }
};

// apps/srv-crm/ms-crm-loyalty/src/index.ts
function buildCrmLoyaltyPlugin(repository = new InMemoryCrmLoyaltyRepositoryAdapter(), accrualPolicy = new DefaultPercentLoyaltyAccrualPolicy()) {
  const useCases = new CrmLoyaltyUseCases(repository, accrualPolicy);
  return defineProvekoMicroservice({
    parentService: "srv:crm",
    microserviceKey: "ms:crm-loyalty",
    tablePrefix: "loy_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/wallets",
        description: "Consultar saldos de puntos de fidelizaci\xF3n",
        handler: async (ctx) => useCases.listWallets(ctx.tenantId)
      },
      {
        method: "POST",
        subPath: "/accrue",
        description: "Acumular puntos de fidelizaci\xF3n por compra validada",
        handler: async (ctx, req) => useCases.accruePoints(ctx.tenantId, req.body ?? {})
      }
    ]
  });
}
var msCrmLoyaltyPlugin = buildCrmLoyaltyPlugin();

// apps/srv-crm/ms-crm-pipelines/src/domain.ts
var VALID_STAGES = /* @__PURE__ */ new Set([
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "WON",
  "LOST"
]);
function buildValidatedPipelineDeal(tenantId, input) {
  if (typeof input.contactId !== "string" || input.contactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "contactId" is required.'
    );
  }
  if (!input.stageKey || !VALID_STAGES.has(input.stageKey)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Invalid "stageKey"; expected LEAD, QUALIFIED, PROPOSAL, WON, or LOST.'
    );
  }
  const expectedValue = MoneyDecimal.from(input.expectedValue).assertNonNegative("expectedValue").toFixed4();
  return {
    tenantId,
    contactId: input.contactId.trim(),
    stageKey: input.stageKey,
    expectedValue
  };
}

// apps/srv-crm/ms-crm-pipelines/src/application.ts
var CrmPipelinesUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listDeals(tenantId) {
    const deals = await this.repository.listByTenant(tenantId);
    return {
      tenantId,
      schema: "srv_crm",
      table: "pip_deals",
      deals
    };
  }
  async createDeal(tenantId, dto) {
    const deal = buildValidatedPipelineDeal(tenantId, dto);
    return this.repository.saveDeal(deal);
  }
};

// apps/srv-crm/ms-crm-pipelines/src/infrastructure.ts
var pipDealsTable = srvCrmSchema.table("pip_deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").notNull(),
  stageKey: varchar("stage_key", { length: 48 }).notNull(),
  // LEAD | QUALIFIED | PROPOSAL | WON | LOST
  expectedValue: numeric("expected_value", { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryCrmPipelinesRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenant(tenantId) {
    return [...this.store.get(tenantId) ?? []];
  }
  async saveDeal(deal) {
    const list = this.store.get(deal.tenantId) ?? [];
    list.push(deal);
    this.store.set(deal.tenantId, list);
    return deal;
  }
};

// apps/srv-crm/ms-crm-pipelines/src/index.ts
function buildCrmPipelinesPlugin(repository = new InMemoryCrmPipelinesRepositoryAdapter()) {
  const useCases = new CrmPipelinesUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:crm",
    microserviceKey: "ms:crm-pipelines",
    tablePrefix: "pip_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/deals",
        description: "Consultar oportunidades comerciales del embudo CRM",
        handler: async (ctx) => useCases.listDeals(ctx.tenantId)
      },
      {
        method: "POST",
        subPath: "/deals",
        description: "Crear oportunidad comercial en el embudo CRM",
        handler: async (ctx, req) => useCases.createDeal(ctx.tenantId, req.body ?? {})
      }
    ]
  });
}
var msCrmPipelinesPlugin = buildCrmPipelinesPlugin();

// apps/srv-crm/host-runner/src/index.ts
function createSrvCrmHostRunner(guard, enabledMicroservicesEnv, hostNodeId = "host-runner:srv:crm") {
  return new ParentServiceHostRunner(
    "srv:crm",
    guard,
    [msCrmDirectoryPlugin, msCrmPipelinesPlugin, msCrmLoyaltyPlugin],
    enabledMicroservicesEnv,
    hostNodeId
  );
}

// apps/srv-finance/ms-finance-accounting-puc/src/domain.ts
function validateAndBalancePucJournalVoucher(tenantId, branchId, input) {
  if (typeof input.voucherNumber !== "string" || input.voucherNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "voucherNumber" is required.'
    );
  }
  if (!Array.isArray(input.lines) || input.lines.length < 2) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      "A double-entry accounting voucher requires at least 2 lines."
    );
  }
  let sumDebit = MoneyDecimal.zero();
  let sumCredit = MoneyDecimal.zero();
  for (let idx = 0; idx < input.lines.length; idx++) {
    const line2 = input.lines[idx];
    if (typeof line2.pucAccountCode !== "string" || line2.pucAccountCode.trim().length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Journal line at index ${idx} is missing "pucAccountCode".`
      );
    }
    if (typeof line2.thirdPartyContactId !== "string" || line2.thirdPartyContactId.trim().length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Journal line at index ${idx} is missing "thirdPartyContactId".`
      );
    }
    const debit = MoneyDecimal.from(line2.debit).assertNonNegative(`lines[${idx}].debit`);
    const credit = MoneyDecimal.from(line2.credit).assertNonNegative(`lines[${idx}].credit`);
    if (debit.isZero() && credit.isZero()) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Journal line at index ${idx} (${line2.pucAccountCode}) cannot have both debit and credit equal to 0.`
      );
    }
    if (!debit.isZero() && !credit.isZero()) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Journal line at index ${idx} (${line2.pucAccountCode}) cannot have both debit (${debit.toFixed4()}) and credit (${credit.toFixed4()}) > 0 on the same line.`
      );
    }
    sumDebit = sumDebit.add(debit);
    sumCredit = sumCredit.add(credit);
  }
  if (!sumDebit.equals(sumCredit) || sumDebit.isZero()) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_ACCOUNTING_IMBALANCE,
      422,
      `Double-entry accounting imbalance: Total Debit (${sumDebit.toFixed4()}) !== Total Credit (${sumCredit.toFixed4()}).`,
      {
        total_debit: sumDebit.toFixed4(),
        total_credit: sumCredit.toFixed4()
      }
    );
  }
  return {
    tenantId,
    branchId,
    voucherNumber: input.voucherNumber.trim(),
    totalDebit: sumDebit.toFixed4(),
    totalCredit: sumCredit.toFixed4(),
    balanced: true
  };
}

// apps/srv-finance/ms-finance-accounting-puc/src/application.ts
var FinanceAccountingPucUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async postJournalVoucher(tenantId, branchId, dto) {
    const voucher = validateAndBalancePucJournalVoucher(tenantId, branchId, dto);
    return this.repository.saveJournalVoucher(voucher);
  }
  async listVouchers(tenantId, branchId) {
    if (!this.repository.listByTenantAndBranch) {
      return [];
    }
    return this.repository.listByTenantAndBranch(tenantId, branchId);
  }
};

// apps/srv-finance/ms-finance-accounting-puc/src/infrastructure.ts
var pucJournalHeadersTable = srvFinanceSchema.table("puc_journal_headers", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  voucherNumber: varchar("voucher_number", { length: 32 }).notNull().unique(),
  totalDebit: numeric("total_debit", { precision: 19, scale: 4 }).notNull(),
  totalCredit: numeric("total_credit", { precision: 19, scale: 4 }).notNull(),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryFinanceAccountingPucRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async saveJournalVoucher(voucher) {
    const key = `${voucher.tenantId}:${voucher.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(voucher);
    this.store.set(key, list);
    return voucher;
  }
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
};

// apps/srv-finance/ms-finance-accounting-puc/src/index.ts
function buildFinanceAccountingPucPlugin(repository = new InMemoryFinanceAccountingPucRepositoryAdapter()) {
  const useCases = new FinanceAccountingPucUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:finance",
    microserviceKey: "ms:finance-accounting-puc",
    tablePrefix: "puc_",
    version: "1.0.0",
    routes: [
      {
        method: "POST",
        subPath: "/journal/post-voucher",
        description: "Contabilizar comprobante PUC/NIIF validando partida doble exacta (D\xE9bito == Cr\xE9dito)",
        handler: async (ctx, req) => useCases.postJournalVoucher(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      },
      {
        method: "GET",
        subPath: "/journal/vouchers",
        description: "Listar comprobantes contables PUC/NIIF por sucursal",
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          vouchers: await useCases.listVouchers(ctx.tenantId, ctx.activeBranchId)
        })
      },
      {
        method: "GET",
        subPath: "/journal/post-voucher",
        description: "Listar comprobantes contables PUC/NIIF por sucursal (alias)",
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          vouchers: await useCases.listVouchers(ctx.tenantId, ctx.activeBranchId)
        })
      }
    ]
  });
}
var msFinanceAccountingPucPlugin = buildFinanceAccountingPucPlugin();

// apps/srv-finance/ms-finance-ar-ap/src/domain.ts
var VALID_LEDGER_TYPES = /* @__PURE__ */ new Set([
  "RECEIVABLE_CXC",
  "PAYABLE_CXP"
]);
function calculateValidatedArApPayment(tenantId, branchId, input) {
  if (typeof input.contactId !== "string" || input.contactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "contactId" is required.'
    );
  }
  if (!input.ledgerType || !VALID_LEDGER_TYPES.has(input.ledgerType)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Invalid "ledgerType"; expected RECEIVABLE_CXC or PAYABLE_CXP.'
    );
  }
  const outstanding = MoneyDecimal.from(input.outstandingBalance).assertPositive(
    "outstandingBalance"
  );
  const payment = MoneyDecimal.from(input.paymentAmount).assertPositive("paymentAmount");
  const remaining = outstanding.sub(payment);
  if (remaining.isNegative()) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Payment amount (${payment.toFixed4()}) exceeds outstanding balance (${outstanding.toFixed4()}).`,
      {
        outstanding_balance: outstanding.toFixed4(),
        payment_amount: payment.toFixed4()
      }
    );
  }
  return {
    tenantId,
    branchId,
    contactId: input.contactId.trim(),
    ledgerType: input.ledgerType,
    remainingBalance: remaining.toFixed4(),
    isSettled: remaining.isZero()
  };
}

// apps/srv-finance/ms-finance-ar-ap/src/application.ts
var FinanceArApUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async applyPayment(tenantId, branchId, dto) {
    const result = calculateValidatedArApPayment(tenantId, branchId, dto);
    return this.repository.savePaymentApplication(result);
  }
  async listLedgers(tenantId, branchId) {
    if (!this.repository.listByTenantAndBranch) {
      return [];
    }
    return this.repository.listByTenantAndBranch(tenantId, branchId);
  }
};

// apps/srv-finance/ms-finance-ar-ap/src/infrastructure.ts
var arpLedgersTable = srvFinanceSchema.table("arp_ledgers", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  contactId: varchar("contact_id", { length: 64 }).notNull(),
  ledgerType: varchar("ledger_type", { length: 16 }).notNull(),
  // RECEIVABLE_CXC | PAYABLE_CXP
  originalAmount: numeric("original_amount", { precision: 19, scale: 4 }).notNull(),
  outstandingBalance: numeric("outstanding_balance", { precision: 19, scale: 4 }).notNull(),
  dueDate: date("due_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryFinanceArApRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async savePaymentApplication(record) {
    const key = `${record.tenantId}:${record.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(record);
    this.store.set(key, list);
    return record;
  }
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
};

// apps/srv-finance/ms-finance-ar-ap/src/index.ts
function buildFinanceArApPlugin(repository = new InMemoryFinanceArApRepositoryAdapter()) {
  const useCases = new FinanceArApUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:finance",
    microserviceKey: "ms:finance-ar-ap",
    tablePrefix: "arp_",
    version: "1.0.0",
    routes: [
      {
        method: "POST",
        subPath: "/ledgers/apply-payment",
        description: "Aplicar abono parcial o total a cartera CxC / CxP",
        handler: async (ctx, req) => useCases.applyPayment(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      },
      {
        method: "GET",
        subPath: "/ledgers",
        description: "Listar aplicaciones de cartera CxC / CxP por sucursal",
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          ledgers: await useCases.listLedgers(ctx.tenantId, ctx.activeBranchId)
        })
      },
      {
        method: "GET",
        subPath: "/ledgers/apply-payment",
        description: "Listar aplicaciones de cartera CxC / CxP por sucursal (alias)",
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          ledgers: await useCases.listLedgers(ctx.tenantId, ctx.activeBranchId)
        })
      }
    ]
  });
}
var msFinanceArApPlugin = buildFinanceArApPlugin();

// apps/srv-finance/ms-finance-cashbook/src/domain.ts
var VALID_ENTRY_TYPES = /* @__PURE__ */ new Set(["INCOME", "EXPENSE"]);
function buildValidatedCashbookEntry(tenantId, branchId, input) {
  if (!input.entryType || !VALID_ENTRY_TYPES.has(input.entryType)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Invalid "entryType"; expected INCOME or EXPENSE.'
    );
  }
  if (typeof input.concept !== "string" || input.concept.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "concept" is required.'
    );
  }
  const amount = MoneyDecimal.from(input.amount).assertPositive("amount").toFixed4();
  return {
    tenantId,
    branchId,
    entryType: input.entryType,
    concept: input.concept.trim(),
    amount
  };
}

// apps/srv-finance/ms-finance-cashbook/src/application.ts
var FinanceCashbookUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listEntries(tenantId, branchId, isReadonlyArchive) {
    const entries = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_finance",
      table: "csh_entries",
      isReadonlyArchive,
      entries
    };
  }
  async recordEntry(tenantId, branchId, dto) {
    const entry = buildValidatedCashbookEntry(tenantId, branchId, dto);
    return this.repository.saveEntry(entry);
  }
};

// apps/srv-finance/ms-finance-cashbook/src/infrastructure.ts
var cshEntriesTable = srvFinanceSchema.table("csh_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  entryType: varchar("entry_type", { length: 16 }).notNull(),
  // INCOME | EXPENSE
  concept: varchar("concept", { length: 180 }).notNull(),
  amount: numeric("amount", { precision: 19, scale: 4 }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryFinanceCashbookRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveEntry(entry) {
    const key = `${entry.tenantId}:${entry.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(entry);
    this.store.set(key, list);
    return entry;
  }
};

// apps/srv-finance/ms-finance-cashbook/src/index.ts
function buildFinanceCashbookPlugin(repository = new InMemoryFinanceCashbookRepositoryAdapter()) {
  const useCases = new FinanceCashbookUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:finance",
    microserviceKey: "ms:finance-cashbook",
    tablePrefix: "csh_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/entries",
        description: "Consultar movimientos del libro de caja simple (disponible en READONLY_ARCHIVE)",
        handler: async (ctx) => useCases.listEntries(ctx.tenantId, ctx.activeBranchId, ctx.isReadonlyArchive)
      },
      {
        method: "POST",
        subPath: "/entries",
        description: "Registrar ingreso o gasto simple (bloqueado si fue reemplazado por PUC)",
        handler: async (ctx, req) => useCases.recordEntry(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      }
    ]
  });
}
var msFinanceCashbookPlugin = buildFinanceCashbookPlugin();

// apps/srv-finance/host-runner/src/index.ts
function createSrvFinanceHostRunner(guard, enabledMicroservicesEnv, hostNodeId = "host-runner:srv:finance") {
  return new ParentServiceHostRunner(
    "srv:finance",
    guard,
    [msFinanceCashbookPlugin, msFinanceArApPlugin, msFinanceAccountingPucPlugin],
    enabledMicroservicesEnv,
    hostNodeId
  );
}

// apps/srv-gastro/ms-gastro-kds/src/domain.ts
var VALID_STATIONS = /* @__PURE__ */ new Set(["HOT_KITCHEN", "BAR", "GRILL"]);
function buildValidatedKdsTicket(tenantId, branchId, input) {
  if (!input.stationKey || !VALID_STATIONS.has(input.stationKey)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Invalid "stationKey"; expected HOT_KITCHEN, BAR, or GRILL.'
    );
  }
  if (typeof input.tableCode !== "string" || input.tableCode.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "tableCode" is required.'
    );
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'KDS ticket "items" must be a non-empty array.'
    );
  }
  const sanitizedItems = input.items.map((item, idx) => {
    if (typeof item.sku !== "string" || item.sku.trim().length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `KDS item at index ${idx} is missing "sku".`
      );
    }
    if (typeof item.qty !== "number" || !Number.isFinite(item.qty) || item.qty <= 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `KDS item "${item.sku}" must have a positive "qty" (> 0).`
      );
    }
    return {
      sku: item.sku.trim(),
      qty: item.qty,
      notes: item.notes?.trim()
    };
  });
  return {
    tenantId,
    branchId,
    stationKey: input.stationKey,
    tableCode: input.tableCode.trim(),
    items: sanitizedItems,
    status: "PREPARING"
  };
}

// apps/srv-gastro/ms-gastro-kds/src/application.ts
var GastroKdsUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listTickets(tenantId, branchId) {
    const tickets = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_gastro",
      table: "kds_tickets",
      tickets
    };
  }
  async dispatchTicket(tenantId, branchId, dto) {
    const ticket = buildValidatedKdsTicket(tenantId, branchId, dto);
    return this.repository.saveTicket(ticket);
  }
};

// apps/srv-gastro/ms-gastro-kds/src/infrastructure.ts
var kdsTicketsTable = srvGastroSchema.table("kds_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  stationKey: varchar("station_key", { length: 48 }).notNull(),
  // HOT_KITCHEN | BAR | GRILL
  tableCode: varchar("table_code", { length: 32 }).notNull(),
  itemsJson: jsonb("items_json").$type().notNull(),
  status: varchar("status", { length: 32 }).notNull().default("PREPARING"),
  // PREPARING | READY | SERVED
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryGastroKdsRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveTicket(ticket) {
    const key = `${ticket.tenantId}:${ticket.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(ticket);
    this.store.set(key, list);
    return ticket;
  }
};

// apps/srv-gastro/ms-gastro-kds/src/index.ts
function buildGastroKdsPlugin(repository = new InMemoryGastroKdsRepositoryAdapter()) {
  const useCases = new GastroKdsUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:gastro",
    microserviceKey: "ms:gastro-kds",
    tablePrefix: "kds_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/tickets",
        description: "Consultar comandas activas de cocina y barra KDS",
        handler: async (ctx) => useCases.listTickets(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "POST",
        subPath: "/tickets/dispatch",
        description: "Enviar comanda a estaci\xF3n de cocina o barra",
        handler: async (ctx, req) => useCases.dispatchTicket(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      }
    ]
  });
}
var msGastroKdsPlugin = buildGastroKdsPlugin();

// apps/srv-gastro/ms-gastro-split-check/src/domain.ts
function calculateValidatedSplitCheck(tenantId, branchId, input) {
  if (typeof input.tableCode !== "string" || input.tableCode.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "tableCode" is required.'
    );
  }
  if (!Array.isArray(input.seatSubtotals) || input.seatSubtotals.length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "seatSubtotals" must be a non-empty array.'
    );
  }
  const tipRate = input.tipRatePercent ?? "10.00";
  const splits = input.seatSubtotals.map((seat, idx) => {
    if (typeof seat.seatNumber !== "number" || !Number.isInteger(seat.seatNumber) || seat.seatNumber <= 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Seat at index ${idx} must have a positive integer "seatNumber".`
      );
    }
    const sub2 = MoneyDecimal.from(seat.subtotal).assertPositive(
      `seatSubtotals[${idx}].subtotal`
    );
    const tip = sub2.applyTaxRatePercent(tipRate);
    const total = sub2.add(tip);
    return {
      seatNumber: seat.seatNumber,
      subtotal: sub2.toFixed4(),
      serviceTip: tip.toFixed4(),
      totalDue: total.toFixed4()
    };
  });
  return {
    tenantId,
    branchId,
    tableCode: input.tableCode.trim(),
    splits
  };
}

// apps/srv-gastro/ms-gastro-split-check/src/application.ts
var GastroSplitCheckUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listSplitChecks(tenantId, branchId) {
    const checks = this.repository.listByTenantAndBranch ? await this.repository.listByTenantAndBranch(tenantId, branchId) : [];
    return {
      tenantId,
      branchId,
      schema: "srv_gastro",
      table: "spl_split_bills",
      checks
    };
  }
  async splitBySeats(tenantId, branchId, dto) {
    const result = calculateValidatedSplitCheck(tenantId, branchId, dto);
    return this.repository.saveSplitCheck(result);
  }
};

// apps/srv-gastro/ms-gastro-split-check/src/infrastructure.ts
var splSplitBillsTable = srvGastroSchema.table("spl_split_bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  tableCode: varchar("table_code", { length: 32 }).notNull(),
  seatNumber: integer("seat_number").notNull(),
  subtotal: numeric("subtotal", { precision: 19, scale: 4 }).notNull(),
  serviceTip: numeric("service_tip", { precision: 19, scale: 4 }).notNull(),
  totalDue: numeric("total_due", { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryGastroSplitCheckRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveSplitCheck(record) {
    const key = `${record.tenantId}:${record.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(record);
    this.store.set(key, list);
    return record;
  }
};

// apps/srv-gastro/ms-gastro-split-check/src/index.ts
function buildGastroSplitCheckPlugin(repository = new InMemoryGastroSplitCheckRepositoryAdapter()) {
  const useCases = new GastroSplitCheckUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:gastro",
    microserviceKey: "ms:gastro-split-check",
    tablePrefix: "spl_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/checks",
        description: "Consultar historial de cuentas divididas por mesa y sucursal",
        handler: async (ctx) => useCases.listSplitChecks(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "GET",
        subPath: "/checks/split-by-seats",
        description: "Consultar historial de cuentas divididas por sillas",
        handler: async (ctx) => useCases.listSplitChecks(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "POST",
        subPath: "/checks/split-by-seats",
        description: "Dividir cuenta de restaurante por sillas/\xEDtems y calcular propina voluntaria con Decimal",
        handler: async (ctx, req) => useCases.splitBySeats(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      }
    ]
  });
}
var msGastroSplitCheckPlugin = buildGastroSplitCheckPlugin();

// apps/srv-gastro/ms-gastro-tables/src/domain.ts
function buildValidatedTableOccupancy(tenantId, branchId, input) {
  if (typeof input.tableCode !== "string" || input.tableCode.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "tableCode" is required.'
    );
  }
  if (typeof input.guestsCount !== "number" || !Number.isInteger(input.guestsCount) || input.guestsCount <= 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "guestsCount" must be a positive integer (> 0).'
    );
  }
  return {
    tenantId,
    branchId,
    tableCode: input.tableCode.trim(),
    guestsCount: input.guestsCount,
    occupancyStatus: "OCCUPIED"
  };
}

// apps/srv-gastro/ms-gastro-tables/src/application.ts
var GastroTablesUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listTables(tenantId, branchId) {
    const tables = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_gastro",
      table: "tbl_dining_tables",
      tables
    };
  }
  async occupyTable(tenantId, branchId, dto) {
    const record = buildValidatedTableOccupancy(tenantId, branchId, dto);
    return this.repository.saveTableOccupancy(record);
  }
};

// apps/srv-gastro/ms-gastro-tables/src/infrastructure.ts
var tblDiningTablesTable = srvGastroSchema.table("tbl_dining_tables", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  zoneName: varchar("zone_name", { length: 64 }).notNull(),
  tableCode: varchar("table_code", { length: 32 }).notNull(),
  seatsCapacity: integer("seats_capacity").notNull().default(4),
  occupancyStatus: varchar("occupancy_status", { length: 32 }).notNull().default("AVAILABLE"),
  // AVAILABLE | OCCUPIED | BILL_REQUESTED
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryGastroTablesRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveTableOccupancy(record) {
    const key = `${record.tenantId}:${record.branchId}`;
    const list = this.store.get(key) ?? [];
    const existingIdx = list.findIndex((t) => t.tableCode === record.tableCode);
    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.push(record);
    }
    this.store.set(key, list);
    return record;
  }
};

// apps/srv-gastro/ms-gastro-tables/src/index.ts
function buildGastroTablesPlugin(repository = new InMemoryGastroTablesRepositoryAdapter()) {
  const useCases = new GastroTablesUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:gastro",
    microserviceKey: "ms:gastro-tables",
    tablePrefix: "tbl_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/tables",
        description: "Consultar mapa de salones y ocupaci\xF3n de mesas en tiempo real",
        handler: async (ctx) => useCases.listTables(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "POST",
        subPath: "/tables/occupy",
        description: "Abrir mesa y asignar n\xFAmero de comensales",
        handler: async (ctx, req) => useCases.occupyTable(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      }
    ]
  });
}
var msGastroTablesPlugin = buildGastroTablesPlugin();

// apps/srv-gastro/host-runner/src/index.ts
function createSrvGastroHostRunner(guard, enabledMicroservicesEnv, hostNodeId = "host-runner:srv:gastro") {
  return new ParentServiceHostRunner(
    "srv:gastro",
    guard,
    [msGastroTablesPlugin, msGastroKdsPlugin, msGastroSplitCheckPlugin],
    enabledMicroservicesEnv,
    hostNodeId
  );
}

// apps/srv-hotel/ms-hotel-bookings/src/domain.ts
function buildValidatedHotelReservation(tenantId, branchId, input) {
  if (typeof input.guestContactId !== "string" || input.guestContactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "guestContactId" is required.'
    );
  }
  if (typeof input.roomNumber !== "string" || input.roomNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "roomNumber" is required.'
    );
  }
  if (typeof input.nightsCount !== "number" || !Number.isInteger(input.nightsCount) || input.nightsCount <= 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "nightsCount" must be a positive integer (> 0).'
    );
  }
  const nightlyRate = MoneyDecimal.from(input.nightlyRate).assertPositive("nightlyRate");
  const total = nightlyRate.mul(input.nightsCount);
  return {
    tenantId,
    branchId,
    guestContactId: input.guestContactId.trim(),
    roomNumber: input.roomNumber.trim(),
    nightsCount: input.nightsCount,
    estimatedTotal: total.toFixed4(),
    status: "CONFIRMED"
  };
}

// apps/srv-hotel/ms-hotel-bookings/src/application.ts
var HotelBookingsUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listReservations(tenantId, branchId) {
    const reservations = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_hotel",
      table: "bkg_reservations",
      reservations
    };
  }
  async createReservation(tenantId, branchId, dto) {
    const reservation = buildValidatedHotelReservation(tenantId, branchId, dto);
    return this.repository.saveReservation(reservation);
  }
};

// apps/srv-hotel/ms-hotel-bookings/src/infrastructure.ts
var bkgReservationsTable = srvHotelSchema.table("bkg_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  guestContactId: varchar("guest_contact_id", { length: 64 }).notNull(),
  roomNumber: varchar("room_number", { length: 32 }).notNull(),
  checkInDate: date("check_in_date").notNull(),
  checkOutDate: date("check_out_date").notNull(),
  nightsCount: integer("nights_count").notNull(),
  estimatedTotal: numeric("estimated_total", { precision: 19, scale: 4 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("CONFIRMED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryHotelBookingsRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveReservation(reservation) {
    const key = `${reservation.tenantId}:${reservation.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(reservation);
    this.store.set(key, list);
    return reservation;
  }
};

// apps/srv-hotel/ms-hotel-bookings/src/index.ts
function buildHotelBookingsPlugin(repository = new InMemoryHotelBookingsRepositoryAdapter()) {
  const useCases = new HotelBookingsUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:hotel",
    microserviceKey: "ms:hotel-bookings",
    tablePrefix: "bkg_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/reservations",
        description: "Consultar calendario de reservas y ocupaci\xF3n hotelera",
        handler: async (ctx) => useCases.listReservations(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "POST",
        subPath: "/reservations",
        description: "Crear reserva hotelera calculando total por n\xFAmero de noches",
        handler: async (ctx, req) => useCases.createReservation(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      }
    ]
  });
}
var msHotelBookingsPlugin = buildHotelBookingsPlugin();

// apps/srv-hotel/ms-hotel-frontdesk/src/domain.ts
function calculateValidatedFolioCharge(tenantId, branchId, input) {
  if (typeof input.roomNumber !== "string" || input.roomNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "roomNumber" is required.'
    );
  }
  const currentBalance = MoneyDecimal.from(input.currentBalance).assertNonNegative(
    "currentBalance"
  );
  const newChargeAmount = MoneyDecimal.from(input.newChargeAmount).assertPositive(
    "newChargeAmount"
  );
  const updatedBalance = currentBalance.add(newChargeAmount);
  return {
    tenantId,
    branchId,
    roomNumber: input.roomNumber.trim(),
    updatedFolioBalance: updatedBalance.toFixed4()
  };
}

// apps/srv-hotel/ms-hotel-frontdesk/src/application.ts
var HotelFrontdeskUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async postFolioCharge(tenantId, branchId, dto) {
    const record = calculateValidatedFolioCharge(tenantId, branchId, dto);
    return this.repository.saveFolioBalance(record);
  }
  async listFolios(tenantId, branchId) {
    if (!this.repository.listByTenantAndBranch) {
      return [];
    }
    return this.repository.listByTenantAndBranch(tenantId, branchId);
  }
};

// apps/srv-hotel/ms-hotel-frontdesk/src/infrastructure.ts
var fdkRoomFoliosTable = srvHotelSchema.table("fdk_room_folios", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  roomNumber: varchar("room_number", { length: 32 }).notNull(),
  guestContactId: varchar("guest_contact_id", { length: 64 }).notNull(),
  lodgingCharges: numeric("lodging_charges", { precision: 19, scale: 4 }).notNull().default("0.0000"),
  minibarAndPosCharges: numeric("minibar_and_pos_charges", { precision: 19, scale: 4 }).notNull().default("0.0000"),
  folioStatus: varchar("folio_status", { length: 32 }).notNull().default("CHECKED_IN"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryHotelFrontdeskRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async saveFolioBalance(record) {
    const key = `${record.tenantId}:${record.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(record);
    this.store.set(key, list);
    return record;
  }
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
};

// apps/srv-hotel/ms-hotel-frontdesk/src/index.ts
function buildHotelFrontdeskPlugin(repository = new InMemoryHotelFrontdeskRepositoryAdapter()) {
  const useCases = new HotelFrontdeskUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:hotel",
    microserviceKey: "ms:hotel-frontdesk",
    tablePrefix: "fdk_",
    version: "1.0.0",
    routes: [
      {
        method: "POST",
        subPath: "/folios/post-charge",
        description: "Cargar consumo (minibar/restaurante/alojamiento) al folio de habitaci\xF3n",
        handler: async (ctx, req) => useCases.postFolioCharge(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      },
      {
        method: "GET",
        subPath: "/folios",
        description: "Listar saldos de folios de habitaciones por sucursal",
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          folios: await useCases.listFolios(ctx.tenantId, ctx.activeBranchId)
        })
      },
      {
        method: "GET",
        subPath: "/folios/post-charge",
        description: "Listar saldos de folios de habitaciones por sucursal (alias)",
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          folios: await useCases.listFolios(ctx.tenantId, ctx.activeBranchId)
        })
      }
    ]
  });
}
var msHotelFrontdeskPlugin = buildHotelFrontdeskPlugin();

// apps/srv-hotel/ms-hotel-rooms/src/domain.ts
function buildValidatedHotelRoom(tenantId, branchId, input) {
  if (typeof input.roomNumber !== "string" || input.roomNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "roomNumber" is required.'
    );
  }
  if (typeof input.roomCategory !== "string" || input.roomCategory.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "roomCategory" is required.'
    );
  }
  const nightlyRate = MoneyDecimal.from(input.nightlyRate).assertPositive("nightlyRate").toFixed4();
  return {
    tenantId,
    branchId,
    roomNumber: input.roomNumber.trim(),
    roomCategory: input.roomCategory.trim(),
    nightlyRate,
    housekeepingStatus: "CLEAN"
  };
}

// apps/srv-hotel/ms-hotel-rooms/src/application.ts
var HotelRoomsUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listRooms(tenantId, branchId) {
    const rooms = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_hotel",
      table: "rom_rooms",
      rooms
    };
  }
  async createRoom(tenantId, branchId, dto) {
    const room = buildValidatedHotelRoom(tenantId, branchId, dto);
    return this.repository.saveRoom(room);
  }
};

// apps/srv-hotel/ms-hotel-rooms/src/infrastructure.ts
var romRoomsTable = srvHotelSchema.table("rom_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  roomNumber: varchar("room_number", { length: 32 }).notNull(),
  roomCategory: varchar("room_category", { length: 64 }).notNull(),
  // STANDARD | SUITE | DELUXE
  nightlyRate: numeric("nightly_rate", { precision: 19, scale: 4 }).notNull(),
  housekeepingStatus: varchar("housekeeping_status", { length: 32 }).notNull().default("CLEAN"),
  // CLEAN | DIRTY | INSPECTED
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryHotelRoomsRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveRoom(room) {
    const key = `${room.tenantId}:${room.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(room);
    this.store.set(key, list);
    return room;
  }
};

// apps/srv-hotel/ms-hotel-rooms/src/index.ts
function buildHotelRoomsPlugin(repository = new InMemoryHotelRoomsRepositoryAdapter()) {
  const useCases = new HotelRoomsUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:hotel",
    microserviceKey: "ms:hotel-rooms",
    tablePrefix: "rom_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/rooms",
        description: "Listar habitaciones, tarifas y estado de limpieza housekeeping",
        handler: async (ctx) => useCases.listRooms(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "POST",
        subPath: "/rooms",
        description: "Registrar habitaci\xF3n con tarifa por noche NUMERIC(19, 4)",
        handler: async (ctx, req) => useCases.createRoom(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      }
    ]
  });
}
var msHotelRoomsPlugin = buildHotelRoomsPlugin();

// apps/srv-hotel/host-runner/src/index.ts
function createSrvHotelHostRunner(guard, enabledMicroservicesEnv, hostNodeId = "host-runner:srv:hotel") {
  return new ParentServiceHostRunner(
    "srv:hotel",
    guard,
    [msHotelRoomsPlugin, msHotelBookingsPlugin, msHotelFrontdeskPlugin],
    enabledMicroservicesEnv,
    hostNodeId
  );
}

// apps/srv-inventory/ms-inventory-lots/src/domain.ts
var ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function allocateValidatedFefoBatches(tenantId, input) {
  if (typeof input.sku !== "string" || input.sku.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "sku" is required.'
    );
  }
  if (!Array.isArray(input.batches) || input.batches.length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "batches" must be a non-empty array.'
    );
  }
  let remaining = MoneyDecimal.from(input.requestedQty).assertPositive("requestedQty");
  const referenceDate = input.referenceDate?.trim();
  if (referenceDate && !ISO_DATE_RE.test(referenceDate)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "referenceDate" must follow YYYY-MM-DD format.'
    );
  }
  const validBatches = input.batches.map((b, idx) => {
    if (typeof b.batchCode !== "string" || b.batchCode.trim().length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Batch at index ${idx} is missing "batchCode".`
      );
    }
    if (typeof b.expirationDate !== "string" || !ISO_DATE_RE.test(b.expirationDate.trim())) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Batch "${b.batchCode}" has invalid "expirationDate"; expected YYYY-MM-DD.`
      );
    }
    const avail = MoneyDecimal.from(b.availableQty).assertNonNegative(
      `batches[${idx}].availableQty`
    );
    return {
      batchCode: b.batchCode.trim(),
      expirationDate: b.expirationDate.trim(),
      avail
    };
  }).filter((b) => {
    if (b.avail.isZero()) return false;
    if (referenceDate && b.expirationDate < referenceDate) {
      return false;
    }
    return true;
  }).sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
  const allocations = [];
  for (const batch of validBatches) {
    if (remaining.isZero()) break;
    const diff = batch.avail.sub(remaining);
    const take = diff.isNegative() ? batch.avail : remaining;
    allocations.push({
      batchCode: batch.batchCode,
      expirationDate: batch.expirationDate,
      allocatedQty: take.toFixed4()
    });
    remaining = remaining.sub(take);
  }
  return {
    tenantId,
    sku: input.sku.trim(),
    allocations,
    unfulfilledQty: remaining.toFixed4()
  };
}

// apps/srv-inventory/ms-inventory-lots/src/application.ts
var InventoryLotsUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listBatches(tenantId, branchId) {
    const batches = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_inventory",
      table: "lot_batches",
      batches
    };
  }
  async allocateFefo(tenantId, dto) {
    const result = allocateValidatedFefoBatches(tenantId, dto);
    return this.repository.saveAllocationRecord(result);
  }
};

// apps/srv-inventory/ms-inventory-lots/src/infrastructure.ts
var lotBatchesTable = srvInventorySchema.table("lot_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  sku: varchar("sku", { length: 64 }).notNull(),
  batchCode: varchar("batch_code", { length: 64 }).notNull(),
  expirationDate: date("expiration_date").notNull(),
  availableQty: numeric("available_qty", { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryInventoryLotsRepositoryAdapter = class {
  batchesByKey = /* @__PURE__ */ new Map();
  allocationsByTenant = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.batchesByKey.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveAllocationRecord(record) {
    const list = this.allocationsByTenant.get(record.tenantId) ?? [];
    list.push(record);
    this.allocationsByTenant.set(record.tenantId, list);
    return record;
  }
};

// apps/srv-inventory/ms-inventory-lots/src/index.ts
function buildInventoryLotsPlugin(repository = new InMemoryInventoryLotsRepositoryAdapter()) {
  const useCases = new InventoryLotsUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:inventory",
    microserviceKey: "ms:inventory-lots",
    tablePrefix: "lot_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/batches",
        description: "Listar lotes y fechas de vencimiento FEFO por sucursal",
        handler: async (ctx) => useCases.listBatches(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "POST",
        subPath: "/batches/allocate-fefo",
        description: "Asignar lotes bajo regla FEFO (First-Expired, First-Out)",
        handler: async (ctx, req) => useCases.allocateFefo(ctx.tenantId, req.body ?? {})
      }
    ]
  });
}
var msInventoryLotsPlugin = buildInventoryLotsPlugin();

// apps/srv-inventory/ms-inventory-recipes/src/domain.ts
function calculateValidatedRecipeExplosion(tenantId, input) {
  if (typeof input.finishedProductSku !== "string" || input.finishedProductSku.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "finishedProductSku" is required.'
    );
  }
  if (!Array.isArray(input.ingredients) || input.ingredients.length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Recipe "ingredients" must be a non-empty array.'
    );
  }
  const soldQty = MoneyDecimal.from(input.soldQuantity).assertPositive("soldQuantity");
  let totalRecipeCost = MoneyDecimal.zero();
  const deductions = input.ingredients.map((ing, idx) => {
    if (typeof ing.ingredientSku !== "string" || ing.ingredientSku.trim().length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Ingredient at index ${idx} is missing "ingredientSku".`
      );
    }
    const qtyRequired = MoneyDecimal.from(ing.quantityRequired).assertPositive(
      `ingredients[${idx}].quantityRequired`
    );
    const unitCost = MoneyDecimal.from(ing.unitCost).assertNonNegative(
      `ingredients[${idx}].unitCost`
    );
    const totalIngredientQty = qtyRequired.mul(soldQty);
    const lineCost = totalIngredientQty.mul(unitCost);
    totalRecipeCost = totalRecipeCost.add(lineCost);
    return {
      ingredientSku: ing.ingredientSku.trim(),
      deductedQuantity: totalIngredientQty.toFixed4(),
      lineCost: lineCost.toFixed4()
    };
  });
  return {
    tenantId,
    finishedProductSku: input.finishedProductSku.trim(),
    soldQuantity: soldQty.toFixed4(),
    totalRecipeCost: totalRecipeCost.toFixed4(),
    deductions
  };
}

// apps/srv-inventory/ms-inventory-recipes/src/application.ts
var InventoryRecipesUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listRecipes(tenantId) {
    const recipes = await this.repository.listByTenant(tenantId);
    return {
      tenantId,
      schema: "srv_inventory",
      table: "rec_headers",
      recipes
    };
  }
  async explodeRecipeCost(tenantId, dto) {
    const result = calculateValidatedRecipeExplosion(tenantId, dto);
    return this.repository.saveRecipeExplosion(result);
  }
};

// apps/srv-inventory/ms-inventory-recipes/src/infrastructure.ts
var recHeadersTable = srvInventorySchema.table("rec_headers", {
  id: uuid("id").primaryKey().defaultRandom(),
  finishedProductSku: varchar("finished_product_sku", { length: 64 }).notNull().unique(),
  yieldQuantity: numeric("yield_quantity", { precision: 19, scale: 4 }).notNull().default("1.0000"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var recBomIngredientsTable = srvInventorySchema.table("rec_bom_ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id").notNull(),
  ingredientSku: varchar("ingredient_sku", { length: 64 }).notNull(),
  quantityRequired: numeric("quantity_required", { precision: 19, scale: 4 }).notNull(),
  unitCostSnapshot: numeric("unit_cost_snapshot", { precision: 19, scale: 4 }).notNull()
});
var InMemoryInventoryRecipesRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenant(tenantId) {
    return [...this.store.get(tenantId) ?? []];
  }
  async saveRecipeExplosion(record) {
    const list = this.store.get(record.tenantId) ?? [];
    list.push(record);
    this.store.set(record.tenantId, list);
    return record;
  }
};

// apps/srv-inventory/ms-inventory-recipes/src/index.ts
function buildInventoryRecipesPlugin(repository = new InMemoryInventoryRecipesRepositoryAdapter()) {
  const useCases = new InventoryRecipesUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:inventory",
    microserviceKey: "ms:inventory-recipes",
    tablePrefix: "rec_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/recipes",
        description: "Listar recetas y escandallos BOM",
        handler: async (ctx) => useCases.listRecipes(ctx.tenantId)
      },
      {
        method: "POST",
        subPath: "/recipes/explode-cost",
        description: "Calcular costo de escandallo y explosi\xF3n de insumos BOM por cantidad vendida",
        handler: async (ctx, req) => useCases.explodeRecipeCost(ctx.tenantId, req.body ?? {})
      }
    ]
  });
}
var msInventoryRecipesPlugin = buildInventoryRecipesPlugin();

// apps/srv-inventory/ms-inventory-stock/src/domain.ts
var VALID_MOVEMENT_TYPES = /* @__PURE__ */ new Set([
  "INBOUND",
  "OUTBOUND_SALE",
  "RECIPE_DEDUCTION",
  "ADJUSTMENT"
]);
function calculateValidatedKardexMovement(tenantId, branchId, input) {
  if (typeof input.sku !== "string" || input.sku.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "sku" is required.'
    );
  }
  if (!input.movementType || !VALID_MOVEMENT_TYPES.has(input.movementType)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Invalid "movementType" ("${String(input.movementType)}"); expected INBOUND, OUTBOUND_SALE, RECIPE_DEDUCTION, or ADJUSTMENT.`
    );
  }
  const currentQty = MoneyDecimal.from(input.currentQty).assertNonNegative("currentQty");
  const delta = MoneyDecimal.from(input.quantityDelta).assertPositive("quantityDelta");
  const unitCost = MoneyDecimal.from(input.unitCost).assertNonNegative("unitCost");
  const newQty = input.movementType === "INBOUND" ? currentQty.add(delta) : currentQty.sub(delta);
  if (newQty.isNegative()) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Insufficient stock for SKU "${input.sku.trim()}": currentQty (${currentQty.toFixed4()}) - delta (${delta.toFixed4()}) would result in negative stock (${newQty.toFixed4()}).`,
      {
        sku: input.sku.trim(),
        current_qty: currentQty.toFixed4(),
        requested_delta: delta.toFixed4()
      }
    );
  }
  const totalValuation = newQty.mul(unitCost);
  return {
    tenantId,
    branchId,
    sku: input.sku.trim(),
    movementType: input.movementType,
    newQtyOnHand: newQty.toFixed4(),
    totalValuation: totalValuation.toFixed4()
  };
}

// apps/srv-inventory/ms-inventory-stock/src/application.ts
var InventoryStockUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listItems(tenantId, branchId) {
    const items = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_inventory",
      table: "stk_items",
      items
    };
  }
  async recordMovement(tenantId, branchId, dto) {
    const result = calculateValidatedKardexMovement(tenantId, branchId, dto);
    return this.repository.saveStockSnapshot(result);
  }
};

// apps/srv-inventory/ms-inventory-stock/src/infrastructure.ts
var stkItemsTable = srvInventorySchema.table("stk_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  sku: varchar("sku", { length: 64 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  qtyOnHand: numeric("qty_on_hand", { precision: 19, scale: 4 }).notNull().default("0.0000"),
  unitCost: numeric("unit_cost", { precision: 19, scale: 4 }).notNull().default("0.0000"),
  salePrice: numeric("sale_price", { precision: 19, scale: 4 }).notNull().default("0.0000"),
  customFields: jsonb("custom_fields").$type().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var stkMovementsTable = srvInventorySchema.table("stk_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  movementType: varchar("movement_type", { length: 32 }).notNull(),
  // INBOUND | OUTBOUND_SALE | RECIPE_DEDUCTION | ADJUSTMENT
  quantityDelta: numeric("quantity_delta", { precision: 19, scale: 4 }).notNull(),
  referenceEventId: varchar("reference_event_id", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryInventoryStockRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveStockSnapshot(snapshot) {
    const key = `${snapshot.tenantId}:${snapshot.branchId}`;
    const list = this.store.get(key) ?? [];
    const existingIdx = list.findIndex((i) => i.sku === snapshot.sku);
    if (existingIdx >= 0) {
      list[existingIdx] = snapshot;
    } else {
      list.push(snapshot);
    }
    this.store.set(key, list);
    return snapshot;
  }
};

// apps/srv-inventory/ms-inventory-stock/src/index.ts
function buildInventoryStockPlugin(repository = new InMemoryInventoryStockRepositoryAdapter()) {
  const useCases = new InventoryStockUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:inventory",
    microserviceKey: "ms:inventory-stock",
    tablePrefix: "stk_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/items",
        description: "Consultar existencias de Kardex por sucursal activa",
        handler: async (ctx) => useCases.listItems(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "POST",
        subPath: "/movements",
        description: "Registrar movimiento de Kardex con precisi\xF3n NUMERIC(19, 4)",
        handler: async (ctx, req) => useCases.recordMovement(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      }
    ]
  });
}
var msInventoryStockPlugin = buildInventoryStockPlugin();

// apps/srv-inventory/ms-inventory-transfers/src/domain.ts
function buildValidatedBranchTransfer(tenantId, activeBranchId, allowedBranchIds, input) {
  if (typeof input.toBranchId !== "string" || input.toBranchId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "toBranchId" is required.'
    );
  }
  const toBranchId = input.toBranchId.trim();
  if (toBranchId === activeBranchId) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Cannot create a circular transfer where source and destination branch are identical ("${activeBranchId}").`
    );
  }
  if (!allowedBranchIds.includes(toBranchId)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_BRANCH_FORBIDDEN,
      403,
      `Destination branch "${toBranchId}" is not in allowed_branch_ids.`
    );
  }
  if (typeof input.sku !== "string" || input.sku.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "sku" is required.'
    );
  }
  const quantity = MoneyDecimal.from(input.quantity).assertPositive("quantity").toFixed4();
  return {
    tenantId,
    fromBranchId: activeBranchId,
    toBranchId,
    sku: input.sku.trim(),
    quantity,
    status: "IN_TRANSIT"
  };
}

// apps/srv-inventory/ms-inventory-transfers/src/application.ts
var InventoryTransfersUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listTransfers(tenantId, activeBranchId) {
    const transfers = await this.repository.listByTenantAndBranch(tenantId, activeBranchId);
    return {
      tenantId,
      activeBranchId,
      schema: "srv_inventory",
      table: "trf_orders",
      transfers
    };
  }
  async createTransfer(tenantId, activeBranchId, allowedBranchIds, dto) {
    const order = buildValidatedBranchTransfer(tenantId, activeBranchId, allowedBranchIds, dto);
    return this.repository.saveTransferOrder(order);
  }
};

// apps/srv-inventory/ms-inventory-transfers/src/infrastructure.ts
var trfOrdersTable = srvInventorySchema.table("trf_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromBranchId: varchar("from_branch_id", { length: 64 }).notNull(),
  toBranchId: varchar("to_branch_id", { length: 64 }).notNull(),
  sku: varchar("sku", { length: 64 }).notNull(),
  quantity: numeric("quantity", { precision: 19, scale: 4 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("IN_TRANSIT"),
  // IN_TRANSIT | RECEIVED
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryInventoryTransfersRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    const all = this.store.get(tenantId) ?? [];
    return all.filter((o) => o.fromBranchId === branchId || o.toBranchId === branchId);
  }
  async saveTransferOrder(order) {
    const list = this.store.get(order.tenantId) ?? [];
    list.push(order);
    this.store.set(order.tenantId, list);
    return order;
  }
};

// apps/srv-inventory/ms-inventory-transfers/src/index.ts
function buildInventoryTransfersPlugin(repository = new InMemoryInventoryTransfersRepositoryAdapter()) {
  const useCases = new InventoryTransfersUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:inventory",
    microserviceKey: "ms:inventory-transfers",
    tablePrefix: "trf_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/transfers",
        description: "Listar traslados de mercanc\xEDa entre sucursales",
        handler: async (ctx) => useCases.listTransfers(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "POST",
        subPath: "/transfers",
        description: "Crear traslado entre sucursales autorizadas del usuario",
        handler: async (ctx, req) => useCases.createTransfer(
          ctx.tenantId,
          ctx.activeBranchId,
          ctx.allowedBranchIds,
          req.body ?? {}
        )
      }
    ]
  });
}
var msInventoryTransfersPlugin = buildInventoryTransfersPlugin();

// apps/srv-inventory/host-runner/src/index.ts
function createSrvInventoryHostRunner(guard, enabledMicroservicesEnv, hostNodeId = "host-runner:srv:inventory") {
  return new ParentServiceHostRunner(
    "srv:inventory",
    guard,
    [
      msInventoryStockPlugin,
      msInventoryRecipesPlugin,
      msInventoryLotsPlugin,
      msInventoryTransfersPlugin
    ],
    enabledMicroservicesEnv,
    hostNodeId
  );
}

// apps/srv-invoicing/ms-invoicing-electronic-dian/src/domain.ts
import crypto4 from "node:crypto";
function computeDeterministicDianCufe(params) {
  const seed = [
    params.invoiceNumber,
    params.issueDateIso,
    params.subtotalFixed2,
    "01",
    params.ivaFixed2,
    "04",
    "0.00",
    "03",
    "0.00",
    params.totalFixed2,
    params.issuerNit,
    params.customerNit,
    params.technicalKey
  ].join("|");
  return crypto4.createHash("sha384").update(seed, "utf8").digest("hex");
}
function buildValidatedDianElectronicInvoice(tenantId, branchId, input) {
  if (typeof input.prefixAndNumber !== "string" || input.prefixAndNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "prefixAndNumber" is required.'
    );
  }
  if (typeof input.issuerNit !== "string" || input.issuerNit.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "issuerNit" is required.'
    );
  }
  if (typeof input.customerNit !== "string" || input.customerNit.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "customerNit" is required.'
    );
  }
  const sub2 = MoneyDecimal.from(input.subtotal).assertPositive("subtotal");
  const iva = sub2.applyTaxRatePercent(input.ivaPercent ?? "19.00");
  const total = sub2.add(iva);
  const issueDateIso = typeof input.issueDateIso === "string" && input.issueDateIso.trim().length > 0 ? input.issueDateIso.trim() : (/* @__PURE__ */ new Date()).toISOString();
  const cufe = computeDeterministicDianCufe({
    invoiceNumber: input.prefixAndNumber.trim(),
    issueDateIso,
    subtotalFixed2: sub2.toCurrencyFixed2(),
    ivaFixed2: iva.toCurrencyFixed2(),
    totalFixed2: total.toCurrencyFixed2(),
    issuerNit: input.issuerNit.trim(),
    customerNit: input.customerNit.trim(),
    technicalKey: input.technicalKey?.trim() || "PROVEKO-DIAN-TECH-KEY-2026"
  });
  return {
    tenantId,
    branchId,
    prefixAndNumber: input.prefixAndNumber.trim(),
    subtotal: sub2.toFixed4(),
    ivaTax: iva.toFixed4(),
    grandTotal: total.toFixed4(),
    cufeSha384: cufe,
    dianStatus: "QUEUED_FOR_SIGNING",
    workerQueue: "bullmq:dian-xml-signer"
  };
}

// apps/srv-invoicing/ms-invoicing-electronic-dian/src/application.ts
var InvoicingElectronicDianUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listInvoices(tenantId, branchId) {
    const invoices = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_invoicing",
      table: "dian_electronic_invoices",
      invoices
    };
  }
  async emitInvoice(tenantId, branchId, dto) {
    const invoice = buildValidatedDianElectronicInvoice(tenantId, branchId, dto);
    return this.repository.saveElectronicInvoice(invoice);
  }
};

// apps/srv-invoicing/ms-invoicing-electronic-dian/src/infrastructure.ts
var dianElectronicInvoicesTable = srvInvoicingSchema.table("dian_electronic_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  prefixAndNumber: varchar("prefix_and_number", { length: 32 }).notNull().unique(),
  customerNit: varchar("customer_nit", { length: 32 }).notNull(),
  subtotal: numeric("subtotal", { precision: 19, scale: 4 }).notNull(),
  ivaTax: numeric("iva_tax", { precision: 19, scale: 4 }).notNull(),
  grandTotal: numeric("grand_total", { precision: 19, scale: 4 }).notNull(),
  cufeSha384: varchar("cufe_sha384", { length: 96 }).notNull().unique(),
  dianStatus: varchar("dian_status", { length: 32 }).notNull().default("QUEUED_FOR_SIGNING"),
  signedXmlUrl: text("signed_xml_url"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryInvoicingElectronicDianRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveElectronicInvoice(invoice) {
    const key = `${invoice.tenantId}:${invoice.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(invoice);
    this.store.set(key, list);
    return invoice;
  }
};

// apps/srv-invoicing/ms-invoicing-electronic-dian/src/index.ts
function buildInvoicingElectronicDianPlugin(repository = new InMemoryInvoicingElectronicDianRepositoryAdapter()) {
  const useCases = new InvoicingElectronicDianUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:invoicing",
    microserviceKey: "ms:invoicing-electronic-dian",
    tablePrefix: "dian_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/invoices",
        description: "Listar facturas electr\xF3nicas DIAN emitidas y su estado CUFE",
        handler: async (ctx) => useCases.listInvoices(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "POST",
        subPath: "/invoices/emit",
        description: "Pre-liquidar Factura Electr\xF3nica DIAN, calcular CUFE SHA-384 y encolar firma XAdES-EPES en Worker (<15ms sin bloquear Event Loop)",
        handler: async (ctx, req) => useCases.emitInvoice(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      }
    ]
  });
}
var msInvoicingElectronicDianPlugin = buildInvoicingElectronicDianPlugin();

// apps/srv-invoicing/ms-invoicing-pos/src/domain.ts
function calculateValidatedPosCheckout(tenantId, branchId, activeInvoicingChildren, input) {
  if (typeof input.contactId !== "string" || input.contactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "contactId" is required.'
    );
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'POS checkout "lines" must be a non-empty array.'
    );
  }
  let subtotal = MoneyDecimal.zero();
  let taxTotal = MoneyDecimal.zero();
  for (let idx = 0; idx < input.lines.length; idx++) {
    const line2 = input.lines[idx];
    if (typeof line2.sku !== "string" || line2.sku.trim().length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `POS line at index ${idx} is missing "sku".`
      );
    }
    const qty = MoneyDecimal.from(line2.quantity).assertPositive(`lines[${idx}].quantity`);
    const unitPrice = MoneyDecimal.from(line2.unitPrice).assertNonNegative(
      `lines[${idx}].unitPrice`
    );
    const lineSub = qty.mul(unitPrice);
    const lineTax = lineSub.applyTaxRatePercent(line2.taxPercent);
    subtotal = subtotal.add(lineSub);
    taxTotal = taxTotal.add(lineTax);
  }
  const grandTotal = subtotal.add(taxTotal);
  const emitter = activeInvoicingChildren.includes("ms:invoicing-electronic-dian") ? "ms:invoicing-electronic-dian" : "ms:invoicing-simple-receipt";
  return {
    tenantId,
    branchId,
    contactId: input.contactId.trim(),
    subtotal: subtotal.toFixed4(),
    taxTotal: taxTotal.toFixed4(),
    grandTotal: grandTotal.toFixed4(),
    resolvedFiscalEmitter: emitter
  };
}

// apps/srv-invoicing/ms-invoicing-pos/src/application.ts
var InvoicingPosUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listShifts(tenantId, branchId) {
    const shifts = await this.repository.listShiftsByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_invoicing",
      table: "pos_cash_shifts",
      shifts
    };
  }
  async checkout(tenantId, branchId, activeInvoicingChildren, dto) {
    const ticket = calculateValidatedPosCheckout(
      tenantId,
      branchId,
      activeInvoicingChildren,
      dto
    );
    return this.repository.saveSaleTicket(ticket);
  }
};

// apps/srv-invoicing/ms-invoicing-pos/src/infrastructure.ts
var posCashShiftsTable = srvInvoicingSchema.table("pos_cash_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  cashierUserId: varchar("cashier_user_id", { length: 64 }).notNull(),
  openingBalance: numeric("opening_balance", { precision: 19, scale: 4 }).notNull(),
  closingBalance: numeric("closing_balance", { precision: 19, scale: 4 }),
  status: varchar("status", { length: 32 }).notNull().default("OPEN"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow()
});
var posSaleTicketsTable = srvInvoicingSchema.table("pos_sale_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  contactId: varchar("contact_id", { length: 64 }).notNull(),
  subtotal: numeric("subtotal", { precision: 19, scale: 4 }).notNull(),
  taxTotal: numeric("tax_total", { precision: 19, scale: 4 }).notNull(),
  grandTotal: numeric("grand_total", { precision: 19, scale: 4 }).notNull(),
  emitterMicroservice: varchar("emitter_microservice", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryInvoicingPosRepositoryAdapter = class {
  ticketsByKey = /* @__PURE__ */ new Map();
  async listShiftsByTenantAndBranch(tenantId, branchId) {
    return [...this.ticketsByKey.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveSaleTicket(ticket) {
    const key = `${ticket.tenantId}:${ticket.branchId}`;
    const list = this.ticketsByKey.get(key) ?? [];
    list.push(ticket);
    this.ticketsByKey.set(key, list);
    return ticket;
  }
};

// apps/srv-invoicing/ms-invoicing-pos/src/index.ts
function buildInvoicingPosPlugin(repository = new InMemoryInvoicingPosRepositoryAdapter()) {
  const useCases = new InvoicingPosUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:invoicing",
    microserviceKey: "ms:invoicing-pos",
    tablePrefix: "pos_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/shifts",
        description: "Consultar turnos de caja POS en la sucursal activa",
        handler: async (ctx) => useCases.listShifts(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "POST",
        subPath: "/checkout",
        description: "Procesar venta en Caja POS calculando totales exactos NUMERIC(19, 4)",
        handler: async (ctx, req) => useCases.checkout(
          ctx.tenantId,
          ctx.activeBranchId,
          ctx.claims.services["srv:invoicing"] ?? [],
          req.body ?? {}
        )
      }
    ]
  });
}
var msInvoicingPosPlugin = buildInvoicingPosPlugin();

// apps/srv-invoicing/ms-invoicing-quotes/src/domain.ts
function buildValidatedCommercialQuote(tenantId, branchId, input) {
  if (typeof input.contactId !== "string" || input.contactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "contactId" is required.'
    );
  }
  if (typeof input.quoteNumber !== "string" || input.quoteNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "quoteNumber" is required.'
    );
  }
  const totalAmount = MoneyDecimal.from(input.totalAmount).assertPositive("totalAmount").toFixed4();
  return {
    tenantId,
    branchId,
    contactId: input.contactId.trim(),
    quoteNumber: input.quoteNumber.trim(),
    totalAmount,
    status: "OPEN"
  };
}

// apps/srv-invoicing/ms-invoicing-quotes/src/application.ts
var InvoicingQuotesUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listQuotes(tenantId, branchId) {
    const quotes = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_invoicing",
      table: "quo_quotes",
      quotes
    };
  }
  async createQuote(tenantId, branchId, dto) {
    const quote = buildValidatedCommercialQuote(tenantId, branchId, dto);
    return this.repository.saveQuote(quote);
  }
};

// apps/srv-invoicing/ms-invoicing-quotes/src/infrastructure.ts
var quoQuotesTable = srvInvoicingSchema.table("quo_quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  contactId: varchar("contact_id", { length: 64 }).notNull(),
  quoteNumber: varchar("quote_number", { length: 32 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 19, scale: 4 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("OPEN"),
  // OPEN | CONVERTED_TO_INVOICE | EXPIRED
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryInvoicingQuotesRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    return [...this.store.get(`${tenantId}:${branchId}`) ?? []];
  }
  async saveQuote(quote) {
    const key = `${quote.tenantId}:${quote.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(quote);
    this.store.set(key, list);
    return quote;
  }
};

// apps/srv-invoicing/ms-invoicing-quotes/src/index.ts
function buildInvoicingQuotesPlugin(repository = new InMemoryInvoicingQuotesRepositoryAdapter()) {
  const useCases = new InvoicingQuotesUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:invoicing",
    microserviceKey: "ms:invoicing-quotes",
    tablePrefix: "quo_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/quotes",
        description: "Listar cotizaciones y remisiones comerciales",
        handler: async (ctx) => useCases.listQuotes(ctx.tenantId, ctx.activeBranchId)
      },
      {
        method: "POST",
        subPath: "/quotes",
        description: "Crear cotizaci\xF3n comercial convertible en factura con 1 clic",
        handler: async (ctx, req) => useCases.createQuote(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      }
    ]
  });
}
var msInvoicingQuotesPlugin = buildInvoicingQuotesPlugin();

// apps/srv-invoicing/ms-invoicing-simple-receipt/src/domain.ts
function buildValidatedSimpleReceipt(tenantId, branchId, input) {
  if (typeof input.consecutiveNumber !== "string" || input.consecutiveNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "consecutiveNumber" is required.'
    );
  }
  if (typeof input.customerName !== "string" || input.customerName.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "customerName" is required.'
    );
  }
  const totalAmount = MoneyDecimal.from(input.totalAmount).assertPositive("totalAmount").toFixed4();
  return {
    tenantId,
    branchId,
    consecutiveNumber: input.consecutiveNumber.trim(),
    customerName: input.customerName.trim(),
    totalAmount,
    documentType: "SIMPLE_NON_FISCAL_RECEIPT"
  };
}

// apps/srv-invoicing/ms-invoicing-simple-receipt/src/application.ts
var InvoicingSimpleReceiptUseCases = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  async listReceipts(tenantId, branchId, isReadonlyArchive) {
    const receipts = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: "srv_invoicing",
      table: "rcp_simple_receipts",
      isReadonlyArchive,
      receipts
    };
  }
  async emitReceipt(tenantId, branchId, dto) {
    const receipt = buildValidatedSimpleReceipt(tenantId, branchId, dto);
    return this.repository.saveReceipt(receipt);
  }
};

// apps/srv-invoicing/ms-invoicing-simple-receipt/src/infrastructure.ts
var rcpSimpleReceiptsTable = srvInvoicingSchema.table("rcp_simple_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: varchar("branch_id", { length: 64 }).notNull(),
  consecutiveNumber: varchar("consecutive_number", { length: 32 }).notNull(),
  customerName: varchar("customer_name", { length: 180 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 19, scale: 4 }).notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow()
});
var InMemoryInvoicingSimpleReceiptRepositoryAdapter = class {
  store = /* @__PURE__ */ new Map();
  async listByTenantAndBranch(tenantId, branchId) {
    const key = `${tenantId}:${branchId}`;
    const existing = this.store.get(key);
    if (!existing || existing.length === 0) {
      return [
        {
          tenantId,
          branchId,
          consecutiveNumber: "RCP-0001",
          customerName: "Consumidor General",
          totalAmount: "45000.0000",
          documentType: "SIMPLE_NON_FISCAL_RECEIPT",
          status: "HISTORICAL_ARCHIVED"
        }
      ];
    }
    return [...existing];
  }
  async saveReceipt(receipt) {
    const key = `${receipt.tenantId}:${receipt.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(receipt);
    this.store.set(key, list);
    return receipt;
  }
};

// apps/srv-invoicing/ms-invoicing-simple-receipt/src/index.ts
function buildInvoicingSimpleReceiptPlugin(repository = new InMemoryInvoicingSimpleReceiptRepositoryAdapter()) {
  const useCases = new InvoicingSimpleReceiptUseCases(repository);
  return defineProvekoMicroservice({
    parentService: "srv:invoicing",
    microserviceKey: "ms:invoicing-simple-receipt",
    tablePrefix: "rcp_",
    version: "1.0.0",
    routes: [
      {
        method: "GET",
        subPath: "/receipts",
        description: "Consultar recibos simples hist\xF3ricos (permitido incluso en READONLY_ARCHIVE)",
        handler: async (ctx) => useCases.listReceipts(ctx.tenantId, ctx.activeBranchId, ctx.isReadonlyArchive)
      },
      {
        method: "POST",
        subPath: "/receipts",
        description: "Emitir recibo simple no fiscal (bloqueado autom\xE1ticamente si est\xE1 en READONLY_ARCHIVE)",
        handler: async (ctx, req) => useCases.emitReceipt(
          ctx.tenantId,
          ctx.activeBranchId,
          req.body ?? {}
        )
      }
    ]
  });
}
var msInvoicingSimpleReceiptPlugin = buildInvoicingSimpleReceiptPlugin();

// apps/srv-invoicing/host-runner/src/index.ts
function createSrvInvoicingHostRunner(guard, enabledMicroservicesEnv, hostNodeId = "host-runner:srv:invoicing") {
  return new ParentServiceHostRunner(
    "srv:invoicing",
    guard,
    [
      msInvoicingPosPlugin,
      msInvoicingSimpleReceiptPlugin,
      msInvoicingElectronicDianPlugin,
      msInvoicingQuotesPlugin
    ],
    enabledMicroservicesEnv,
    hostNodeId
  );
}

// apps/srv-appointments/frontend/appointments-service.view.ts
var SRV_APPOINTMENTS_FRONTEND_VIEW = {
  serviceKey: "srv-appointments",
  externalPrincipalModuleName: "Agendamiento, Turnos y Recordatorios IA (v2)",
  icon: "\u{1F4C5}",
  subtitle: "Motor de agendas multi-profesional y consultorios/recursos estilo v2, recordatorios interactivos WhatsApp IA y turnador.",
  standaloneMonthlyUsd: 135e3,
  submodules: [
    {
      moduleKey: "mod-calendar-slots",
      parentServiceKey: "srv-appointments",
      externalSubmoduleName: "Agenda Multi-Profesional y Recursos (v2)",
      tabIcon: "\u{1F5D3}\uFE0F",
      summary: "Calendario por bloques horarios, asignaci\xF3n de sala/consultorio/bah\xEDa, control de inasistencias y estados de cita.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Agendar Cita / Bloque Horario",
      tableHeaders: ["C\xF3digo Cita", "Cliente / Usuario", "Profesional / Recurso", "Fecha y Hora", "Servicio Programado"],
      fields: [
        { key: "appointmentCode", label: "C\xF3digo de Cita", type: "text", placeholder: "CIT-2026-0412" },
        { key: "customerName", label: "Cliente / Usuario y WhatsApp", type: "text", placeholder: "Laura Valentina R\xEDos \u2014 315 884 1200" },
        { key: "specialistResource", label: "Profesional y Sala / Consultorio", type: "select", options: ["Dr. Alejandro Mej\xEDa \u2014 Consultorio 201", "Esp. Camila Pineda \u2014 Cabina 02", "Ing. Mateo G\xF3mez \u2014 Bah\xEDa Diagn\xF3stico 01"] },
        { key: "slotDateTime", label: "Fecha y Bloque Horario", type: "text", placeholder: "2026-11-12 09:30 AM (45 min)" },
        { key: "serviceName", label: "Servicio / Procedimiento Agendado", type: "text", placeholder: "Valoraci\xF3n Especializada Integral" }
      ]
    },
    {
      moduleKey: "mod-staff-schedules",
      parentServiceKey: "srv-appointments",
      externalSubmoduleName: "Mallas Horarias, Bloqueos y Excepciones",
      tabIcon: "\u23F0",
      summary: "Configuraci\xF3n de turnos semanales por especialista, vacaciones, permisos y tiempos de alistamiento.",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "Publicar Malla Horaria",
      tableHeaders: ["Especialista", "Sede / Consultorio", "Franja Horaria", "Duraci\xF3n Bloque (min)", "Estado Malla"],
      fields: [
        { key: "specialistName", label: "Profesional / Especialista", type: "text", placeholder: "Dr. Alejandro Mej\xEDa" },
        { key: "branchRoom", label: "Sede y Recurso F\xEDsico", type: "select", options: ["Sede Principal \u2014 Consultorio 201", "Sede Norte \u2014 Sala Especial 03", "Atenci\xF3n Virtual Teleconsulta"] },
        { key: "workDaysSchedule", label: "D\xEDas y Franja Horaria", type: "text", placeholder: "Lunes a Viernes 07:00 AM - 05:00 PM" },
        { key: "slotDurationMin", label: "Duraci\xF3n por Cita (Minutos)", type: "number", placeholder: "30" }
      ]
    },
    {
      moduleKey: "mod-interactive-reminders",
      parentServiceKey: "srv-appointments",
      externalSubmoduleName: "Recordatorios Interactivos WhatsApp / Email",
      tabIcon: "\u{1F4AC}",
      summary: "Env\xEDo automatizado 24h y 2h antes con botones interactivos para Confirmar, Cancelar o Reprogramar en vivo.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Disparar Recordatorio Interactivo",
      tableHeaders: ["Env\xEDo #", "Destinatario", "Canal", "Respuesta Cliente", "Estado Cupo"],
      fields: [
        { key: "notificationCode", label: "C\xF3digo de Notificaci\xF3n", type: "text", placeholder: "WSP-2026-8812" },
        { key: "customerName", label: "Cliente y Tel\xE9fono", type: "text", placeholder: "Laura Valentina R\xEDos \u2014 +57 3158841200" },
        { key: "channel", label: "Canal de Recordatorio", type: "select", options: ["WhatsApp Interactivo IA (24h/2h)", "Correo Electr\xF3nico + ICS", "SMS Transaccional"] },
        { key: "clientResponse", label: "Acci\xF3n del Usuario", type: "select", options: ["Confirmada por WhatsApp", "Solicit\xF3 Reprogramar", "Cancelada \u2014 Cupo Liberado"] }
      ]
    },
    {
      moduleKey: "mod-queue-turnador",
      parentServiceKey: "srv-appointments",
      externalSubmoduleName: "Sala de Espera, Check-In QR y Turnador TV",
      tabIcon: "\u{1F4FA}",
      summary: "Registro de llegada en kiosco o QR, llamado en pantalla de sala de espera por m\xF3dulo y m\xE9trica de espera.",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "Llamar Siguiente Turno en Pantalla",
      tableHeaders: ["Turno Sala", "Cliente en Espera", "M\xF3dulo / Consultorio", "Espera (Min)", "Estado Llamado"],
      fields: [
        { key: "turnTicket", label: "C\xF3digo de Turno", type: "text", placeholder: "A-042 (Prioritario)" },
        { key: "customerName", label: "Nombre en Sala de Espera", type: "text", placeholder: "Jorge Enrique Vargas" },
        { key: "deskModule", label: "Consultorio / Ventanilla que Llama", type: "select", options: ["Consultorio 201", "Recepci\xF3n Admisiones 01", "Sala de Procedimientos 02"] },
        { key: "waitingMinutes", label: "Minutos en Sala de Espera", type: "number", placeholder: "8" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-overbooking-guard",
      externalName: "Candado anti-cruce de profesional y consultorio/sala",
      description: "Bloquea colisiones simult\xE1neas de especialista o recurso f\xEDsico al reservar o reprogramar citas.",
      parentModuleKey: "mod-calendar-slots",
      includedByDefault: true,
      monthlyAddonUsd: 19e3
    },
    {
      componentKey: "comp-whatsapp-ai-reschedule",
      externalName: "Auto-reprogramaci\xF3n conversacional por WhatsApp IA",
      description: "Libera el cupo autom\xE1ticamente al cancelar y ofrece 3 nuevos horarios disponibles al cliente.",
      parentModuleKey: "mod-interactive-reminders",
      includedByDefault: true,
      monthlyAddonUsd: 25e3
    }
  ]
};

// apps/srv-crm/frontend/crm-service.view.ts
var SRV_CRM_FRONTEND_VIEW = {
  serviceKey: "srv-crm",
  externalPrincipalModuleName: "Clientes, Proveedores, Contratos (v2) y CRM 360",
  icon: "\u{1F91D}",
  subtitle: "Directorio maestro estilo v2 (NIT+DV, DANE, sucursales), contratos con bolsa presupuestal, LTV 360\xB0 y fidelizaci\xF3n.",
  standaloneMonthlyUsd: 115e3,
  submodules: [
    {
      moduleKey: "mod-directory",
      parentServiceKey: "srv-crm",
      externalSubmoduleName: "Listado de Clientes y Terceros (v2)",
      tabIcon: "\u{1F4C7}",
      summary: "Directorio completo estilo version2: identificaci\xF3n NIT+DV, responsabilidades DIAN, DANE, sucursales y cupo de cr\xE9dito.",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "Guardar Cliente / Tercero en BD",
      tableHeaders: ["NIT / Documento", "Raz\xF3n Social / Nombre", "Tipo de Tercero", "Ciudad / Tel\xE9fono", "Cupo Aprobado (COP)"],
      fields: [
        { key: "docType", label: "Tipo de Documento", type: "select", options: ["NIT Empresarial", "C\xE9dula de Ciudadan\xEDa (CC)", "C\xE9dula de Extranjer\xEDa (CE)", "Pasaporte"] },
        { key: "taxId", label: "N\xFAmero NIT / Documento (Con DV)", type: "text", placeholder: "900.812.441-9" },
        { key: "legalName", label: "Raz\xF3n Social o Nombre Completo", type: "text", placeholder: "Distribuidora del Caribe S.A.S." },
        { key: "partyRole", label: "Clasificaci\xF3n del Tercero", type: "select", options: ["Cliente Corporativo", "Cliente Frecuente / Mostrador", "Proveedor de Insumos", "Empresa Transportista", "Cliente y Proveedor"] },
        { key: "taxRegime", label: "R\xE9gimen Tributario DIAN", type: "select", options: ["Responsable de IVA (R\xE9gimen Com\xFAn)", "No Responsable de IVA", "Gran Contribuyente", "R\xE9gimen Simple RST"] },
        { key: "cityPhone", label: "Ciudad DANE, Direcci\xF3n y WhatsApp", type: "text", placeholder: "Barranquilla (08001) \u2014 300 412 8890" },
        { key: "billingEmail", label: "Correo Recepci\xF3n Factura Electr\xF3nica", type: "text", placeholder: "facturacion@empresa.co" },
        { key: "paymentTerm", label: "Condici\xF3n y Plazo de Pago", type: "select", options: ["Contado Inmediato", "Cr\xE9dito 15 D\xEDas", "Cr\xE9dito 30 D\xEDas", "Cr\xE9dito 60 D\xEDas"] },
        { key: "creditLimit", label: "Cupo de Cr\xE9dito Aprobado ($ COP)", type: "number", placeholder: "15000000" }
      ]
    },
    {
      moduleKey: "mod-contracts",
      parentServiceKey: "srv-crm",
      externalSubmoduleName: "Contratos Comerciales y Bolsas Presupuestales (v2)",
      tabIcon: "\u{1F4DC}",
      summary: "Convenios corporativos estilo EmpresaContrato v2 con techo presupuestal, consumo acumulado, vigencias y p\xF3lizas.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Crear / Actualizar Contrato Corporativo",
      tableHeaders: ["N\xB0 Contrato", "Empresa / Convenio", "Vigencia", "Techo Presupuestal", "Saldo Disponible (COP)"],
      fields: [
        { key: "contractNumber", label: "N\xFAmero de Contrato / Convenio", type: "text", placeholder: "CNT-2026-0084" },
        { key: "companyName", label: "Empresa Contratante", type: "text", placeholder: "Grupo Industrial del Pac\xEDfico S.A." },
        { key: "validityRange", label: "Vigencia Inicial \u2014 Final", type: "text", placeholder: "2026-01-01 a 2026-12-31" },
        { key: "budgetCeiling", label: "Bolsa / Techo Presupuestal ($ COP)", type: "number", placeholder: "120000000" },
        { key: "availableBalance", label: "Saldo Disponible Actual ($ COP)", type: "number", placeholder: "84500000" }
      ]
    },
    {
      moduleKey: "mod-customer-360",
      parentServiceKey: "srv-crm",
      externalSubmoduleName: "Expediente 360\xB0 LTV y Segmentaci\xF3n RFM",
      tabIcon: "\u{1F3AF}",
      summary: "M\xE9tricas tipo FixMotor: valor hist\xF3rico comprado (LTV), ticket promedio, frecuencia de visita y alerta de inactividad.",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "Actualizar Ficha 360\xB0 y Segmento",
      tableHeaders: ["Cliente", "Segmento RFM", "Total Hist\xF3rico LTV", "Ticket Promedio", "D\xEDas Sin Compra"],
      fields: [
        { key: "customerName", label: "Cliente Analizado", type: "text", placeholder: "Inversiones automotrices del Norte" },
        { key: "rfmSegment", label: "Segmento RFM", type: "select", options: ["Campe\xF3n VIP (Alta Frecuencia)", "Leal Recurrente", "En Riesgo de Fuga (>60 d\xEDas)", "Nuevo Cliente"] },
        { key: "lifetimeValueCop", label: "LTV Hist\xF3rico Acumulado ($ COP)", type: "number", placeholder: "42800000" },
        { key: "avgTicketCop", label: "Ticket Promedio ($ COP)", type: "number", placeholder: "1850000" }
      ]
    },
    {
      moduleKey: "mod-pipelines",
      parentServiceKey: "srv-crm",
      externalSubmoduleName: "Oportunidades y Embudo Comercial",
      tabIcon: "\u{1F4C8}",
      summary: "Seguimiento de negocios en negociaci\xF3n, etapa comercial, ejecutivo asignado y cierre esperado.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Registrar Oportunidad",
      tableHeaders: ["Negocio", "Cliente Prospecto", "Etapa del Embudo", "Ejecutivo", "Valor Estimado"],
      fields: [
        { key: "dealTitle", label: "Nombre del Negocio / Contrato", type: "text", placeholder: "Suministro Mensual Dotaci\xF3n Industrial" },
        { key: "prospectName", label: "Empresa Prospecto", type: "text", placeholder: "Ingenios Unidos S.A." },
        { key: "stage", label: "Etapa Actual", type: "select", options: ["Contacto Inicial", "Propuesta Enviada", "Negociaci\xF3n Final", "Ganada / Cerrada"] },
        { key: "expectedValue", label: "Valor Estimado ($ COP)", type: "number", placeholder: "18500000" }
      ]
    },
    {
      moduleKey: "mod-loyalty",
      parentServiceKey: "srv-crm",
      externalSubmoduleName: "Fidelizaci\xF3n, Puntos y Cashback",
      tabIcon: "\u2B50",
      summary: "Acumulaci\xF3n y redenci\xF3n de puntos por compras frecuentes y categor\xEDas de cliente.",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "Acreditar / Redimir Puntos",
      tableHeaders: ["Cliente", "Categor\xEDa", "Puntos Acumulados", "\xDAltima Compra", "Beneficio Activo"],
      fields: [
        { key: "memberName", label: "Cliente Afiliado", type: "text", placeholder: "Diana Marcela Pineda" },
        { key: "tierLevel", label: "Nivel de Fidelidad", type: "select", options: ["Oro Preferencial", "Plata", "Bronce"] },
        { key: "pointsBalance", label: "Puntos a Registrar", type: "number", placeholder: "1250" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-nit-dv-auto",
      externalName: "C\xE1lculo autom\xE1tico de D\xEDgito de Verificaci\xF3n NIT (M\xF3dulo 11 DIAN)",
      description: "Calcula autom\xE1ticamente el DV fiscal al registrar clientes, proveedores o transportistas.",
      parentModuleKey: "mod-directory",
      includedByDefault: true,
      monthlyAddonUsd: 15e3
    },
    {
      componentKey: "comp-credit-quota-lock",
      externalName: "Bloqueo autom\xE1tico de despacho por cupo de cr\xE9dito o mora",
      description: "Impide facturar a cr\xE9dito cuando el cliente supera su cupo aprobado o presenta facturas vencidas.",
      parentModuleKey: "mod-directory",
      includedByDefault: true,
      monthlyAddonUsd: 19e3
    },
    {
      componentKey: "comp-contract-budget-alert",
      externalName: "Alerta de agotamiento de bolsa presupuestal de contrato (v2)",
      description: "Notifica cuando el consumo acumulado de un convenio supera el 80% del techo contratado.",
      parentModuleKey: "mod-contracts",
      includedByDefault: true,
      monthlyAddonUsd: 19e3
    }
  ]
};

// apps/srv-finance/frontend/finance-service.view.ts
var SRV_FINANCE_FRONTEND_VIEW = {
  serviceKey: "srv-finance",
  externalPrincipalModuleName: "Contabilidad NIIF, PUC, Activos Fijos y Ex\xF3gena DIAN",
  icon: "\u{1F4D8}",
  subtitle: "Plan \xDAnico de Cuentas PUC Colombia, asientos contables, centros de costo, activos fijos y medios magn\xE9ticos Ex\xF3gena DIAN.",
  standaloneMonthlyUsd: 139e3,
  submodules: [
    {
      moduleKey: "mod-puc",
      parentServiceKey: "srv-finance",
      externalSubmoduleName: "Plan \xDAnico de Cuentas (PUC) y Comprobantes",
      tabIcon: "\u{1F4D8}",
      summary: "Comprobantes de diario, causaci\xF3n autom\xE1tica por cuenta PUC de 6-8 d\xEDgitos y validaci\xF3n de partida doble.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Asentar Comprobante Contable",
      tableHeaders: ["Asiento", "Cuenta PUC", "Tercero NIT", "Detalle", "D\xE9bito / Cr\xE9dito", "Estado"],
      fields: [
        { key: "pucCode", label: "Cuenta Contable PUC", type: "select", options: ["110505 - Caja General", "130505 - Clientes Nacionales", "220501 - Proveedores Nacionales", "236540 - ReteFuente Compras 2.5%", "413501 - Comercio al por Mayor y Menor"] },
        { key: "thirdPartyNit", label: "NIT Tercero", type: "text", placeholder: "900.412.110-1" },
        { key: "entryDetail", label: "Concepto Contable", type: "text", placeholder: "Causaci\xF3n Factura de Venta FEV-1042" },
        { key: "entryAmount", label: "Valor Asiento ($ COP)", type: "number", placeholder: "2350000" }
      ]
    },
    {
      moduleKey: "mod-cashbook",
      parentServiceKey: "srv-finance",
      externalSubmoduleName: "Libro de Caja, Bancos y Movimientos",
      tabIcon: "\u{1F4B5}",
      summary: "Ingresos, egresos contables, arqueo de turno y saldos conciliados en cuentas bancarias.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Registrar Movimiento Contable",
      tableHeaders: ["Comprobante", "Cuenta / Caja", "Tipo", "Concepto", "Firma Encargado", "Monto"],
      fields: [
        { key: "accountName", label: "Caja o Cuenta Bancaria", type: "select", options: ["Caja General Principal", "Bancolombia Cuenta Corriente", "Davivienda Recaudos"] },
        { key: "movementType", label: "Naturaleza", type: "select", options: ["Ingreso / Recaudo", "Egreso / Pago", "Traslado entre Cuentas"] },
        { key: "concept", label: "Concepto del Movimiento", type: "text", placeholder: "Pago Flete Transporte Nacional" },
        { key: "managerSignature", label: "Firma de Encargado que Autoriza", type: "text", placeholder: "Autorizado: Tesorer\xEDa General", requiredFeatureKey: "comp-manager-signature" },
        { key: "amount", label: "Valor del Movimiento ($ COP)", type: "number", placeholder: "890000" }
      ]
    },
    {
      moduleKey: "mod-arap",
      parentServiceKey: "srv-finance",
      externalSubmoduleName: "Auxiliar de Cartera Fiscal CxC y CxP",
      tabIcon: "\u{1F4D1}",
      summary: "Saldos contables por tercero para cruce de cuentas 1305 (Clientes) y 2205/2335 (Proveedores y Costos por Pagar).",
      monthlyAddonUsd: 42e3,
      actionButtonLabel: "Registrar Cruce / Obligaci\xF3n",
      tableHeaders: ["Documento", "Tercero", "Tipo de Cartera", "Vencimiento", "Saldo Pendiente", "Estado"],
      fields: [
        { key: "thirdParty", label: "Cliente o Proveedor", type: "text", placeholder: "Agroinsumos del Norte S.A.S." },
        { key: "ledgerType", label: "Tipo de Cartera", type: "select", options: ["Cuenta por Cobrar (Cliente)", "Cuenta por Pagar (Proveedor)"] },
        { key: "dueDate", label: "Fecha de Vencimiento", type: "date" },
        { key: "balanceAmount", label: "Valor / Abono ($ COP)", type: "number", placeholder: "4200000" }
      ]
    },
    {
      moduleKey: "mod-cost-centers",
      parentServiceKey: "srv-finance",
      externalSubmoduleName: "Centros y Subcentros de Costo / Proyectos",
      tabIcon: "\u{1F3D7}\uFE0F",
      summary: "Contabilidad anal\xEDtica por sede, unidad de negocio, proyecto o veh\xEDculo para medir rentabilidad real.",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "Crear / Imputar Centro de Costo",
      tableHeaders: ["C\xF3digo CC", "Centro de Costo / Proyecto", "Sede", "Presupuesto Mensual", "Ejecutado ($ COP)"],
      fields: [
        { key: "costCenterCode", label: "C\xF3digo Centro de Costo", type: "text", placeholder: "CC-200-LOGISTICA" },
        { key: "costCenterName", label: "Nombre del Centro o Proyecto", type: "text", placeholder: "Operaci\xF3n Planta Norte y Distribuci\xF3n" },
        { key: "monthlyBudget", label: "Presupuesto Mensual ($ COP)", type: "number", placeholder: "45000000" },
        { key: "executedAmount", label: "Ejecuci\xF3n Acumulada ($ COP)", type: "number", placeholder: "31800000" }
      ]
    },
    {
      moduleKey: "mod-fixed-assets",
      parentServiceKey: "srv-finance",
      externalSubmoduleName: "Activos Fijos y Depreciaci\xF3n NIIF",
      tabIcon: "\u{1F3E2}",
      summary: "Hoja de vida de maquinaria, veh\xEDculos y equipos con c\xE1lculo mensual autom\xE1tico de depreciaci\xF3n NIIF.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Registrar Activo Fijo / Depreciar",
      tableHeaders: ["Placa Activo", "Descripci\xF3n del Bien", "Vida \xDAtil (Meses)", "Costo Hist\xF3rico", "Valor Neto Libros (COP)"],
      fields: [
        { key: "assetTag", label: "Placa / C\xF3digo de Activo Fijo", type: "text", placeholder: "AF-MAQ-0042" },
        { key: "assetDescription", label: "Nombre del Activo", type: "text", placeholder: "Montacargas El\xE9ctrico Toyota 2.5 Ton" },
        { key: "usefulLifeMonths", label: "Vida \xDAtil NIIF (Meses)", type: "number", placeholder: "60" },
        { key: "acquisitionCost", label: "Costo de Adquisici\xF3n ($ COP)", type: "number", placeholder: "95000000" }
      ]
    },
    {
      moduleKey: "mod-exogena-taxes",
      parentServiceKey: "srv-finance",
      externalSubmoduleName: "Certificados de Retenci\xF3n y Ex\xF3gena DIAN (1001-1009)",
      tabIcon: "\u{1F3DB}\uFE0F",
      summary: "Generaci\xF3n de formatos de Informaci\xF3n Ex\xF3gena DIAN (1001, 1003, 1005, 1006, 1007, 1008, 1009) y certificados.",
      monthlyAddonUsd: 49e3,
      actionButtonLabel: "Generar Formato Ex\xF3gena / Certificado",
      tableHeaders: ["Formato DIAN", "Concepto Fiscal", "Terceros Reportados", "A\xF1o Gravable", "Total Reportado (COP)"],
      fields: [
        { key: "exogenaFormat", label: "Formato Medios Magn\xE9ticos DIAN", type: "select", options: ["Formato 1001 \u2014 Pagos y Retenciones Practicadas", "Formato 1007 \u2014 Ingresos Recibidos", "Formato 1008 \u2014 Saldo Cuentas por Cobrar", "Formato 1009 \u2014 Saldo Cuentas por Pagar", "Certificado Anual de Retenci\xF3n en la Fuente"] },
        { key: "dianConceptCode", label: "Concepto DIAN", type: "text", placeholder: "5004 \u2014 Compra de Activos Movibles / Inventarios" },
        { key: "reportedThirdParties", label: "Cantidad de NITs Incluidos", type: "number", placeholder: "128" },
        { key: "totalReportedCop", label: "Monto Total Reportado ($ COP)", type: "number", placeholder: "845000000" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-withholding-calc",
      externalName: "Motor autom\xE1tico de ReteFuente, ReteIVA, ReteICA y Autorretenci\xF3n por topes UVT",
      description: "Calcula autom\xE1ticamente las retenciones seg\xFAn el r\xE9gimen tributario del emisor y del tercero.",
      parentModuleKey: "mod-puc",
      includedByDefault: true,
      monthlyAddonUsd: 25e3
    }
  ]
};

// apps/srv-fleet/frontend/fleet-service.view.ts
var SRV_FLEET_FRONTEND_VIEW = {
  serviceKey: "srv-fleet",
  externalPrincipalModuleName: "Flotas, B\xE1scula Camionera y RNDC",
  icon: "\u{1F69B}",
  subtitle: "B\xE1scula camionera RS-232 (Bruto/Tara/Neto), manifiestos RNDC Ministerio de Transporte, anticipos de viaje y control de llantas.",
  standaloneMonthlyUsd: 165e3,
  submodules: [
    {
      moduleKey: "mod-fleet-scale",
      parentServiceKey: "srv-fleet",
      externalSubmoduleName: "B\xE1scula Camionera RS-232 y Destare de Flota",
      tabIcon: "\u2696\uFE0F",
      summary: "Pesaje camionero Bruto / Tara / Neto en kilogramos y toneladas, descuento por humedad/impureza y transportista.",
      monthlyAddonUsd: 65e3,
      actionButtonLabel: "Emitir Tiquete de B\xE1scula",
      tableHeaders: ["Tiquete", "Placa / Remolque", "Transportista / Conductor", "Peso Bruto", "Peso Tara", "Peso Neto"],
      hasTruckScaleWeighbridge: true,
      fields: [
        { key: "truckPlate", label: "Placa Cabezote / Remolque", type: "text", placeholder: "SXT-942 / R-4481" },
        { key: "driverName", label: "Conductor y C\xE9dula", type: "text", placeholder: "Hernando Valencia \u2014 CC 79.412.880" },
        {
          key: "carrierCompany",
          label: "Seleccionar Transportista",
          type: "select",
          options: ["TransCarga Pesada de Colombia", "Cooperativa de Tractomulas del Sur", "Particular / Flota Propia"],
          requiredFeatureKey: "comp-carrier-select"
        },
        { key: "cargoType", label: "Carga y Muelle Asignado", type: "text", placeholder: "Granel Ma\xEDz Amarillo \u2014 Muelle 3" }
      ]
    },
    {
      moduleKey: "mod-fleet-dispatch-rndc",
      parentServiceKey: "srv-fleet",
      externalSubmoduleName: "Despachos, Remesas y Manifiestos RNDC",
      tabIcon: "\u{1F6E3}\uFE0F",
      summary: "Emisi\xF3n de remesas terrestres de carga, manifiestos electr\xF3nicos RNDC, conductores y piso SICETAC.",
      monthlyAddonUsd: 55e3,
      actionButtonLabel: "Radicar Manifiesto RNDC",
      tableHeaders: ["Manifiesto RNDC", "Ruta Origen \u2192 Destino", "Tractomula / Remolque", "Conductor", "Flete Pactado ($ COP)"],
      fields: [
        { key: "manifestCode", label: "Consecutivo Manifiesto RNDC", type: "text", placeholder: "MN-2026-08841" },
        { key: "routeDetail", label: "Ruta Origen \u2192 Destino (DANE)", type: "text", placeholder: "Buenaventura (Valle) \u2192 Bogot\xE1 D.C." },
        { key: "vehiclePlate", label: "Placa Cabezote y Tr\xE1iler", type: "text", placeholder: "WXY-812 / R-5520" },
        { key: "driverName", label: "Conductor Asignado", type: "text", placeholder: "\xC1lvaro G\xF3mez \u2014 Lic. C3" },
        { key: "agreedFreight", label: "Valor Flete Pactado ($ COP)", type: "number", placeholder: "4850000" }
      ]
    },
    {
      moduleKey: "mod-trip-settlements",
      parentServiceKey: "srv-fleet",
      externalSubmoduleName: "Anticipos de Viaje, Peajes, ACPM y Liquidaci\xF3n",
      tabIcon: "\u26FD",
      summary: "Legalizaci\xF3n de anticipos de conductores, peajes, ACPM (rendimiento Km/Gal\xF3n), vi\xE1ticos y cumplido de remesa.",
      monthlyAddonUsd: 49e3,
      actionButtonLabel: "Liquidar Viaje y Cumplido",
      tableHeaders: ["Liquidaci\xF3n", "Manifiesto", "Anticipos Giro", "Peajes + ACPM + Vi\xE1ticos", "Saldo a Pagar ($ COP)"],
      fields: [
        { key: "settlementCode", label: "N\xB0 Liquidaci\xF3n de Viaje", type: "text", placeholder: "LIQ-V-2026-310" },
        { key: "manifestRef", label: "Manifiesto RNDC Cumplido", type: "text", placeholder: "MN-2026-08841" },
        { key: "advancePaid", label: "Anticipo Entregado ($ COP)", type: "number", placeholder: "2200000" },
        { key: "tollsAndFuel", label: "Total Peajes + ACPM (Galones)", type: "text", placeholder: "18 Peajes + 145 Gal ACPM ($1.950.000)" },
        { key: "netBalance", label: "Saldo Neto Propietario ($ COP)", type: "number", placeholder: "2601500" }
      ]
    },
    {
      moduleKey: "mod-tires-fleet-maint",
      parentServiceKey: "srv-fleet",
      externalSubmoduleName: "Control de Llantas por Eje, SOAT y Tecnomec\xE1nica",
      tabIcon: "\u{1F6DE}",
      summary: "Mapa de llantas por posici\xF3n de eje, profundidad de labrado (mm), reencauches y alertas SOAT/Tecnomec\xE1nica.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Registrar Inspecci\xF3n de Llanta / Veh\xEDculo",
      tableHeaders: ["Serial Llanta", "Placa / Posici\xF3n Eje", "Labrado (mm)", "Km Acumulados", "Estado / SOAT"],
      fields: [
        { key: "tireSerial", label: "Serial de Llanta / Marca", type: "text", placeholder: "MICH-295-80R22-991" },
        { key: "axlePosition", label: "Veh\xEDculo y Posici\xF3n de Eje", type: "select", options: ["Eje 1 Direccional Izq", "Eje 1 Direccional Der", "Eje 2 Tracci\xF3n Ext", "Tr\xE1iler Eje 3 Int"] },
        { key: "treadDepthMm", label: "Profundidad Labrado (mm)", type: "text", placeholder: "8.5 mm (\xD3ptimo)" },
        { key: "accumulatedKm", label: "Kil\xF3metros Acumulados", type: "number", placeholder: "64200" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-weighbridge-humidity-discount",
      externalName: "Descuento autom\xE1tico por humedad e impureza en b\xE1scula camionera",
      description: "Resta autom\xE1ticamente el porcentaje de humedad e impureza de laboratorio sobre el peso neto destarado.",
      parentModuleKey: "mod-fleet-scale",
      includedByDefault: true,
      monthlyAddonUsd: 25e3
    },
    {
      componentKey: "comp-rndc-manifest-sync",
      externalName: "Validaci\xF3n SICETAC y Radicaci\xF3n RNDC Ministerio de Transporte",
      description: "Verifica piso tarifario SICETAC, retenci\xF3n 1% transporte y radicaci\xF3n de manifiesto de carga.",
      parentModuleKey: "mod-fleet-dispatch-rndc",
      includedByDefault: true,
      monthlyAddonUsd: 25e3
    }
  ]
};

// apps/srv-gastro/frontend/gastro-service.view.ts
var SRV_GASTRO_FRONTEND_VIEW = {
  serviceKey: "srv-gastro",
  externalPrincipalModuleName: "Restaurantes, Bares, Comandas KDS y Domicilios",
  icon: "\u{1F37D}\uFE0F",
  subtitle: "Sal\xF3n y barras, comandas KDS por estaci\xF3n, carta con modificadores, divisi\xF3n de cuentas y despacho de domicilios.",
  standaloneMonthlyUsd: 129e3,
  submodules: [
    {
      moduleKey: "mod-tables",
      parentServiceKey: "srv-gastro",
      externalSubmoduleName: "Sal\xF3n, Barras y Mapa de Mesas",
      tabIcon: "\u{1FA91}",
      summary: "Ocupaci\xF3n de mesas por terraza o sal\xF3n, comensales activos, medidas de licor y asignaci\xF3n de mesero.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Abrir / Actualizar Mesa",
      tableHeaders: ["Mesa / Zona", "Comensales", "Mesero Asignado", "Consumo Acumulado", "Estado"],
      fields: [
        { key: "tableCode", label: "Mesa y Zona", type: "select", options: ["Mesa 01 \u2014 Sal\xF3n Principal", "Mesa 05 \u2014 Terraza", "Mesa 12 \u2014 VIP", "Barra Principal 02"] },
        { key: "guestsCount", label: "N\xFAmero de Comensales", type: "number", placeholder: "4" },
        { key: "waiterName", label: "Mesero / Bartender Asignado", type: "text", placeholder: "Mateo R\xEDos", requiredFeatureKey: "comp-waiter-assign" },
        { key: "barBottleMeasure", label: "Medida de Licor / Botella (Bares)", type: "select", options: ["Botella Completa 750ml", "Media Botella 375ml", "Trago / Shot 1.5 Oz", "C\xF3ctel de Autor"], requiredFeatureKey: "comp-bar-shot-measure" },
        { key: "currentTotal", label: "Consumo Inicial ($ COP)", type: "number", placeholder: "148000" }
      ]
    },
    {
      moduleKey: "mod-kds",
      parentServiceKey: "srv-gastro",
      externalSubmoduleName: "Monitor de Cocina y Barra (KDS)",
      tabIcon: "\u{1F525}",
      summary: "Tablero de comandas por estaci\xF3n de preparaci\xF3n (parrilla, cocina fr\xEDa, barra de licores) y tiempos SLA.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Enviar Comanda a Cocina / Barra",
      tableHeaders: ["Comanda", "Mesa / Barra", "Pedido y Notas", "Estaci\xF3n", "Tiempo / Estado"],
      fields: [
        { key: "originTable", label: "Mesa / Barra", type: "text", placeholder: "Mesa 05 \u2014 Terraza / Barra 02" },
        { key: "dishesDetail", label: "Platos o Tragos Solicitados", type: "text", placeholder: "2x Punta de Anca 3/4, 2x Gin Tonic" },
        { key: "stationName", label: "Estaci\xF3n Destino", type: "select", options: ["Barra Principal y Cocteler\xEDa", "Parrilla y Calientes", "Cocina Fr\xEDa y Entradas", "Reposter\xEDa"] }
      ]
    },
    {
      moduleKey: "mod-modifiers-menu",
      parentServiceKey: "srv-gastro",
      externalSubmoduleName: "Carta Digital, T\xE9rminos de Cocci\xF3n y Adiciones",
      tabIcon: "\u{1F969}",
      summary: 'Configuraci\xF3n de t\xE9rminos de carne, adiciones con cobro extra, exclusiones ("sin cebolla") y combos.',
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "Guardar Grupo de Modificadores",
      tableHeaders: ["Grupo Modificador", "Plato / Categor\xEDa", "Opciones Disponibles", "Recargo Adici\xF3n (COP)", "Estado"],
      fields: [
        { key: "modifierGroup", label: "Grupo de Modificador", type: "text", placeholder: "T\xE9rmino de Cocci\xF3n / Adiciones Parrilla" },
        { key: "dishTarget", label: "Categor\xEDa Aplicable", type: "select", options: ["Cortes de Parrilla y Hamburguesas", "Cocteler\xEDa y Licores", "Pizzas y Pastas", "Desayunos y Combos"] },
        { key: "optionsList", label: "Opciones de Selecci\xF3n", type: "text", placeholder: "Azul, Medio, Tres Cuartos (3/4), Bien Asado + Tocineta" },
        { key: "extraPriceCop", label: "Recargo Adici\xF3n ($ COP)", type: "number", placeholder: "8500" }
      ]
    },
    {
      moduleKey: "mod-split",
      parentServiceKey: "srv-gastro",
      externalSubmoduleName: "Divisi\xF3n de Cuentas y Pre-Cuentas",
      tabIcon: "\u2797",
      summary: "Separaci\xF3n de cuenta por silla, por comensal o en partes iguales con c\xE1lculo de Impoconsumo 8% y propina.",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "Registrar Divisi\xF3n de Cuenta",
      tableHeaders: ["Referencia", "Mesa", "Modalidad", "Pagadores", "Total por Pagador"],
      fields: [
        { key: "tableRef", label: "Mesa a Dividir", type: "text", placeholder: "Mesa 12 \u2014 VIP" },
        { key: "splitMode", label: "Modalidad de Divisi\xF3n", type: "select", options: ["Por Comensal / Silla", "Partes Iguales", "Por Producto Consumido"] },
        { key: "payersCount", label: "Cantidad de Pagadores", type: "number", placeholder: "3" },
        { key: "amountPerPayer", label: "Valor Promedio por Pagador ($ COP)", type: "number", placeholder: "85000" }
      ]
    },
    {
      moduleKey: "mod-deliveries",
      parentServiceKey: "srv-gastro",
      externalSubmoduleName: "Domicilios Propios,Plataformas y Motorizados",
      tabIcon: "\u{1F6F5}",
      summary: "Despacho de pedidos a domicilio por WhatsApp/Web/Rappi, asignaci\xF3n de domiciliario y cuadre de efectivo.",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "Despachar Pedido con Domiciliario",
      tableHeaders: ["Pedido #", "Cliente y Direcci\xF3n", "Canal", "Domiciliario", "Total + Env\xEDo (COP)"],
      fields: [
        { key: "orderCode", label: "Consecutivo Domicilio", type: "text", placeholder: "DOM-2026-419" },
        { key: "customerAddress", label: "Cliente, Tel\xE9fono y Direcci\xF3n", type: "text", placeholder: "Cra 15 # 88-20 Apto 502 \u2014 310 554 1190" },
        { key: "channel", label: "Canal de Entrada", type: "select", options: ["WhatsApp Directo Restaurante", "P\xE1gina Web Propia", "Rappi / Didi Food", "Tel\xE9fono PBX"] },
        { key: "courierName", label: "Motorizado Asignado", type: "text", placeholder: "Kevin Andr\xE9s Mora \u2014 Moto Placa KLM-45D" },
        { key: "totalWithDelivery", label: "Total a Recaudar ($ COP)", type: "number", placeholder: "94000" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-waiter-assign", externalName: "Asignaci\xF3n de mesero / bartender por mesa", description: "Registra el mesero o bartender responsable en apertura de mesa y liquidaci\xF3n de propinas.", parentModuleKey: "mod-tables", includedByDefault: true, monthlyAddonUsd: 15e3 },
    { componentKey: "comp-bar-shot-measure", externalName: "Control de inventario por trago / botella (Bares)", description: "Descuenta autom\xE1ticamente onzas o mililitros de botellas abiertas al vender tragos o c\xF3cteles.", parentModuleKey: "mod-tables", includedByDefault: true, monthlyAddonUsd: 19e3 },
    { componentKey: "comp-happy-hour-pricing", externalName: "Tarifas autom\xE1ticas Happy Hour (Bares)", description: "Activa precios promocionales por franja horaria en barra y mesas.", parentModuleKey: "mod-tables", includedByDefault: true, monthlyAddonUsd: 15e3 },
    { componentKey: "comp-courtesy-auth", externalName: "PIN supervisor para cortes\xEDas y anulaciones de comanda", description: "Exige autorizaci\xF3n de administrador y motivo al anular un plato ya enviado a cocina.", parentModuleKey: "mod-kds", includedByDefault: true, monthlyAddonUsd: 15e3 }
  ]
};

// apps/srv-hotel/frontend/hotel-service.view.ts
var SRV_HOTEL_FRONTEND_VIEW = {
  serviceKey: "srv-hotel",
  externalPrincipalModuleName: "Hoteler\xEDa, Alojamiento, Folios y Reservas",
  icon: "\u{1F3E8}",
  subtitle: "Rack de habitaciones, check-in/out, folios de cargos (minibar/restaurante), tarifas por temporada y ama de llaves.",
  standaloneMonthlyUsd: 129e3,
  submodules: [
    {
      moduleKey: "mod-bookings",
      parentServiceKey: "srv-hotel",
      externalSubmoduleName: "Reserva de Cupos, Caba\xF1as y Salones",
      tabIcon: "\u{1F4C5}",
      summary: "Control de disponibilidad por fecha, temporada, anticipo garantizado y bloqueo en calendario.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Confirmar Reserva de Alojamiento",
      tableHeaders: ["C\xF3digo Reserva", "Titular", "Espacio / Habitaci\xF3n", "Fecha y Franja", "Cupos / Hu\xE9spedes", "Estado"],
      fields: [
        { key: "holderName", label: "Nombre del Titular", type: "text", placeholder: "Valeria Mendoza" },
        { key: "spaceName", label: "Habitaci\xF3n / Caba\xF1a / Sal\xF3n", type: "select", options: ["Suite Ejecutiva Matrimonial", "Caba\xF1a Familiar Glamping", "Sal\xF3n Auditorio Empresarial"] },
        { key: "bookingDate", label: "Fecha de Check-In", type: "date" },
        { key: "slotsBooked", label: "Cantidad de Hu\xE9spedes", type: "number", placeholder: "4" }
      ]
    },
    {
      moduleKey: "mod-rooms",
      parentServiceKey: "srv-hotel",
      externalSubmoduleName: "Recepci\xF3n, Check-In y Folio de Hu\xE9sped",
      tabIcon: "\u{1F6CE}\uFE0F",
      summary: "Check-in, registro TRA MinCIT, estado de habitaciones y cuenta maestra (folio) de consumos.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Registrar Check-In / Cargo a Habitaci\xF3n",
      tableHeaders: ["Habitaci\xF3n / Unidad", "Hu\xE9sped Titular", "Ingreso / Salida", "Tarifa Noche", "Estado"],
      fields: [
        { key: "roomNumber", label: "Unidad / Habitaci\xF3n", type: "text", placeholder: "Habitaci\xF3n 304 \u2014 Vista Jard\xEDn" },
        { key: "guestName", label: "Hu\xE9sped Titular y Documento", type: "text", placeholder: "Camila Restrepo \u2014 CC 1.020.441.210" },
        { key: "nightsCount", label: "Noches de Estad\xEDa", type: "number", placeholder: "2" },
        { key: "nightlyRate", label: "Tarifa por Noche ($ COP)", type: "number", placeholder: "210000" }
      ]
    },
    {
      moduleKey: "mod-seasonal-rates",
      parentServiceKey: "srv-hotel",
      externalSubmoduleName: "Tarifas por Temporada y Planes de Estad\xEDa",
      tabIcon: "\u{1F31E}",
      summary: "Configuraci\xF3n de tarifas din\xE1micas por temporada alta/media/baja, puentes festivos y planes con desayuno.",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "Guardar Plan Tarifario de Temporada",
      tableHeaders: ["Plan / Temporada", "Tipo Habitaci\xF3n", "Vigencia", "Incluye Alimentaci\xF3n", "Tarifa Noche ($ COP)"],
      fields: [
        { key: "seasonPlanName", label: "Nombre de Temporada / Plan", type: "text", placeholder: "Temporada Alta Puentes Festivos \u2014 Plan Americano" },
        { key: "roomType", label: "Categor\xEDa de Alojamiento", type: "select", options: ["Est\xE1ndar Doble", "Suite Junior VIP", "Caba\xF1a Familiar 6 Personas"] },
        { key: "mealPlan", label: "R\xE9gimen de Alimentaci\xF3n", type: "select", options: ["Alojamiento + Desayuno Buffet", "Todo Incluido (Pensi\xF3n Completa)", "Solo Alojamiento"] },
        { key: "seasonRateCop", label: "Tarifa Noche Temporada ($ COP)", type: "number", placeholder: "340000" }
      ]
    },
    {
      moduleKey: "mod-housekeeping",
      parentServiceKey: "srv-hotel",
      externalSubmoduleName: "Ama de Llaves, Aseo y Mantenimiento",
      tabIcon: "\u{1F9F9}",
      summary: "Tablero operativo de habitaciones (Sucia, En Limpieza, Inspeccionada, Bloqueada) y conteo de lencer\xEDa/minibar.",
      monthlyAddonUsd: 32e3,
      actionButtonLabel: "Actualizar Estado de Habitaci\xF3n",
      tableHeaders: ["Habitaci\xF3n", "Camarera Asignada", "Estado Limpieza", "Novedad Minibar / Lencer\xEDa", "Hora Liberaci\xF3n"],
      fields: [
        { key: "roomCode", label: "Habitaci\xF3n / Caba\xF1a", type: "text", placeholder: "Habitaci\xF3n 304" },
        { key: "staffAssigned", label: "Camarera / Auxiliar Asignado", type: "text", placeholder: "Luz Marina Pineda" },
        { key: "cleaningState", label: "Estado de Ama de Llaves", type: "select", options: ["Inspeccionada \u2014 Lista para Check-In", "Sucia (Salida Reciente)", "En Proceso de Limpieza", "Fuera de Servicio / Mantenimiento"] },
        { key: "minibarReport", label: "Consumo Minibar / Novedad", type: "text", placeholder: "2x Agua Cristal + 1x Chocolatina (Cargado a Folio)" }
      ]
    },
    {
      moduleKey: "mod-tickets",
      parentServiceKey: "srv-hotel",
      externalSubmoduleName: "Pasad\xEDas, Eventos y Tickets de Acceso QR",
      tabIcon: "\u{1F3AB}",
      summary: "Expedici\xF3n de pases de d\xEDa (Day Pass), acceso a piscina/zonas h\xFAmedas y validaci\xF3n QR en porter\xEDa.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Emitir Pase / Ticket QR",
      tableHeaders: ["N\xB0 Ticket", "Categor\xEDa", "Visitante / Comprador", "C\xF3digo QR", "Tarifa", "Estado Porter\xEDa"],
      fields: [
        { key: "ticketCategory", label: "Categor\xEDa de Ticket", type: "select", options: ["Pasad\xEDa Adulto (Incluye Almuerzo)", "Pasad\xEDa Ni\xF1o", "Ticket Parqueadero / Evento"] },
        { key: "visitorName", label: "Nombre del Visitante", type: "text", placeholder: "Santiago Ospina" },
        { key: "qrToken", label: "C\xF3digo QR de Control", type: "text", placeholder: "QR-PK-88412", requiredFeatureKey: "comp-qr-ticket" },
        { key: "ticketPrice", label: "Valor del Ticket ($ COP)", type: "number", placeholder: "85000" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-qr-ticket",
      externalName: "Validador QR de ticket en porter\xEDa",
      description: "Genera y valida token QR \xFAnico para control de acceso en eventos, pasad\xEDas y parqueaderos.",
      parentModuleKey: "mod-tickets",
      includedByDefault: true,
      monthlyAddonUsd: 19e3
    }
  ]
};

// apps/srv-hr-payroll/frontend/hr-payroll-service.view.ts
var SRV_HR_PAYROLL_FRONTEND_VIEW = {
  serviceKey: "srv-hr-payroll",
  externalPrincipalModuleName: "N\xF3mina Electr\xF3nica DIAN, PILA y RRHH",
  icon: "\u{1F465}",
  subtitle: "Contratos laborales, liquidaci\xF3n quincenal/mensual, horas extras, seguridad social PILA, prestaciones y N\xF3mina Electr\xF3nica DIAN (CUNE).",
  standaloneMonthlyUsd: 17e4,
  submodules: [
    {
      moduleKey: "mod-employees-contracts",
      parentServiceKey: "srv-hr-payroll",
      externalSubmoduleName: "Empleados, Contratos, EPS, AFP, ARL y Fondos",
      tabIcon: "\u{1FAAA}",
      summary: "Ficha laboral completa, tipo de contrato (t\xE9rmino fijo, indefinido, aprendizaje, integral) y nivel de riesgo ARL I-V.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Registrar Contrato Laboral",
      tableHeaders: ["Documento", "Empleado y Cargo", "Tipo Contrato", "EPS / Pensi\xF3n / ARL", "Salario Base ($ COP)"],
      fields: [
        { key: "employeeDoc", label: "C\xE9dula / Documento Empleado", type: "text", placeholder: "CC 1.032.488.910" },
        { key: "fullNameRole", label: "Nombre Completo y Cargo", type: "text", placeholder: "Juli\xE1n David Torres \u2014 Jefe de Operaciones" },
        { key: "contractType", label: "Modalidad de Contrato", type: "select", options: ["T\xE9rmino Indefinido", "T\xE9rmino Fijo", "Obra o Labor", "Aprendizaje SENA", "Salario Integral"] },
        { key: "fundsSummary", label: "Fondos EPS / Pensi\xF3n / ARL Riesgo", type: "text", placeholder: "Sura EPS / Porvenir AFP / Sura ARL Nivel II" },
        { key: "baseSalaryCop", label: "Salario B\xE1sico Mensual ($ COP)", type: "number", placeholder: "2850000" }
      ]
    },
    {
      moduleKey: "mod-payroll-settlement",
      parentServiceKey: "srv-hr-payroll",
      externalSubmoduleName: "Liquidaci\xF3n de N\xF3mina, Horas Extras y Novedades",
      tabIcon: "\u{1F9EE}",
      summary: "C\xE1lculo de auxilio de transporte, HED (25%), HEN (75%), HRN (35%), dominicales, incapacidades, FSP y libranzas.",
      monthlyAddonUsd: 52e3,
      actionButtonLabel: "Liquidar Per\xEDodo de N\xF3mina",
      tableHeaders: ["Per\xEDodo", "Colaborador", "Total Devengado", "Deducciones Salud/Pensi\xF3n", "Neto a Pagar ($ COP)"],
      fields: [
        { key: "periodCode", label: "Per\xEDodo de Liquidaci\xF3n", type: "text", placeholder: "NOM-2026-11-Q1" },
        { key: "employeeName", label: "Colaborador", type: "text", placeholder: "Juli\xE1n David Torres" },
        { key: "accruedCop", label: "Total Devengado + Auxilio + Extras ($ COP)", type: "number", placeholder: "3120000" },
        { key: "deductedCop", label: "Deducciones Empleado (Salud 4% + Pensi\xF3n 4%)", type: "number", placeholder: "228000" },
        { key: "netPayCop", label: "Neto a Dispersar en Banco ($ COP)", type: "number", placeholder: "2892000" }
      ]
    },
    {
      moduleKey: "mod-social-benefits-pila",
      parentServiceKey: "srv-hr-payroll",
      externalSubmoduleName: "Seguridad Social PILA y Prestaciones Sociales",
      tabIcon: "\u{1F3E6}",
      summary: "Provisiones mensuales y liquidaci\xF3n de Prima de Servicios, Cesant\xEDas, Intereses (12%), Vacaciones y archivo plano PILA.",
      monthlyAddonUsd: 49e3,
      actionButtonLabel: "Generar Planilla PILA / Prestaciones",
      tableHeaders: ["Planilla / Liquidaci\xF3n", "Concepto", "Empleados", "Exoneraci\xF3n Ley 1607", "Valor Liquidado ($ COP)"],
      fields: [
        { key: "benefitCode", label: "N\xFAmero Planilla PILA / Liquidaci\xF3n", type: "text", placeholder: "PILA-2026-11-8841" },
        { key: "benefitType", label: "Concepto Liquidado", type: "select", options: ["Planilla Integrada PILA Mensual", "Prima Legal de Servicios", "Consignaci\xF3n Cesant\xEDas a Fondo", "Liquidaci\xF3n Definitiva de Contrato"] },
        { key: "employeesCount", label: "Empleados Incluidos", type: "number", placeholder: "14" },
        { key: "provisionTotalCop", label: "Total Aportes / Prestaciones ($ COP)", type: "number", placeholder: "9450000" }
      ]
    },
    {
      moduleKey: "mod-electronic-payroll-dian",
      parentServiceKey: "srv-hr-payroll",
      externalSubmoduleName: "Transmisi\xF3n N\xF3mina Electr\xF3nica DIAN (NI / CUNE)",
      tabIcon: "\u{1F3DB}\uFE0F",
      summary: "Generaci\xF3n XML mensual de Soporte de Pago de N\xF3mina Electr\xF3nica (NI) y Notas de Ajuste (NA) con firma digital y CUNE.",
      monthlyAddonUsd: 55e3,
      actionButtonLabel: "Transmitir N\xF3mina Electr\xF3nica a DIAN",
      tableHeaders: ["Consecutivo NI", "Empleado Reportado", "CUNE DIAN", "Estado DIAN", "Neto Reportado ($ COP)"],
      fields: [
        { key: "niConsecutive", label: "Consecutivo Soporte N\xF3mina (NI)", type: "text", placeholder: "NE-2026-00314" },
        { key: "employeeName", label: "Empleado Reportado", type: "text", placeholder: "Juli\xE1n David Torres" },
        { key: "cuneHash", label: "CUNE SHA-384 Validado DIAN", type: "text", placeholder: "CUNE-9f82a41c-dian-2026-ok" },
        { key: "reportedTotalCop", label: "Neto Reportado en XML ($ COP)", type: "number", placeholder: "2892000" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-ley1607-exoneration",
      externalName: "Exoneraci\xF3n autom\xE1tica de aportes Ley 1607 (Art. 114-1 E.T.)",
      description: "Aplica exoneraci\xF3n autom\xE1tica de Salud Patronal (8.5%), SENA (2%) e ICBF (3%) para devengos menores a 10 SMMLV.",
      parentModuleKey: "mod-employees-contracts",
      includedByDefault: true,
      monthlyAddonUsd: 19e3
    },
    {
      componentKey: "comp-cune-dian-payroll",
      externalName: "Firmador XAdES-EPES y validador CUNE de N\xF3mina Electr\xF3nica DIAN",
      description: "Genera el C\xF3digo \xDAnico de N\xF3mina Electr\xF3nica (CUNE SHA-384) y valida reglas DIAN antes de transmitir.",
      parentModuleKey: "mod-electronic-payroll-dian",
      includedByDefault: true,
      monthlyAddonUsd: 25e3
    }
  ]
};

// apps/srv-inventory/frontend/inventory-service.view.ts
var SRV_INVENTORY_FRONTEND_VIEW = {
  serviceKey: "srv-inventory",
  externalPrincipalModuleName: "Inventario, Bodegas, Lotes FEFO y Actas (v2)",
  icon: "\u{1F4E6}",
  subtitle: "Kardex valorizado, bodegas, solicitudes de traslado, actas de recepci\xF3n t\xE9cnica v2, conteo f\xEDsico ciego, recetas y b\xE1scula.",
  standaloneMonthlyUsd: 149e3,
  submodules: [
    {
      moduleKey: "mod-stock",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Existencias, Variantes y Kardex Valorizado",
      tabIcon: "\u{1F4CA}",
      summary: "Kardex valorizado de productos, variantes/seriales, costo promedio ponderado y punto de reorden.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Registrar Producto / Ajuste",
      tableHeaders: ["C\xF3digo SKU", "Producto / Insumo", "Bodega Base", "Disponible", "Stock M\xEDnimo", "Costo Unitario"],
      fields: [
        { key: "sku", label: "C\xF3digo SKU / Barras", type: "text", placeholder: "INS-00412" },
        { key: "productName", label: "Nombre del Producto o Insumo", type: "text", placeholder: "Cemento Gris Estructural 50Kg" },
        { key: "warehouseName", label: "Bodega Asignada", type: "select", options: ["Bodega Central Principal", "Bodega Norte Punto Venta", "Bodega Materia Prima"] },
        { key: "onHandQty", label: "Cantidad Disponible", type: "number", placeholder: "180" },
        { key: "minStock", label: "Alerta Stock M\xEDnimo", type: "number", placeholder: "30" },
        { key: "unitCost", label: "Costo Unitario ($ COP)", type: "number", placeholder: "31500" }
      ]
    },
    {
      moduleKey: "mod-warehouses",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Bodegas y Ubicaciones WMS",
      tabIcon: "\u{1F3ED}",
      summary: "Administraci\xF3n de bodegas f\xEDsicas, pasillos/estantes, capacidad instalada y responsable.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Crear / Actualizar Bodega",
      tableHeaders: ["C\xF3digo", "Nombre de Bodega", "Ciudad / Sede", "Capacidad", "Encargado / Firma", "Estado"],
      fields: [
        { key: "warehouseCode", label: "C\xF3digo de Bodega", type: "text", placeholder: "BOD-NORTE-02" },
        { key: "warehouseTitle", label: "Nombre de la Bodega", type: "text", placeholder: "Bodega Log\xEDstica Zona Franca" },
        { key: "cityLocation", label: "Ciudad / Direcci\xF3n", type: "text", placeholder: "Yumbo \u2014 Autopista Cali Km 4" },
        { key: "capacityTons", label: "Capacidad Operativa (Ton / Estibas)", type: "text", placeholder: "450 Toneladas / 120 Estibas" },
        { key: "managerSignature", label: "Firma de Encargado de Bodega", type: "text", placeholder: "Firmado: Jorge Eliecer Pardo", requiredFeatureKey: "comp-manager-signature" }
      ]
    },
    {
      moduleKey: "mod-transfers",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Solicitudes para Traslados entre Bodegas",
      tabIcon: "\u{1F504}",
      summary: "Solicitudes de traslado entre bodegas con despacho en tr\xE1nsito, recepci\xF3n, transportista y firma.",
      monthlyAddonUsd: 55e3,
      actionButtonLabel: "Emitir Solicitud de Traslado",
      tableHeaders: ["Solicitud", "Bodega Origen", "Bodega Destino", "\xCDtem y Cantidad", "Transportista", "Firma Encargado"],
      fields: [
        { key: "originWarehouse", label: "Bodega Origen", type: "select", options: ["Bodega Central Principal", "Planta de Producci\xF3n", "Bodega Zona Franca"] },
        { key: "targetWarehouse", label: "Bodega Destino", type: "select", options: ["Bodega Norte Punto Venta", "Bodega Sur Despachos", "Bodega Principal"] },
        { key: "itemSummary", label: "Producto y Cantidad a Trasladar", type: "text", placeholder: "120 Sacos Harina Fortificada x 50Kg" },
        { key: "carrierName", label: "Seleccionar Transportista", type: "select", options: ["Transportes R\xE1pidos del Norte S.A.S.", "Flota Propia \u2014 Cami\xF3n NPR Placa WXY-412", "Log\xEDstica Nacional Carga Segura"], requiredFeatureKey: "comp-carrier-select" },
        { key: "managerSignature", label: "Firma de Encargado que Autoriza", type: "text", placeholder: "Autorizado: Ing. Andr\xE9s Mej\xEDa", requiredFeatureKey: "comp-manager-signature" }
      ]
    },
    {
      moduleKey: "mod-tech-reception",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Actas de Recepci\xF3n T\xE9cnica de Mercanc\xEDa (v2)",
      tabIcon: "\u{1F321}\uFE0F",
      summary: "Inspecci\xF3n t\xE9cnica estilo InventarioActaRecepcion v2: control de temperatura, cadena de fr\xEDo, registro sanitario y cuarentena.",
      monthlyAddonUsd: 42e3,
      actionButtonLabel: "Firmar Acta de Recepci\xF3n T\xE9cnica",
      tableHeaders: ["N\xB0 Acta", "Proveedor / Factura", "Lote y Temp (\xB0C)", "Estado Empaque", "Concepto T\xE9cnico"],
      fields: [
        { key: "actaNumber", label: "Consecutivo Acta T\xE9cnica", type: "text", placeholder: "ACT-REC-2026-118" },
        { key: "supplierInvoice", label: "Proveedor y Factura", type: "text", placeholder: "Laboratorios / Distribuidora Nacional \u2014 FE-9941" },
        { key: "lotAndTemp", label: "Lote, Registro INVIMA/ICA y Temperatura (\xB0C)", type: "text", placeholder: "Lote L-8841 \u2014 Temp: 4.2 \xB0C (Cadena Fr\xEDo OK)" },
        { key: "technicalConcept", label: "Dictamen de Recepci\xF3n", type: "select", options: ["Aprobado \u2014 Ingresa a Stock Disponible", "Aprobado con Observaciones", "Rechazado / En Bodega de Cuarentena"] }
      ]
    },
    {
      moduleKey: "mod-physical-count",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Toma F\xEDsica Ciega y Conciliaci\xF3n de Mermas",
      tabIcon: "\u{1F4CB}",
      summary: "Conteo f\xEDsico ciego sin mostrar saldo del sistema a los operarios, c\xE1lculo de diferencias y ajuste autom\xE1tico.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Cerrar Conteo Ciego y Ajustar",
      tableHeaders: ["Sesi\xF3n Conteo", "Bodega Auditada", "\xCDtems Contados", "Diferencia Neta ($ COP)", "Estado Ajuste"],
      fields: [
        { key: "countSessionCode", label: "C\xF3digo de Toma F\xEDsica", type: "text", placeholder: "TOM-CIEGA-2026-09" },
        { key: "warehouseAudited", label: "Bodega en Conteo", type: "select", options: ["Bodega Central Principal", "Bodega Norte Punto Venta", "Barra / Cava de Licores"] },
        { key: "itemsCounted", label: "Referencias Verificadas", type: "number", placeholder: "145" },
        { key: "netVarianceCop", label: "Diferencia Valorizada ($ COP)", type: "number", placeholder: "-48000" }
      ]
    },
    {
      moduleKey: "mod-recipes",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Recetas y Producci\xF3n BOM",
      tabIcon: "\u{1F9EA}",
      summary: "F\xF3rmulas de producci\xF3n y escandallos con descuento autom\xE1tico de insumos por unidad.",
      monthlyAddonUsd: 55e3,
      actionButtonLabel: "Guardar Receta / F\xF3rmula",
      tableHeaders: ["C\xF3digo", "Producto Terminado", "Insumos de la Receta", "Rendimiento", "Costo Total"],
      hasVisualRecipeBuilder: true,
      fields: [
        { key: "finishedName", label: "Producto Terminado / Plato", type: "text", placeholder: "Mezcla Lista / Men\xFA Ejecutivo" },
        { key: "yieldQty", label: "Rendimiento por Lote", type: "number", placeholder: "1" }
      ]
    },
    {
      moduleKey: "mod-lots",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Lotes y Vencimientos FEFO",
      tabIcon: "\u{1F4C5}",
      summary: "Trazabilidad sanitaria por lote, fecha de vencimiento y despacho prioritario FEFO con sem\xE1foro.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Registrar Lote",
      tableHeaders: ["N\xB0 Lote", "Producto", "Bodega", "Vencimiento", "Cantidad", "Estado FEFO"],
      fields: [
        { key: "lotCode", label: "N\xFAmero de Lote", type: "text", placeholder: "LOT-2026-884" },
        { key: "productName", label: "Producto", type: "text", placeholder: "L\xE1cteo / Insumo Perecedero" },
        { key: "expiryDate", label: "Fecha de Vencimiento", type: "date" },
        { key: "qty", label: "Cantidad del Lote", type: "number", placeholder: "250" }
      ]
    },
    {
      moduleKey: "mod-scale",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "B\xE1scula y Tractomulas",
      tabIcon: "\u{1F69B}",
      summary: "Control de tractomulas en b\xE1scula camionera, pesaje Bruto/Tara/Neto, transportista y muelle.",
      monthlyAddonUsd: 75e3,
      actionButtonLabel: "Emitir Tiquete de B\xE1scula",
      tableHeaders: ["Tiquete", "Placa / Remolque", "Transportista / Conductor", "Peso Bruto", "Peso Tara", "Peso Neto"],
      hasTruckScaleWeighbridge: true,
      fields: [
        { key: "truckPlate", label: "Placa Cabezote / Remolque", type: "text", placeholder: "SXT-942 / R-4481" },
        { key: "driverName", label: "Conductor y C\xE9dula", type: "text", placeholder: "Hernando Valencia \u2014 CC 79.412.880" },
        { key: "carrierCompany", label: "Seleccionar Transportista", type: "select", options: ["TransCarga Pesada de Colombia", "Cooperativa de Tractomulas del Sur", "Particular / Flota Propia"], requiredFeatureKey: "comp-carrier-select" },
        { key: "cargoType", label: "Carga y Muelle Asignado", type: "text", placeholder: "Granel Ma\xEDz Amarillo \u2014 Muelle 3" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-manager-signature", externalName: "Firma de encargado", description: "Exige registrar la firma o nombre del encargado responsable en bodegas, traslados y remisiones.", parentModuleKey: "independent", includedByDefault: true, monthlyAddonUsd: 19e3 },
    { componentKey: "comp-carrier-select", externalName: "Seleccionar transportista", description: "Habilita el selector de empresa transportista y placa en traslados de bodega y b\xE1scula.", parentModuleKey: "mod-transfers", includedByDefault: true, monthlyAddonUsd: 19e3 },
    { componentKey: "comp-scale-tare", externalName: "C\xE1lculo autom\xE1tico Bruto / Tara / Neto en b\xE1scula", description: "Calcula en vivo el peso neto destarado en kilogramos y toneladas para tractomulas.", parentModuleKey: "mod-scale", includedByDefault: true, monthlyAddonUsd: 25e3 },
    { componentKey: "comp-expiry-semaphore", externalName: "Sem\xE1foro visual FEFO de lotes pr\xF3ximos a vencer (30/60/90 d\xEDas)", description: "Destaca en rojo/\xE1mbar/verde los lotes seg\xFAn sus d\xEDas restantes de vida \xFAtil.", parentModuleKey: "mod-lots", includedByDefault: true, monthlyAddonUsd: 15e3 }
  ]
};

// apps/srv-invoicing/frontend/invoicing-service.view.ts
var SRV_INVOICING_FRONTEND_VIEW = {
  serviceKey: "srv-invoicing",
  externalPrincipalModuleName: "Facturaci\xF3n DIAN, POS, Tarifarios (v2) y Glosas",
  icon: "\u{1F9FE}",
  subtitle: "Caja POS con arqueo ciego, facturaci\xF3n electr\xF3nica UBL 2.1, tarifarios v2, facturaci\xF3n agrupada y auditor\xEDa de glosas.",
  standaloneMonthlyUsd: 145e3,
  submodules: [
    {
      moduleKey: "mod-pos",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Caja POS, Turnos y Tirilla Electr\xF3nica",
      tabIcon: "\u{1F6D2}",
      summary: "Terminal de venta r\xE1pida con carrito interactivo, pagos mixtos, arqueo ciego X/Z y c\xE1lculo de vueltas.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Emitir Comprobante POS",
      tableHeaders: ["Comprobante", "Cliente", "Cajero / Turno", "Medio de Pago", "Total", "Estado"],
      hasInteractivePosCart: true,
      fields: [
        { key: "customerName", label: "Cliente / Comprador", type: "text", placeholder: "Consumidor Final o Raz\xF3n Social" },
        { key: "customerNit", label: "NIT o Documento", type: "text", placeholder: "222222222-2" },
        { key: "cashierName", label: "Nombre de Cajero y Turno", type: "text", placeholder: "Laura G\xF3mez \u2014 Turno Ma\xF1ana", requiredFeatureKey: "comp-cashier-name" },
        { key: "paymentMethod", label: "Medio de Pago", type: "select", options: ["Efectivo", "Tarjeta D\xE9bito / Cr\xE9dito", "Transferencia Nequi / Daviplata / QR", "Pago Mixto"] },
        { key: "tipPct", label: "Propina Voluntaria (%)", type: "number", placeholder: "10", requiredFeatureKey: "comp-tip" }
      ]
    },
    {
      moduleKey: "mod-dian",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Facturaci\xF3n Electr\xF3nica DIAN (UBL 2.1)",
      tabIcon: "\u{1F3DB}\uFE0F",
      summary: "Emisi\xF3n de facturas electr\xF3nicas FEV, Notas Cr\xE9dito y D\xE9bito con validaci\xF3n previa, CUFE y XML/PDF.",
      monthlyAddonUsd: 69e3,
      actionButtonLabel: "Emitir Factura Electr\xF3nica",
      tableHeaders: ["Prefijo / N\xFAmero", "Adquirente", "NIT", "Total Gravado", "CUFE / Estado DIAN", "Fecha"],
      fields: [
        { key: "resolutionPrefix", label: "Prefijo de Resoluci\xF3n", type: "select", options: ["FEV - Factura Electr\xF3nica", "NC - Nota Cr\xE9dito", "ND - Nota D\xE9bito"] },
        { key: "buyerLegalName", label: "Raz\xF3n Social del Adquirente", type: "text", placeholder: "Comercializadora del Valle S.A.S." },
        { key: "buyerTaxId", label: "NIT con D\xEDgito de Verificaci\xF3n", type: "text", placeholder: "901.452.110-4" },
        { key: "buyerEmail", label: "Correo de Recepci\xF3n XML/PDF", type: "text", placeholder: "facturacion@empresa.co" },
        { key: "totalAmount", label: "Valor Total Factura ($ COP)", type: "number", placeholder: "1450000" }
      ]
    },
    {
      moduleKey: "mod-tariffs",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Listas de Precios y Tarifarios Pactados (v2)",
      tabIcon: "\u{1F3F7}\uFE0F",
      summary: "Motor de tarifas estilo TarifaConvenio v2 con recargos/descuentos porcentuales y precios pactados por convenio.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Guardar Lista / Tarifa Pactada",
      tableHeaders: ["C\xF3digo Tarifa", "Nombre Tarifario / Convenio", "Regla de C\xE1lculo", "Vigencia", "Precio Base / Factor"],
      fields: [
        { key: "tariffCode", label: "C\xF3digo de Lista / Tarifario", type: "text", placeholder: "TAR-CORP-2026" },
        { key: "tariffName", label: "Nombre de Lista o Convenio", type: "text", placeholder: "Tarifario Mayorista Institucional (-15%)" },
        { key: "pricingRule", label: "F\xF3rmula de Liquidaci\xF3n", type: "select", options: ["Precio Fijo Pactado por \xCDtem", "Descuento % sobre Lista Base", "Margen % sobre Costo Promedio"] },
        { key: "sampleRateCop", label: "Valor Referencia / Tarifa Base ($ COP)", type: "number", placeholder: "125000" }
      ]
    },
    {
      moduleKey: "mod-grouped-billing",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Facturaci\xF3n Agrupada de \xD3rdenes y Remisiones (v2)",
      tabIcon: "\u{1F4E6}",
      summary: "Consolida m\xFAltiples \xF3rdenes de servicio, remisiones o atenciones del mes en una sola Factura Corporativa con anexo.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Consolidar y Emitir Factura Agrupada",
      tableHeaders: ["Lote Consolidado", "Empresa / Contrato", "\xD3rdenes Incluidas", "Corte Per\xEDodo", "Total Facturado (COP)"],
      fields: [
        { key: "batchCode", label: "Consecutivo de Consolidaci\xF3n", type: "text", placeholder: "FAC-AGR-2026-089" },
        { key: "contractClient", label: "Empresa y Contrato (v2)", type: "text", placeholder: "Grupo Industrial del Pac\xEDfico \u2014 CNT-2026-0084" },
        { key: "ordersIncluded", label: "Cantidad de Remisiones / \xD3rdenes Agrupadas", type: "text", placeholder: "28 Remisiones Verificadas (Mes Octubre)" },
        { key: "consolidatedTotal", label: "Total Factura Consolidada ($ COP)", type: "number", placeholder: "18950000" }
      ]
    },
    {
      moduleKey: "mod-glosas-disputes",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Radicaci\xF3n de Facturas y Auditor\xEDa de Glosas (v2)",
      tabIcon: "\u2696\uFE0F",
      summary: "Control de radicaci\xF3n ante clientes corporativos, registro de objeciones/glosas parciales, conciliaci\xF3n y nota cr\xE9dito.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Registrar Radicado / Respuesta a Glosa",
      tableHeaders: ["Radicado / Glosa", "Factura Afectada", "Causal de Objeci\xF3n", "Valor Objetado", "Estado Conciliaci\xF3n"],
      fields: [
        { key: "disputeCode", label: "N\xFAmero de Radicado / Glosa", type: "text", placeholder: "GLO-2026-00312" },
        { key: "invoiceRef", label: "Factura Radicada", type: "text", placeholder: "FEV-10428 \u2014 Constructora Andina" },
        { key: "disputeReason", label: "Causal de Glosa / Devoluci\xF3n", type: "select", options: ["Diferencia en Tarifa Pactada", "Soporte o Firma de Entrega Faltante", "Diferencia en Cantidad Recibida", "Radicaci\xF3n Exitosa Sin Glosa"] },
        { key: "disputedAmount", label: "Valor Objetado / Conciliado ($ COP)", type: "number", placeholder: "420000" }
      ]
    },
    {
      moduleKey: "mod-quotes",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Cotizaciones, Pedidos y Plan Separe",
      tabIcon: "\u{1F4CB}",
      summary: "Propuestas comerciales, remisiones de entrega de mercanc\xEDa, plan separe con abonos y conversi\xF3n a factura.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Guardar Cotizaci\xF3n / Plan Separe",
      tableHeaders: ["Documento", "Cliente", "Vigencia", "Encargado Autorizador", "Valor Estimado", "Estado"],
      fields: [
        { key: "docType", label: "Tipo de Documento", type: "select", options: ["Cotizaci\xF3n Comercial", "Remisi\xF3n de Salida", "Plan Separe con Abono Inicial"] },
        { key: "clientName", label: "Empresa / Cliente", type: "text", placeholder: "Constructora Andina S.A.S." },
        { key: "validUntil", label: "V\xE1lido Hasta", type: "date" },
        { key: "managerSignature", label: "Firma de Encargado que Autoriza", type: "text", placeholder: "Ing. Carlos Ruiz", requiredFeatureKey: "comp-manager-signature" },
        { key: "quotedTotal", label: "Valor Total ($ COP)", type: "number", placeholder: "3200000" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-cashier-name",
      externalName: "Ingreso de nombre de cajero y turno",
      description: "Habilita la identificaci\xF3n del cajero responsable en cada comprobante POS.",
      parentModuleKey: "mod-pos",
      includedByDefault: true,
      monthlyAddonUsd: 15e3
    },
    {
      componentKey: "comp-tip",
      externalName: "Propina sugerida voluntaria en cuenta",
      description: "Permite registrar porcentaje de propina voluntaria en la liquidaci\xF3n de caja.",
      parentModuleKey: "mod-pos",
      includedByDefault: true,
      monthlyAddonUsd: 15e3
    },
    {
      componentKey: "comp-line-discount",
      externalName: "Descuento por l\xEDnea en carrito POS",
      description: "Permite aplicar porcentaje de descuento individual por producto en el carrito POS.",
      parentModuleKey: "mod-pos",
      includedByDefault: true,
      monthlyAddonUsd: 19e3
    },
    {
      componentKey: "comp-blind-cash-count",
      externalName: "Arqueo ciego de caja X/Z por denominaci\xF3n de billetes y monedas",
      description: "Exige declarar el conteo f\xEDsico en efectivo sin ver el saldo te\xF3rico antes de cerrar turno.",
      parentModuleKey: "mod-pos",
      includedByDefault: true,
      monthlyAddonUsd: 19e3
    }
  ]
};

// apps/srv-procurement/frontend/procurement-service.view.ts
var SRV_PROCUREMENT_FRONTEND_VIEW = {
  serviceKey: "srv-procurement",
  externalPrincipalModuleName: "Compras, Proveedores, RADIAN y Doc Soporte",
  icon: "\u{1F6CD}\uFE0F",
  subtitle: "\xD3rdenes de compra a proveedores, recepci\xF3n de facturas, buz\xF3n RADIAN (030/032/033) y Documento Soporte DIAN.",
  standaloneMonthlyUsd: 119e3,
  submodules: [
    {
      moduleKey: "mod-purchase-orders",
      parentServiceKey: "srv-procurement",
      externalSubmoduleName: "\xD3rdenes de Compra (OC)",
      tabIcon: "\u{1F4DD}",
      summary: "Emisi\xF3n de \xF3rdenes de compra (EgresoOrden v2) con control de cantidad pedida vs recibida en bodega.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Emitir Orden de Compra",
      tableHeaders: ["N\xB0 Orden", "Proveedor NIT", "Bodega Destino", "Estado Recepci\xF3n", "Total Orden ($ COP)"],
      fields: [
        { key: "poNumber", label: "Consecutivo Orden de Compra", type: "text", placeholder: "OC-2026-00418" },
        { key: "supplierName", label: "Proveedor y NIT", type: "text", placeholder: "Distribuidora Nacional de Insumos S.A.S. \u2014 900.412.889-1" },
        { key: "targetWarehouse", label: "Bodega de Recepci\xF3n", type: "select", options: ["Bodega Central Principal", "Bodega Norte Punto Venta", "Bodega Materia Prima"] },
        { key: "itemsSummary", label: "Detalle y Cantidades Pedidas", type: "text", placeholder: "80 Und Aceite Sint\xE9tico 20W50 + 40 Filtros" },
        {
          key: "approvalSignature",
          label: "Firma de Aprobaci\xF3n de Compra",
          type: "text",
          placeholder: "Aprobado: Gerencia de Compras",
          requiredFeatureKey: "comp-po-approval-signature"
        },
        { key: "totalAmount", label: "Valor Total Orden ($ COP)", type: "number", placeholder: "4850000" }
      ]
    },
    {
      moduleKey: "mod-purchase-invoices",
      parentServiceKey: "srv-procurement",
      externalSubmoduleName: "Facturas de Compra y Gastos",
      tabIcon: "\u{1F9FE}",
      summary: "Causaci\xF3n de facturas de proveedores con cruce de OC, actualizaci\xF3n de costo promedio y retenciones.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Causar Factura de Compra",
      tableHeaders: ["Factura Proveedor", "Proveedor", "Orden Cruzada", "IVA / Retenciones", "Neto por Pagar ($ COP)"],
      fields: [
        { key: "supplierInvoiceNum", label: "Prefijo y N\xFAmero Factura Proveedor", type: "text", placeholder: "FE-99412" },
        { key: "supplierName", label: "Proveedor Emisor", type: "text", placeholder: "Importadora Andina S.A.S." },
        { key: "poRef", label: "Orden de Compra / Entrada Almac\xE9n", type: "text", placeholder: "OC-2026-00418 / EA-109" },
        { key: "taxSummary", label: "IVA Descontable y ReteFuente Aplicada", type: "select", options: ["IVA 19% + ReteFuente Compras 2.5%", "IVA 5% + ReteFuente 2.5%", "Servicio Gravado + ReteFuente 4%", "Exento / R\xE9gimen Simple"] },
        { key: "netPayable", label: "Valor Neto a Pagar ($ COP)", type: "number", placeholder: "5420000" }
      ]
    },
    {
      moduleKey: "mod-support-doc-dse",
      parentServiceKey: "srv-procurement",
      externalSubmoduleName: "Documento Soporte DIAN (No Obligados)",
      tabIcon: "\u{1F3DB}\uFE0F",
      summary: "Transmisi\xF3n electr\xF3nica de Documento Soporte (CUDS) para compras y cuentas de cobro a no responsables de IVA.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Transmitir Documento Soporte DIAN",
      tableHeaders: ["N\xB0 DSE", "Proveedor Cuenta de Cobro", "Concepto", "CUDS / Estado DIAN", "Valor ($ COP)"],
      fields: [
        { key: "dseNumber", label: "Consecutivo Resoluci\xF3n DSE", type: "text", placeholder: "DSE-000215" },
        { key: "naturalSupplier", label: "Persona Natural / Cuenta de Cobro (CC)", type: "text", placeholder: "Jairo Alberto M\xE9ndez \u2014 CC 79.884.120" },
        { key: "serviceConcept", label: "Concepto de Adquisici\xF3n o Servicio", type: "text", placeholder: "Mantenimiento El\xE9ctrico Local Norte" },
        { key: "withholdingApplied", label: "Retenci\xF3n Practicada", type: "select", options: ["ReteFuente Servicios No Declarante 6%", "ReteFuente Honorarios 10%", "ReteFuente Compras 3.5%", "Sin Retenci\xF3n (< Tope UVT)"] },
        { key: "dseTotal", label: "Valor Documento Soporte ($ COP)", type: "number", placeholder: "950000" }
      ]
    },
    {
      moduleKey: "mod-radian-events",
      parentServiceKey: "srv-procurement",
      externalSubmoduleName: "Buz\xF3n Tributario y Eventos RADIAN",
      tabIcon: "\u{1F4E8}",
      summary: "Recepci\xF3n de XML de proveedores y emisi\xF3n de eventos DIAN 030 (Acuse), 032 (Recibo Bien) y 033 (Aceptaci\xF3n).",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Emitir Evento RADIAN a DIAN",
      tableHeaders: ["Factura / CUFE", "Proveedor Emisor", "Evento RADIAN", "Estado DIAN", "Valor Factura ($ COP)"],
      fields: [
        { key: "supplierInvoice", label: "Factura Electr\xF3nica Recibida", type: "text", placeholder: "FEV-88410 (XML Adjunto)" },
        { key: "issuerName", label: "Proveedor Emisor", type: "text", placeholder: "Licores y Bebidas Nacionales S.A." },
        { key: "radianEventCode", label: "Evento RADIAN a Transmitir", type: "select", options: ["030 - Acuse de Recibo de Factura", "032 - Recibo del Bien o Servicio", "033 - Aceptaci\xF3n Expresa", "031 - Reclamo / Rechazo de Factura"] },
        { key: "invoiceAmount", label: "Valor Factura ($ COP)", type: "number", placeholder: "3680000" }
      ]
    },
    {
      moduleKey: "mod-landed-costs",
      parentServiceKey: "srv-procurement",
      externalSubmoduleName: "Prorrateo de Fletes e Importaci\xF3n",
      tabIcon: "\u{1F6A2}",
      summary: "Distribuci\xF3n de costos de transporte, seguros y aranceles sobre el costo unitario del Kardex.",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "Prorratear Costo en Kardex",
      tableHeaders: ["Liquidaci\xF3n", "Entrada de Almac\xE9n", "Concepto Flete/Aduana", "M\xE9todo Prorrateo", "Costo Distribuido ($ COP)"],
      fields: [
        { key: "allocationCode", label: "C\xF3digo de Prorrateo", type: "text", placeholder: "PRF-2026-041" },
        { key: "receiptRef", label: "Entrada de Almac\xE9n Destino", type: "text", placeholder: "EA-2026-109 (Bodega Central)" },
        { key: "freightConcept", label: "Factura de Flete / Nacionalizaci\xF3n", type: "text", placeholder: "Flete Tractomula Puerto Buenaventura - Cali" },
        { key: "allocationMethod", label: "Criterio de Distribuci\xF3n", type: "select", options: ["Por Valor FOB / Costo", "Por Peso en Kilogramos", "Por Volumen (m3)", "Por Cantidad de Unidades"] },
        { key: "freightAmount", label: "Valor Flete a Distribuir ($ COP)", type: "number", placeholder: "1850000" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-margin-drop-alert",
      externalName: "Alerta de ca\xEDda de margen por alza de costo de proveedor",
      description: "Advierte autom\xE1ticamente al registrar una compra si el nuevo costo reduce el margen comercial esperado.",
      parentModuleKey: "mod-purchase-invoices",
      includedByDefault: true,
      monthlyAddonUsd: 15e3
    },
    {
      componentKey: "comp-po-approval-signature",
      externalName: "Firma de aprobaci\xF3n gerencial en \xD3rdenes de Compra",
      description: "Exige autorizaci\xF3n firmada del jefe de compras o gerencia antes de despachar la orden al proveedor.",
      parentModuleKey: "mod-purchase-orders",
      includedByDefault: true,
      monthlyAddonUsd: 15e3
    }
  ]
};

// apps/srv-reports/frontend/reports-service.view.ts
var SRV_REPORTS_FRONTEND_VIEW = {
  serviceKey: "srv-reports",
  externalPrincipalModuleName: "Reportes Financieros, Anal\xEDtica BI y Exportador",
  icon: "\u{1F4CA}",
  subtitle: "Estado de Resultados P&G en vivo, Balance de Prueba por Tercero, rentabilidad por producto, anexos DIAN y constructor BI.",
  standaloneMonthlyUsd: 99e3,
  submodules: [
    {
      moduleKey: "mod-financial-reports",
      parentServiceKey: "srv-reports",
      externalSubmoduleName: "Estado de Resultados (P&G) y Balance por Tercero",
      tabIcon: "\u{1F4C8}",
      summary: "Utilidad Neta Real (Ventas - Costo Kardex + Mano de Obra - Gastos - Comisiones), Balance General NIIF y Balance de Prueba por NIT.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Generar y Exportar Estado Financiero",
      tableHeaders: ["Reporte Financiero", "Per\xEDodo / Corte", "Ingresos Brutos", "Costos y Gastos", "Utilidad Neta Real ($ COP)"],
      fields: [
        { key: "reportType", label: "Tipo de Estado Financiero", type: "select", options: ["Estado de Resultados Operativo (P&G Real FixMotor)", "Balance de Prueba por Tercero (NIT)", "Estado de Situaci\xF3n Financiera (Balance General NIIF)", "Libro Auxiliar por Cuenta y Centro de Costo"] },
        { key: "periodRange", label: "Per\xEDodo o Rango de Fechas", type: "text", placeholder: "Noviembre 2026 (Acumulado Mensual)" },
        { key: "grossRevenue", label: "Ingresos Totales del Per\xEDodo ($ COP)", type: "number", placeholder: "84500000" },
        { key: "totalCostsExpenses", label: "Costo Kardex (COGS) + Gastos + Comisiones ($ COP)", type: "number", placeholder: "56200000" },
        { key: "netProfit", label: "Utilidad Neta Real Calculada ($ COP)", type: "number", placeholder: "28300000" }
      ]
    },
    {
      moduleKey: "mod-sales-profitability-reports",
      parentServiceKey: "srv-reports",
      externalSubmoduleName: "Rentabilidad de Ventas y Arqueos de Caja",
      tabIcon: "\u{1F4B9}",
      summary: "Margen bruto por producto, categor\xEDa, vendedor y sucursal, m\xE1s consolidado de Efectivo Neto en Caja F\xEDsica vs Medios Digitales.",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "Generar Reporte de Rentabilidad / Arqueo",
      tableHeaders: ["Corte / Categor\xEDa", "Sede / Cajero", "Efectivo Neto Caja", "Digitales (Nequi/Tarjeta)", "Margen Ponderado (%)"],
      fields: [
        { key: "analysisScope", label: "Agrupaci\xF3n del Reporte", type: "select", options: ["Rentabilidad por Producto y Categor\xEDa", "Consolidado Arqueo de Caja (Efectivo Neto vs Digital)", "Ventas y Comisiones por Vendedor / T\xE9cnico", "Ventas por Franja Horaria y D\xEDa"] },
        { key: "branchCashier", label: "Sucursal / Caja / Vendedor", type: "text", placeholder: "Sede Principal \u2014 Todas las Cajas" },
        { key: "netCashBox", label: "Efectivo Neto en Caja F\xEDsica ($ COP)", type: "number", placeholder: "12450000" },
        { key: "digitalCollected", label: "Recaudo Transferencias / Nequi / Dat\xE1fono ($ COP)", type: "number", placeholder: "19800000" },
        { key: "weightedMarginPct", label: "Margen Bruto Ponderado (%)", type: "text", placeholder: "38.4% Utilidad sobre Venta" }
      ]
    },
    {
      moduleKey: "mod-inventory-reports",
      parentServiceKey: "srv-reports",
      externalSubmoduleName: "Valorizaci\xF3n de Inventario, Rotaci\xF3n ABC y Vencimientos",
      tabIcon: "\u{1F4E6}",
      summary: "Capital invertido al costo vs venta potencial (FixMotor), rotaci\xF3n ABC (v2), alertas bajo m\xEDnimo y lotes por vencer.",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "Ejecutar Auditor\xEDa de Inventario",
      tableHeaders: ["Bodega / Familia", "Capital al Costo", "Venta Potencial", "Utilidad Proyectada", "SKUs en Alerta / Vencimiento"],
      fields: [
        { key: "warehouseFilter", label: "Bodega Auditada", type: "select", options: ["Todas las Bodegas Consolidadas", "Bodega Central Principal", "Bodega Norte Punto Venta"] },
        { key: "capitalAtCost", label: "Capital Invertido al Costo ($ COP)", type: "number", placeholder: "62400000" },
        { key: "potentialRevenue", label: "Valor Potencial de Venta ($ COP)", type: "number", placeholder: "98500000" },
        { key: "projectedProfit", label: "Utilidad Bruta Proyectada ($ COP)", type: "number", placeholder: "36100000" },
        { key: "alertsSummary", label: "Alertas de Reorden y Vencimiento FEFO", type: "text", placeholder: "4 SKUs Bajo M\xEDnimo | 2 Lotes en Alerta Naranja (<30 d\xEDas)" }
      ]
    },
    {
      moduleKey: "mod-tax-dian-reports",
      parentServiceKey: "srv-reports",
      externalSubmoduleName: "Anexos Tributarios DIAN (IVA 300, ReteFuente 350, ICA)",
      tabIcon: "\u{1F3DB}\uFE0F",
      summary: "Borradores autom\xE1ticos de IVA Generado vs Descontable, Retenciones practicadas por rengl\xF3n e ICA municipal.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Generar Anexo Tributario DIAN",
      tableHeaders: ["Declaraci\xF3n / Anexo", "Per\xEDodo Fiscal", "Base Gravable Total", "Impuesto / Retenci\xF3n Liquidada", "Estado Pre-Auditor\xEDa"],
      fields: [
        { key: "taxFormType", label: "Formulario / Anexo Oficial", type: "select", options: ["Formulario 300 \u2014 Declaraci\xF3n de IVA (Generado vs Descontable)", "Formulario 350 \u2014 Retenci\xF3n en la Fuente Mensual", "Anexo Industria y Comercio (ICA y ReteICA por Municipio)", "Certificados de Retenci\xF3n Bimestral/Anual en PDF"] },
        { key: "taxPeriod", label: "Bimestre / Cuatrimestre / Mes", type: "text", placeholder: "2026 \u2014 Per\xEDodo 06 (Noviembre)" },
        { key: "taxableBaseCop", label: "Base Gravable Consolidada ($ COP)", type: "number", placeholder: "142000000" },
        { key: "taxPayableCop", label: "Saldo Neto Impuesto / Retenci\xF3n ($ COP)", type: "number", placeholder: "14850000" }
      ]
    },
    {
      moduleKey: "mod-custom-report-builder",
      parentServiceKey: "srv-reports",
      externalSubmoduleName: "Constructor Din\xE1mico BI y Exportaci\xF3n As\xEDncrona (v2)",
      tabIcon: "\u{1F6E0}\uFE0F",
      summary: "Cruce din\xE1mico de tablas (ConfiguracionReportes v2) y descarga masiva en Excel (.xlsx), CSV UTF-8 BOM y PDF.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Encolar y Descargar Reporte BI",
      tableHeaders: ["Nombre del Reporte", "Tabla Principal y Cruces", "Formato Salida", "Filas Procesadas", "Estado Exportaci\xF3n"],
      fields: [
        { key: "customReportName", label: "T\xEDtulo de la Plantilla de Reporte", type: "text", placeholder: "Cruces Ventas + Kardex + Cartera por Contrato" },
        { key: "sourceTables", label: "M\xF3dulo Principal y Relaciones Cruzadas", type: "select", options: ["Facturaci\xF3n + Clientes + Detalle \xCDtems + Kardex", "Inventario + Lotes + Recepciones T\xE9cnicas + Proveedores", "\xD3rdenes de Taller + Veh\xEDculos + Comisiones de T\xE9cnicos", "Agendamiento + Recursos + Tiempos de Espera Turnador"] },
        { key: "exportFormat", label: "Formato de Exportaci\xF3n", type: "select", options: ["Excel Nativo (.xlsx)", "CSV Contable UTF-8 con BOM (;)", "PDF Membreteado con QR (DocForge)"] },
        { key: "rowsCount", label: "Registros Estimados", type: "number", placeholder: "4520" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-csv-utf8-bom-export",
      externalName: "Exportaci\xF3n contable CSV con BOM UTF-8 para Excel en espa\xF1ol",
      description: "Genera archivos planos separados por punto y coma (;) con codificaci\xF3n UTF-8-SIG listos para Excel y contadores.",
      parentModuleKey: "mod-financial-reports",
      includedByDefault: true,
      monthlyAddonUsd: 15e3
    }
  ]
};

// apps/srv-ticketing/frontend/ticketing-service.view.ts
var SRV_TICKETING_FRONTEND_VIEW = {
  serviceKey: "srv-ticketing",
  externalPrincipalModuleName: "Taquilla QR, Eventos y Mesa PQRSF SLA",
  icon: "\u{1F3AB}",
  subtitle: "Venta de boleter\xEDa/covers con c\xF3digo QR antifraude, control de aforo en torniquetes y mesa PQRSF con SLA en d\xEDas h\xE1biles.",
  standaloneMonthlyUsd: 13e4,
  submodules: [
    {
      moduleKey: "mod-event-tickets",
      parentServiceKey: "srv-ticketing",
      externalSubmoduleName: "Taquilla, Covers, Palcos y Preventa QR",
      tabIcon: "\u{1F39F}\uFE0F",
      summary: "Emisi\xF3n de entradas generales, VIP y palcos con consumo m\xEDnimo incluido y c\xF3digo QR \xFAnico criptogr\xE1fico.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Emitir Ticket / Cover QR",
      tableHeaders: ["N\xB0 Ticket", "Categor\xEDa / Palco", "Visitante / Comprador", "C\xF3digo QR", "Tarifa ($ COP)"],
      fields: [
        { key: "ticketCategory", label: "Categor\xEDa de Ticket / Localidad", type: "select", options: ["Cover General Noche", "Palco VIP (Incluye Consumo)", "Preventa Evento Especial", "Pase Parqueadero"] },
        { key: "visitorName", label: "Nombre del Asistente / Comprador", type: "text", placeholder: "Santiago Ospina" },
        {
          key: "qrToken",
          label: "C\xF3digo QR Criptogr\xE1fico de Control",
          type: "text",
          placeholder: "QR-PK-88412",
          requiredFeatureKey: "comp-anti-clone-qr-gate"
        },
        { key: "ticketPrice", label: "Valor del Ticket ($ COP)", type: "number", placeholder: "65000" }
      ]
    },
    {
      moduleKey: "mod-gate-scanner",
      parentServiceKey: "srv-ticketing",
      externalSubmoduleName: "Esc\xE1ner de Puerta, Torniquetes y Aforo en Vivo",
      tabIcon: "\u{1F6A7}",
      summary: "Control de acceso en tiempo real por porter\xEDa, contador de ocupaci\xF3n m\xE1xima legal y lista de cortes\xEDas.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Validar Ingreso en Porter\xEDa",
      tableHeaders: ["Porter\xEDa / Acceso", "Evento Activo", "Ingresos Validados", "Aforo M\xE1ximo", "Estado Puerta"],
      fields: [
        { key: "gateCode", label: "Punto de Acceso / Torniquete", type: "select", options: ["Porter\xEDa Principal Calle 85", "Acceso VIP Palcos", "Porter\xEDa Vehicular"] },
        { key: "eventName", label: "Evento / Noche Activa", type: "text", placeholder: "S\xE1bado Concierto en Vivo" },
        { key: "checkedInCount", label: "Asistentes Dentro del Recinto", type: "number", placeholder: "340" },
        { key: "maxCapacity", label: "Aforo Legal Permitido", type: "number", placeholder: "450" }
      ]
    },
    {
      moduleKey: "mod-pqrsf-helpdesk",
      parentServiceKey: "srv-ticketing",
      externalSubmoduleName: "Mesa de Ayuda PQRSF y SLA D\xEDas H\xE1biles (Ley 1755)",
      tabIcon: "\u{1F6CE}\uFE0F",
      summary: "Radicaci\xF3n de Peticiones, Quejas, Reclamos y Solicitudes con sem\xE1foro de vencimiento en d\xEDas h\xE1biles de Colombia.",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Radicar Caso PQRSF",
      tableHeaders: ["Radicado PQRSF", "Tipo (P/Q/R/S/F)", "Solicitante", "D\xEDas H\xE1biles SLA", "Estado Tr\xE1mite"],
      fields: [
        { key: "radicadoNumber", label: "N\xFAmero de Radicado Oficial", type: "text", placeholder: "PQRS-2026-00914" },
        { key: "requestType", label: "Tipolog\xEDa Ley 1755", type: "select", options: ["Petici\xF3n (15 d\xEDas h\xE1biles)", "Queja de Servicio (15 d\xEDas h\xE1biles)", "Reclamo de Facturaci\xF3n / Garant\xEDa", "Solicitud de Informaci\xF3n (10 d\xEDas h\xE1biles)"] },
        { key: "petitionerName", label: "Nombre del Solicitante y Correo", type: "text", placeholder: "Marcela Quintero \u2014 marcela@cliente.co" },
        { key: "businessDaysLeft", label: "D\xEDas H\xE1biles Restantes (Sin Festivos)", type: "number", placeholder: "12" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-anti-clone-qr-gate",
      externalName: "Generador y validador QR criptogr\xE1fico anti-clonaci\xF3n en torniquetes",
      description: "Invalida el token QR en milisegundos tras la primera lectura en puerta para impedir reingresos.",
      parentModuleKey: "mod-event-tickets",
      includedByDefault: true,
      monthlyAddonUsd: 19e3
    },
    {
      componentKey: "comp-sla-business-days",
      externalName: "Calculadora SLA con festivos oficiales de Colombia (Ley Emiliani)",
      description: "Descuenta domingos y festivos oficiales de Colombia al calcular t\xE9rminos legales de respuesta PQRSF.",
      parentModuleKey: "mod-pqrsf-helpdesk",
      includedByDefault: true,
      monthlyAddonUsd: 19e3
    }
  ]
};

// apps/srv-treasury/frontend/treasury-service.view.ts
var SRV_TREASURY_FRONTEND_VIEW = {
  serviceKey: "srv-treasury",
  externalPrincipalModuleName: "Tesorer\xEDa, Cartera por Edades, Bancos y Cajas Menores",
  icon: "\u{1F4B0}",
  subtitle: "Recibos de caja, edades de cartera CxC, comprobantes de egreso CxP, conciliaci\xF3n bancaria y gastos menores.",
  standaloneMonthlyUsd: 119e3,
  submodules: [
    {
      moduleKey: "mod-receivables-cxc",
      parentServiceKey: "srv-treasury",
      externalSubmoduleName: "Cartera Clientes (CxC) y Recibos de Caja",
      tabIcon: "\u{1F4E5}",
      summary: "Edades de cartera (Al d\xEDa, 15, 30, 60, +90 d\xEDas), abonos parciales con retenciones y cobro jur\xEDdico.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Emitir Recibo de Caja (Abono CxC)",
      tableHeaders: ["Recibo / Factura", "Cliente", "Edad de Mora", "Retenciones Aplicadas", "Abono Recibido ($ COP)"],
      fields: [
        { key: "receiptNumber", label: "N\xB0 Recibo de Caja y Factura Cruzada", type: "text", placeholder: "RC-001420 -> FEV-1042" },
        { key: "customerName", label: "Cliente Pagador", type: "text", placeholder: "Cl\xEDnica / Comercializadora del Norte S.A.S." },
        { key: "agingBucket", label: "Tramo de Cartera / Estado", type: "select", options: ["Al D\xEDa (0-15 d\xEDas)", "Mora Temprana (16-30 d\xEDas)", "Mora Media (31-60 d\xEDas)", "Cartera Cr\xEDtica (+60 d\xEDas)", "En Cobro Jur\xEDdico"] },
        {
          key: "withholdingDeducted",
          label: "Retenciones Practicadas por el Cliente al Pagar",
          type: "text",
          placeholder: "ReteFuente $85.000 + ReteICA $24.000",
          requiredFeatureKey: "comp-payment-withholding-deduct"
        },
        { key: "amountReceived", label: "Valor Neto Ingresado a Caja/Banco ($ COP)", type: "number", placeholder: "3450000" }
      ]
    },
    {
      moduleKey: "mod-payables-cxp",
      parentServiceKey: "srv-treasury",
      externalSubmoduleName: "Cuentas por Pagar (CxP) y Comprobantes de Egreso",
      tabIcon: "\u{1F4E4}",
      summary: "Programaci\xF3n de pagos a proveedores, abonos a \xF3rdenes de compra y exportaci\xF3n de archivo plano ACH.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Emitir Comprobante de Egreso (CE)",
      tableHeaders: ["Comprobante CE", "Proveedor Beneficiario", "Factura / OC Cruzada", "Banco / Medio", "Valor Pagado ($ COP)"],
      fields: [
        { key: "ceNumber", label: "Consecutivo Comprobante de Egreso", type: "text", placeholder: "CE-2026-00892" },
        { key: "supplierBeneficiary", label: "Proveedor / Beneficiario", type: "text", placeholder: "Distribuidora Mayorista del Eje S.A.S." },
        { key: "invoiceRef", label: "Factura de Compra / Orden Cruzada", type: "text", placeholder: "FC-99412 / OC-00418" },
        { key: "bankSource", label: "Cuenta Bancaria o Caja Origen", type: "select", options: ["Bancolombia Cta Corriente \u2014 Dispersiones PAB", "Davivienda Empresarial ACH", "Nequi Negocios", "Caja General Principal"] },
        { key: "paidAmount", label: "Valor Girado ($ COP)", type: "number", placeholder: "2890000" }
      ]
    },
    {
      moduleKey: "mod-banks-reconciliation",
      parentServiceKey: "srv-treasury",
      externalSubmoduleName: "Bancos, Traslados y Conciliaci\xF3n Bancaria",
      tabIcon: "\u{1F3E6}",
      summary: "Saldos en libros vs extracto bancario, traslados entre cajas/bancos e imputaci\xF3n autom\xE1tica de 4x1000.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Registrar Conciliaci\xF3n / Traslado",
      tableHeaders: ["Cuenta Bancaria", "Per\xEDodo Corte", "Saldo en Libros", "Saldo Extracto", "Diferencia Conciliada ($ COP)"],
      fields: [
        { key: "bankAccount", label: "Cuenta Bancaria o Billetera", type: "select", options: ["Bancolombia Corriente #412-88901-2", "Davivienda Ahorros #0051-99120", "BBVA Empresarial #110-44521", "Billetera Nequi / QR Bre-B"] },
        { key: "cutoffPeriod", label: "Mes de Conciliaci\xF3n / Operaci\xF3n", type: "text", placeholder: "Noviembre 2026 \u2014 Corte Mensual" },
        { key: "bookBalance", label: "Saldo Seg\xFAn Libros ($ COP)", type: "number", placeholder: "48520000" },
        { key: "statementBalance", label: "Saldo Seg\xFAn Extracto Bancario ($ COP)", type: "number", placeholder: "48520000" }
      ]
    },
    {
      moduleKey: "mod-petty-cash",
      parentServiceKey: "srv-treasury",
      externalSubmoduleName: "Cajas Menores y Gastos de Turno (FixMotor)",
      tabIcon: "\u{1FA99}",
      summary: "Control de salidas operativas de efectivo (Expenses FixMotor), vales provisionales y reembolso de caja menor.",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "Registrar Gasto / Legalizaci\xF3n",
      tableHeaders: ["Comprobante", "Categor\xEDa de Gasto", "Concepto / Tercero", "Medio de Salida", "Valor Gasto ($ COP)"],
      fields: [
        { key: "expenseCategory", label: "Categor\xEDa Operativa", type: "select", options: ["Insumos y Suministros R\xE1pidos", "Transporte, Peajes y Mensajer\xEDa", "Servicios P\xFAblicos y Aseo", "Gastos Generales de Turno"] },
        { key: "expenseDescription", label: "Concepto y NIT del Soporte", type: "text", placeholder: "Compra Jab\xF3n Desengrasante y Papeler\xEDa \u2014 NIT 800.112.440" },
        { key: "paymentSource", label: "Pagado Desde", type: "select", options: ["Efectivo de Caja (Resta Efectivo Neto)", "Fondo Fijo Caja Menor Administraci\xF3n", "Transferencia Nequi Menor"] },
        { key: "expenseAmount", label: "Valor del Gasto ($ COP)", type: "number", placeholder: "65000" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-payment-withholding-deduct",
      externalName: "Liquidaci\xF3n de retenciones aplicadas por el cliente en el recaudo (v2)",
      description: "Permite descontar ReteFuente, ReteICA y ReteIVA practicadas por el cliente al registrar el Recibo de Caja.",
      parentModuleKey: "mod-receivables-cxc",
      includedByDefault: true,
      monthlyAddonUsd: 15e3
    },
    {
      componentKey: "comp-gmf-4x1000-auto",
      externalName: "C\xE1lculo autom\xE1tico de GMF (4x1000) en egresos bancarios",
      description: "Calcula y contabiliza autom\xE1ticamente el gravamen a los movimientos financieros (4x1000) en cuentas no exentas.",
      parentModuleKey: "mod-banks-reconciliation",
      includedByDefault: true,
      monthlyAddonUsd: 15e3
    }
  ]
};

// apps/srv-workshop/frontend/workshop-service.view.ts
var SRV_WORKSHOP_FRONTEND_VIEW = {
  serviceKey: "srv-workshop",
  externalPrincipalModuleName: "Talleres Automotrices, OT Kanban y Comisiones (FixMotor)",
  icon: "\u{1F527}",
  subtitle: "Recepci\xF3n t\xE9cnica por placa, sem\xE1foro SOAT/Tecnomec\xE1nica/Aceite, tablero Kanban de 5 etapas y liquidaci\xF3n de mec\xE1nicos.",
  standaloneMonthlyUsd: 129e3,
  submodules: [
    {
      moduleKey: "mod-vehicles-assets",
      parentServiceKey: "srv-workshop",
      externalSubmoduleName: "Parque Automotor / Equipos y Alertas (SOAT / Aceite)",
      tabIcon: "\u{1F3CD}\uFE0F",
      summary: "Hoja de vida cl\xEDnica por placa/serial, od\xF3metro actual, pr\xF3ximo cambio de aceite y vencimientos SOAT/Tecnomec\xE1nica.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Guardar Veh\xEDculo / Activo en BD",
      tableHeaders: ["Placa / Serial", "Marca y L\xEDnea", "Propietario", "Kilometraje / Pr\xF3ximo Aceite", "Sem\xE1foro SOAT / Tecno"],
      fields: [
        { key: "plate", label: "Placa del Veh\xEDculo o Serial Equipo", type: "text", placeholder: "KLM-84G / WXY-912" },
        { key: "makeModel", label: "Marca y L\xEDnea / Modelo", type: "text", placeholder: "Yamaha NMAX Connected 155 \u2014 Mod 2025" },
        { key: "ownerName", label: "Cliente Propietario y WhatsApp", type: "text", placeholder: "Andr\xE9s Felipe Toro \u2014 315 842 9910" },
        { key: "mileageInfo", label: "Kilometraje Actual / Pr\xF3ximo Cambio Aceite", type: "text", placeholder: "Actual: 14.200 Km | Pr\xF3ximo Aceite: 17.000 Km" },
        {
          key: "legalAlerts",
          label: "Estado SOAT y Revisi\xF3n Tecnomec\xE1nica",
          type: "select",
          options: ["Vigente al D\xEDa (Verde)", "Pr\xF3ximo a Vencer < 15 D\xEDas (Naranja)", "SOAT / Tecnomec\xE1nica Vencido (Rojo)"],
          requiredFeatureKey: "comp-soat-tecno-oil-alerts"
        }
      ]
    },
    {
      moduleKey: "mod-work-orders-kanban",
      parentServiceKey: "srv-workshop",
      externalSubmoduleName: "Recepci\xF3n 360\xB0 y Tablero Kanban de Taller (5 Etapas)",
      tabIcon: "\u{1F4CB}",
      summary: "\xD3rdenes de trabajo (Recibido -> Diagn\xF3stico -> Esperando Repuesto -> En Reparaci\xF3n -> Listo para Entrega) con aviso WhatsApp.",
      monthlyAddonUsd: 49e3,
      actionButtonLabel: "Crear / Avanzar Orden en Kanban",
      tableHeaders: ["N\xB0 Orden (OT)", "Placa y Cliente", "T\xE9cnico Asignado", "Etapa Kanban", "Trabajos y Total ($ COP)"],
      fields: [
        { key: "otNumber", label: "N\xFAmero de Orden de Trabajo", type: "text", placeholder: "OT-2026-00914" },
        { key: "vehicleAndClient", label: "Placa y Propietario", type: "text", placeholder: "KLM-84G \u2014 Andr\xE9s Felipe Toro" },
        { key: "assignedWorker", label: "Mec\xE1nico / T\xE9cnico Responsable", type: "select", options: ["Carlos Julio Pineda (Especialista Inyecci\xF3n)", "Robinson Morales (Frenos y Suspensi\xF3n)", "Diego Fernando R\xEDos (Electricidad y Diagn\xF3stico)"] },
        { key: "kanbanStage", label: "Etapa en el Tablero Kanban", type: "select", options: ["1. Recibido en Taller", "2. En Diagn\xF3stico T\xE9cnico", "3. Esperando Repuesto", "4. En Reparaci\xF3n en Bah\xEDa", "5. Listo para Entrega (Notificar WhatsApp)"] },
        { key: "servicesChecklist", label: "Trabajos Solicitados y Checklist Recepci\xF3n", type: "text", placeholder: "Cambio Aceite + Pastillas Delanteras (Deja Casco, Combustible 50%)" },
        { key: "estimatedTotal", label: "Total Repuestos + Mano de Obra ($ COP)", type: "number", placeholder: "285000" }
      ]
    },
    {
      moduleKey: "mod-worker-commissions",
      parentServiceKey: "srv-workshop",
      externalSubmoduleName: "Liquidaci\xF3n de Comisiones de Mec\xE1nicos / T\xE9cnicos",
      tabIcon: "\u{1F477}",
      summary: "Acumulador de mano de obra producida en el turno (totalDia), porcentaje del t\xE9cnico vs taller y liquidaci\xF3n auditable.",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Liquidar Corte de Comisi\xF3n a T\xE9cnico",
      tableHeaders: ["Liquidaci\xF3n", "Mec\xE1nico / T\xE9cnico", "Mano de Obra Bruta", "% Comisi\xF3n", "Pagado a T\xE9cnico ($ COP)"],
      fields: [
        { key: "settlementCode", label: "C\xF3digo de Liquidaci\xF3n", type: "text", placeholder: "LIQ-TEC-00312" },
        { key: "workerName", label: "Mec\xE1nico / T\xE9cnico", type: "text", placeholder: "Carlos Julio Pineda" },
        { key: "grossLabor", label: "Total Bruto Mano de Obra del Turno ($ COP)", type: "number", placeholder: "640000" },
        { key: "commissionPct", label: "Esquema de Participaci\xF3n (%)", type: "select", options: ["60% T\xE9cnico / 40% Taller", "50% T\xE9cnico / 50% Taller", "40% T\xE9cnico / 60% Taller", "70% Especialista Externo / 30% Taller"] },
        { key: "paidToWorker", label: "Neto Pagado al T\xE9cnico ($ COP)", type: "number", placeholder: "384000" }
      ]
    },
    {
      moduleKey: "mod-warranties",
      parentServiceKey: "srv-workshop",
      externalSubmoduleName: "Garant\xEDas de Repuestos y Mano de Obra",
      tabIcon: "\u{1F6E1}\uFE0F",
      summary: "Control de reingresos por garant\xEDa vinculados a la factura original o serial del repuesto instalado.",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "Registrar Caso de Garant\xEDa",
      tableHeaders: ["Radicado Garant\xEDa", "Factura / OT Origen", "Placa / Repuesto", "Dictamen T\xE9cnico", "Costo Asumido ($ COP)"],
      fields: [
        { key: "warrantyCode", label: "Radicado de Garant\xEDa", type: "text", placeholder: "GAR-2026-0048" },
        { key: "originInvoiceOt", label: "Factura y OT Original", type: "text", placeholder: "FEV-1088 / OT-2026-00810" },
        { key: "itemOrService", label: "Placa y Repuesto / Trabajo Reclamado", type: "text", placeholder: "KLM-84G \u2014 Bater\xEDa Gel 12V 7Ah (Serial BAT-9912)" },
        { key: "resolutionType", label: "Resoluci\xF3n T\xE9cnica", type: "select", options: ["Reposici\xF3n sin Costo por Proveedor", "Ajuste Mano de Obra Taller", "Improcedente por Mal Uso"] },
        { key: "assumedCost", label: "Valor Cubierto ($ COP)", type: "number", placeholder: "145000" }
      ]
    }
  ],
  features: [
    {
      componentKey: "comp-soat-tecno-oil-alerts",
      externalName: "Sem\xE1foro preventivo de SOAT, Tecnomec\xE1nica y Cambio de Aceite",
      description: "Muestra alertas autom\xE1ticas al digitar la placa si el veh\xEDculo tiene documentos o cambio de aceite pr\xF3ximos a vencer.",
      parentModuleKey: "mod-vehicles-assets",
      includedByDefault: true,
      monthlyAddonUsd: 15e3
    },
    {
      componentKey: "comp-kanban-whatsapp-notify",
      externalName: "Notificaci\xF3n WhatsApp en 1 clic por etapa del Kanban",
      description: "Env\xEDa mensaje autom\xE1tico al celular del cliente cuando su veh\xEDculo avanza de etapa o est\xE1 Listo para Entrega.",
      parentModuleKey: "mod-work-orders-kanban",
      includedByDefault: true,
      monthlyAddonUsd: 15e3
    },
    {
      componentKey: "comp-pos-ot-preload",
      externalName: "Precarga autom\xE1tica de Orden de Trabajo en Caja POS",
      description: "Al facturar una placa con orden pendiente en el taller, carga autom\xE1ticamente sus repuestos, mano de obra y mec\xE1nico.",
      parentModuleKey: "mod-work-orders-kanban",
      includedByDefault: true,
      monthlyAddonUsd: 19e3
    }
  ]
};

// apps/web-app/src/application/registries/platform-centers.registry.ts
var MICROSERVICE_FRONTEND_CATALOG = [
  SRV_INVOICING_FRONTEND_VIEW,
  SRV_INVENTORY_FRONTEND_VIEW,
  SRV_PROCUREMENT_FRONTEND_VIEW,
  SRV_TREASURY_FRONTEND_VIEW,
  SRV_CRM_FRONTEND_VIEW,
  SRV_FINANCE_FRONTEND_VIEW,
  SRV_HR_PAYROLL_FRONTEND_VIEW,
  SRV_REPORTS_FRONTEND_VIEW,
  SRV_GASTRO_FRONTEND_VIEW,
  SRV_WORKSHOP_FRONTEND_VIEW,
  SRV_FLEET_FRONTEND_VIEW,
  SRV_APPOINTMENTS_FRONTEND_VIEW,
  SRV_HOTEL_FRONTEND_VIEW,
  SRV_TICKETING_FRONTEND_VIEW
];
var ALL_SUBMODULES_FLAT = MICROSERVICE_FRONTEND_CATALOG.flatMap((svc) => svc.submodules);
var ALL_FEATURES_FLAT = MICROSERVICE_FRONTEND_CATALOG.flatMap((svc) => svc.features);
var BUSINESS_TYPE_PRESETS = [
  {
    id: "comercio-retail",
    name: "Comercio, Tienda & Ferreter\xEDa",
    badge: "Plan Base Completo Comercial",
    description: "Incluye Caja POS, Cotizaciones, Existencias, Bodega Base, Compras a Proveedores, Directorio de Clientes, Cartera y Reportes.",
    baseMonthlyUsd: 169e3,
    includedPrincipalServices: ["srv-invoicing", "srv-inventory", "srv-procurement", "srv-crm", "srv-treasury", "srv-reports"],
    includedSubmodules: ["mod-pos", "mod-quotes", "mod-stock", "mod-warehouses", "mod-purchase-orders", "mod-directory", "mod-receivables-cxc", "mod-sales-profitability-reports"],
    includedFeatures: ["comp-cashier-name", "comp-line-discount", "comp-manager-signature", "comp-nit-dv-auto"]
  },
  {
    id: "restaurante-gastro",
    name: "Restaurante, Gastrobar & Cafeter\xEDa",
    badge: "Plan Base Completo Gastron\xF3mico",
    description: "Incluye Sal\xF3n y Mesas, Monitor KDS, Modificadores de Carta, Divisi\xF3n de Cuentas, Domicilios, Caja POS con Propina y Recetas BOM.",
    baseMonthlyUsd: 199e3,
    includedPrincipalServices: ["srv-gastro", "srv-invoicing", "srv-inventory", "srv-procurement", "srv-treasury", "srv-reports"],
    includedSubmodules: ["mod-tables", "mod-kds", "mod-modifiers-menu", "mod-split", "mod-deliveries", "mod-pos", "mod-stock", "mod-recipes", "mod-petty-cash", "mod-sales-profitability-reports"],
    includedFeatures: ["comp-cashier-name", "comp-tip", "comp-waiter-assign", "comp-courtesy-auth"]
  },
  {
    id: "bares-discotecas",
    name: "Bares, Licores & Entretenimiento Nocturno",
    badge: "Plan Base Especializado Bares",
    description: "Incluye Barra y Mesas, Comandas KDS, Control por Trago/Botella, Happy Hour, Taquilla/Covers QR, Torniquetes y Caja POS.",
    baseMonthlyUsd: 199e3,
    includedPrincipalServices: ["srv-gastro", "srv-ticketing", "srv-invoicing", "srv-inventory", "srv-treasury", "srv-reports"],
    includedSubmodules: ["mod-tables", "mod-kds", "mod-split", "mod-event-tickets", "mod-gate-scanner", "mod-pos", "mod-stock", "mod-recipes", "mod-petty-cash"],
    includedFeatures: ["comp-bar-shot-measure", "comp-happy-hour-pricing", "comp-waiter-assign", "comp-tip", "comp-cashier-name", "comp-anti-clone-qr-gate"]
  },
  {
    id: "talleres-fixmotor",
    name: "Talleres Automotrices, CDA & Servicio T\xE9cnico (FixMotor)",
    badge: "Plan Especializado FixMotor",
    description: "Incluye Flota/Veh\xEDculos de Clientes, \xD3rdenes de Trabajo Kanban con Checklist, Comisiones de T\xE9cnicos, Garant\xEDas, Repuestos y POS/FE.",
    baseMonthlyUsd: 229e3,
    includedPrincipalServices: ["srv-workshop", "srv-inventory", "srv-procurement", "srv-invoicing", "srv-crm", "srv-treasury", "srv-reports"],
    includedSubmodules: ["mod-vehicles-assets", "mod-work-orders-kanban", "mod-worker-commissions", "mod-warranties", "mod-stock", "mod-warehouses", "mod-purchase-orders", "mod-pos", "mod-dian", "mod-directory", "mod-customer-360"],
    includedFeatures: ["comp-intake-checklist-sign", "comp-warranty-vin-alert", "comp-nit-dv-auto", "comp-cashier-name"]
  },
  {
    id: "servicios-citas-v2",
    name: "Consultorios, IPS, Centros de Servicios & Citas (v2)",
    badge: "Plan Especializado Estilo v2",
    description: "Incluye Agendas Multi-Profesional, Recordatorios WhatsApp IA, Turnador TV, Contratos con Bolsa v2, Tarifarios, Facturaci\xF3n Agrupada y Glosas.",
    baseMonthlyUsd: 249e3,
    includedPrincipalServices: ["srv-appointments", "srv-crm", "srv-invoicing", "srv-inventory", "srv-treasury", "srv-reports"],
    includedSubmodules: ["mod-calendar-slots", "mod-staff-schedules", "mod-interactive-reminders", "mod-queue-turnador", "mod-directory", "mod-contracts", "mod-tariffs", "mod-grouped-billing", "mod-glosas-disputes", "mod-dian", "mod-tech-reception", "mod-lots"],
    includedFeatures: ["comp-overbooking-guard", "comp-whatsapp-ai-reschedule", "comp-contract-budget-alert", "comp-expiry-semaphore"]
  },
  {
    id: "reservas-tickets-hotel",
    name: "Hoteles, Glamping, Clubes & Taquilla de Eventos",
    badge: "Plan Base Alojamiento y Cupos",
    description: "Incluye Reserva de Caba\xF1as/Salones, Recepci\xF3n y Folio de Hu\xE9sped, Tarifas por Temporada, Ama de Llaves, Pasad\xEDas QR y Facturaci\xF3n.",
    baseMonthlyUsd: 229e3,
    includedPrincipalServices: ["srv-hotel", "srv-ticketing", "srv-gastro", "srv-invoicing", "srv-crm", "srv-treasury"],
    includedSubmodules: ["mod-bookings", "mod-rooms", "mod-seasonal-rates", "mod-housekeeping", "mod-tickets", "mod-tables", "mod-pos", "mod-dian", "mod-directory"],
    includedFeatures: ["comp-qr-ticket", "comp-cashier-name", "comp-nit-dv-auto"]
  },
  {
    id: "distribuidora-mayorista",
    name: "Distribuidora Mayorista, Importadora & Multi-Bodega",
    badge: "Plan Base Completo Mayorista",
    description: "Incluye Facturaci\xF3n DIAN, Tarifarios, Bodegas WMS, Traslados, Toma F\xEDsica Ciega, Compras, RADIAN, Documento Soporte, Cartera CxC/CxP y PUC.",
    baseMonthlyUsd: 259e3,
    includedPrincipalServices: ["srv-invoicing", "srv-inventory", "srv-procurement", "srv-treasury", "srv-crm", "srv-finance", "srv-reports"],
    includedSubmodules: ["mod-pos", "mod-dian", "mod-tariffs", "mod-quotes", "mod-stock", "mod-warehouses", "mod-transfers", "mod-physical-count", "mod-purchase-orders", "mod-purchase-invoices", "mod-radian-events", "mod-landed-costs", "mod-receivables-cxc", "mod-payables-cxp", "mod-directory", "mod-puc"],
    includedFeatures: ["comp-manager-signature", "comp-carrier-select", "comp-credit-quota-lock", "comp-margin-drop-alert"]
  },
  {
    id: "agro-logistica-bascula",
    name: "Agroindustria, Transporte de Carga RNDC & B\xE1scula Camionera",
    badge: "Plan Base Completo Log\xEDstico y Pesaje",
    description: "Incluye B\xE1scula Camionera RS-232 (Bruto/Tara/Neto), Manifiestos RNDC, Anticipos y Liquidaci\xF3n de Viajes, Llantas, Bodegas, Lotes y DIAN.",
    baseMonthlyUsd: 289e3,
    includedPrincipalServices: ["srv-fleet", "srv-inventory", "srv-procurement", "srv-invoicing", "srv-treasury", "srv-crm", "srv-finance"],
    includedSubmodules: ["mod-fleet-scale", "mod-fleet-dispatch-rndc", "mod-trip-settlements", "mod-tires-fleet-maint", "mod-stock", "mod-warehouses", "mod-transfers", "mod-lots", "mod-scale", "mod-support-doc-dse", "mod-dian", "mod-receivables-cxc", "mod-payables-cxp", "mod-directory"],
    includedFeatures: ["comp-manager-signature", "comp-carrier-select", "comp-scale-tare", "comp-weighbridge-humidity-discount", "comp-rndc-manifest-sync"]
  },
  {
    id: "erp-corporativo-integral",
    name: "ERP Corporativo Multi-Sede (NIIF + N\xF3mina DIAN + BI)",
    badge: "Suite Empresarial Todo-en-Uno",
    description: "Habilita Contabilidad NIIF, Ex\xF3gena DIAN, N\xF3mina Electr\xF3nica CUNE + PILA, Tesorer\xEDa, Compras RADIAN, Inventario WMS, Facturaci\xF3n y BI.",
    baseMonthlyUsd: 389e3,
    includedPrincipalServices: ["srv-invoicing", "srv-inventory", "srv-procurement", "srv-treasury", "srv-finance", "srv-hr-payroll", "srv-reports", "srv-crm"],
    includedSubmodules: ["mod-pos", "mod-dian", "mod-tariffs", "mod-grouped-billing", "mod-stock", "mod-warehouses", "mod-transfers", "mod-physical-count", "mod-purchase-orders", "mod-purchase-invoices", "mod-support-doc-dse", "mod-radian-events", "mod-receivables-cxc", "mod-payables-cxp", "mod-banks-reconciliation", "mod-puc", "mod-cost-centers", "mod-fixed-assets", "mod-exogena-taxes", "mod-employees-contracts", "mod-payroll-settlement", "mod-social-benefits-pila", "mod-electronic-payroll-dian", "mod-financial-reports", "mod-tax-dian-reports", "mod-directory", "mod-contracts"],
    includedFeatures: ["comp-nit-dv-auto", "comp-credit-quota-lock", "comp-withholding-calc", "comp-ley1607-exoneration", "comp-cune-dian-payroll", "comp-dian-xml-exporter"]
  }
];

// apps/web-app/src/application/registries/platform-expansion-seed-rows.registry.ts
var EXPANSION_SUBMODULE_SEED_ROWS = {
  // srv-crm (Nuevos submódulos v2 + FixMotor)
  "mod-contracts": [
    ["CNT-2026-0084", "Grupo Industrial del Pac\xEDfico S.A.", "2026-01-01 a 2026-12-31", "$ 120.000.000", "$ 84.500.000"],
    ["CNT-2026-0112", "Cl\xEDnica y Servicios Integrales S.A.S.", "2026-03-01 a 2027-02-28", "$ 95.000.000", "$ 61.200.000"]
  ],
  "mod-customer-360": [
    ["Comercializadora del Valle S.A.S.", "Campe\xF3n VIP (Alta Frecuencia)", "$ 68.400.000", "$ 4.850.000", "4 D\xEDas"],
    ["Transportes R\xE1pidos del Norte S.A.S.", "Leal Recurrente", "$ 31.200.000", "$ 2.600.000", "11 D\xEDas"]
  ],
  // srv-invoicing (Nuevos submódulos v2)
  "mod-tariffs": [
    ["TAR-CORP-2026", "Tarifario Mayorista Institucional (-15%)", "Descuento % sobre Lista Base", "2026 Anual", "$ 125.000"],
    ["TAR-CONV-V2", "Convenio Corporativo Especial Pactado", "Precio Fijo Pactado por \xCDtem", "2026 Semestral", "$ 98.500"]
  ],
  "mod-grouped-billing": [
    ["FAC-AGR-2026-089", "Grupo Industrial del Pac\xEDfico \u2014 CNT-2026-0084", "28 Remisiones Verificadas (Mes)", "Corte Mensual", "$ 18.950.000"]
  ],
  "mod-glosas-disputes": [
    ["GLO-2026-00312", "FEV-10421 \u2014 Comercializadora del Valle", "Diferencia en Tarifa Pactada", "$ 420.000", "Conciliada (NC Parcial)"]
  ],
  // srv-inventory (Nuevos submódulos v2)
  "mod-tech-reception": [
    ["ACT-REC-2026-118", "Distribuidora Nacional \u2014 FE-9941", "Lote L-8841 \u2014 Temp: 4.2 \xB0C (OK)", "\xCDntegro Sellado", "Aprobado \u2014 Stock Disponible"]
  ],
  "mod-physical-count": [
    ["TOM-CIEGA-2026-09", "Bodega Central Principal", "145 Referencias Auditadas", "$ -48.000", "Ajuste Contabilizado"]
  ],
  // srv-procurement (Nuevo Microservicio Compras + RADIAN + Doc Soporte)
  "mod-purchase-orders": [
    ["OC-2026-00418", "Distribuidora Nacional de Insumos \u2014 900.412.889-1", "Bodega Central Principal", "Recibida 100%", "$ 4.850.000"],
    ["OC-2026-00419", "Importadora Andina de Repuestos \u2014 901.220.410-8", "Bodega Norte Punto Venta", "Parcial (70%)", "$ 8.200.000"]
  ],
  "mod-purchase-invoices": [
    ["FE-99412", "Importadora Andina S.A.S.", "OC-2026-00418 / EA-109", "IVA 19% + ReteFuente 2.5%", "$ 5.420.000"]
  ],
  "mod-support-doc-dse": [
    ["DSE-000215", "Jairo Alberto M\xE9ndez \u2014 CC 79.884.120", "Mantenimiento El\xE9ctrico Sede Norte", "CUDS Validado DIAN", "$ 950.000"]
  ],
  "mod-radian-events": [
    ["FEV-88410", "Licores y Bebidas Nacionales S.A.", "030 Acuse + 032 Recibo + 033 Aceptaci\xF3n", "T\xEDtulo Valor RADIAN OK", "$ 3.680.000"]
  ],
  "mod-landed-costs": [
    ["PRF-2026-041", "EA-2026-109 (Bodega Central)", "Flete Tractomula Puerto Buenaventura", "Por Peso en Kilogramos", "$ 1.850.000"]
  ],
  // srv-treasury (Nuevo Microservicio Tesorería, Cartera y Bancos)
  "mod-receivables-cxc": [
    ["RC-2026-00891", "Comercializadora del Valle S.A.S.", "FEV-10421 (Corriente <30 d\xEDas)", "Transferencia Bancolombia", "$ 4.850.000"]
  ],
  "mod-payables-cxp": [
    ["CE-2026-00314", "Importadora Andina S.A.S.", "FE-99412 (Por Vencer)", "Dispersi\xF3n PAB ACH", "$ 5.420.000"]
  ],
  "mod-banks-reconciliation": [
    ["CON-2026-11", "Bancolombia Cuenta Corriente 441-889201-04", "$ 48.920.000", "$ 48.920.000", "$ 0 (Conciliado)"]
  ],
  "mod-petty-cash": [
    ["CM-ADMIN-01", "Elementos de Cafeter\xEDa, Papeler\xEDa y Peajes", "Claudia Patricia G\xF3mez", "$ 1.500.000", "$ 342.000"]
  ],
  // srv-finance (Nuevos submódulos NIIF + Exógena)
  "mod-cost-centers": [
    ["CC-200-LOGISTICA", "Operaci\xF3n Planta Norte y Distribuci\xF3n", "Sede Principal", "$ 45.000.000", "$ 31.800.000"]
  ],
  "mod-fixed-assets": [
    ["AF-MAQ-0042", "Montacargas El\xE9ctrico Toyota 2.5 Ton", "60 Meses", "$ 95.000.000", "$ 79.166.667"]
  ],
  "mod-exogena-taxes": [
    ["Formato 1001 DIAN", "5004 \u2014 Compra de Inventarios y Retenciones", "128 NITs Reportados", "A\xF1o Gravable 2026", "$ 845.000.000"]
  ],
  // srv-hr-payroll (Nuevo Microservicio Nómina Electrónica DIAN + PILA)
  "mod-employees-contracts": [
    ["CC 1.032.488.910", "Juli\xE1n David Torres \u2014 Jefe Operaciones", "T\xE9rmino Indefinido", "Sura EPS / Porvenir AFP / ARL II", "$ 2.850.000"]
  ],
  "mod-payroll-settlement": [
    ["NOM-2026-11-Q1", "Juli\xE1n David Torres", "$ 3.120.000", "$ 228.000 (Salud 4% + Pensi\xF3n 4%)", "$ 2.892.000"]
  ],
  "mod-social-benefits-pila": [
    ["PILA-2026-11-8841", "Planilla Integrada PILA Mensual", "14 Colaboradores", "Exonerado Ley 1607 Art 114-1", "$ 9.450.000"]
  ],
  "mod-electronic-payroll-dian": [
    ["NE-2026-00314", "Juli\xE1n David Torres", "CUNE-9f82a41c-dian-2026-ok", "Aceptado DIAN Sin Observaciones", "$ 2.892.000"]
  ],
  // srv-reports (Nuevo Microservicio BI y Reportes Centralizados)
  "mod-financial-reports": [
    ["Estado de Resultados (PyG) NIIF", "Mensual Consolidado 2026-11", "Todas las Sedes", "Utilidad Neta +24.8%", "$ 84.500.000"]
  ],
  "mod-sales-profitability-reports": [
    ["Corte Diario Ventas + Margen FIFO", "Sede Principal \u2014 Andr\xE9s Felipe", "Efectivo + QR + Tarjetas", "Margen Bruto 38.4%", "$ 14.850.000"]
  ],
  "mod-inventory-reports": [
    ["Valorizaci\xF3n de Stock y Alertas FEFO", "Bodega Central Principal", "248 SKUs Activos", "4 Lotes < 60 d\xEDas", "$ 192.400.000"]
  ],
  "mod-tax-dian-reports": [
    ["Anexo Bimestral IVA (Formulario 300)", "2026 Bimestre 05", "IVA Generado $18.4M vs Descontable $11.2M", "Validado PUC", "$ 7.200.000"]
  ],
  "mod-custom-report-builder": [
    ["Rentabilidad por Cliente y L\xEDnea v2", "Ventas + Inventario + Cartera", "Excel (.xlsx) + PDF Ejecutivo", "Lun-Vie 06:00 AM", "Activo"]
  ],
  // srv-gastro (Nuevos submódulos)
  "mod-modifiers-menu": [
    ["T\xE9rmino de Cocci\xF3n / Adiciones Parrilla", "Cortes de Parrilla y Hamburguesas", "Azul, Medio, 3/4, Bien Asado + Tocineta", "$ 8.500", "Activo en KDS"]
  ],
  "mod-deliveries": [
    ["DOM-2026-419", "Cra 15 # 88-20 Apto 502 \u2014 310 554 1190", "WhatsApp Directo", "Kevin Mora \u2014 Moto KLM-45D", "$ 94.000"]
  ],
  // srv-workshop (Nuevo Microservicio Talleres FixMotor)
  "mod-vehicles-assets": [
    ["KLM-482 (VIN 9FB...)", "Toyota Hilux SRX 4x4 2.8L Diesel 2024", "Inversiones del Norte S.A.S.", "42.850 Km", "SOAT Vigente 2027-04"]
  ],
  "mod-work-orders-kanban": [
    ["OT-2026-00842", "KLM-482 \u2014 Toyota Hilux SRX", "En Reparaci\xF3n en Bah\xEDa 02", "Ing. Mauricio Casta\xF1o", "$ 1.850.000"]
  ],
  "mod-worker-commissions": [
    ["LIQ-TEC-2026-11", "Ing. Mauricio Casta\xF1o (L\xEDder)", "14 \xD3rdenes Entregadas", "35% sobre Mano de Obra ($6.8M)", "$ 2.380.000"]
  ],
  "mod-warranties": [
    ["GAR-2026-019", "OT-2026-00842 / Placa KLM-482", "Sincronizaci\xF3n e Inyectores Diesel", "90 D\xEDas o 5.000 Km", "Certificado Emitido"]
  ],
  // srv-fleet (Nuevo Microservicio Flotas, Báscula RS-232 y RNDC)
  "mod-fleet-scale": [
    ["BAS-FL-7741", "SXT-942 / R-4481", "TransCarga Pesada \u2014 Hernando Valencia", "52.400 Kg", "16.800 Kg", "35.600 Kg (35.60 Ton)"]
  ],
  "mod-fleet-dispatch-rndc": [
    ["MN-2026-08841", "Buenaventura (Valle) \u2192 Bogot\xE1 D.C.", "WXY-812 / R-5520", "\xC1lvaro G\xF3mez \u2014 Lic. C3", "$ 4.850.000"]
  ],
  "mod-trip-settlements": [
    ["LIQ-V-2026-310", "MN-2026-08841", "$ 2.200.000", "18 Peajes + 145 Gal ACPM ($1.95M)", "$ 2.601.500"]
  ],
  "mod-tires-fleet-maint": [
    ["MICH-295-80R22-991", "WXY-812 \u2014 Eje 1 Direccional Izq", "8.5 mm (\xD3ptimo)", "64.200 Km", "SOAT y Tecno Al D\xEDa"]
  ],
  // srv-appointments (Nuevo Microservicio Agendamiento v2 + IA)
  "mod-calendar-slots": [
    ["CIT-2026-0412", "Laura Valentina R\xEDos \u2014 315 884 1200", "Dr. Alejandro Mej\xEDa \u2014 Consultorio 201", "2026-11-12 09:30 AM", "Valoraci\xF3n Especializada"]
  ],
  "mod-staff-schedules": [
    ["Dr. Alejandro Mej\xEDa", "Sede Principal \u2014 Consultorio 201", "Lunes a Viernes 07:00 AM - 05:00 PM", "30 Minutos", "Publicada"]
  ],
  "mod-interactive-reminders": [
    ["WSP-2026-8812", "Laura Valentina R\xEDos (+57 3158841200)", "WhatsApp Interactivo IA (24h/2h)", "Confirmada por Bot\xF3n WhatsApp", "Cupo Asegurado"]
  ],
  "mod-queue-turnador": [
    ["A-042 (Prioritario)", "Jorge Enrique Vargas", "Consultorio 201", "8 Minutos", "Llamando en Pantalla TV"]
  ],
  // srv-hotel (Nuevos submódulos)
  "mod-seasonal-rates": [
    ["Temporada Alta Puentes \u2014 Plan Americano", "Suite Junior VIP", "Vigencia Puentes 2026", "Alojamiento + Desayuno Buffet", "$ 340.000"]
  ],
  "mod-housekeeping": [
    ["Habitaci\xF3n 304", "Luz Marina Pineda", "Inspeccionada \u2014 Lista Check-In", "2x Agua Cristal Cargadas a Folio", "11:40 AM"]
  ],
  // srv-ticketing (Nuevo Microservicio Taquilla QR y Mesa PQRSF SLA)
  "mod-event-tickets": [
    ["TCK-EV-99201", "Palco VIP (Incluye Consumo)", "Santiago Ospina", "QR-PK-88412", "$ 65.000"]
  ],
  "mod-gate-scanner": [
    ["Porter\xEDa Principal Calle 85", "S\xE1bado Concierto en Vivo", "340 Validados", "450 Aforo M\xE1x", "Ingreso Activo (75%)"]
  ],
  "mod-pqrsf-helpdesk": [
    ["PQRS-2026-00914", "Petici\xF3n Ley 1755 (15 d\xEDas h\xE1biles)", "Marcela Quintero", "12 D\xEDas H\xE1biles Restantes", "En Tr\xE1mite (Verde SLA)"]
  ]
};

// apps/web-app/src/application/registries/platform-seed-state.registry.ts
var INITIAL_CLIENT_DATABASES = [
  {
    tenantId: "tnt-demo",
    companyName: "Entorno Demo Oficial Proveko (14 Microservicios)",
    nit: "900.000.000-1",
    businessTypeId: "erp-corporativo-integral",
    businessTypeName: "Entorno Demo Integral (14 M\xF3dulos Principales Activos)",
    dbName: "db_version_prueba",
    dbHost: "db",
    dbPort: 5432,
    paymentStatus: "DEMO",
    monthlyUsd: 0,
    adminUsername: "demo",
    adminPasswordHint: "DemoProveko2026!",
    maxRolesAllowed: 8,
    maxUsersAllowed: 25,
    activePrincipalServices: MICROSERVICE_FRONTEND_CATALOG.map((svc) => svc.serviceKey),
    activeSubmodules: ALL_SUBMODULES_FLAT.map((sub2) => sub2.moduleKey),
    activeFeatures: ALL_FEATURES_FLAT.map((feat) => feat.componentKey),
    internalRoles: [
      {
        roleId: "rol-admin",
        name: "Administrador General (Cuenta Admin)",
        description: "Control completo de la base de datos de la empresa, roles internos y los 14 m\xF3dulos.",
        allowedSubmodules: ["*"]
      },
      {
        roleId: "rol-cajero",
        name: "Cajero, Facturador y Cartera",
        description: "Operaci\xF3n de Caja POS, Facturaci\xF3n Electr\xF3nica DIAN, Tarifarios v2, Glosas y Recibos de Caja CxC.",
        allowedSubmodules: ["mod-pos", "mod-dian", "mod-tariffs", "mod-grouped-billing", "mod-glosas-disputes", "mod-quotes", "mod-directory", "mod-receivables-cxc"]
      },
      {
        roleId: "rol-bodega",
        name: "Jefe de Bodega, Compras y B\xE1scula RNDC",
        description: "Existencias, Bodegas WMS, Actas v2, Toma Ciega, Compras, RADIAN y B\xE1scula Camionera.",
        allowedSubmodules: ["mod-stock", "mod-warehouses", "mod-transfers", "mod-tech-reception", "mod-physical-count", "mod-recipes", "mod-lots", "mod-scale", "mod-purchase-orders", "mod-purchase-invoices", "mod-fleet-scale", "mod-fleet-dispatch-rndc"]
      },
      {
        roleId: "rol-operador",
        name: "Coordinador Operativo (Taller / Gastro / Citas / Hotel)",
        description: "\xD3rdenes de trabajo FixMotor, Sal\xF3n y KDS, Agenda de Citas v2, Alojamiento y Taquilla QR.",
        allowedSubmodules: ["mod-vehicles-assets", "mod-work-orders-kanban", "mod-tables", "mod-kds", "mod-calendar-slots", "mod-bookings", "mod-rooms", "mod-event-tickets"]
      }
    ],
    internalUsers: [
      {
        userId: "usr-demo-admin",
        username: "demo",
        fullName: "Administrador Demo Proveko",
        email: "demo@proveko.com",
        internalRoleId: "rol-admin",
        internalRoleName: "Administrador General (Cuenta Admin)",
        passwordHint: "DemoProveko2026!",
        isClientAdmin: true
      }
    ]
  }
];
var INITIAL_SUBMODULE_ROWS = {
  "mod-pos": [
    ["POS-9001", "Consumidor Final", "Laura G\xF3mez \u2014 Turno Ma\xF1ana", "Efectivo", "$ 148.500", "Emitido"],
    ["POS-9002", "Constructora Andina S.A.S.", "Laura G\xF3mez \u2014 Turno Ma\xF1ana", "Transferencia / QR", "$ 920.000", "Emitido"]
  ],
  "mod-dian": [
    ["FEV-10421", "Comercializadora del Valle S.A.S.", "901.452.110-4", "$ 4.850.000", "CUFE Validado DIAN", "Hoy 09:15"]
  ],
  "mod-quotes": [
    ["COT-308", "Ingenios Unidos S.A.", "2026-11-30", "Ing. Carlos Ruiz", "$ 12.400.000", "Vigente"]
  ],
  "mod-stock": [
    ["INS-00104", "Cemento Gris Estructural 50Kg", "Bodega Central Principal", "420 Und", "50 Und", "$ 31.500"],
    ["INS-00219", "Acero Figurado 1/2 Pulgada", "Bodega Norte Punto Venta", "185 Und", "40 Und", "$ 42.000"]
  ],
  "mod-warehouses": [
    ["BOD-CENTRAL-01", "Bodega Central Principal", "Barranquilla \u2014 V\xEDa 40", "800 Ton / 240 Estibas", "Firmado: Jorge Pardo", "Activa"],
    ["BOD-NORTE-02", "Bodega Norte Punto Venta", "Cartagena \u2014 Mamonal", "450 Ton / 120 Estibas", "Firmado: Andr\xE9s Mej\xEDa", "Activa"]
  ],
  "mod-transfers": [
    ["TR-501", "Bodega Central Principal", "Bodega Norte Punto Venta", "120 Sacos Cemento 50Kg", "Transportes R\xE1pidos del Norte S.A.S.", "Autorizado: Jorge Pardo"]
  ],
  "mod-recipes": [
    ["BOM-101", "Mortero Premezclado Seco x 40Kg", "Cemento (12Kg) + Arena S\xEDlice (28Kg) + Aditivo (0.2Kg)", "1 Saco", "$ 18.900"]
  ],
  "mod-lots": [
    ["LOT-2026-901", "Aditivo Impermeabilizante Industrial", "Bodega Central Principal", "2027-06-15", "95 Cu\xF1etes", "\xD3ptimo FEFO"]
  ],
  "mod-scale": [
    ["BAS-7741", "SXT-942 / R-4481", "TransCarga Pesada \u2014 Hernando Valencia", "52.400 Kg", "16.800 Kg", "35.600 Kg (35.60 Ton)"]
  ],
  "mod-tables": [
    ["Mesa 05 \u2014 Terraza", "4 Comensales", "Mateo R\xEDos", "$ 186.000", "Ocupada"]
  ],
  "mod-kds": [
    ["CMD-409", "Mesa 05 \u2014 Terraza", "2x Lomito t\xE9rmino 3/4, 2x Jugo Natural", "Parrilla y Calientes", "En Preparaci\xF3n (6 min)"]
  ],
  "mod-split": [
    ["DIV-112", "Mesa 05 \u2014 Terraza", "Partes Iguales", "4 Pagadores", "$ 46.500 c/u"]
  ],
  "mod-bookings": [
    ["RES-801", "Valeria Mendoza", "Sal\xF3n Auditorio Empresarial", "2026-11-12 08:00 - 12:00", "40 Cupos", "Confirmada"]
  ],
  "mod-tickets": [
    ["TCK-99201", "Pasad\xEDa Adulto (Incluye Almuerzo)", "Santiago Ospina", "QR-PK-99201", "$ 85.000", "V\xE1lido en Porter\xEDa"]
  ],
  "mod-rooms": [
    ["Habitaci\xF3n 304 \u2014 Ejecutiva", "Camila Restrepo", "2 Noches", "$ 210.000 / noche", "Check-In Activo"]
  ],
  "mod-directory": [
    ["901.452.110-4", "Comercializadora del Valle S.A.S.", "Cliente Corporativo", "Cali \u2014 315 890 1122", "$ 25.000.000"],
    ["900.771.220-8", "Transportes R\xE1pidos del Norte S.A.S.", "Empresa Transportista", "Barranquilla \u2014 300 441 9080", "$ 0"]
  ],
  "mod-pipelines": [
    ["OP-204", "Ingenios Unidos S.A.", "Propuesta Enviada", "Carlos Ruiz", "$ 28.000.000"]
  ],
  "mod-loyalty": [
    ["Diana Marcela Pineda", "Oro Preferencial", "2.450 Puntos", "Hoy", "5% Descuento Directo"]
  ],
  "mod-cashbook": [
    ["EGR-2041", "Bancolombia Cuenta Corriente", "Egreso / Pago", "Pago Flete Transporte Nacional", "Autorizado: Tesorer\xEDa", "$ 1.450.000"]
  ],
  "mod-arap": [
    ["CXC-8810", "Comercializadora del Valle S.A.S.", "Cuenta por Cobrar (Cliente)", "2026-11-30", "$ 4.850.000", "Al D\xEDa"]
  ],
  "mod-puc": [
    ["AST-9901", "130505 - Clientes Nacionales", "901.452.110-4", "Causaci\xF3n Factura FEV-10421", "$ 4.850.000", "Asentado"]
  ],
  ...EXPANSION_SUBMODULE_SEED_ROWS
};

// apps/web-app/src/presentation/client-runtime/developer-groups-catalog.runtime.ts
function renderDeveloperGroupsCatalogRuntimeJs() {
  return `
  STATE.editingGroupKey = (BOOT.businessTypes && BOOT.businessTypes[0]) ? BOOT.businessTypes[0].id : 'bares-discotecas';
  STATE.v2FilterText = '';

  function pkRenderGroupsCatalogAdmin() {
    var panel = document.getElementById('sa-groups-catalog-panel');
    if (!panel) return;
    var groups = BOOT.businessTypes || [];
    var svcs = BOOT.services || [];
    var activeGrp = pkGetPreset(STATE.editingGroupKey) || groups[0];
    if (activeGrp) STATE.editingGroupKey = activeGrp.id;

    var grpChips = '';
    for (var g = 0; g < groups.length; g++) {
      var gp = groups[g];
      var isAct = activeGrp && gp.id === activeGrp.id;
      grpChips += '<button type="button" class="preset-chip ' + (isAct ? 'active' : '') + '" data-sa-select-group="' + pkEsc(gp.id) + '">' +
        pkEsc(gp.name) + ' (' + pkCop(gp.baseMonthlyUsd) + ')</button>';
    }

    var svcChecks = ''; var subChecks = ''; var featChecks = '';
    for (var i = 0; i < svcs.length; i++) {
      var s = svcs[i];
      var hasS = activeGrp && activeGrp.includedPrincipalServices.indexOf(s.serviceKey) !== -1;
      svcChecks += '<label class="comp-toggle-pill"><input type="checkbox" data-grp-svc="' + pkEsc(s.serviceKey) + '" ' + (hasS ? 'checked' : '') + '/><span>' + pkEsc(s.icon + ' ' + s.externalPrincipalModuleName) + '</span></label>';
      for (var j = 0; j < s.submodules.length; j++) {
        var sm = s.submodules[j];
        var hasSm = activeGrp && activeGrp.includedSubmodules.indexOf(sm.moduleKey) !== -1;
        subChecks += '<label class="comp-toggle-pill"><input type="checkbox" data-grp-sub="' + pkEsc(sm.moduleKey) + '" ' + (hasSm ? 'checked' : '') + '/><span>' + pkEsc(sm.tabIcon + ' ' + sm.externalSubmoduleName) + '</span></label>';
      }
      for (var f = 0; f < s.features.length; f++) {
        var ft = s.features[f];
        var hasFt = activeGrp && activeGrp.includedFeatures.indexOf(ft.componentKey) !== -1;
        featChecks += '<label class="comp-toggle-pill"><input type="checkbox" data-grp-feat="' + pkEsc(ft.componentKey) + '" ' + (hasFt ? 'checked' : '') + '/><span>\u2728 ' + pkEsc(ft.externalName) + '</span></label>';
      }
    }

    var grpOpts = '<option value="NONE">-- Solo agregar al cat\xE1logo general --</option>';
    for (var k = 0; k < groups.length; k++) {
      grpOpts += '<option value="' + pkEsc(groups[k].id) + '" ' + (groups[k].id === 'bares-discotecas' ? 'selected' : '') + '>Incluir en Plan B\xE1sico de: ' + pkEsc(groups[k].name) + '</option>';
    }
    var svcOpts = '';
    for (var m = 0; m < svcs.length; m++) {
      svcOpts += '<option value="' + pkEsc(svcs[m].serviceKey) + '">' + pkEsc(svcs[m].externalPrincipalModuleName) + '</option>';
    }

    panel.innerHTML =
      '<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:800;margin-bottom:6px">1. Selecciona un Grupo de Clientes de proveko_groups_db para ver o editar qu\xE9 incluye su Plan B\xE1sico:</div><div class="preset-row">' + grpChips + '</div></div>' +
      (activeGrp ? (
        '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:14px;margin-bottom:16px">' +
        '<div class="grid-3" style="margin-bottom:12px">' +
        '<div class="field"><label>Clave del Grupo (group_key)</label><input type="text" id="sa-grp-key" value="' + pkEsc(activeGrp.id) + '" /></div>' +
        '<div class="field"><label>Nombre del Grupo de Clientes</label><input type="text" id="sa-grp-name" value="' + pkEsc(activeGrp.name) + '" /></div>' +
        '<div class="field"><label>Precio Base Mensual (COP)</label><input type="number" id="sa-grp-cop" value="' + Number(activeGrp.baseMonthlyUsd || 149000) + '" /></div></div>' +
        '<div class="grid-3">' +
        '<div><div style="font-size:11px;font-weight:800;margin-bottom:6px">M\xD3DULOS PRINCIPALES DEL GRUPO</div><div class="comp-toggle-list">' + svcChecks + '</div></div>' +
        '<div><div style="font-size:11px;font-weight:800;margin-bottom:6px">SUBM\xD3DULOS B\xC1SICOS DEL GRUPO</div><div class="comp-toggle-list" style="max-height:210px;overflow-y:auto">' + subChecks + '</div></div>' +
        '<div><div style="font-size:11px;font-weight:800;margin-bottom:6px">FUNCIONALIDADES B\xC1SICAS DEL GRUPO</div><div class="comp-toggle-list" style="max-height:210px;overflow-y:auto">' + featChecks + '</div></div></div>' +
        '<div class="row-actions" style="margin-top:12px;justify-content:flex-end"><button type="button" class="btn btn-primary" id="btn-sa-save-group-bundle">\u{1F4BE} Guardar Grupo y su Matriz en proveko_groups_db</button></div></div>'
      ) : '') +
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px">' +
      '<div style="font-weight:800;font-size:13px;margin-bottom:8px">\u{1F6E0}\uFE0F 2. Desarrollador: Crear Nuevo Subm\xF3dulo o Funcionalidad y Agregarlo a un Grupo B\xE1sico (Ej: Bares)</div>' +
      '<div class="grid-3" style="margin-bottom:10px">' +
      '<div class="field"><label>Nivel a Crear</label><select id="dev-new-tier"><option value="FUNCIONALIDAD">Funcionalidad (Componente mini)</option><option value="SUBMODULO">Subm\xF3dulo (Pesta\xF1a)</option></select></div>' +
      '<div class="field"><label>M\xF3dulo Principal Padre</label><select id="dev-new-parent-svc">' + svcOpts + '</select></div>' +
      '<div class="field"><label>Asociar al Plan B\xE1sico del Grupo</label><select id="dev-new-target-group">' + grpOpts + '</select></div></div>' +
      '<div class="grid-3">' +
      '<div class="field"><label>Clave T\xE9cnica</label><input type="text" id="dev-new-key" placeholder="Ej: comp-bar-botellas" /></div>' +
      '<div class="field"><label>Nombre P\xFAblico</label><input type="text" id="dev-new-name" placeholder="Ej: Control de Botellas Abiertas (Bares)" /></div>' +
      '<div class="field"><label>Valor Adicional Mensual (COP)</label><input type="number" id="dev-new-cop" value="19000" /></div></div>' +
      '<div class="row-actions" style="margin-top:10px;justify-content:flex-end"><button type="button" class="btn btn-emerald" id="btn-dev-create-catalog-item">+ Registrar en proveko_groups_db y Asociar al Grupo</button></div></div>';
  }

  function pkHandleDeveloperCatalogAction(target) {
    var selGrp = target.closest('[data-sa-select-group]');
    if (selGrp) { STATE.editingGroupKey = selGrp.getAttribute('data-sa-select-group'); pkRenderGroupsCatalogAdmin(); return true; }
    if (target.closest('#btn-sa-save-group-bundle')) {
      var gKey = ((document.getElementById('sa-grp-key') || {}).value || '').trim() || 'grupo-personalizado';
      var gName = ((document.getElementById('sa-grp-name') || {}).value || '').trim() || 'Grupo Empresarial';
      var gCop = Number((document.getElementById('sa-grp-cop') || {}).value || 149000);
      var sChecks = document.querySelectorAll('[data-grp-svc]:checked');
      var mChecks = document.querySelectorAll('[data-grp-sub]:checked');
      var fChecks = document.querySelectorAll('[data-grp-feat]:checked');
      var incS = []; var incM = []; var incF = [];
      for (var i = 0; i < sChecks.length; i++) incS.push(sChecks[i].getAttribute('data-grp-svc'));
      for (var j = 0; j < mChecks.length; j++) incM.push(mChecks[j].getAttribute('data-grp-sub'));
      for (var k = 0; k < fChecks.length; k++) incF.push(fChecks[k].getAttribute('data-grp-feat'));
      var found = pkGetPreset(gKey);
      if (found) { found.name = gName; found.baseMonthlyUsd = gCop; found.includedPrincipalServices = incS; found.includedSubmodules = incM; found.includedFeatures = incF; }
      else { BOOT.businessTypes.push({ id: gKey, name: gName, badge: 'Plan Base Personalizado', description: 'Grupo configurado en proveko_groups_db', baseMonthlyUsd: gCop, includedPrincipalServices: incS, includedSubmodules: incM, includedFeatures: incF }); }
      STATE.editingGroupKey = gKey;
      try { fetch('/api/v1/control/groups-catalog/group', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupKey: gKey, groupName: gName, badgeLabel: 'Plan Base Completo', description: 'Grupo configurado en proveko_groups_db', baseMonthlyCop: gCop, includedPrincipalServices: incS, includedSubmodules: incM, includedFeatures: incF }) }).catch(function() {}); } catch (_e) {}
      pkRenderGroupsCatalogAdmin(); pkToast('Grupo "' + gName + '" guardado en proveko_groups_db.'); return true;
    }
    if (target.closest('#btn-dev-create-catalog-item')) {
      var tier = ((document.getElementById('dev-new-tier') || {}).value || 'FUNCIONALIDAD');
      var pSvc = ((document.getElementById('dev-new-parent-svc') || {}).value || 'srv-gastro');
      var tGrp = ((document.getElementById('dev-new-target-group') || {}).value || 'NONE');
      var iKey = ((document.getElementById('dev-new-key') || {}).value || '').trim() || ('comp-dev-' + String(Date.now()).slice(-4));
      var iName = ((document.getElementById('dev-new-name') || {}).value || '').trim();
      var iCop = Number((document.getElementById('dev-new-cop') || {}).value || 19000);
      if (!iName) { pkToast('Ingresa el nombre p\xFAblico del nuevo \xEDtem.'); return true; }
      for (var s = 0; s < BOOT.services.length; s++) {
        if (BOOT.services[s].serviceKey === pSvc) {
          if (tier === 'SUBMODULO') BOOT.services[s].submodules.push({ moduleKey: iKey, parentServiceKey: pSvc, externalSubmoduleName: iName, tabIcon: '\u2728', summary: 'Subm\xF3dulo creado en proveko_groups_db', monthlyAddonUsd: iCop, actionButtonLabel: 'Guardar Registro', tableHeaders: ['C\xF3digo', 'Detalle', 'Estado'], fields: [{ key: 'detail', label: iName, type: 'text', placeholder: 'Valor...' }] });
          else BOOT.services[s].features.push({ componentKey: iKey, externalName: iName, description: 'Funcionalidad creada en proveko_groups_db', parentModuleKey: 'independent', includedByDefault: true, monthlyAddonUsd: iCop });
        }
      }
      if (tGrp !== 'NONE') {
        var grpObj = pkGetPreset(tGrp);
        if (grpObj) {
          if (tier === 'SUBMODULO' && grpObj.includedSubmodules.indexOf(iKey) === -1) grpObj.includedSubmodules.push(iKey);
          if (tier === 'FUNCIONALIDAD' && grpObj.includedFeatures.indexOf(iKey) === -1) grpObj.includedFeatures.push(iKey);
        }
      }
      try { fetch('/api/v1/control/groups-catalog/item', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemTier: tier, itemKey: iKey, parentServiceKey: pSvc, externalName: iName, description: iName, monthlyCop: iCop, targetGroupKey: tGrp }) }).catch(function() {}); } catch (_e) {}
      pkRenderGroupsCatalogAdmin(); pkToast(tier + ' "' + iName + '" guardado en proveko_groups_db.'); return true;
    }
    return false;
  }

  function pkHydrateGroupsCatalogFromPostgres() {
    try {
      fetch('/api/v1/control/groups-catalog').then(function(r) { return r.ok ? r.json() : null; }).then(function(snap) {
        if (!snap || !Array.isArray(snap.groups) || snap.groups.length === 0) return;
        var bundles = Array.isArray(snap.bundleItems) ? snap.bundleItems : [];
        var hydratedGroups = [];
        for (var i = 0; i < snap.groups.length; i++) {
          var g = snap.groups[i]; var gKey = g.group_key; var svcs = []; var subs = []; var feats = [];
          for (var b = 0; b < bundles.length; b++) {
            if (bundles[b].group_key === gKey && bundles[b].included_in_base_plan) {
              if (bundles[b].item_tier === 'MODULO_PRINCIPAL') svcs.push(bundles[b].item_key);
              if (bundles[b].item_tier === 'SUBMODULO') subs.push(bundles[b].item_key);
              if (bundles[b].item_tier === 'FUNCIONALIDAD') feats.push(bundles[b].item_key);
            }
          }
          hydratedGroups.push({ id: gKey, name: g.group_name, badge: g.badge_label || 'Plan Base Completo', description: g.description || '', baseMonthlyUsd: Number(g.base_monthly_cop) || 149000, includedPrincipalServices: svcs, includedSubmodules: subs, includedFeatures: feats });
        }
        BOOT.businessTypes = hydratedGroups;
        if (STATE.publicTab === 'showcase') pkRenderShowcase();
        if (STATE.publicTab === 'auth' && STATE.authMode === 'register') pkRenderRegistrationWizard();
        if (STATE.session && (STATE.session.role === 'superadmin' || STATE.session.role === 'desarrollador' || STATE.session.role === 'auxiliar')) pkRenderGroupsCatalogAdmin();
      }).catch(function() {});
    } catch (_e) {}
  }
  setTimeout(pkHydrateGroupsCatalogFromPostgres, 90);
`;
}

// apps/web-app/src/presentation/client-runtime/dom-sanitizer.runtime.ts
function renderDomSanitizerRuntimeJs() {
  return `
  var BOOT = window.__PROVEKO_BOOT__ || {};
  var DEMO_STORAGE_KEY = 'proveko_demo_localstorage_v1';
  var defaultDemoClient = (BOOT.initialClients && BOOT.initialClients[0]) ? JSON.parse(JSON.stringify(BOOT.initialClients[0])) : null;
  if (defaultDemoClient) defaultDemoClient.dbName = 'localStorage (Navegador)';

  var STATE = {
    publicTab: 'showcase', // 'showcase' | 'auth' | 'demo'
    authMode: 'login',     // 'login' | 'register'
    session: null,         // { role: 'superadmin'|'desarrollador'|'auxiliar'|'cliente', username, tenantId, internalRoleName }
    selectedBusinessTypeId: (BOOT.businessTypes && BOOT.businessTypes[0]) ? BOOT.businessTypes[0].id : 'comercio-retail',
    extraServiceKeys: {},
    extraSubmoduleKeys: {},
    demoClient: defaultDemoClient,
    clients: [],
    pgDatabases: ['proveko_control_db', 'proveko_groups_db'],
    activeTenantId: 'tnt-demo',
    activeServiceKey: 'srv-invoicing',
    activeSubmoduleKey: 'mod-pos',
    activeWorkstationPane: 'module', // 'module' | 'rbac' | 'need-feature'
    submoduleRows: JSON.parse(JSON.stringify(BOOT.initialRows || {})),
    featureRequests: [],
    posCart: [
      { name: 'Producto / Servicio Principal', qty: 2, price: 48000, discountPct: 0 },
      { name: 'Insumo Complementario', qty: 1, price: 29000, discountPct: 5 }
    ],
    bomLines: [
      { ingredient: 'Materia Prima Base', qty: '10', unit: 'Kg', cost: 24000 },
      { ingredient: 'Empaque Sellado', qty: '1', unit: 'Und', cost: 2500 }
    ],
    lastGeneratedClient: null
  };

  function pkIsDemoMode() {
    return !STATE.session && STATE.publicTab === 'demo';
  }

  function pkLoadDemoFromLocalStorage() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(DEMO_STORAGE_KEY) : null;
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.demoClient) STATE.demoClient = parsed.demoClient;
      if (parsed && parsed.submoduleRows) STATE.submoduleRows = parsed.submoduleRows;
    } catch (_e) {}
  }

  function pkSaveDemoToLocalStorage() {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
        demoClient: STATE.demoClient,
        submoduleRows: STATE.submoduleRows
      }));
    } catch (_e) {}
  }
  pkLoadDemoFromLocalStorage();

  function pkEsc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pkCop(val) {
    return '$' + Number(val || 0).toLocaleString('es-CO') + ' COP';
  }

  function pkToast(msg) {
    var el = document.getElementById('pk-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(window.__pkToastTimer);
    window.__pkToastTimer = setTimeout(function() { el.classList.remove('show'); }, 3400);
  }

  function pkGetPreset(id) {
    var list = BOOT.businessTypes || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return list[0] || null;
  }

  function pkGetActiveClient() {
    if (pkIsDemoMode()) return STATE.demoClient;
    for (var i = 0; i < STATE.clients.length; i++) {
      if (STATE.clients[i].tenantId === STATE.activeTenantId) return STATE.clients[i];
    }
    return STATE.clients[0] || STATE.demoClient;
  }

  function pkRenderShowcase() {
    var svcGrid = document.getElementById('showcase-services-grid');
    if (svcGrid) {
      var sHtml = '';
      var svcs = BOOT.services || [];
      for (var i = 0; i < svcs.length; i++) {
        var s = svcs[i];
        var subBadges = '';
        for (var j = 0; j < s.submodules.length; j++) {
          subBadges += '<span class="badge badge-slate">' + pkEsc(s.submodules[j].tabIcon + ' ' + s.submodules[j].externalSubmoduleName) + '</span> ';
        }
        sHtml += '<div class="center-pick-card">' +
          '<div class="center-pick-head"><div class="center-pick-title">' + pkEsc(s.icon + ' ' + s.externalPrincipalModuleName) + '</div>' +
          '<span class="badge badge-blue">M\xF3dulo Principal</span></div>' +
          '<div class="center-pick-desc">' + pkEsc(s.subtitle) + '</div>' +
          '<div style="font-size:11px;font-weight:700;color:var(--pk-muted);margin-bottom:6px">Subm\xF3dulos integrados en pesta\xF1as:</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:5px">' + subBadges + '</div></div>';
      }
      svcGrid.innerHTML = sHtml;
    }

    var presetGrid = document.getElementById('showcase-presets-grid');
    if (presetGrid) {
      var pHtml = '';
      var presets = BOOT.businessTypes || [];
      for (var k = 0; k < presets.length; k++) {
        var p = presets[k];
        pHtml += '<div class="center-pick-card">' +
          '<div class="center-pick-head"><div class="center-pick-title">' + pkEsc(p.name) + '</div>' +
          '<span class="center-pick-price">' + pkCop(p.baseMonthlyUsd) + '/mes</span></div>' +
          '<div style="margin-bottom:6px"><span class="badge badge-emerald">' + pkEsc(p.badge) + '</span></div>' +
          '<div class="center-pick-desc">' + pkEsc(p.description) + '</div>' +
          '<button type="button" class="btn btn-primary btn-sm" data-showcase-preset="' + pkEsc(p.id) + '">Elegir este Tipo de Negocio &rarr;</button></div>';
      }
      presetGrid.innerHTML = pHtml;
    }
  }

  function pkComputeRegistrationPlan() {
    var preset = pkGetPreset(STATE.selectedBusinessTypeId);
    var baseUsd = preset ? preset.baseMonthlyUsd : 149000;
    var incSvcs = preset ? preset.includedPrincipalServices : [];
    var incSubs = preset ? preset.includedSubmodules : [];
    var incFeats = preset ? preset.includedFeatures : [];
    var extraUsd = 0;
    var finalSvcs = incSvcs.slice();
    var finalSubs = incSubs.slice();

    var svcs = BOOT.services || [];
    for (var i = 0; i < svcs.length; i++) {
      var s = svcs[i];
      if (incSvcs.indexOf(s.serviceKey) === -1 && STATE.extraServiceKeys[s.serviceKey]) {
        extraUsd += s.standaloneMonthlyUsd;
        finalSvcs.push(s.serviceKey);
      }
      for (var j = 0; j < s.submodules.length; j++) {
        var sub = s.submodules[j];
        if (incSubs.indexOf(sub.moduleKey) === -1 && STATE.extraSubmoduleKeys[sub.moduleKey]) {
          extraUsd += sub.monthlyAddonUsd;
          finalSubs.push(sub.moduleKey);
          if (finalSvcs.indexOf(s.serviceKey) === -1) finalSvcs.push(s.serviceKey);
        }
      }
    }
    return {
      preset: preset,
      baseUsd: baseUsd,
      extraUsd: extraUsd,
      totalUsd: baseUsd + extraUsd,
      services: finalSvcs,
      submodules: finalSubs,
      features: incFeats.slice()
    };
  }
`;
}

// apps/web-app/src/presentation/client-runtime/form-and-table.runtime.ts
function renderFormAndTableRuntimeJs() {
  return `
  function pkRenderRegistrationWizard() {
    var plan = pkComputeRegistrationPlan();
    var rowEl = document.getElementById('reg-business-types-row');
    if (rowEl) {
      var bHtml = '';
      var presets = BOOT.businessTypes || [];
      for (var i = 0; i < presets.length; i++) {
        var p = presets[i];
        var isSel = p.id === STATE.selectedBusinessTypeId;
        bHtml += '<button type="button" class="preset-chip ' + (isSel ? 'active' : '') + '" data-select-btype="' + pkEsc(p.id) + '">' +
          pkEsc(p.name) + ' (' + pkCop(p.baseMonthlyUsd) + '/mes)</button>';
      }
      rowEl.innerHTML = bHtml;
    }

    var incBox = document.getElementById('reg-included-summary');
    if (incBox && plan.preset) {
      incBox.innerHTML = '<strong>\u2705 Incluido en tu Plan Base (' + pkEsc(plan.preset.name) + ' \u2014 ' + pkCop(plan.baseUsd) + '/mes):</strong> ' +
        pkEsc(plan.preset.description);
    }

    var addonsGrid = document.getElementById('reg-addons-grid');
    if (addonsGrid && plan.preset) {
      var aHtml = '';
      var svcs = BOOT.services || [];
      for (var sIdx = 0; sIdx < svcs.length; sIdx++) {
        var svc = svcs[sIdx];
        var svcIncluded = plan.preset.includedPrincipalServices.indexOf(svc.serviceKey) !== -1;
        var svcExtraChecked = !!STATE.extraServiceKeys[svc.serviceKey];
        var subItems = '';
        for (var mIdx = 0; mIdx < svc.submodules.length; mIdx++) {
          var sub = svc.submodules[mIdx];
          var subIncluded = plan.preset.includedSubmodules.indexOf(sub.moduleKey) !== -1;
          var subChecked = subIncluded || svcExtraChecked || !!STATE.extraSubmoduleKeys[sub.moduleKey];
          subItems += '<label class="comp-toggle-pill" style="' + (subIncluded ? 'background:#ecfdf5;border-color:#6ee7b7' : '') + '">' +
            '<input type="checkbox" data-extra-submodule="' + pkEsc(sub.moduleKey) + '" ' +
            (subChecked ? 'checked ' : '') + (subIncluded ? 'disabled ' : '') + '/>' +
            '<span>' + pkEsc(sub.tabIcon + ' ' + sub.externalSubmoduleName) + '</span>' +
            '<strong style="color:var(--pk-primary)">' + (subIncluded ? 'B\xE1sico Incluido' : '+' + pkCop(sub.monthlyAddonUsd)) + '</strong></label>';
        }
        aHtml += '<div class="center-pick-card ' + ((svcIncluded || svcExtraChecked) ? 'selected' : '') + '">' +
          '<div class="center-pick-head">' +
          '<div class="center-pick-title">' + pkEsc(svc.icon + ' ' + svc.externalPrincipalModuleName) + '</div>' +
          (svcIncluded
            ? '<span class="badge badge-emerald">M\xF3dulo Base Incluido</span>'
            : '<label style="font-size:12px;font-weight:700;cursor:pointer"><input type="checkbox" data-extra-service="' + pkEsc(svc.serviceKey) + '" ' + (svcExtraChecked ? 'checked' : '') + '/> Agregar M\xF3dulo (+' + pkCop(svc.standaloneMonthlyUsd) + ')</label>') +
          '</div><div class="center-pick-desc">' + pkEsc(svc.subtitle) + '</div>' +
          '<div class="comp-toggle-list">' + subItems + '</div></div>';
      }
      addonsGrid.innerHTML = aHtml;
    }

    var totalEl = document.getElementById('reg-quote-total');
    if (totalEl) totalEl.textContent = pkCop(plan.totalUsd) + '/mes';
    var breakEl = document.getElementById('reg-quote-breakdown');
    if (breakEl) {
      breakEl.textContent = 'Plan Base: ' + pkCop(plan.baseUsd) + ' + Adicionales seleccionados: ' + pkCop(plan.extraUsd);
    }
  }

  function pkRenderSpecializedWidget(submodule, client) {
    var slot = document.getElementById('ws-specialized-widget-slot');
    if (!slot) return;
    if (submodule.hasInteractivePosCart) {
      var hasDisc = client.activeFeatures.indexOf('comp-line-discount') !== -1;
      var rows = '';
      var subtotal = 0;
      for (var i = 0; i < STATE.posCart.length; i++) {
        var it = STATE.posCart[i];
        var net = Math.round(it.qty * it.price * (1 - (hasDisc ? (it.discountPct || 0) : 0) / 100));
        subtotal += net;
        rows += '<tr><td>' + pkEsc(it.name) + '</td><td>' + it.qty + '</td><td>$ ' + it.price.toLocaleString('es-CO') + '</td>' +
          (hasDisc ? '<td>' + (it.discountPct || 0) + '%</td>' : '') + '<td><strong>$ ' + net.toLocaleString('es-CO') + '</strong></td></tr>';
      }
      slot.innerHTML = '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<strong>\u{1F6D2} Carrito Activo en Caja POS</strong><span class="badge badge-blue">Subtotal: $ ' + subtotal.toLocaleString('es-CO') + '</span></div>' +
        '<table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th>' + (hasDisc ? '<th>Desc.</th>' : '') + '<th>Total L\xEDnea</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      return;
    }
    if (submodule.hasVisualRecipeBuilder) {
      var bRows = '';
      for (var j = 0; j < STATE.bomLines.length; j++) {
        var b = STATE.bomLines[j];
        bRows += '<tr><td>' + pkEsc(b.ingredient) + '</td><td>' + pkEsc(b.qty + ' ' + b.unit) + '</td><td>$ ' + Number(b.cost).toLocaleString('es-CO') + '</td></tr>';
      }
      slot.innerHTML = '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px">' +
        '<div style="font-weight:800;margin-bottom:8px">\u{1F9EA} Insumos de la Receta / F\xF3rmula (Explosi\xF3n de Materiales)</div>' +
        '<table><thead><tr><th>Insumo</th><th>Cantidad</th><th>Costo</th></tr></thead><tbody>' + bRows + '</tbody></table></div>';
      return;
    }
    if (submodule.hasTruckScaleWeighbridge) {
      slot.innerHTML = '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:12px">' +
        '<div style="font-weight:800;margin-bottom:8px">\u2696\uFE0F Lectura Digital de B\xE1scula Camionera (Destare Autom\xE1tico)</div>' +
        '<div class="grid-3">' +
        '<div class="field"><label>Peso Bruto (Kg)</label><input type="number" id="scale-gross-kg" value="52400" /></div>' +
        '<div class="field"><label>Peso Tara Vac\xEDo (Kg)</label><input type="number" id="scale-tare-kg" value="16800" /></div>' +
        '<div class="field"><label>Peso Neto Destarado</label><input type="text" id="scale-net-display" value="35.600 Kg (35.60 Ton)" readonly style="font-weight:800;color:var(--pk-emerald)" /></div>' +
        '</div></div>';
      return;
    }
    slot.innerHTML = '';
  }
`;
}

// apps/web-app/src/presentation/client-runtime/gateway-transport.runtime.ts
function renderGatewayTransportRuntimeJs() {
  return `
  function pkRenderWorkstation() {
    var client = pkGetActiveClient();
    if (!client) return;

    var demoBanner = document.getElementById('demo-mode-banner');
    if (demoBanner) {
      demoBanner.style.display = (STATE.publicTab === 'demo' && !STATE.session) ? 'flex' : 'none';
    }

    var quotaSub = document.getElementById('ws-rbac-quota-sub');
    if (quotaSub) {
      quotaSub.textContent = 'Roles: ' + client.internalRoles.length + '/' + client.maxRolesAllowed +
        ' \xB7 Usuarios: ' + client.internalUsers.length + '/' + client.maxUsersAllowed;
    }

    var navEl = document.getElementById('ws-principal-modules-nav');
    var svcs = BOOT.services || [];
    var activeSvc = null;
    if (navEl) {
      var nHtml = '';
      for (var i = 0; i < svcs.length; i++) {
        var s = svcs[i];
        if (client.activePrincipalServices.indexOf(s.serviceKey) === -1) continue;
        if (!activeSvc || s.serviceKey === STATE.activeServiceKey) activeSvc = s;
        var isCurrent = (STATE.activeWorkstationPane === 'module' && s.serviceKey === STATE.activeServiceKey);
        nHtml += '<button type="button" class="ws-nav-btn ' + (isCurrent ? 'active' : '') + '" data-ws-service="' + pkEsc(s.serviceKey) + '">' +
          '<div class="ws-nav-title">' + pkEsc(s.icon + ' ' + s.externalPrincipalModuleName) + '</div>' +
          '<div class="ws-nav-sub">' + s.submodules.length + ' Subm\xF3dulos integrados</div></button>';
      }
      navEl.innerHTML = nHtml;
    }

    var rbacBtn = document.getElementById('btn-nav-internal-rbac');
    var featBtn = document.getElementById('btn-nav-need-feature');
    if (rbacBtn) rbacBtn.className = 'ws-nav-btn ' + (STATE.activeWorkstationPane === 'rbac' ? 'active' : '');
    if (featBtn) featBtn.className = 'ws-nav-btn ' + (STATE.activeWorkstationPane === 'need-feature' ? 'active' : '');

    var paneMod = document.getElementById('ws-pane-module-operation');
    var paneRbac = document.getElementById('ws-pane-internal-rbac');
    var paneFeat = document.getElementById('ws-pane-need-feature');
    if (paneMod) paneMod.style.display = STATE.activeWorkstationPane === 'module' ? 'block' : 'none';
    if (paneRbac) paneRbac.style.display = STATE.activeWorkstationPane === 'rbac' ? 'block' : 'none';
    if (paneFeat) paneFeat.style.display = STATE.activeWorkstationPane === 'need-feature' ? 'block' : 'none';

    if (STATE.activeWorkstationPane === 'rbac') {
      pkRenderInternalRbacPane(client);
      return;
    }
    if (STATE.activeWorkstationPane === 'need-feature') {
      pkRenderNeedFeaturePane(client);
      return;
    }
    if (!activeSvc) return;
    STATE.activeServiceKey = activeSvc.serviceKey;

    var iconEl = document.getElementById('ws-active-service-icon');
    var titleEl = document.getElementById('ws-active-service-title');
    var subEl = document.getElementById('ws-active-service-sub');
    var dbEl = document.getElementById('ws-active-db-badge');
    if (iconEl) iconEl.textContent = activeSvc.icon;
    if (titleEl) titleEl.textContent = activeSvc.externalPrincipalModuleName;
    if (subEl) subEl.textContent = activeSvc.subtitle;
    if (dbEl) {
      dbEl.textContent = pkIsDemoMode()
        ? 'Almacenamiento Demo: localStorage (Navegador)'
        : 'BD PostgreSQL Aislada: ' + client.dbName;
    }

    var pillsEl = document.getElementById('ws-active-features-pills');
    if (pillsEl) {
      var pHtml = '';
      for (var fIdx = 0; fIdx < activeSvc.features.length; fIdx++) {
        var feat = activeSvc.features[fIdx];
        if (client.activeFeatures.indexOf(feat.componentKey) !== -1) {
          pHtml += '<span class="badge badge-blue">\u2713 Funcionalidad: ' + pkEsc(feat.externalName) + '</span>';
        }
      }
      pillsEl.innerHTML = pHtml;
    }

    var tabsEl = document.getElementById('ws-submodule-tabs');
    var activeSub = null;
    var availableSubs = [];
    for (var j = 0; j < activeSvc.submodules.length; j++) {
      var sm = activeSvc.submodules[j];
      if (client.activeSubmodules.indexOf(sm.moduleKey) !== -1) {
        availableSubs.push(sm);
        if (sm.moduleKey === STATE.activeSubmoduleKey) activeSub = sm;
      }
    }
    if (!activeSub && availableSubs.length > 0) {
      activeSub = availableSubs[0];
      STATE.activeSubmoduleKey = activeSub.moduleKey;
    }

    if (tabsEl) {
      var tHtml = '';
      for (var k = 0; k < availableSubs.length; k++) {
        var subTab = availableSubs[k];
        var isTabAct = activeSub && subTab.moduleKey === activeSub.moduleKey;
        tHtml += '<button type="button" class="btn ' + (isTabAct ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-ws-submodule="' + pkEsc(subTab.moduleKey) + '">' +
          pkEsc(subTab.tabIcon + ' ' + subTab.externalSubmoduleName) + '</button>';
      }
      tabsEl.innerHTML = tHtml;
    }

    if (!activeSub) return;
    var sumEl = document.getElementById('ws-submodule-summary');
    if (sumEl) sumEl.textContent = activeSub.summary;

    pkRenderSpecializedWidget(activeSub, client);

    var fieldsEl = document.getElementById('ws-submodule-form-fields');
    if (fieldsEl) {
      var fHtml = '';
      for (var m = 0; m < activeSub.fields.length; m++) {
        var fld = activeSub.fields[m];
        if (fld.requiredFeatureKey && client.activeFeatures.indexOf(fld.requiredFeatureKey) === -1) continue;
        fHtml += '<div class="field"><label>' + pkEsc(fld.label) + '</label>';
        if (fld.type === 'select') {
          fHtml += '<select data-ws-field="' + pkEsc(fld.key) + '">';
          var opts = fld.options || [];
          for (var o = 0; o < opts.length; o++) {
            fHtml += '<option value="' + pkEsc(opts[o]) + '">' + pkEsc(opts[o]) + '</option>';
          }
          fHtml += '</select>';
        } else {
          fHtml += '<input type="' + pkEsc(fld.type) + '" data-ws-field="' + pkEsc(fld.key) + '" placeholder="' + pkEsc(fld.placeholder || '') + '" />';
        }
        fHtml += '</div>';
      }
      fieldsEl.innerHTML = fHtml;
    }

    var saveBtn = document.getElementById('btn-ws-save-record');
    if (saveBtn) saveBtn.textContent = activeSub.actionButtonLabel;

    var thead = document.getElementById('ws-submodule-thead');
    if (thead) {
      var hHtml = '<tr>';
      for (var h = 0; h < activeSub.tableHeaders.length; h++) {
        hHtml += '<th>' + pkEsc(activeSub.tableHeaders[h]) + '</th>';
      }
      hHtml += '</tr>';
      thead.innerHTML = hHtml;
    }

    var tbody = document.getElementById('ws-submodule-tbody');
    if (tbody) {
      var rows = STATE.submoduleRows[activeSub.moduleKey] || [];
      var qFilter = (STATE.v2FilterText || '').trim().toLowerCase();
      var rHtml = '';
      var matchedCount = 0;
      for (var r = 0; r < rows.length; r++) {
        var rowStr = rows[r].join(' ').toLowerCase();
        if (qFilter && rowStr.indexOf(qFilter) === -1) continue;
        matchedCount++;
        rHtml += '<tr>';
        for (var c = 0; c < rows[r].length; c++) {
          rHtml += '<td>' + (c === 0 ? '<strong>' + pkEsc(rows[r][c]) + '</strong>' : pkEsc(rows[r][c])) + '</td>';
        }
        rHtml += '</tr>';
      }
      tbody.innerHTML = rHtml;
      var cntBadge = document.getElementById('ws-v2-count-badge');
      if (cntBadge) cntBadge.textContent = matchedCount + ' / ' + rows.length + ' registros';
    }
  }
`;
}

// apps/web-app/src/presentation/client-runtime/platform-actions.runtime.ts
function renderPlatformActionsRuntimeJs() {
  return `
  function pkRenderInternalRbacPane(client) {
    var el = document.getElementById('ws-pane-internal-rbac');
    if (!el) return;
    var rRows = '';
    for (var i = 0; i < client.internalRoles.length; i++) {
      var rl = client.internalRoles[i];
      rRows += '<tr><td><strong>' + pkEsc(rl.name) + '</strong></td><td>' + pkEsc(rl.description) + '</td>' +
        '<td><span class="badge badge-blue">' + pkEsc(rl.allowedSubmodules.join(', ')) + '</span></td></tr>';
    }
    var uRows = '';
    for (var j = 0; j < client.internalUsers.length; j++) {
      var u = client.internalUsers[j];
      uRows += '<tr><td><strong>' + pkEsc(u.username) + '</strong></td><td>' + pkEsc(u.fullName) + '</td>' +
        '<td><span class="badge badge-emerald">' + pkEsc(u.internalRoleName) + '</span></td>' +
        '<td><code>' + pkEsc(u.passwordHint) + '</code></td></tr>';
    }
    var roleOpts = '';
    for (var k = 0; k < client.internalRoles.length; k++) {
      roleOpts += '<option value="' + pkEsc(client.internalRoles[k].roleId) + '">' + pkEsc(client.internalRoles[k].name) + '</option>';
    }
    el.innerHTML =
      '<div class="card" style="margin-bottom:14px">' +
      '<div class="card-head"><div><div class="card-title">\u{1F465} Roles Internos en tu Base de Datos (' + pkEsc(client.dbName) + ')</div>' +
      '<div style="font-size:12px;color:var(--pk-muted)">Se crean los roles b\xE1sicos por defecto y puedes modificarlos o agregar nuevos dentro del cupo asignado por SuperAdmin.</div></div>' +
      '<span class="badge badge-blue">Cupo de Roles: ' + client.internalRoles.length + ' / ' + client.maxRolesAllowed + '</span></div>' +
      '<div class="card-body">' +
      '<div class="grid-3" style="margin-bottom:12px">' +
      '<div class="field"><label>Nombre del Nuevo Rol Interno</label><input type="text" id="new-role-name" placeholder="Ej: Auditor de Bodega" /></div>' +
      '<div class="field"><label>Descripci\xF3n de Permisos</label><input type="text" id="new-role-desc" placeholder="Ej: Revisi\xF3n de traslados y existencias" /></div>' +
      '<div class="field" style="justify-content:flex-end"><button type="button" class="btn btn-primary" id="btn-create-internal-role">+ Crear Rol Interno</button></div>' +
      '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Rol Interno</th><th>Alcance</th><th>Subm\xF3dulos Permitidos</th></tr></thead><tbody>' + rRows + '</tbody></table></div>' +
      '</div></div>' +
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">\u{1F510} Usuarios de tu Empresa (Conectados a ' + pkEsc(client.dbName) + ')</div>' +
      '<div style="font-size:12px;color:var(--pk-muted)">Cuenta Admin generada autom\xE1ticamente + usuarios operativos asignados a tus roles internos.</div></div>' +
      '<span class="badge badge-emerald">Cupo de Usuarios: ' + client.internalUsers.length + ' / ' + client.maxUsersAllowed + '</span></div>' +
      '<div class="card-body">' +
      '<div class="grid-3" style="margin-bottom:12px">' +
      '<div class="field"><label>Nombre Completo</label><input type="text" id="new-user-fullname" placeholder="Ej: Camilo Vargas" /></div>' +
      '<div class="field"><label>Usuario de Acceso</label><input type="text" id="new-user-username" placeholder="Ej: cajero.camilo" /></div>' +
      '<div class="field"><label>Rol Interno Asignado</label><select id="new-user-role">' + roleOpts + '</select></div>' +
      '</div>' +
      '<div class="row-actions" style="justify-content:flex-end;margin-bottom:12px"><button type="button" class="btn btn-emerald" id="btn-create-internal-user">+ Crear Usuario en mi Empresa</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol Interno</th><th>Credencial</th></tr></thead><tbody>' + uRows + '</tbody></table></div>' +
      '</div></div>';
  }

  function pkRenderNeedFeaturePane(client) {
    var el = document.getElementById('ws-pane-need-feature');
    if (!el) return;
    var cards = '';
    var svcs = BOOT.services || [];
    for (var i = 0; i < svcs.length; i++) {
      var s = svcs[i];
      var subHtml = '';
      for (var j = 0; j < s.submodules.length; j++) {
        var sub = s.submodules[j];
        var hasSub = client.activeSubmodules.indexOf(sub.moduleKey) !== -1;
        subHtml += '<div class="comp-toggle-pill">' +
          '<span>' + pkEsc(sub.tabIcon + ' Subm\xF3dulo: ' + sub.externalSubmoduleName) + '</span>' +
          (hasSub
            ? '<span class="badge badge-emerald">Activo</span>'
            : '<button type="button" class="btn btn-primary btn-sm" data-req-tier="SUBMODULO" data-req-key="' + pkEsc(sub.moduleKey) + '" data-req-label="' + pkEsc(sub.externalSubmoduleName) + '">Solicitar / Activar (+' + pkCop(sub.monthlyAddonUsd) + ')</button>') +
          '</div>';
      }
      for (var f = 0; f < s.features.length; f++) {
        var feat = s.features[f];
        var hasFeat = client.activeFeatures.indexOf(feat.componentKey) !== -1;
        subHtml += '<div class="comp-toggle-pill">' +
          '<span>\u2728 Funcionalidad: ' + pkEsc(feat.externalName) + '</span>' +
          (hasFeat
            ? '<span class="badge badge-blue">Activa</span>'
            : '<button type="button" class="btn btn-outline btn-sm" data-req-tier="FUNCIONALIDAD" data-req-key="' + pkEsc(feat.componentKey) + '" data-req-label="' + pkEsc(feat.externalName) + '">Solicitar Funcionalidad (+' + pkCop(feat.monthlyAddonUsd) + ')</button>') +
          '</div>';
      }
      cards += '<div class="center-pick-card">' +
        '<div class="center-pick-head"><div class="center-pick-title">' + pkEsc(s.icon + ' ' + s.externalPrincipalModuleName) + '</div></div>' +
        '<div class="center-pick-desc">' + pkEsc(s.subtitle) + '</div>' +
        '<div class="comp-toggle-list">' + subHtml + '</div></div>';
    }
    el.innerHTML =
      '<div class="card">' +
      '<div class="card-head"><div><span class="badge badge-amber">AMPLIACI\xD3N DE CAPACIDADES EMPRESARIALES</span>' +
      '<h2 style="margin:4px 0 0;font-size:18px">\u2728 Necesito otra funcionalidad, Subm\xF3dulo o M\xF3dulo Principal</h2>' +
      '<div style="font-size:12px;color:var(--pk-muted)">Las pantallas operativas permanecen limpias. Desde esta pesta\xF1a exclusiva puedes solicitar o activar nuevos Subm\xF3dulos o Funcionalidades (como Firma de encargado o Seleccionar transportista).</div></div></div>' +
      '<div class="card-body"><div class="center-selector-grid">' + cards + '</div></div></div>';
  }

  function pkConfirmStandbyCheckout() {
    var compName = ((document.getElementById('pay-modal-company') || {}).value || '').trim() || 'Empresa Registrada S.A.S.';
    var nitVal = ((document.getElementById('reg-company-nit') || {}).value || '').trim() || '901.880.110-2';
    var slug = compName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20) || 'cliente';
    var planInfo = pkComputeRegistrationPlan();
    var newClient = {
      tenantId: 'tnt-' + slug + '-' + String(Date.now()).slice(-3),
      companyName: compName, nit: nitVal,
      businessTypeId: STATE.selectedBusinessTypeId,
      businessTypeName: planInfo.preset ? planInfo.preset.name : 'Plan Empresarial',
      dbName: 'db_' + slug, dbHost: 'db', dbPort: 5432,
      paymentStatus: 'STANDBY_VERIFICADO', monthlyUsd: planInfo.totalUsd,
      adminUsername: 'admin.' + slug,
      adminPasswordHint: 'PkAdmin#' + slug.slice(0, 4).toUpperCase() + '2026!',
      maxRolesAllowed: 5, maxUsersAllowed: 10,
      activePrincipalServices: planInfo.services,
      activeSubmodules: planInfo.submodules,
      activeFeatures: planInfo.features,
      internalRoles: [
        { roleId: 'rol-admin', name: 'Administrador General (Cuenta Admin)', description: 'Control total en la BD del cliente.', allowedSubmodules: ['*'] },
        { roleId: 'rol-cajero', name: 'Cajero y Facturador', description: 'Caja POS y Facturaci\xF3n.', allowedSubmodules: ['mod-pos', 'mod-dian'] },
        { roleId: 'rol-bodega', name: 'Encargado de Bodega', description: 'Existencias, Bodegas y Traslados.', allowedSubmodules: ['mod-stock', 'mod-warehouses', 'mod-transfers'] }
      ],
      internalUsers: [
        { userId: 'u-admin', username: 'admin.' + slug, fullName: 'Administrador ' + compName, email: 'admin@' + slug + '.co', internalRoleId: 'rol-admin', internalRoleName: 'Administrador General (Cuenta Admin)', passwordHint: 'PkAdmin#' + slug.slice(0, 4).toUpperCase() + '2026!', isClientAdmin: true }
      ]
    };
    STATE.clients.push(newClient);
    if (STATE.pgDatabases.indexOf(newClient.dbName) === -1) STATE.pgDatabases.push(newClient.dbName);
    STATE.lastGeneratedClient = newClient;
    try {
      fetch('/api/v1/payments/checkout/standby', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(newClient)
      }).then(function() { pkHydrateClientsFromPostgres(); }).catch(function() {});
    } catch (_e) {}
    document.getElementById('generated-credentials-box').innerHTML =
      '<div>Empresa: <strong>' + pkEsc(newClient.companyName) + '</strong></div>' +
      '<div>Base de Datos PostgreSQL Creada: <strong>' + pkEsc(newClient.dbName) + '</strong></div>' +
      '<div>Rol Global: <strong>cliente</strong> \xB7 Cuenta Admin: <strong>' + pkEsc(newClient.adminUsername) + '</strong></div>' +
      '<div>Contrase\xF1a Inicial: <strong>' + pkEsc(newClient.adminPasswordHint) + '</strong></div>';
    document.getElementById('payment-step-checkout').style.display = 'none';
    document.getElementById('payment-step-credentials').style.display = 'block';
  }

  function pkHydrateClientsFromPostgres() {
    try {
      fetch('/api/v1/control/databases')
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (!data) return;
          if (Array.isArray(data.databases) && data.databases.length > 0) {
            STATE.pgDatabases = data.databases;
          }
          if (Array.isArray(data.rows)) {
            for (var i = 0; i < data.rows.length; i++) {
              var r = data.rows[i];
              if (!r.db_name || r.db_name === 'db_version_prueba') continue;
              var exists = false;
              for (var j = 0; j < STATE.clients.length; j++) {
                if (STATE.clients[j].dbName === r.db_name) { exists = true; break; }
              }
              if (!exists) {
                STATE.clients.push({
                  tenantId: r.tenant_id || ('tnt-' + r.db_name),
                  companyName: r.company_name || r.db_name,
                  nit: r.nit || '900.000.000-1',
                  businessTypeId: r.business_type || 'comercio-retail',
                  businessTypeName: r.business_type || 'Plan Empresarial',
                  dbName: r.db_name,
                  dbHost: r.db_host || 'db',
                  dbPort: Number(r.db_port) || 5432,
                  paymentStatus: 'STANDBY_VERIFICADO',
                  monthlyUsd: 149000,
                  adminUsername: r.admin_username || 'admin',
                  adminPasswordHint: r.admin_password_hint || 'Prov#2026!',
                  maxRolesAllowed: Number(r.max_roles_allowed) || 5,
                  maxUsersAllowed: Number(r.max_users_allowed) || 10,
                  activePrincipalServices: Array.isArray(r.enabled_services_json) ? r.enabled_services_json : ['srv-invoicing', 'srv-inventory'],
                  activeSubmodules: Array.isArray(r.enabled_submodules_json) ? r.enabled_submodules_json : ['mod-pos', 'mod-stock', 'mod-warehouses'],
                  activeFeatures: Array.isArray(r.enabled_features_json) ? r.enabled_features_json : ['comp-cashier-name', 'comp-manager-signature'],
                  internalRoles: (STATE.demoClient ? STATE.demoClient.internalRoles.slice() : []),
                  internalUsers: [{ userId: 'u-adm', username: r.admin_username || 'admin', fullName: 'Administrador ' + (r.company_name || ''), email: 'admin@empresa.co', internalRoleId: 'rol-admin', internalRoleName: 'Administrador General (Cuenta Admin)', passwordHint: r.admin_password_hint || 'Prov#2026!', isClientAdmin: true }]
                });
              }
            }
          }
          if (STATE.session && (STATE.session.role === 'superadmin' || STATE.session.role === 'desarrollador' || STATE.session.role === 'auxiliar')) {
            pkRenderSuperAdmin();
          }
        })
        .catch(function() {});
    } catch (_e) {}
  }
  setTimeout(pkHydrateClientsFromPostgres, 50);
`;
}

// apps/web-app/src/presentation/client-runtime/superadmin-and-shell.runtime.ts
function renderSuperAdminAndShellRuntimeJs() {
  return `
  function pkRenderSuperAdmin() {
    var kpiEl = document.getElementById('sa-kpi-row');
    if (kpiEl) {
      var pgList = (STATE.pgDatabases && STATE.pgDatabases.length > 0)
        ? STATE.pgDatabases
        : ['proveko_control_db', 'proveko_groups_db'];
      kpiEl.innerHTML =
        '<div class="kpi-box"><div class="kpi-label">BDs Sistema (Core + Grupos)</div><div class="kpi-val" style="font-size:13px">proveko_control_db \xB7 proveko_groups_db</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Total BDs PostgreSQL en proveko_db</div><div class="kpi-val">' + pgList.length + ' BDs (' + pkEsc(pgList.join(', ')) + ')</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Empresas Clientes (BD Propia)</div><div class="kpi-val" style="color:var(--pk-emerald)">' + STATE.clients.length + ' BDs Clientes</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Modo Demo P\xFAblico</div><div class="kpi-val" style="font-size:13px;color:var(--pk-primary)">100% localStorage (Sin BD)</div></div>';
    }

    var gridEl = document.getElementById('sa-tenants-grid');
    if (gridEl) {
      var gHtml = '';
      if (STATE.clients.length === 0) {
        gHtml = '<div class="card"><div class="card-body" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
          '<div><strong>A\xFAn no hay empresas clientes registradas en PostgreSQL.</strong><div style="font-size:12px;color:var(--pk-muted)">Las bases del sistema (<code>proveko_control_db</code> y <code>proveko_groups_db</code>) ya est\xE1n activas en <code>proveko_db</code>. El modo Demo opera en <code>localStorage</code>. Crea un cliente para aprovisionar su BD PostgreSQL aislada (<code>db_&lt;cliente&gt;</code>).</div></div>' +
          '<button type="button" class="btn btn-emerald btn-sm" id="btn-sa-empty-new-client">+ Crear Primer Cliente y su BD PostgreSQL</button></div></div>';
      }
      for (var i = 0; i < STATE.clients.length; i++) {
        var t = STATE.clients[i];
        gHtml += '<div class="card"><div class="card-head">' +
          '<div><div style="display:flex;align-items:center;gap:8px">' +
          '<strong style="font-size:15px">' + pkEsc(t.companyName) + '</strong>' +
          '<span class="badge badge-blue">NIT: ' + pkEsc(t.nit) + '</span>' +
          '<span class="badge badge-emerald">BD PostgreSQL: ' + pkEsc(t.dbName) + ' (' + pkEsc(t.dbHost + ':' + t.dbPort) + ')</span></div>' +
          '<div style="font-size:12px;color:var(--pk-muted);margin-top:4px">Cuenta Admin generada: <code>' + pkEsc(t.adminUsername) + '</code> \xB7 Clave: <code>' + pkEsc(t.adminPasswordHint) + '</code></div></div>' +
          '<div class="row-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" data-sa-regen="' + pkEsc(t.tenantId) + '">\u{1F511} Regenerar Clave Admin</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-sa-open="' + pkEsc(t.tenantId) + '">\u{1F3E2} Abrir Plataforma</button></div></div>' +
          '<div class="card-body"><div class="grid-2">' +
          '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-size:11px;color:var(--pk-muted);font-weight:700">CUOTA M\xC1XIMA DE ROLES INTERNOS</div>' +
          '<div style="font-size:14px;font-weight:800">Usados: ' + t.internalRoles.length + ' / M\xE1ximo permitido: ' + t.maxRolesAllowed + '</div></div>' +
          '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-sa-quota-role="-1" data-sa-tenant="' + pkEsc(t.tenantId) + '">-1</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-sa-quota-role="1" data-sa-tenant="' + pkEsc(t.tenantId) + '">+1</button></div></div>' +
          '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-size:11px;color:var(--pk-muted);font-weight:700">CUOTA M\xC1XIMA DE USUARIOS DEL CLIENTE</div>' +
          '<div style="font-size:14px;font-weight:800">Usados: ' + t.internalUsers.length + ' / M\xE1ximo permitido: ' + t.maxUsersAllowed + '</div></div>' +
          '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-sa-quota-user="-1" data-sa-tenant="' + pkEsc(t.tenantId) + '">-1</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-sa-quota-user="1" data-sa-tenant="' + pkEsc(t.tenantId) + '">+1</button></div></div>' +
          '</div></div></div>';
      }
      gridEl.innerHTML = gHtml;
    }

    var reqCount = document.getElementById('sa-requests-count');
    if (reqCount) reqCount.textContent = STATE.featureRequests.length + ' solicitudes';
    var reqBody = document.getElementById('sa-feature-requests-body');
    if (reqBody) {
      if (STATE.featureRequests.length === 0) {
        reqBody.innerHTML = '<div style="font-size:12px;color:var(--pk-muted)">No hay solicitudes pendientes en la pesta\xF1a "Necesito otra funcionalidad".</div>';
      } else {
        var rHtml = '<table><thead><tr><th>Empresa</th><th>Tipo</th><th>Solicitud</th><th>Estado</th></tr></thead><tbody>';
        for (var r = 0; r < STATE.featureRequests.length; r++) {
          var rq = STATE.featureRequests[r];
          rHtml += '<tr><td><strong>' + pkEsc(rq.companyName) + '</strong></td><td>' + pkEsc(rq.tier) + '</td><td>' + pkEsc(rq.label) + '</td><td><span class="badge badge-emerald">Activada</span></td></tr>';
        }
        reqBody.innerHTML = rHtml + '</tbody></table>';
      }
    }
    if (typeof pkRenderGroupsCatalogAdmin === 'function') pkRenderGroupsCatalogAdmin();
  }

  function pkUpdateShellNavigation() {
    var pubNav = document.getElementById('public-nav-tabs');
    var sessBar = document.getElementById('authenticated-session-bar');
    var topCtx = document.getElementById('top-context-label');

    var sShow = document.getElementById('surface-showcase');
    var sAuth = document.getElementById('surface-auth');
    var sSa = document.getElementById('surface-superadmin');
    var sWs = document.getElementById('surface-workstation');
    if (sShow) sShow.classList.remove('active');
    if (sAuth) sAuth.classList.remove('active');
    if (sSa) sSa.classList.remove('active');
    if (sWs) sWs.classList.remove('active');

    if (STATE.session) {
      if (pubNav) pubNav.style.display = 'none';
      if (sessBar) sessBar.style.display = 'flex';
      var rBadge = document.getElementById('session-role-badge');
      var dBadge = document.getElementById('session-db-badge');
      var uLabel = document.getElementById('session-user-label');
      if (STATE.session.role === 'superadmin' || STATE.session.role === 'desarrollador' || STATE.session.role === 'auxiliar') {
        if (rBadge) rBadge.textContent = 'Rol Global: ' + STATE.session.role.toUpperCase();
        if (dBadge) dBadge.textContent = 'BDs: proveko_control_db + proveko_groups_db';
        if (uLabel) uLabel.textContent = STATE.session.username;
        if (topCtx) topCtx.textContent = '| Consola Global (' + STATE.session.role + ')';
        if (sSa) sSa.classList.add('active');
        pkRenderSuperAdmin();
      } else {
        var cl = pkGetActiveClient();
        if (rBadge) rBadge.textContent = 'Rol: cliente (' + (STATE.session.internalRoleName || 'Admin') + ')';
        if (dBadge) dBadge.textContent = 'BD Propia: ' + (cl ? cl.dbName : '');
        if (uLabel) uLabel.textContent = (cl ? cl.companyName : '') + ' \u2014 ' + STATE.session.username;
        if (topCtx) topCtx.textContent = '| ' + (cl ? cl.companyName : 'Plataforma Cliente');
        if (sWs) sWs.classList.add('active');
        pkRenderWorkstation();
      }
      return;
    }

    if (pubNav) pubNav.style.display = 'flex';
    if (sessBar) sessBar.style.display = 'none';
    var tShow = document.getElementById('tab-nav-showcase');
    var tAuth = document.getElementById('tab-nav-auth');
    var tDemo = document.getElementById('tab-nav-demo');
    if (tShow) tShow.className = 'pk-tab-btn ' + (STATE.publicTab === 'showcase' ? 'active' : '');
    if (tAuth) tAuth.className = 'pk-tab-btn ' + (STATE.publicTab === 'auth' ? 'active' : '');
    if (tDemo) tDemo.className = 'pk-tab-btn ' + (STATE.publicTab === 'demo' ? 'active' : '');

    if (STATE.publicTab === 'showcase') {
      if (topCtx) topCtx.textContent = '| Muestra de la Plataforma';
      if (sShow) sShow.classList.add('active');
      pkRenderShowcase();
    } else if (STATE.publicTab === 'auth') {
      if (topCtx) topCtx.textContent = STATE.authMode === 'register' ? '| Registra tu Negocio' : '| Iniciar Sesi\xF3n';
      if (sAuth) sAuth.classList.add('active');
      var pLogin = document.getElementById('auth-pane-login');
      var pReg = document.getElementById('auth-pane-register');
      var bLogin = document.getElementById('btn-auth-mode-login');
      var bReg = document.getElementById('btn-auth-mode-register');
      if (pLogin) pLogin.style.display = STATE.authMode === 'login' ? 'block' : 'none';
      if (pReg) pReg.style.display = STATE.authMode === 'register' ? 'block' : 'none';
      if (bLogin) bLogin.className = 'btn ' + (STATE.authMode === 'login' ? 'btn-primary' : 'btn-outline');
      if (bReg) bReg.className = 'btn ' + (STATE.authMode === 'register' ? 'btn-primary' : 'btn-outline');
      pkRenderRegistrationWizard();
    } else if (STATE.publicTab === 'demo') {
      STATE.activeTenantId = 'tnt-demo';
      if (topCtx) topCtx.textContent = '| Demo Interactiva (Datos en localStorage)';
      if (sWs) sWs.classList.add('active');
      pkRenderWorkstation();
    }
  }

  function pkHandleSuperAdminAction(target) {
    if (typeof pkHandleDeveloperCatalogAction === 'function' && pkHandleDeveloperCatalogAction(target)) return true;
    var qRoleBtn = target.closest('[data-sa-quota-role]');
    if (qRoleBtn) {
      var tidR = qRoleBtn.getAttribute('data-sa-tenant');
      var deltaR = Number(qRoleBtn.getAttribute('data-sa-quota-role'));
      for (var qr = 0; qr < STATE.clients.length; qr++) {
        if (STATE.clients[qr].tenantId === tidR) STATE.clients[qr].maxRolesAllowed = Math.max(1, STATE.clients[qr].maxRolesAllowed + deltaR);
      }
      pkRenderSuperAdmin(); return true;
    }
    var qUserBtn = target.closest('[data-sa-quota-user]');
    if (qUserBtn) {
      var tidU = qUserBtn.getAttribute('data-sa-tenant');
      var deltaU = Number(qUserBtn.getAttribute('data-sa-quota-user'));
      for (var qu = 0; qu < STATE.clients.length; qu++) {
        if (STATE.clients[qu].tenantId === tidU) STATE.clients[qu].maxUsersAllowed = Math.max(1, STATE.clients[qu].maxUsersAllowed + deltaU);
      }
      pkRenderSuperAdmin(); return true;
    }
    var saOpen = target.closest('[data-sa-open]');
    if (saOpen) {
      STATE.activeTenantId = saOpen.getAttribute('data-sa-open');
      STATE.session = { role: 'cliente', username: 'superadmin->cliente', tenantId: STATE.activeTenantId, internalRoleName: 'SuperAdmin Auditando BD' };
      pkUpdateShellNavigation(); return true;
    }
    var saRegen = target.closest('[data-sa-regen]');
    if (saRegen) {
      var tidG = saRegen.getAttribute('data-sa-regen');
      for (var g = 0; g < STATE.clients.length; g++) {
        if (STATE.clients[g].tenantId === tidG) STATE.clients[g].adminPasswordHint = 'PkReset#' + String(Date.now()).slice(-4) + '!';
      }
      pkRenderSuperAdmin(); pkToast('Credencial Admin regenerada.'); return true;
    }
    return false;
  }
`;
}

// apps/web-app/src/presentation/client-runtime/workstation-controller.runtime.ts
function renderClientRuntimeBundleJs() {
  return `(function() {
${renderDomSanitizerRuntimeJs()}
${renderFormAndTableRuntimeJs()}
${renderGatewayTransportRuntimeJs()}
${renderPlatformActionsRuntimeJs()}
${renderDeveloperGroupsCatalogRuntimeJs()}
${renderSuperAdminAndShellRuntimeJs()}

  function pkGoRegister(presetId) {
    if (presetId) { STATE.selectedBusinessTypeId = presetId; STATE.extraServiceKeys = {}; STATE.extraSubmoduleKeys = {}; }
    STATE.publicTab = 'auth'; STATE.authMode = 'register'; pkUpdateShellNavigation();
  }

  document.addEventListener('click', function(ev) {
    var target = ev.target;
    if (!target || !target.closest) return;

    if (target.closest('#tab-nav-showcase')) { STATE.publicTab = 'showcase'; pkUpdateShellNavigation(); return; }
    if (target.closest('#tab-nav-auth') || target.closest('#btn-hero-go-login')) { STATE.publicTab = 'auth'; STATE.authMode = 'login'; pkUpdateShellNavigation(); return; }
    if (target.closest('#tab-nav-demo') || target.closest('#btn-hero-go-demo')) { STATE.publicTab = 'demo'; STATE.activeWorkstationPane = 'module'; pkUpdateShellNavigation(); return; }
    if (target.closest('#btn-hero-go-register') || target.closest('#btn-card-go-register') ||
        target.closest('#btn-showcase-mid-register') || target.closest('#btn-demo-go-register') ||
        target.closest('#btn-login-switch-to-register') || target.closest('#btn-auth-mode-register')) { pkGoRegister(); return; }
    if (target.closest('#btn-auth-mode-login')) { STATE.authMode = 'login'; pkUpdateShellNavigation(); return; }
    if (target.closest('#btn-logout-session')) { STATE.session = null; STATE.publicTab = 'showcase'; pkUpdateShellNavigation(); pkToast('Sesi\xF3n cerrada.'); return; }

    var shPreset = target.closest('[data-showcase-preset]');
    if (shPreset) { pkGoRegister(shPreset.getAttribute('data-showcase-preset')); return; }

    var bTypeBtn = target.closest('[data-select-btype]');
    if (bTypeBtn) {
      STATE.selectedBusinessTypeId = bTypeBtn.getAttribute('data-select-btype');
      STATE.extraServiceKeys = {}; STATE.extraSubmoduleKeys = {};
      pkRenderRegistrationWizard(); return;
    }

    if (target.closest('#btn-submit-login')) {
      var uVal = ((document.getElementById('login-username') || {}).value || '').trim().toLowerCase();
      if (!uVal) { pkToast('Ingresa tu usuario o correo.'); return; }
      if (uVal.indexOf('superadmin') !== -1) { STATE.session = { role: 'superadmin', username: uVal }; }
      else if (uVal.indexOf('dev') !== -1 || uVal.indexOf('desarrollador') !== -1) { STATE.session = { role: 'desarrollador', username: uVal }; }
      else if (uVal.indexOf('aux') !== -1) { STATE.session = { role: 'auxiliar', username: uVal }; }
      else {
        var matchedClient = STATE.clients[STATE.clients.length - 1] || STATE.clients[0];
        for (var i = 0; i < STATE.clients.length; i++) {
          if (STATE.clients[i].adminUsername.toLowerCase() === uVal) matchedClient = STATE.clients[i];
        }
        if (!matchedClient) { pkToast('No hay un cliente registrado con ese usuario. Registra primero tu empresa.'); return; }
        STATE.activeTenantId = matchedClient.tenantId;
        STATE.session = { role: 'cliente', username: uVal, tenantId: matchedClient.tenantId, internalRoleName: 'Administrador General' };
      }
      pkUpdateShellNavigation(); pkToast('Bienvenido a Proveko (' + STATE.session.role + ').'); return;
    }

    if (target.closest('#btn-open-standby-checkout') || target.closest('#btn-sa-new-client') || target.closest('#btn-sa-empty-new-client')) {
      var cName = ((document.getElementById('reg-company-name') || {}).value || '').trim() || 'Nueva Empresa Cliente S.A.S.';
      var plan = pkComputeRegistrationPlan();
      document.getElementById('pay-modal-company').value = cName;
      document.getElementById('pay-modal-amount').value = pkCop(plan.totalUsd) + '/mes';
      document.getElementById('payment-step-checkout').style.display = 'block';
      document.getElementById('payment-step-credentials').style.display = 'none';
      document.getElementById('standby-payment-modal').classList.add('open');
      return;
    }
    if (target.closest('#btn-close-payment-modal')) { document.getElementById('standby-payment-modal').classList.remove('open'); return; }
    if (target.closest('#btn-confirm-standby-payment')) { pkConfirmStandbyCheckout(); return; }
    if (target.closest('#btn-enter-with-generated-creds') && STATE.lastGeneratedClient) {
      var gc = STATE.lastGeneratedClient;
      document.getElementById('standby-payment-modal').classList.remove('open');
      STATE.activeTenantId = gc.tenantId;
      STATE.session = { role: 'cliente', username: gc.adminUsername, tenantId: gc.tenantId, internalRoleName: 'Administrador General (Cuenta Admin)' };
      pkUpdateShellNavigation(); return;
    }

    var wsSvc = target.closest('[data-ws-service]');
    if (wsSvc) { STATE.activeWorkstationPane = 'module'; STATE.activeServiceKey = wsSvc.getAttribute('data-ws-service'); STATE.activeSubmoduleKey = ''; pkRenderWorkstation(); return; }
    var wsSub = target.closest('[data-ws-submodule]');
    if (wsSub) { STATE.activeSubmoduleKey = wsSub.getAttribute('data-ws-submodule'); pkRenderWorkstation(); return; }
    if (target.closest('#btn-nav-internal-rbac')) { STATE.activeWorkstationPane = 'rbac'; pkRenderWorkstation(); return; }
    if (target.closest('#btn-nav-need-feature')) { STATE.activeWorkstationPane = 'need-feature'; pkRenderWorkstation(); return; }
    if (target.closest('#btn-ws-clear-filter')) {
      STATE.v2FilterText = ''; var fIn = document.getElementById('ws-v2-filter-input'); if (fIn) fIn.value = ''; pkRenderWorkstation(); return;
    }

    if (target.closest('#btn-ws-save-record')) {
      var inputs = document.querySelectorAll('[data-ws-field]');
      var recId = 'REG-' + String(Date.now()).slice(-4);
      var row = [recId];
      for (var f = 0; f < inputs.length; f++) row.push(inputs[f].value || 'Registrado');
      if (!STATE.submoduleRows[STATE.activeSubmoduleKey]) STATE.submoduleRows[STATE.activeSubmoduleKey] = [];
      STATE.submoduleRows[STATE.activeSubmoduleKey].unshift(row);
      if (pkIsDemoMode()) {
        pkSaveDemoToLocalStorage();
        pkRenderWorkstation();
        pkToast('Registro guardado en localStorage (Modo Demo).');
      } else {
        var clRec = pkGetActiveClient();
        fetch('/api/v1/control/client-db/record', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dbName: clRec.dbName, submoduleKey: STATE.activeSubmoduleKey, recordId: recId, cells: row })
        }).catch(function() {});
        pkRenderWorkstation();
        pkToast('Registro persistido en BD PostgreSQL: ' + clRec.dbName);
      }
      return;
    }

    if (target.closest('#btn-create-internal-role')) {
      var clR = pkGetActiveClient();
      if (clR.internalRoles.length >= clR.maxRolesAllowed) {
        pkToast('Has alcanzado el l\xEDmite m\xE1ximo de roles (' + clR.maxRolesAllowed + ') permitido por SuperAdmin.'); return;
      }
      var rName = ((document.getElementById('new-role-name') || {}).value || '').trim();
      var rDesc = ((document.getElementById('new-role-desc') || {}).value || '').trim() || 'Rol personalizado';
      if (!rName) { pkToast('Ingresa el nombre del rol.'); return; }
      clR.internalRoles.push({ roleId: 'rol-' + Date.now(), name: rName, description: rDesc, allowedSubmodules: clR.activeSubmodules.slice(0, 3) });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage();
      pkRenderWorkstation(); pkToast('Rol interno creado en ' + clR.dbName); return;
    }

    if (target.closest('#btn-create-internal-user')) {
      var clU = pkGetActiveClient();
      if (clU.internalUsers.length >= clU.maxUsersAllowed) {
        pkToast('Has alcanzado el l\xEDmite m\xE1ximo de usuarios (' + clU.maxUsersAllowed + ') permitido por SuperAdmin.'); return;
      }
      var uFull = ((document.getElementById('new-user-fullname') || {}).value || '').trim();
      var uName = ((document.getElementById('new-user-username') || {}).value || '').trim();
      if (!uFull || !uName) { pkToast('Completa nombre y usuario.'); return; }
      clU.internalUsers.push({ userId: 'u-' + Date.now(), username: uName, fullName: uFull, email: uName + '@empresa.co', internalRoleId: 'rol-operador', internalRoleName: 'Rol Asignado', passwordHint: 'Usr#2026!', isClientAdmin: false });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage();
      pkRenderWorkstation(); pkToast('Usuario creado en ' + clU.dbName); return;
    }

    var reqBtn = target.closest('[data-req-key]');
    if (reqBtn) {
      var clF = pkGetActiveClient();
      var rTier = reqBtn.getAttribute('data-req-tier');
      var rKey = reqBtn.getAttribute('data-req-key');
      var rLbl = reqBtn.getAttribute('data-req-label');
      if (rTier === 'SUBMODULO' && clF.activeSubmodules.indexOf(rKey) === -1) clF.activeSubmodules.push(rKey);
      if (rTier === 'FUNCIONALIDAD' && clF.activeFeatures.indexOf(rKey) === -1) clF.activeFeatures.push(rKey);
      STATE.featureRequests.push({ companyName: clF.companyName, tier: rTier, key: rKey, label: rLbl });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage();
      pkRenderWorkstation(); pkToast('Activado: ' + rLbl); return;
    }

    if (pkHandleSuperAdminAction(target)) return;
  });

  document.addEventListener('change', function(ev) {
    var t = ev.target;
    if (!t) return;
    var exSvc = t.getAttribute('data-extra-service');
    if (exSvc) { STATE.extraServiceKeys[exSvc] = !!t.checked; pkRenderRegistrationWizard(); return; }
    var exSub = t.getAttribute('data-extra-submodule');
    if (exSub) { STATE.extraSubmoduleKeys[exSub] = !!t.checked; pkRenderRegistrationWizard(); return; }
  });

  document.addEventListener('input', function(ev) {
    var t = ev.target;
    if (t && t.id === 'ws-v2-filter-input') {
      STATE.v2FilterText = t.value || '';
      pkRenderWorkstation();
      return;
    }
    if (t && (t.id === 'scale-gross-kg' || t.id === 'scale-tare-kg')) {
      var g = Number((document.getElementById('scale-gross-kg') || {}).value || 0);
      var tr = Number((document.getElementById('scale-tare-kg') || {}).value || 0);
      var net = Math.max(0, g - tr);
      var disp = document.getElementById('scale-net-display');
      if (disp) disp.value = net.toLocaleString('es-CO') + ' Kg (' + (net / 1000).toFixed(2) + ' Ton)';
    }
  });

  pkUpdateShellNavigation();
})();`;
}

// apps/web-app/src/presentation/components/landing-layer.component.ts
function renderLandingLayerHtml() {
  return `
  <!-- APARTADO 1: P\xC1GINA DE MUESTRA DE LA PLATAFORMA -->
  <section class="surface active" id="surface-showcase">
    <div class="hero-banner">
      <div>
        <span class="hero-badge">PLATAFORMA EMPRESARIAL CON BASE DE DATOS AISLADA POR CLIENTE</span>
        <h1 class="hero-title">Un solo sistema integrado para facturar, controlar bodegas, traslados, b\xE1scula, comandas y cupos.</h1>
        <p class="hero-sub">
          En <strong>Proveko</strong> cada empresa opera sobre su propia base de datos PostgreSQL independiente.
          Elige tu tipo de negocio con todos los m\xF3dulos b\xE1sicos incluidos y agrega subm\xF3dulos adicionales solo cuando los necesites.
        </p>
        <div class="row-actions" style="margin-top:16px">
          <button type="button" class="btn btn-primary" id="btn-hero-go-register">\u{1F680} Registra tu Negocio</button>
          <button type="button" class="btn btn-hero-outline" id="btn-hero-go-demo">\u{1F9EA} Probar Demo Interactiva</button>
          <button type="button" class="btn btn-hero-outline" id="btn-hero-go-login">\u{1F510} Iniciar Sesi\xF3n</button>
        </div>
      </div>
      <div class="quote-card">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#93c5fd;font-weight:700">Arquitectura Empresarial</div>
        <div style="font-size:18px;font-weight:800;margin:8px 0">M\xF3dulos Principales + Subm\xF3dulos + Funcionalidades</div>
        <div style="font-size:12px;color:#cbd5e1;line-height:1.5;margin-bottom:14px">
          \u2022 <strong>Base de Datos Propia:</strong> Aislamiento real por cliente.<br/>
          \u2022 <strong>Planes por Giro de Negocio:</strong> Todo lo b\xE1sico incluido desde el primer d\xEDa.<br/>
          \u2022 <strong>Roles y Usuarios Internos:</strong> Cuenta Admin generada al instante.
        </div>
        <button type="button" class="btn btn-emerald" style="width:100%" id="btn-card-go-register">
          Comenzar Registro de mi Negocio &rarr;
        </button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head">
        <div>
          <div class="card-title">M\xF3dulos Principales y Subm\xF3dulos de la Plataforma</div>
          <div style="font-size:12px;color:var(--pk-muted)">Cada M\xF3dulo Principal integra sus propios Subm\xF3dulos por pesta\xF1as y Funcionalidades especializadas</div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-showcase-mid-register">Registra tu Negocio</button>
      </div>
      <div class="card-body">
        <div class="center-selector-grid" id="showcase-services-grid"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-title">Planes Base por Tipo de Negocio</div>
          <div style="font-size:12px;color:var(--pk-muted)">Al seleccionar tu tipo de negocio ya vienen activados todos los m\xF3dulos b\xE1sicos para operar completo</div>
        </div>
      </div>
      <div class="card-body">
        <div class="center-selector-grid" id="showcase-presets-grid"></div>
      </div>
    </div>
  </section>

  <!-- MODAL DE VENTANA DE PAGOS (MICROSERVICIO MS-PAYMENTS EN STANDBY) + ENTREGA DE CUENTA ADMIN -->
  <div class="modal-backdrop" id="standby-payment-modal">
    <div class="modal-box">
      <div class="modal-head">
        <div>
          <span class="badge badge-amber">MICROSERVICIO DE PAGOS (MS-PAYMENTS) \xB7 MODO STANDBY</span>
          <h3 style="margin:6px 0 0;font-size:17px">Confirmaci\xF3n de Suscripci\xF3n y Creaci\xF3n de Base de Datos</h3>
        </div>
        <button type="button" class="btn btn-hero-outline btn-sm" id="btn-close-payment-modal">\u2715</button>
      </div>
      <div class="modal-body" id="payment-step-checkout">
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#92400e">
          <strong>Pasarela en Standby:</strong> El microservicio de cobro procesar\xE1 tu registro en modo pre-autorizado para crear de inmediato tu Base de Datos aislada en PostgreSQL y generar tu cuenta <strong>admin</strong>.
        </div>
        <div class="grid-2" style="margin-bottom:12px">
          <div class="field">
            <label>Empresa a Registrar</label>
            <input type="text" id="pay-modal-company" readonly />
          </div>
          <div class="field">
            <label>Total Mensual (Plan Base + Adicionales)</label>
            <input type="text" id="pay-modal-amount" readonly />
          </div>
        </div>
        <div class="field" style="margin-bottom:14px">
          <label>M\xE9todo de Pago (Pasarela Standby)</label>
          <select id="pay-modal-method">
            <option value="PSE_EMPRESARIAL">Transferencia PSE Empresarial (Standby)</option>
            <option value="TARJETA_CORPORATIVA">Tarjeta de Cr\xE9dito Corporativa (Standby)</option>
            <option value="FACTURACION_CONTRATO">Orden de Compra Corporativa (Standby)</option>
          </select>
        </div>
        <button type="button" class="btn btn-emerald" style="width:100%;padding:12px" id="btn-confirm-standby-payment">
          \u2705 Confirmar Pago en Standby, Crear Base de Datos y Generar Cuenta Admin
        </button>
      </div>

      <div class="modal-body" id="payment-step-credentials" style="display:none">
        <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:14px;margin-bottom:14px">
          <div style="font-weight:800;color:#065f46;font-size:15px;margin-bottom:4px">\u{1F389} \xA1Negocio Registrado y Base de Datos Creada en PostgreSQL!</div>
          <div style="font-size:12px;color:#047857">Guarda las credenciales de tu cuenta <strong>admin</strong> generada autom\xE1ticamente:</div>
        </div>
        <div class="cred-box" id="generated-credentials-box"></div>
        <div class="row-actions" style="margin-top:16px;justify-content:flex-end">
          <button type="button" class="btn btn-primary" id="btn-enter-with-generated-creds">
            \u{1F680} Entrar Ahora a la Plataforma de mi Empresa
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

// apps/web-app/src/presentation/components/login-and-superadmin.component.ts
function renderLoginAndSuperAdminHtml() {
  return `
  <!-- APARTADO 2: INICIAR SESI\xD3N O REGISTRA TU NEGOCIO -->
  <section class="surface" id="surface-auth">
    <div style="display:flex;justify-content:center;gap:10px;margin-bottom:18px">
      <button type="button" class="btn btn-primary" id="btn-auth-mode-login">\u{1F510} Iniciar Sesi\xF3n</button>
      <button type="button" class="btn btn-outline" id="btn-auth-mode-register">\u{1F680} Registra tu Negocio (Paso a Paso)</button>
    </div>

    <!-- MODO 2A: FORMULARIO DE LOGIN PROFESIONAL (CERO SELECTORES EDUCATIVOS) -->
    <div id="auth-pane-login" style="max-width:480px;margin:0 auto">
      <div class="card">
        <div class="card-head">
          <div>
            <span class="badge badge-blue">ACCESO SEGURO MULTI-BASE</span>
            <h2 style="margin:6px 0 0;font-size:18px">Iniciar Sesi\xF3n en Proveko</h2>
          </div>
        </div>
        <div class="card-body">
          <p style="font-size:12px;color:var(--pk-muted);margin:0 0 14px">
            Ingresa con tu usuario o correo corporativo. El sistema identifica autom\xE1ticamente tu rol
            (<strong>superadmin</strong>, <strong>desarrollador</strong>, <strong>auxiliar</strong> o <strong>cliente</strong>)
            y conecta con la base de datos aislada de tu empresa.
          </p>
          <div class="field" style="margin-bottom:12px">
            <label>Usuario o Correo Electr\xF3nico</label>
            <input type="text" id="login-username" placeholder="Ej: admin@tuempresa.com o superadmin@proveko.com" />
          </div>
          <div class="field" style="margin-bottom:16px">
            <label>Contrase\xF1a</label>
            <input type="password" id="login-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" />
          </div>
          <button type="button" class="btn btn-primary" style="width:100%;padding:11px" id="btn-submit-login">
            Ingresar a la Plataforma
          </button>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--pk-border);display:flex;justify-content:space-between;align-items:center;font-size:12px">
            <span style="color:var(--pk-muted)">\xBFA\xFAn no tienes cuenta empresarial?</span>
            <button type="button" class="btn btn-outline btn-sm" id="btn-login-switch-to-register">Registra tu Negocio &rarr;</button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODO 2B: ASISTENTE "REGISTRA TU NEGOCIO" (3 PASOS + PAGO AL FINAL) -->
    <div id="auth-pane-register" style="display:none">
      <div class="card" style="margin-bottom:16px">
        <div class="card-head">
          <div>
            <span class="badge badge-emerald">ALTA DE EMPRESA Y BASE DE DATOS PROPIA</span>
            <h2 style="margin:4px 0 0;font-size:18px">Registra tu Negocio en 3 Pasos</h2>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--pk-muted)">Total Mensual Estimado (Pesos Colombianos)</div>
            <div style="font-size:24px;font-weight:800;color:var(--pk-primary)" id="reg-quote-total">$149.000 COP/mes</div>
            <div style="font-size:11px;color:var(--pk-muted)" id="reg-quote-breakdown">Plan Base Incluido</div>
          </div>
        </div>
        <div class="card-body">
          <!-- PASO 1: TIPO DE NEGOCIO -->
          <div style="margin-bottom:20px">
            <div style="font-weight:800;font-size:14px;margin-bottom:4px">
              Paso 1. Selecciona tu Tipo de Negocio (Habilita todos los m\xF3dulos b\xE1sicos de tu operaci\xF3n)
            </div>
            <div style="font-size:12px;color:var(--pk-muted);margin-bottom:10px">
              El plan base de tu tipo de negocio ya incluye todos los M\xF3dulos Principales y Subm\xF3dulos esenciales para operar sin cobros ocultos.
            </div>
            <div class="preset-row" id="reg-business-types-row"></div>
            <div id="reg-included-summary" style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:12px;font-size:12px"></div>
          </div>

          <!-- PASO 2: \xBFQUIERES AGREGAR M\xD3DULOS PRINCIPALES O SUBM\xD3DULOS ADICIONALES? -->
          <div style="margin-bottom:20px">
            <div style="font-weight:800;font-size:14px;margin-bottom:4px">
              Paso 2. \xBFQuieres agregar M\xF3dulos Principales o Subm\xF3dulos adicionales? (Opcional)
            </div>
            <div style="font-size:12px;color:var(--pk-muted);margin-bottom:10px">
              Solo si necesitas capacidades fuera de tu giro base, selecciona aqu\xED M\xF3dulos Principales o Subm\xF3dulos adicionales (las funcionalidades internas vienen gobernadas por el sistema).
            </div>
            <div class="center-selector-grid" id="reg-addons-grid"></div>
          </div>

          <!-- PASO 3: DATOS DE LA EMPRESA Y PAGO FINAL -->
          <div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:16px">
            <div style="font-weight:800;font-size:14px;margin-bottom:10px">
              Paso 3. Datos de tu Empresa y Pago de Activaci\xF3n
            </div>
            <div class="grid-3">
              <div class="field">
                <label>Raz\xF3n Social o Nombre del Negocio</label>
                <input type="text" id="reg-company-name" placeholder="Ej: Comercializadora del Norte S.A.S." />
              </div>
              <div class="field">
                <label>NIT / Identificaci\xF3n Fiscal</label>
                <input type="text" id="reg-company-nit" placeholder="Ej: 901.552.310-8" />
              </div>
              <div class="field">
                <label>Correo del Administrador</label>
                <input type="email" id="reg-company-email" placeholder="gerencia@tuempresa.com" />
              </div>
            </div>
            <div class="row-actions" style="margin-top:14px;justify-content:flex-end">
              <button type="button" class="btn btn-emerald" id="btn-open-standby-checkout">
                \u{1F4B3} Ir al Pago y Crear Base de Datos de mi Empresa &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CONSOLA GLOBAL PARA ROLES DE PLATAFORMA: SUPERADMIN, DESARROLLADOR Y AUXILIAR -->
  <section class="surface" id="surface-superadmin">
    <div class="card" style="margin-bottom:16px">
      <div class="card-head">
        <div>
          <span class="badge badge-blue" id="staff-console-badge">ROL GLOBAL: SUPERADMIN</span>
          <h2 style="margin:4px 0 0;font-size:18px" id="staff-console-title">Control Maestro de Clientes, Bases de Datos y Cuotas de Roles/Usuarios</h2>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-sa-new-client">+ Crear Nuevo Cliente y su Base de Datos</button>
      </div>
      <div class="card-body">
        <div class="kpi-row" id="sa-kpi-row"></div>
        <div id="sa-tenants-grid" style="display:grid;gap:14px"></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head">
        <div>
          <span class="badge badge-emerald">BASE DE DATOS DEDICADA: proveko_groups_db</span>
          <div class="card-title" style="margin-top:4px">\u{1F9E9} Grupos de Clientes (Bares, Comercio, Agro...) y Cat\xE1logo Din\xE1mico para Desarrolladores</div>
          <div style="font-size:12px;color:var(--pk-muted)">Guarda en BD qu\xE9 M\xF3dulos Principales, Subm\xF3dulos y Funcionalidades tiene cada grupo b\xE1sico y permite a los desarrolladores crear nuevas funcionalidades y asociarlas a cualquier grupo.</div>
        </div>
      </div>
      <div class="card-body" id="sa-groups-catalog-panel"></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">Solicitudes de Clientes \u2014 Pesta\xF1a "Necesito otra funcionalidad"</div>
        <span class="badge badge-amber" id="sa-requests-count">0 solicitudes</span>
      </div>
      <div class="card-body" id="sa-feature-requests-body"></div>
    </div>
  </section>`;
}

// apps/web-app/src/presentation/components/workstation-layer.component.ts
function renderWorkstationLayerHtml() {
  return `
  <section class="surface" id="surface-workstation">
    <!-- BANNER EXCLUSIVO CUANDO SE NAVEGA EN EL APARTADO 3: DEMO (db_version_prueba) -->
    <div id="demo-mode-banner" style="display:none;background:linear-gradient(90deg,#1e3a8a,#1d4ed8);color:#fff;padding:10px 16px;border-radius:12px;margin-bottom:14px;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="font-size:12px">
        <strong>\u{1F9EA} APARTADO DEMO INTERACTIVA:</strong> Est\xE1s probando todos los M\xF3dulos Principales y Subm\xF3dulos sobre la base de datos de demostraci\xF3n (<code>db_version_prueba</code>).
      </div>
      <button type="button" class="btn btn-emerald btn-sm" id="btn-demo-go-register">
        \u{1F680} Registra tu Negocio y obt\xE9n tu propia Base de Datos &rarr;
      </button>
    </div>

    <div class="ws-layout">
      <!-- BARRA LATERAL: M\xD3DULOS PRINCIPALES + ROLES/USUARIOS + "NECESITO OTRA FUNCIONALIDAD" -->
      <aside class="ws-sidebar">
        <div class="ws-nav-head" id="ws-tenant-sidebar-head">M\xD3DULOS PRINCIPALES</div>
        <div class="ws-nav-list" id="ws-principal-modules-nav"></div>
        <div style="border-top:1px solid var(--pk-border);margin:8px 0;padding-top:8px">
          <div class="ws-nav-head">ADMINISTRACI\xD3N DE EMPRESA</div>
          <div class="ws-nav-list" id="ws-company-admin-nav">
            <button type="button" class="ws-nav-btn" id="btn-nav-internal-rbac">
              <div class="ws-nav-title">\u{1F465} Roles y Usuarios Internos</div>
              <div class="ws-nav-sub" id="ws-rbac-quota-sub">Cuenta Admin y permisos en tu BD</div>
            </button>
            <button type="button" class="ws-nav-btn" id="btn-nav-need-feature">
              <div class="ws-nav-title">\u2728 Necesito otra funcionalidad</div>
              <div class="ws-nav-sub">Solicitar o ampliar m\xF3dulos y funciones</div>
            </button>
          </div>
        </div>
      </aside>

      <!-- \xC1REA CENTRAL DE OPERACI\xD3N -->
      <div class="ws-main">
        <!-- VISTA 1: OPERACI\xD3N DE UN M\xD3DULO PRINCIPAL Y SUS INTERPESTA\xD1AS DE SUBM\xD3DULOS -->
        <div id="ws-pane-module-operation">
          <div class="card" style="margin-bottom:14px">
            <div class="card-head">
              <div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span id="ws-active-service-icon" style="font-size:20px">\u{1F4E6}</span>
                  <h2 style="margin:0;font-size:18px" id="ws-active-service-title">M\xF3dulo Principal</h2>
                  <span class="badge badge-emerald" id="ws-active-db-badge">BD: db_version_prueba</span>
                </div>
                <div style="font-size:12px;color:var(--pk-muted);margin-top:3px" id="ws-active-service-sub"></div>
              </div>
              <div id="ws-active-features-pills" style="display:flex;gap:6px;flex-wrap:wrap"></div>
            </div>
            <!-- BARRA DE INTERPESTA\xD1AS DE SUBM\xD3DULOS -->
            <div style="padding:10px 18px;background:#f8fafc;border-bottom:1px solid var(--pk-border);display:flex;gap:8px;flex-wrap:wrap" id="ws-submodule-tabs"></div>

            <div class="card-body">
              <div style="margin-bottom:12px;font-size:12px;color:var(--pk-muted)" id="ws-submodule-summary"></div>

              <!-- WIDGETS ESPECIALIZADOS DEL SUBM\xD3DULO (POS / RECETAS / B\xC1SCULA) -->
              <div id="ws-specialized-widget-slot" style="margin-bottom:16px"></div>

              <!-- FORMULARIO LIMPIO DEL SUBM\xD3DULO (CON LOS CAMPOS DE SUS FUNCIONALIDADES ACTIVAS) -->
              <div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:14px;margin-bottom:16px">
                <div class="grid-3" id="ws-submodule-form-fields"></div>
                <div class="row-actions" style="margin-top:12px;justify-content:flex-end">
                  <button type="button" class="btn btn-primary" id="btn-ws-save-record">Guardar Registro</button>
                </div>
              </div>

              <!-- BARRA DE FILTROS MULTICRITERIO ESTILO VERSION2 (v2) -->
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;padding:10px 12px;background:#f1f5f9;border:1px solid var(--pk-border);border-radius:10px">
                <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:240px">
                  <span style="font-size:12px;font-weight:800;color:var(--pk-text)">\u{1F50D} Filtro R\xE1pido (v2):</span>
                  <input type="text" id="ws-v2-filter-input" placeholder="Buscar por NIT, cliente, c\xF3digo, bodega, placa o estado..." style="flex:1;padding:7px 10px;border:1px solid var(--pk-border);border-radius:7px;font-size:12px;background:#fff" />
                </div>
                <div class="row-actions">
                  <span class="badge badge-blue" id="ws-v2-count-badge">0 registros</span>
                  <button type="button" class="btn btn-outline btn-sm" id="btn-ws-clear-filter">Limpiar Filtro</button>
                </div>
              </div>

              <!-- TABLA DE REGISTROS DEL SUBM\xD3DULO -->
              <div class="table-wrap">
                <table>
                  <thead id="ws-submodule-thead"></thead>
                  <tbody id="ws-submodule-tbody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- VISTA 2: ROLES Y USUARIOS INTERNOS EN LA BD DEL CLIENTE -->
        <div id="ws-pane-internal-rbac" style="display:none"></div>

        <!-- VISTA 3: PESTA\xD1A "NECESITO OTRA FUNCIONALIDAD" -->
        <div id="ws-pane-need-feature" style="display:none"></div>
      </div>
    </div>
  </section>`;
}

// apps/web-app/src/presentation/styles/components.styles.ts
function renderComponentsStylesCss() {
  return `
    .preset-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    .preset-chip {
      border: 1px solid var(--pk-border); background: #fff; border-radius: 999px;
      padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer;
    }
    .preset-chip.active { background: var(--pk-primary); color: #fff; border-color: var(--pk-primary); }
    .center-selector-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .center-pick-card {
      background: #fff; border: 2px solid var(--pk-border); border-radius: 14px;
      padding: 16px; transition: 0.15s;
    }
    .center-pick-card.selected { border-color: var(--pk-primary); background: #f8faff; }
    .center-pick-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .center-pick-title { font-weight: 800; font-size: 14px; }
    .center-pick-price { font-size: 12px; font-weight: 800; color: var(--pk-primary); background: #dbeafe; padding: 3px 8px; border-radius: 6px; }
    .center-pick-desc { font-size: 12px; color: var(--pk-muted); margin-bottom: 10px; line-height: 1.4; }
    .comp-toggle-list { display: flex; flex-direction: column; gap: 6px; border-top: 1px dashed var(--pk-border); padding-top: 10px; }
    .comp-toggle-pill {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      font-size: 11px; background: #f8fafc; padding: 6px 9px; border-radius: 7px; border: 1px solid #e2e8f0;
    }
    .card { background: #fff; border: 1px solid var(--pk-border); border-radius: 14px; overflow: hidden; }
    .card-head {
      padding: 14px 18px; border-bottom: 1px solid var(--pk-border);
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      background: #f8fafc;
    }
    .card-title { font-size: 15px; font-weight: 800; }
    .card-body { padding: 18px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field label { font-size: 11px; font-weight: 700; color: var(--pk-muted); text-transform: uppercase; }
    .field input, .field select {
      padding: 9px 11px; border: 1px solid var(--pk-border); border-radius: 8px;
      font-size: 13px; background: #fff; color: var(--pk-text);
    }
    .btn {
      border: 0; border-radius: 9px; padding: 9px 15px; font-size: 12px; font-weight: 700;
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    }
    .btn-primary { background: var(--pk-primary); color: #fff; }
    .btn-emerald { background: var(--pk-emerald); color: #fff; }
    .btn-outline { background: #fff; border: 1px solid var(--pk-border); color: var(--pk-text); }
    .btn-hero-outline { background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.42); color: #ffffff; }
    .btn-hero-outline:hover { background: rgba(255, 255, 255, 0.24); }
    .btn-sm { padding: 5px 10px; font-size: 11px; }
    .badge {
      display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px;
      border-radius: 999px; font-size: 11px; font-weight: 700;
    }
    .badge-emerald { background: #d1fae5; color: #065f46; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-slate { background: #f1f5f9; color: #334155; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      text-align: left; padding: 10px 12px; background: #f1f5f9; color: var(--pk-muted);
      font-size: 11px; text-transform: uppercase; border-bottom: 1px solid var(--pk-border);
    }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    .kpi-box { background: #fff; border: 1px solid var(--pk-border); border-radius: 12px; padding: 14px; }
    .kpi-label { font-size: 11px; color: var(--pk-muted); font-weight: 700; text-transform: uppercase; }
    .kpi-val { font-size: 20px; font-weight: 800; margin-top: 4px; }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(15,23,42,0.65);
      display: none; align-items: center; justify-content: center; z-index: 80; padding: 20px;
    }
    .modal-backdrop.open { display: flex; }
    .modal-box {
      background: #fff; border-radius: 16px; max-width: 620px; width: 100%;
      border: 1px solid var(--pk-border); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.25);
    }
    .modal-head { padding: 16px 20px; background: #0f172a; color: #fff; display: flex; justify-content: space-between; align-items: center; }
    .modal-body { padding: 20px; }
    .cred-box {
      background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.6;
    }
    .row-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .toast {
      position: fixed; bottom: 18px; right: 18px; background: #0f172a; color: #fff;
      padding: 12px 18px; border-radius: 10px; font-size: 12px; font-weight: 700;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25); display: none; z-index: 95;
    }
    .toast.show { display: block; }
    @media (max-width: 1024px) {
      .hero-banner, .center-selector-grid, .ws-layout, .grid-2, .grid-3, .kpi-row { grid-template-columns: 1fr; }
    }
  `;
}

// apps/web-app/src/presentation/styles/design-tokens.styles.ts
function renderProvekoDesignTokensCss() {
  return `
    :root {
      --bg-canvas: #F8FAFC;
      --bg-surface: #FFFFFF;
      --border-hairline: #E2E8F0;
      --border-strong: #CBD5E1;
      --nav-bg: #0F172A;
      --nav-bg-hover: #1E293B;
      --nav-text-muted: #94A3B8;
      --nav-text-active: #F8FAFC;
      --brand-primary: #1D4ED8;
      --brand-primary-hover: #1E40AF;
      --brand-primary-soft: #EFF6FF;
      --text-primary: #0F172A;
      --text-secondary: #334155;
      --text-muted: #64748B;
      --status-emerald-fg: #15803D;
      --status-emerald-bg: #DCFCE7;
      --status-amber-fg: #B45309;
      --status-amber-bg: #FEF3C7;
      --status-crimson-fg: #B91C1C;
      --status-crimson-bg: #FEE2E2;
      --status-slate-fg: #475569;
      --status-slate-bg: #F1F5F9;
      --font-sans: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-sans);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: 14px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .tabular-nums {
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum" 1, "zero" 1;
    }

    .mono {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }

    .hidden {
      display: none !important;
    }
  `;
}

// apps/web-app/src/presentation/styles/layout-shell.styles.ts
function renderLayoutShellStylesCss() {
  return `
    :root {
      --pk-bg: #f1f5f9;
      --pk-card: #ffffff;
      --pk-text: #0f172a;
      --pk-muted: #475569;
      --pk-border: #cbd5e1;
      --pk-primary: #1d4ed8;
      --pk-primary-hover: #1e40af;
      --pk-emerald: #059669;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--pk-bg);
      color: var(--pk-text);
    }
    .pk-shell { min-height: 100vh; display: flex; flex-direction: column; }
    .pk-topbar {
      background: #ffffff;
      border-bottom: 1px solid var(--pk-border);
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .pk-brand { display: flex; align-items: center; gap: 10px; }
    .pk-logo {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #1e3a8a, #2563eb);
      color: #fff; font-weight: 800; font-size: 15px;
      display: flex; align-items: center; justify-content: center;
    }
    .pk-title { font-weight: 800; font-size: 16px; letter-spacing: -0.02em; }
    .pk-subtitle { font-size: 11px; color: var(--pk-muted); }
    .pk-surface-tabs {
      display: flex; gap: 6px; background: #f1f5f9; padding: 4px;
      border-radius: 10px; border: 1px solid var(--pk-border);
    }
    .pk-tab-btn {
      border: 0; background: transparent; padding: 7px 13px; border-radius: 7px;
      font-size: 12px; font-weight: 700; color: var(--pk-muted); cursor: pointer;
    }
    .pk-tab-btn.active {
      background: #fff; color: var(--pk-primary);
      box-shadow: 0 1px 3px rgba(15,23,42,0.1);
    }
    .pk-context-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .surface { display: none; padding: 20px; max-width: 1440px; width: 100%; margin: 0 auto; }
    .surface.active { display: block; }
    .hero-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      color: #fff; border-radius: 16px; padding: 26px;
      display: grid; grid-template-columns: 1.5fr 1fr; gap: 22px; margin-bottom: 20px;
    }
    .hero-badge {
      display: inline-block; background: rgba(59,130,246,0.25); border: 1px solid rgba(147,197,253,0.4);
      color: #bfdbfe; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-bottom: 10px;
    }
    .hero-title { font-size: 25px; font-weight: 800; margin: 0 0 8px; line-height: 1.25; }
    .hero-sub { font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5; }
    .quote-card {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 14px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .ws-layout { display: grid; grid-template-columns: 280px 1fr; gap: 18px; align-items: start; }
    .ws-sidebar {
      background: #fff; border: 1px solid var(--pk-border); border-radius: 14px;
      padding: 12px; position: sticky; top: 74px;
    }
    .ws-nav-head { font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--pk-muted); padding: 6px 8px; }
    .ws-nav-list { display: flex; flex-direction: column; gap: 5px; }
    .ws-nav-btn {
      text-align: left; border: 1px solid transparent; background: transparent;
      padding: 10px 12px; border-radius: 10px; cursor: pointer; transition: 0.15s;
    }
    .ws-nav-btn:hover { background: #f8fafc; border-color: var(--pk-border); }
    .ws-nav-btn.active { background: #eff6ff; border-color: #93c5fd; color: var(--pk-primary); }
    .ws-nav-title { font-size: 13px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .ws-nav-sub { font-size: 11px; color: var(--pk-muted); margin-top: 2px; }
    .ws-main { display: flex; flex-direction: column; gap: 16px; }
  `;
}

// apps/web-app/src/presentation/views/proveko-app.document.ts
function renderProvekoWorkstationHtml(options = {}) {
  const appDomain = options.appDomain ?? "proveko.sudoalexmar.tech";
  const initialSurface = options.initialSurface ?? "landing";
  const bootPayloadJson = JSON.stringify({
    initialSurface,
    services: MICROSERVICE_FRONTEND_CATALOG,
    submodules: ALL_SUBMODULES_FLAT,
    features: ALL_FEATURES_FLAT,
    businessTypes: BUSINESS_TYPE_PRESETS,
    initialClients: INITIAL_CLIENT_DATABASES,
    initialRows: INITIAL_SUBMODULE_ROWS
  }).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Proveko \u2014 Plataforma Empresarial de Gesti\xF3n Multi-Base</title>
  <style>
${renderProvekoDesignTokensCss()}
${renderLayoutShellStylesCss()}
${renderComponentsStylesCss()}
  </style>
</head>
<body>
  <div class="pk-shell">
    <header class="pk-topbar">
      <div class="pk-brand">
        <div class="pk-logo">PK</div>
        <div>
          <div class="pk-title">PROVEKO <span style="color:var(--pk-primary)" id="top-context-label">| Plataforma Empresarial</span></div>
          <div class="pk-subtitle">Gesti\xF3n Integrada Multi-Base \xB7 Dominio: ${appDomain}</div>
        </div>
      </div>

      <!-- NAVEGACI\xD3N P\xDABLICA: LOS 3 APARTADOS OFICIALES (1. MUESTRA, 2. LOGIN / REGISTRA TU NEGOCIO, 3. DEMO) -->
      <div class="pk-surface-tabs" id="public-nav-tabs">
        <button type="button" class="pk-tab-btn active" id="tab-nav-showcase">\u{1F3E2} Muestra de la Plataforma</button>
        <button type="button" class="pk-tab-btn" id="tab-nav-auth">\u{1F510} Login / Registra tu Negocio</button>
        <button type="button" class="pk-tab-btn" id="tab-nav-demo">\u{1F9EA} Demo</button>
      </div>

      <!-- BARRA DE SESI\xD3N AUTENTICADA (SOLO VISIBLE CUANDO UN USUARIO INICIA SESI\xD3N REAL) -->
      <div class="pk-context-bar" id="authenticated-session-bar" style="display:none">
        <span class="badge badge-blue" id="session-role-badge">Rol</span>
        <span class="badge badge-emerald" id="session-db-badge">BD</span>
        <span style="font-size:12px;font-weight:700;color:var(--pk-text)" id="session-user-label"></span>
        <button type="button" class="btn btn-outline btn-sm" id="btn-logout-session">Cerrar Sesi\xF3n</button>
      </div>
    </header>

    ${renderLandingLayerHtml()}
    ${renderLoginAndSuperAdminHtml()}
    ${renderWorkstationLayerHtml()}
  </div>

  <div class="toast" id="pk-toast"></div>

  <script>
    window.__PROVEKO_BOOT__ = ${bootPayloadJson};
${renderClientRuntimeBundleJs()}
  </script>
</body>
</html>`;
}

// apps/api-gateway/src/control-plane-http.handler.ts
async function handleControlPlaneAndCheckoutRoutes(params) {
  const { method, url, req, res, jwtVault, migrationsRootDir, readJsonBody: readJsonBody2 } = params;
  if (method === "GET" && url === "/api/v1/control/databases") {
    let live = PostgresPsqlBootstrapRunner.listPostgresDatabasesAndClients();
    if (process.env.DB_HOST && (!live.databases.includes("proveko_groups_db") || live.databases.includes("db_version_prueba"))) {
      await PostgresPsqlBootstrapRunner.runStartupMigrations(migrationsRootDir);
      live = PostgresPsqlBootstrapRunner.listPostgresDatabasesAndClients();
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(live));
    return true;
  }
  if (method === "GET" && url === "/api/v1/control/groups-catalog") {
    const snapshot = PostgresPsqlBootstrapRunner.getClientGroupsCatalogFromPostgres();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(snapshot));
    return true;
  }
  if (method === "POST" && url === "/api/v1/control/client-db/record") {
    const body = await readJsonBody2(req) ?? {};
    const ok = PostgresPsqlBootstrapRunner.saveClientSubmoduleRecordInPostgres({
      dbName: String(body.dbName ?? ""),
      submoduleKey: String(body.submoduleKey ?? "mod-pos"),
      recordId: String(body.recordId ?? `REG-${Date.now()}`),
      cells: Array.isArray(body.cells) ? body.cells : []
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok }));
    return true;
  }
  if (method === "POST" && url === "/api/v1/control/groups-catalog/group") {
    const body = await readJsonBody2(req) ?? {};
    const ok = PostgresPsqlBootstrapRunner.upsertClientBusinessGroupInPostgres({
      groupKey: String(body.groupKey ?? "nuevo-grupo"),
      groupName: String(body.groupName ?? "Nuevo Grupo de Clientes"),
      badgeLabel: String(body.badgeLabel ?? "Plan Base Completo"),
      description: String(body.description ?? ""),
      baseMonthlyCop: Number(body.baseMonthlyCop ?? 149e3),
      includedPrincipalServices: Array.isArray(body.includedPrincipalServices) ? body.includedPrincipalServices : [],
      includedSubmodules: Array.isArray(body.includedSubmodules) ? body.includedSubmodules : [],
      includedFeatures: Array.isArray(body.includedFeatures) ? body.includedFeatures : []
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok }));
    return true;
  }
  if (method === "POST" && url === "/api/v1/control/groups-catalog/item") {
    const body = await readJsonBody2(req) ?? {};
    const rawTier = String(body.itemTier ?? "FUNCIONALIDAD");
    const itemTier = rawTier === "MODULO_PRINCIPAL" || rawTier === "SUBMODULO" ? rawTier : "FUNCIONALIDAD";
    const ok = PostgresPsqlBootstrapRunner.registerDeveloperCatalogItemInPostgres({
      itemTier,
      itemKey: String(body.itemKey ?? `comp-dev-${Date.now()}`),
      parentServiceKey: String(body.parentServiceKey ?? "srv-gastro"),
      parentSubmoduleKey: String(body.parentSubmoduleKey ?? "independent"),
      externalName: String(body.externalName ?? "Nueva Funcionalidad"),
      iconEmoji: String(body.iconEmoji ?? "\u2728"),
      description: String(body.description ?? ""),
      monthlyCop: Number(body.monthlyCop ?? 19e3),
      targetGroupKey: typeof body.targetGroupKey === "string" ? body.targetGroupKey : void 0
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok }));
    return true;
  }
  if (method === "POST" && url === "/api/v1/payments/checkout/standby") {
    const checkoutReq = await readJsonBody2(req) ?? {};
    const companyName = typeof checkoutReq.companyName === "string" && checkoutReq.companyName.trim().length > 0 ? checkoutReq.companyName.trim() : "Nueva Empresa Cliente S.A.S.";
    const nit = typeof checkoutReq.nit === "string" && checkoutReq.nit.trim().length > 0 ? checkoutReq.nit.trim() : "900.000.000-1";
    const rawSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20) || "cliente";
    const tenantId = `tnt-${rawSlug}`;
    const dbName = `db_${rawSlug}`;
    const adminUsername = typeof checkoutReq.adminUsername === "string" && checkoutReq.adminUsername.trim().length > 0 ? checkoutReq.adminUsername.trim() : typeof checkoutReq.adminEmail === "string" && checkoutReq.adminEmail.trim().length > 0 ? checkoutReq.adminEmail.trim() : `admin.${rawSlug}`;
    const temporaryPassword = typeof checkoutReq.adminPasswordHint === "string" && checkoutReq.adminPasswordHint.trim().length > 0 ? checkoutReq.adminPasswordHint.trim() : "Prov#2026!";
    const paymentReference = `STBY-${Date.now()}`;
    const createdInPostgres = await PostgresPsqlBootstrapRunner.provisionNewClientDatabaseInPostgres({
      tenantId,
      slug: rawSlug,
      companyName,
      nit,
      businessType: checkoutReq.businessTypeId ?? "comercio-retail",
      dbName,
      adminUsername,
      adminPassword: temporaryPassword,
      maxRolesAllowed: checkoutReq.maxRolesAllowed ?? 5,
      maxUsersAllowed: checkoutReq.maxUsersAllowed ?? 10,
      enabledServices: checkoutReq.activePrincipalServices ?? [
        "srv-invoicing",
        "srv-inventory"
      ],
      enabledSubmodules: checkoutReq.activeSubmodules ?? [
        "mod-pos",
        "mod-stock",
        "mod-warehouses"
      ],
      enabledFeatures: checkoutReq.activeFeatures ?? [
        "comp-cashier-name",
        "comp-manager-signature"
      ],
      monthlyAmountUsd: checkoutReq.monthlyUsd ?? 39,
      paymentReference,
      migrationsRootDir
    });
    const token = jwtVault.signAccessToken({
      tenant_id: tenantId,
      cell_id: "cell-db-01",
      user_id: `usr-admin-${rawSlug}`,
      role_key: "cliente",
      tier: "enterprise",
      is_sandbox: false,
      active_branch_id: "br-01",
      allowed_branch_ids: ["br-01", "br-02"],
      sub_ver: 1,
      services: {
        "srv:crm": ["ms:crm-directory"],
        "srv:invoicing": ["ms:invoicing-pos", "ms:invoicing-electronic-dian"],
        "srv:inventory": ["ms:inventory-stock", "ms:inventory-recipes"]
      },
      readonly_microservices: []
    });
    res.writeHead(201, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        paymentStatus: "STANDBY_APPROVED",
        paymentService: "ms-payments",
        paymentReference,
        dbName,
        createdInPostgres,
        credential: {
          tenantId,
          companyName,
          nit,
          dbName,
          adminUsername,
          temporaryPassword,
          roleKey: "cliente"
        },
        token
      })
    );
    return true;
  }
  return false;
}

// apps/api-gateway/src/security/rate-limiter.ts
var TIER_RATE_LIMITS = {
  sandbox_ephemeral: { maxTokens: 30, refillPerSec: 5 },
  basic: { maxTokens: 120, refillPerSec: 20 },
  business: { maxTokens: 300, refillPerSec: 50 },
  enterprise: { maxTokens: 1e3, refillPerSec: 200 }
};
var TenantTierRateLimiter = class {
  buckets = /* @__PURE__ */ new Map();
  maxTrackedSubjects;
  bucketTtlMs;
  constructor(options = {}) {
    this.maxTrackedSubjects = options.maxTrackedSubjects ?? 1e4;
    this.bucketTtlMs = options.bucketTtlMs ?? 36e5;
  }
  getTrackedSubjectsCount() {
    return this.buckets.size;
  }
  checkOrThrow(subjectKey, tier = "basic") {
    const config2 = TIER_RATE_LIMITS[tier] ?? TIER_RATE_LIMITS.basic;
    const now = Date.now();
    const existing = this.buckets.get(subjectKey);
    if (!existing || now - existing.lastRefillMs > this.bucketTtlMs) {
      if (existing) {
        this.buckets.delete(subjectKey);
      }
      while (this.buckets.size >= this.maxTrackedSubjects) {
        const oldestKey = this.buckets.keys().next().value;
        if (!oldestKey) break;
        this.buckets.delete(oldestKey);
      }
      this.buckets.set(subjectKey, {
        tokens: config2.maxTokens - 1,
        lastRefillMs: now
      });
      return;
    }
    const elapsedSec = Math.max(0, (now - existing.lastRefillMs) / 1e3);
    const refilled = Math.min(
      config2.maxTokens,
      existing.tokens + elapsedSec * config2.refillPerSec
    );
    if (refilled < 1) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_RATE_LIMIT_EXCEEDED,
        429,
        `Rate limit exceeded for subject "${subjectKey}" (tier: ${tier}).`,
        { subject: subjectKey, tier }
      );
    }
    this.buckets.delete(subjectKey);
    this.buckets.set(subjectKey, {
      tokens: refilled - 1,
      lastRefillMs: now
    });
  }
};

// apps/api-gateway/src/gateway.server.ts
var FetchUpstreamHttpClientAdapter = class {
  constructor(timeoutMs = 5e3) {
    this.timeoutMs = timeoutMs;
  }
  timeoutMs;
  async forwardHttpRequest(params) {
    try {
      const fetchRes = await fetch(params.targetUrl, {
        method: params.method,
        headers: {
          "content-type": "application/json",
          ...params.headers ?? {},
          ...params.authorizationHeader ? { authorization: params.authorizationHeader } : {}
        },
        body: params.body !== void 0 && params.method !== "GET" && params.method !== "HEAD" ? JSON.stringify(params.body) : void 0,
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      const responseHeaders = {};
      fetchRes.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith("x-proveko-")) {
          responseHeaders[key.toLowerCase()] = value;
        }
      });
      const responseBody = await fetchRes.json().catch(() => null);
      return {
        status: fetchRes.status,
        contentType: fetchRes.headers.get("content-type") ?? "application/json",
        headers: responseHeaders,
        body: responseBody
      };
    } catch (err) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_UPSTREAM_UNAVAILABLE,
        502,
        `Upstream server at "${params.targetUrl}" failed or timed out: ${err instanceof Error ? err.message : String(err)}`,
        { target_url: params.targetUrl }
      );
    }
  }
};
var ProvekoApiGateway = class {
  constructor(perimeterGuard, upstreamRegistry, rateLimiter = new TenantTierRateLimiter(), httpClient = new FetchUpstreamHttpClientAdapter(), clusterHmacGuard = new ClusterHmacGuard()) {
    this.perimeterGuard = perimeterGuard;
    this.upstreamRegistry = upstreamRegistry;
    this.rateLimiter = rateLimiter;
    this.httpClient = httpClient;
    this.clusterHmacGuard = clusterHmacGuard;
  }
  perimeterGuard;
  upstreamRegistry;
  rateLimiter;
  httpClient;
  clusterHmacGuard;
  async handleGatewayRequest(req) {
    const cleanHeaders = sanitizeInboundTenantHeaders(req.headers);
    const authHeaderRaw = cleanHeaders["authorization"] ?? cleanHeaders["Authorization"];
    const authorizationHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
    if (this.hasPathTraversalSequence(req.url)) {
      const err = new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        400,
        `Path traversal sequences are forbidden in gateway URL: "${req.url}".`
      );
      return {
        status: err.statusCode,
        headers: { "content-type": "application/problem+json" },
        body: err.toProblemDetails()
      };
    }
    const parsedRoute = this.parseServiceAndMicroserviceUrl(req.url);
    if (!parsedRoute) {
      return {
        status: 404,
        headers: { "content-type": "application/problem+json" },
        body: {
          type: "https://errors.proveko.com/err_not_found",
          title: "Invalid Gateway Route Pattern",
          status: 404,
          error_code: PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
          detail: `Expected URL pattern /api/v1/<ms:*|srv:*>/<mod:*|ms:*>/<subPath>, received "${req.url}".`
        }
      };
    }
    try {
      const upstream = this.upstreamRegistry.resolveTargetServer(
        parsedRoute.parentService,
        parsedRoute.microserviceKey
      );
      return await this.perimeterGuard.verifyAndExecute(
        {
          authorizationHeader,
          method: req.method,
          headers: cleanHeaders
        },
        parsedRoute.parentService,
        parsedRoute.microserviceKey,
        async (verifiedCtx) => {
          this.rateLimiter.checkOrThrow(`tenant:${verifiedCtx.tenantId}`, verifiedCtx.tier);
          const fullSubPathWithQuery = parsedRoute.queryString ? `${parsedRoute.subPath}?${parsedRoute.queryString}` : parsedRoute.subPath;
          const downstreamReq = {
            method: req.method,
            path: fullSubPathWithQuery,
            headers: {
              ...cleanHeaders,
              authorization: authorizationHeader
            },
            body: req.body,
            query: parsedRoute.queryParams
          };
          if (upstream.transport) {
            const response = await upstream.transport(parsedRoute.microserviceKey, downstreamReq);
            const mergedHeaders = {
              ...response.headers,
              "x-proveko-gateway-routed-to": upstream.serverId,
              "x-proveko-gateway-base-url": upstream.baseUrl,
              "x-proveko-routing-mode": upstream.mode
            };
            return {
              ...response,
              headers: mergedHeaders
            };
          }
          const targetUrl = `${upstream.baseUrl}${fullSubPathWithQuery}`;
          const clusterHeaders = this.clusterHmacGuard.signOutboundRequest({
            method: req.method,
            pathAndQuery: fullSubPathWithQuery,
            targetParent: parsedRoute.parentService,
            targetModule: parsedRoute.microserviceKey,
            authorizationHeader
          });
          const fetchRes = await this.httpClient.forwardHttpRequest({
            targetUrl,
            method: req.method,
            authorizationHeader,
            headers: {
              "x-proveko-target-parent": parsedRoute.parentService,
              "x-proveko-target-module": parsedRoute.microserviceKey,
              ...clusterHeaders
            },
            body: req.body
          });
          const remoteHeaders = {
            ...fetchRes.headers ?? {},
            "content-type": fetchRes.contentType,
            "x-proveko-gateway-routed-to": upstream.serverId,
            "x-proveko-gateway-base-url": upstream.baseUrl,
            "x-proveko-routing-mode": upstream.mode
          };
          return {
            status: fetchRes.status,
            headers: remoteHeaders,
            body: fetchRes.body
          };
        }
      );
    } catch (err) {
      if (err instanceof ProvekoDomainError) {
        return {
          status: err.statusCode,
          headers: { "content-type": "application/problem+json" },
          body: err.toProblemDetails()
        };
      }
      const unexpected = new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_UPSTREAM_UNAVAILABLE,
        502,
        err instanceof Error ? err.message : "Unexpected Gateway Upstream Error"
      );
      return {
        status: unexpected.statusCode,
        headers: { "content-type": "application/problem+json" },
        body: unexpected.toProblemDetails()
      };
    }
  }
  hasPathTraversalSequence(rawUrl) {
    const lower = rawUrl.toLowerCase();
    return lower.includes("..") || lower.includes("%2e%2e") || lower.includes("%2e.") || lower.includes(".%2e") || lower.includes("\\") || lower.includes("%5c");
  }
  parseServiceAndMicroserviceUrl(url) {
    const qIndex = url.indexOf("?");
    const pathOnly = qIndex >= 0 ? url.slice(0, qIndex) : url;
    const queryString = qIndex >= 0 ? url.slice(qIndex + 1) : "";
    if (!pathOnly) return null;
    const match = /^\/api\/v1\/((?:srv|ms):[a-z0-9-]+)\/((?:mod|ms):[a-z0-9-]+)(\/.*)?$/.exec(pathOnly);
    if (!match || !match[1] || !match[2]) {
      return null;
    }
    try {
      const parentService = normalizeParentMicroserviceKey(
        match[1]
      );
      const microserviceKey = normalizeModuleKey(match[2]);
      const queryParams = {};
      if (queryString) {
        const searchParams = new URLSearchParams(queryString);
        for (const [k, v] of searchParams.entries()) {
          queryParams[k] = v;
        }
      }
      return {
        parentService,
        microserviceKey,
        subPath: match[3] && match[3].length > 0 ? match[3] : "/",
        queryString,
        queryParams
      };
    } catch {
      return null;
    }
  }
};

// apps/api-gateway/src/routing/upstream-registry.ts
function toMicroserviceEnvVarName(msKeyInput) {
  const msKey = normalizeModuleKey(msKeyInput);
  const normalized = msKey.replace(/^ms:/, "").replace(/-/g, "_").toUpperCase();
  return `UPSTREAM_MS_${normalized}`;
}
function toModuleEnvVarName(modKeyInput) {
  const msKey = normalizeModuleKey(modKeyInput);
  const normalized = msKey.replace(/^ms:/, "").replace(/-/g, "_").toUpperCase();
  return `UPSTREAM_MOD_${normalized}`;
}
function toParentServiceEnvVarName(srvKeyInput) {
  const srvKey = normalizeParentMicroserviceKey(srvKeyInput);
  const normalized = srvKey.replace(/^srv:/, "").replace(/-/g, "_").toUpperCase();
  return `UPSTREAM_SRV_${normalized}`;
}
function toParentMicroserviceEnvVarName(parentKeyInput) {
  const srvKey = normalizeParentMicroserviceKey(parentKeyInput);
  const normalized = srvKey.replace(/^srv:/, "").replace(/-/g, "_").toUpperCase();
  return `UPSTREAM_MS_${normalized}`;
}
var UpstreamRouteRegistry = class {
  dedicatedMicroserviceServers = /* @__PURE__ */ new Map();
  parentServiceHostServers = /* @__PURE__ */ new Map();
  catalogByMicroservice = /* @__PURE__ */ new Map();
  constructor(env = process.env) {
    const enabledFilterRaw = (env.ENABLED_MICROSERVICES || "*").trim();
    const enabledFilterSet = enabledFilterRaw === "*" || enabledFilterRaw === "" ? null : new Set(
      enabledFilterRaw.split(",").map(
        (token) => token.trim().toLowerCase().replace(/^(ms|srv)[:_-]/, "")
      ).filter(Boolean)
    );
    for (const item of SEED_MICROSERVICES_CATALOG) {
      this.catalogByMicroservice.set(item.key, item.parentService);
      const parentDomainSlug = item.parentService.replace(/^srv:/, "").toLowerCase();
      if (enabledFilterSet && !enabledFilterSet.has(parentDomainSlug)) {
        continue;
      }
      const modEnvKey = toModuleEnvVarName(item.key);
      const msEnvKey = toMicroserviceEnvVarName(item.key);
      const dedicatedUrl = env[modEnvKey] ?? env[msEnvKey];
      const usedEnvKey = env[modEnvKey] ? modEnvKey : msEnvKey;
      if (dedicatedUrl) {
        this.dedicatedMicroserviceServers.set(item.key, {
          serverId: `env:${usedEnvKey}`,
          baseUrl: dedicatedUrl.replace(/\/+$/, ""),
          mode: "DEDICATED_MICROSERVICE_SERVER"
        });
      }
      const parentMsEnvKey = toParentMicroserviceEnvVarName(item.parentService);
      const srvEnvKey = toParentServiceEnvVarName(item.parentService);
      const srvUrl = env[srvEnvKey] ?? env[parentMsEnvKey];
      const usedParentEnvKey = env[srvEnvKey] ? srvEnvKey : parentMsEnvKey;
      if (srvUrl && !this.parentServiceHostServers.has(item.parentService)) {
        this.parentServiceHostServers.set(item.parentService, {
          serverId: `env:${usedParentEnvKey}`,
          baseUrl: srvUrl.replace(/\/+$/, ""),
          mode: "PARENT_SERVICE_HOST_RUNNER"
        });
      }
    }
  }
  /**
   * Registra o mueve en caliente un Módulo (`mod:*` / `ms:*`) a un Servidor Dedicado propio.
   */
  registerDedicatedMicroserviceServer(microserviceKeyInput, baseUrl, standaloneNode) {
    const microserviceKey = normalizeModuleKey(microserviceKeyInput);
    if (!this.catalogByMicroservice.has(microserviceKey)) {
      throw new Error(`Unknown microservice key: ${microserviceKey}`);
    }
    this.dedicatedMicroserviceServers.set(microserviceKey, {
      serverId: standaloneNode?.serverNodeId ?? `dedicated:${microserviceKey}@${baseUrl}`,
      baseUrl: baseUrl.replace(/\/+$/, ""),
      mode: "DEDICATED_MICROSERVICE_SERVER",
      transport: standaloneNode ? async (_msKey, req) => standaloneNode.handleRequest(req) : void 0
    });
  }
  /**
   * Registra el Servidor del `host-runner` de un Microservicio Padre (`ms:*` / `srv:*`).
   */
  registerParentServiceHostServer(parentServiceInput, baseUrl, hostRunner) {
    const parentService = normalizeParentMicroserviceKey(parentServiceInput);
    this.parentServiceHostServers.set(parentService, {
      serverId: hostRunner?.hostNodeId ?? `host-runner:${parentService}@${baseUrl}`,
      baseUrl: baseUrl.replace(/\/+$/, ""),
      mode: "PARENT_SERVICE_HOST_RUNNER",
      transport: hostRunner ? async (msKey, req) => hostRunner.dispatch(msKey, req) : void 0
    });
  }
  /**
   * Remueve el override dedicado de un módulo para que regrese al servidor de su Microservicio Padre.
   */
  removeDedicatedMicroserviceServer(microserviceKeyInput) {
    this.dedicatedMicroserviceServers.delete(normalizeModuleKey(microserviceKeyInput));
  }
  /**
   * Resuelve a qué servidor físico/contenedor debe enviarse la petición:
   * 1. Valida que el Módulo pertenezca realmente al Microservicio Padre indicado en la ruta.
   * 2. Si el Módulo tiene un Servidor Dedicado (`DEDICATED_MICROSERVICE_SERVER`), lo elige.
   * 3. Si no, elige el Servidor `host-runner` del Microservicio Padre (`PARENT_SERVICE_HOST_RUNNER`).
   */
  resolveTargetServer(parentServiceInput, microserviceKeyInput) {
    const parentService = normalizeParentMicroserviceKey(parentServiceInput);
    const microserviceKey = normalizeModuleKey(microserviceKeyInput);
    const officialParent = this.catalogByMicroservice.get(microserviceKey);
    if (!officialParent || officialParent !== parentService) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MICROSERVICE_DISABLED,
        400,
        `Module "${microserviceKey}" does not belong to parent microservice "${parentService}".`,
        { parent_service: parentService, microservice: microserviceKey }
      );
    }
    const dedicated = this.dedicatedMicroserviceServers.get(microserviceKey);
    if (dedicated) {
      return dedicated;
    }
    const parentHost = this.parentServiceHostServers.get(parentService);
    if (parentHost) {
      return parentHost;
    }
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_UPSTREAM_UNAVAILABLE,
      502,
      `No upstream server configured for module "${microserviceKey}" nor parent "${parentService}".`,
      { parent_service: parentService, microservice: microserviceKey }
    );
  }
  getTopologySnapshot() {
    return SEED_MICROSERVICES_CATALOG.map((item) => {
      const dedicated = this.dedicatedMicroserviceServers.get(item.key);
      if (dedicated) {
        return {
          microserviceKey: item.key,
          parentService: item.parentService,
          resolvedMode: dedicated.mode,
          targetBaseUrl: dedicated.baseUrl,
          serverId: dedicated.serverId
        };
      }
      const parent = this.parentServiceHostServers.get(item.parentService);
      if (parent) {
        return {
          microserviceKey: item.key,
          parentService: item.parentService,
          resolvedMode: parent.mode,
          targetBaseUrl: parent.baseUrl,
          serverId: parent.serverId
        };
      }
      return {
        microserviceKey: item.key,
        parentService: item.parentService,
        resolvedMode: "UNCONFIGURED",
        targetBaseUrl: null,
        serverId: null
      };
    });
  }
};

// apps/api-gateway/src/cluster-node-runner.ts
function createHostRunnerForParentService(parentServiceInput, guard, enabledModulesFilter = "*", nodeId) {
  const normalizedParent = normalizeParentMicroserviceKey(parentServiceInput);
  const resolvedNodeId = nodeId ?? `container:${toParentMicroserviceNotation(normalizedParent)}`;
  switch (normalizedParent) {
    case "srv:crm":
      return createSrvCrmHostRunner(guard, enabledModulesFilter, resolvedNodeId);
    case "srv:inventory":
      return createSrvInventoryHostRunner(guard, enabledModulesFilter, resolvedNodeId);
    case "srv:invoicing":
      return createSrvInvoicingHostRunner(guard, enabledModulesFilter, resolvedNodeId);
    case "srv:gastro":
      return createSrvGastroHostRunner(guard, enabledModulesFilter, resolvedNodeId);
    case "srv:hotel":
      return createSrvHotelHostRunner(guard, enabledModulesFilter, resolvedNodeId);
    case "srv:finance":
      return createSrvFinanceHostRunner(guard, enabledModulesFilter, resolvedNodeId);
  }
}
var MAX_BODY_BYTES = 1048576;
async function readJsonBody(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buf.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new ProvekoDomainError(
        "ERR_VALIDATION_FAILED",
        413,
        `Request payload exceeds maximum allowed size (${MAX_BODY_BYTES} bytes).`
      );
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) return void 0;
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return void 0;
  try {
    return JSON.parse(raw);
  } catch {
    throw new ProvekoDomainError(
      "ERR_VALIDATION_FAILED",
      400,
      "Invalid JSON payload in HTTP request body."
    );
  }
}
async function startProvekoClusterNodeHttpServer(options) {
  const env = options.env ?? process.env;
  const host = options.host ?? "0.0.0.0";
  const port = options.port ?? Number(env.PORT ?? 4e3);
  const jwtKid = options.jwtKid ?? env.JWT_ACTIVE_KID ?? "kid-proveko-cluster-2026";
  const jwtMasterSeed = options.jwtMasterSeed ?? env.JWT_MASTER_SEED ?? "proveko-default-cluster-ed25519-master-seed-2026";
  const clusterSecret = options.clusterSecret ?? env.PROVEKO_CLUSTER_SECRET ?? DEFAULT_PROVEKO_CLUSTER_SECRET;
  const keyPair = Ed25519JwtVault.deriveDeterministicKeyPairEntry(jwtKid, jwtMasterSeed);
  const jwtVault = new Ed25519JwtVault(jwtKid, [keyPair]);
  const guard = new DoubleKeyServiceGuard(jwtVault);
  const clusterHmacGuard = new ClusterHmacGuard(clusterSecret);
  const nodeId = options.nodeId ?? env.PROVEKO_NODE_ID ?? `proveko-${options.nodeRole}${options.parentService ? `-${options.parentService}` : ""}`;
  let hostRunner = null;
  let gateway = null;
  let migrationRegistry = null;
  let postgresBootstrapSummary = null;
  const cwdMigrations = path.resolve(process.cwd(), "libs/tenant-db-resolver/migrations");
  const relativeMigrations = fileURLToPath(
    new URL("../../../libs/tenant-db-resolver/migrations", import.meta.url)
  );
  const migrationsRootDir = env.PROVEKO_MIGRATIONS_DIR ?? (existsSync3(cwdMigrations) ? cwdMigrations : relativeMigrations);
  if (options.nodeRole === "ms-host-runner") {
    const rawParent = options.parentService ?? env.PROVEKO_PARENT_SERVICE ?? "ms:invoicing";
    const enabledFilter = options.enabledModulesFilter ?? env.ENABLED_MODULES ?? env.ENABLED_MICROSERVICES ?? "*";
    hostRunner = createHostRunnerForParentService(rawParent, guard, enabledFilter, nodeId);
  } else if (options.nodeRole === "api-gateway") {
    const upstreamRegistry = new UpstreamRouteRegistry(env);
    gateway = new ProvekoApiGateway(
      guard,
      upstreamRegistry,
      new TenantTierRateLimiter(),
      new FetchUpstreamHttpClientAdapter(),
      clusterHmacGuard
    );
    if (env.DB_HOST) {
      postgresBootstrapSummary = await PostgresPsqlBootstrapRunner.runStartupMigrations(migrationsRootDir);
    }
  } else if (options.nodeRole === "core-service") {
    migrationRegistry = new FileBasedMigrationRegistry();
    migrationRegistry.loadAllCatalogMigrationsFromRoot(migrationsRootDir);
    if (env.DB_HOST) {
      postgresBootstrapSummary = await PostgresPsqlBootstrapRunner.runStartupMigrations(migrationsRootDir);
    }
  } else if (options.nodeRole === "frontend" && env.DB_HOST) {
    postgresBootstrapSummary = await PostgresPsqlBootstrapRunner.runStartupMigrations(migrationsRootDir);
  }
  const server = http.createServer(async (req, res) => {
    try {
      const method = req.method?.toUpperCase() ?? "GET";
      const url = req.url ?? "/";
      if (method === "GET" && (url === "/health" || url === "/api/v1/health")) {
        res.writeHead(200, { "content-type": "application/json" });
        if (options.nodeRole === "ms-host-runner" && hostRunner) {
          res.end(
            JSON.stringify({
              status: "healthy",
              nodeRole: options.nodeRole,
              nodeId,
              parentMicroservice: toParentMicroserviceNotation(hostRunner.parentService),
              mountedModules: hostRunner.getMountedMicroserviceKeys().map((k) => toModuleNotation(k))
            })
          );
          return;
        }
        if (options.nodeRole === "api-gateway" && gateway) {
          res.end(
            JSON.stringify({
              status: "healthy",
              nodeRole: options.nodeRole,
              nodeId,
              topology: gateway.upstreamRegistry.getTopologySnapshot()
            })
          );
          return;
        }
        if (options.nodeRole === "core-service" && migrationRegistry) {
          res.end(
            JSON.stringify({
              status: "healthy",
              nodeRole: options.nodeRole,
              nodeId,
              servicesCount: SEED_SERVICES_CATALOG.length,
              modulesCount: SEED_MICROSERVICES_CATALOG.length,
              sqlMigrationsCount: migrationRegistry.getAllMigrations().length
            })
          );
          return;
        }
        res.end(
          JSON.stringify({
            status: "healthy",
            nodeRole: options.nodeRole,
            nodeId,
            postgresBootstrapSummary
          })
        );
        return;
      }
      const handledControlPlane = await handleControlPlaneAndCheckoutRoutes({
        method,
        url,
        req,
        res,
        jwtVault,
        migrationsRootDir,
        readJsonBody
      });
      if (handledControlPlane) {
        return;
      }
      if (options.nodeRole === "ms-host-runner" && hostRunner) {
        const targetModuleHeader = req.headers["x-proveko-target-module"];
        const rawTargetModule = Array.isArray(targetModuleHeader) ? targetModuleHeader[0] : targetModuleHeader;
        if (!rawTargetModule) {
          res.writeHead(400, { "content-type": "application/problem+json" });
          res.end(
            JSON.stringify({
              title: "Missing Target Module Header",
              status: 400,
              detail: "Expected header x-proveko-target-module from Proveko API Gateway."
            })
          );
          return;
        }
        const targetModule = normalizeModuleKey(rawTargetModule);
        const authHeaderRaw = req.headers["authorization"] ?? req.headers["Authorization"];
        const authorizationHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
        try {
          clusterHmacGuard.verifyInboundRequest(req.headers, {
            method,
            pathAndQuery: url,
            targetParent: hostRunner.parentService,
            targetModule,
            authorizationHeader
          });
        } catch (hmacErr) {
          if (hmacErr instanceof ProvekoDomainError) {
            res.writeHead(hmacErr.statusCode, {
              "content-type": "application/problem+json",
              "x-proveko-served-by": nodeId
            });
            res.end(JSON.stringify(hmacErr.toProblemDetails()));
            return;
          }
          throw hmacErr;
        }
        const body = method !== "GET" && method !== "HEAD" ? await readJsonBody(req) : void 0;
        const qIndex = url.indexOf("?");
        const queryParams = {};
        if (qIndex >= 0) {
          const searchParams = new URLSearchParams(url.slice(qIndex + 1));
          for (const [k, v] of searchParams.entries()) {
            queryParams[k] = v;
          }
        }
        const result = await hostRunner.dispatch(targetModule, {
          method,
          path: url,
          headers: req.headers,
          body,
          query: queryParams
        });
        res.writeHead(result.status, result.headers);
        res.end(JSON.stringify(result.body));
        return;
      }
      if (options.nodeRole === "api-gateway" && gateway) {
        if (method === "GET" && url === "/api/v1/topology") {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              gatewayNodeId: nodeId,
              topology: gateway.upstreamRegistry.getTopologySnapshot()
            })
          );
          return;
        }
        if (method === "GET" && url === "/api/v1/control/catalog") {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              microservices: SEED_SERVICES_CATALOG.map((s) => ({
                ...s,
                microserviceKey: toParentMicroserviceNotation(s.key)
              })),
              modules: SEED_MICROSERVICES_CATALOG.map((m) => ({
                ...m,
                parentMicroserviceKey: toParentMicroserviceNotation(m.parentService),
                moduleKey: toModuleNotation(m.key)
              })),
              presets: SEED_INDUSTRY_PRESETS,
              topology: gateway.upstreamRegistry.getTopologySnapshot()
            })
          );
          return;
        }
        if (method === "POST" && url === "/api/v1/control/session") {
          const sessionReq = await readJsonBody(req) ?? {};
          const tenantId = typeof sessionReq.tenantId === "string" && sessionReq.tenantId.trim().length > 0 ? sessionReq.tenantId.trim() : "db_version_prueba";
          const activeBranchId = typeof sessionReq.activeBranchId === "string" && sessionReq.activeBranchId.trim().length > 0 ? sessionReq.activeBranchId.trim() : "br-01";
          const rawSubVer = Number(sessionReq.subVer ?? 1);
          const subVer = Number.isInteger(rawSubVer) && rawSubVer >= 1 ? rawSubVer : 1;
          const services = sessionReq.services ?? {
            "srv:crm": ["ms:crm-directory"],
            "srv:invoicing": ["ms:invoicing-pos", "ms:invoicing-electronic-dian"],
            "srv:inventory": ["ms:inventory-stock"]
          };
          const readonlyMicroservices = Array.isArray(sessionReq.readonlyMicroservices) ? sessionReq.readonlyMicroservices : [];
          const token = jwtVault.signAccessToken({
            tenant_id: tenantId,
            cell_id: "cell-db-01",
            user_id: "usr-workstation-admin",
            role_key: "admin",
            tier: "business",
            is_sandbox: tenantId === "db_version_prueba",
            active_branch_id: activeBranchId,
            allowed_branch_ids: ["br-01", "br-02"],
            sub_ver: subVer,
            services,
            readonly_microservices: readonlyMicroservices
          });
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              token,
              tenantId,
              activeBranchId,
              subVer
            })
          );
          return;
        }
        const body = method !== "GET" && method !== "HEAD" ? await readJsonBody(req) : void 0;
        const gatewayRes = await gateway.handleGatewayRequest({
          method,
          url,
          headers: req.headers,
          body,
          clientIp: req.socket.remoteAddress
        });
        res.writeHead(gatewayRes.status, gatewayRes.headers);
        res.end(JSON.stringify(gatewayRes.body));
        return;
      }
      if (options.nodeRole === "core-service" && migrationRegistry) {
        if (method === "GET" && url === "/api/v1/control/catalog") {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              microservices: SEED_SERVICES_CATALOG.map((s) => ({
                ...s,
                microserviceKey: toParentMicroserviceNotation(s.key)
              })),
              modules: SEED_MICROSERVICES_CATALOG.map((m) => ({
                ...m,
                parentMicroserviceKey: toParentMicroserviceNotation(m.parentService),
                moduleKey: toModuleNotation(m.key)
              })),
              presets: SEED_INDUSTRY_PRESETS
            })
          );
          return;
        }
        if (method === "GET" && url === "/api/v1/control/migrations") {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              totalFiles: migrationRegistry.getAllMigrations().length,
              migrations: migrationRegistry.getAllMigrations().map((m) => ({
                version: m.version,
                filename: m.filename,
                parentMicroservice: toParentMicroserviceNotation(m.parentService),
                moduleKey: toModuleNotation(m.moduleKey),
                checksumSha256: m.checksumSha256
              }))
            })
          );
          return;
        }
      }
      if (options.nodeRole === "frontend") {
        const initialSurface = url.startsWith("/app") ? "workstation" : "landing";
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "x-content-type-options": "nosniff",
          "x-frame-options": "DENY",
          "referrer-policy": "strict-origin-when-cross-origin"
        });
        res.end(
          renderProvekoWorkstationHtml({
            appUrl: env.APP_URL,
            appDomain: env.APP_DOMAIN,
            initialSurface
          })
        );
        return;
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found", nodeRole: options.nodeRole, url }));
    } catch (err) {
      if (err instanceof ProvekoDomainError) {
        res.writeHead(err.statusCode, { "content-type": "application/problem+json" });
        res.end(JSON.stringify(err.toProblemDetails()));
        return;
      }
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Internal Server Error"
        })
      );
    }
  });
  await new Promise((resolve2, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve2());
  });
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  return {
    server,
    port: actualPort,
    baseUrl: `http://${displayHost}:${actualPort}`,
    nodeRole: options.nodeRole,
    nodeId,
    jwtVault,
    close: () => new Promise((resolve2, reject) => {
      server.close((err) => err ? reject(err) : resolve2());
    })
  };
}
var currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1] === currentFilePath) {
  const role = process.env.PROVEKO_NODE_ROLE ?? "api-gateway";
  startProvekoClusterNodeHttpServer({ nodeRole: role }).then((handle) => {
    console.log(
      `[Proveko Cluster] Node "${handle.nodeId}" (${handle.nodeRole}) listening on ${handle.baseUrl}`
    );
  }).catch((err) => {
    console.error("[Proveko Cluster] Fatal startup error:", err);
    process.exit(1);
  });
}
export {
  startProvekoClusterNodeHttpServer
};
/*! Bundled license information:

decimal.js/decimal.mjs:
  (*!
   *  decimal.js v10.6.0
   *  An arbitrary-precision Decimal type for JavaScript.
   *  https://github.com/MikeMcl/decimal.js
   *  Copyright (c) 2025 Michael Mclaughlin <M8ch88l@gmail.com>
   *  MIT Licence
   *)
*/
