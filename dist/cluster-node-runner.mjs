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

// libs/tenant-db-resolver/src/tenant-relational-workspace.repository.ts
var PostgresTenantRelationalWorkspaceRepository = class {
  constructor(driver) {
    this.driver = driver;
  }
  driver;
  getRelationalStateSnapshot(dbName) {
    const safeDb = sanitizePgIdentifier(dbName);
    if (!safeDb || safeDb === "db_version_prueba") return null;
    const ensureRes = this.driver.executePsql({
      dbName: safeDb,
      sql: `
        CREATE TABLE IF NOT EXISTS public.client_relational_state_snapshot (
          snapshot_key VARCHAR(64) PRIMARY KEY,
          state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        SELECT state_json::text
        FROM public.client_relational_state_snapshot
        WHERE snapshot_key = 'PRIMARY_RELATIONAL_GRAPH'
        LIMIT 1;
      `
    });
    if (!ensureRes.ok || !ensureRes.stdout.trim()) return null;
    const lines = ensureRes.stdout.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{"));
    if (lines.length === 0) return null;
    try {
      return JSON.parse(lines[lines.length - 1] ?? "{}");
    } catch {
      return null;
    }
  }
  executeRelationalTransaction(input) {
    const safeDb = sanitizePgIdentifier(input.dbName);
    if (!safeDb || safeDb === "db_version_prueba") return false;
    const p = input.entityPayload ?? {};
    const stateJson = input.fullRelationalState ? JSON.stringify(input.fullRelationalState) : null;
    if (stateJson) {
      this.driver.executePsql({
        dbName: safeDb,
        singleTransaction: true,
        variables: { state_json: stateJson },
        sql: `
          CREATE TABLE IF NOT EXISTS public.client_relational_state_snapshot (
            snapshot_key VARCHAR(64) PRIMARY KEY,
            state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          INSERT INTO public.client_relational_state_snapshot (snapshot_key, state_json, updated_at)
          VALUES ('PRIMARY_RELATIONAL_GRAPH', :'state_json'::jsonb, NOW())
          ON CONFLICT (snapshot_key) DO UPDATE SET
            state_json = EXCLUDED.state_json,
            updated_at = NOW();
        `
      });
    }
    if (input.actionType === "ISSUE_HYBRID_INVOICE") {
      const invoiceNumber = String(p.invoiceNumber ?? `FEV-${Date.now().toString().slice(-5)}`);
      const customerNit = String(p.customerNit ?? "900.000.000-1");
      const customerName = String(p.customerName ?? "Cliente General");
      const total = Number(p.total ?? 0);
      const pendingBalance = Number(p.pendingBalance ?? 0);
      const cxcId = `cxc-${invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      this.driver.executePsql({
        dbName: safeDb,
        singleTransaction: true,
        variables: {
          inv_num: invoiceNumber,
          cust_nit: customerNit,
          cust_name: customerName,
          total_amt: String(total),
          pending_amt: String(pendingBalance),
          cxc_id: cxcId,
          cufe_val: `CUFE-sha384-${invoiceNumber.toLowerCase()}-${Date.now()}`
        },
        sql: `
          INSERT INTO srv_treasury.trs_accounts_receivable (
            cxc_id, invoice_number, customer_nit, customer_name, aging_bucket, original_amount_cop, balance_pending_cop, status
          ) VALUES (
            :'cxc_id', :'inv_num', :'cust_nit', :'cust_name', 'CORRIENTE_0_30',
            :'total_amt'::numeric, :'pending_amt'::numeric,
            CASE WHEN :'pending_amt'::numeric > 0 THEN 'OPEN' ELSE 'PAID' END
          )
          ON CONFLICT (cxc_id) DO UPDATE SET
            balance_pending_cop = EXCLUDED.balance_pending_cop,
            status = EXCLUDED.status;
        `
      });
    } else if (input.actionType === "REGISTER_CXC_PAYMENT") {
      const invoiceNumber = String(p.invoiceNumber ?? "FEV-10421");
      const customerName = String(p.customerName ?? "Cliente");
      const amount = Number(p.amount ?? 0);
      const newBalance = Number(p.newBalance ?? 0);
      const rcNumber = String(p.rcNumber ?? `RC-${Date.now().toString().slice(-5)}`);
      const cxcId = `cxc-${invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      this.driver.executePsql({
        dbName: safeDb,
        singleTransaction: true,
        variables: {
          cxc_id: cxcId,
          rc_id: rcNumber.toLowerCase(),
          rc_num: rcNumber,
          cust_name: customerName,
          amt: String(amount),
          new_bal: String(newBalance)
        },
        sql: `
          UPDATE srv_treasury.trs_accounts_receivable
          SET balance_pending_cop = :'new_bal'::numeric,
              status = CASE WHEN :'new_bal'::numeric <= 0 THEN 'PAID' ELSE 'PARTIAL' END
          WHERE cxc_id = :'cxc_id' OR invoice_number = :'cxc_id';

          INSERT INTO srv_treasury.trs_cash_receipt_vouchers (
            rc_id, rc_consecutive, customer_name, amount_received_cop
          ) VALUES (
            :'rc_id', :'rc_num', :'cust_name', :'amt'::numeric
          )
          ON CONFLICT (rc_id) DO NOTHING;
        `
      });
    }
    return true;
  }
};

// libs/tenant-db-resolver/src/postgres-psql.driver.ts
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
  static getClientRelationalStateFromPostgres(dbName) {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) return null;
    const driver = new PostgresMigrationDatabaseDriverAdapter(cfg);
    if (!driver.isReachable().ok) return null;
    const repo = new PostgresTenantRelationalWorkspaceRepository(driver);
    return repo.getRelationalStateSnapshot(dbName);
  }
  static executeClientRelationalTransactionInPostgres(input) {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) return false;
    const driver = new PostgresMigrationDatabaseDriverAdapter(cfg);
    if (!driver.isReachable().ok) return false;
    const repo = new PostgresTenantRelationalWorkspaceRepository(driver);
    return repo.executeRelationalTransaction(input);
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
  externalPrincipalModuleName: "Agenda y Citas",
  icon: "\u{1F4C5}",
  subtitle: "Agendamiento de citas, horarios de profesionales y sala de espera.",
  standaloneMonthlyUsd: 119e3,
  submodules: [
    {
      moduleKey: "mod-calendar-slots",
      parentServiceKey: "srv-appointments",
      externalSubmoduleName: "Agenda de Citas",
      tabIcon: "\u{1F4C5}",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Agendar Cita",
      tableHeaders: ["C\xF3digo", "Fecha y Hora", "Cliente / Paciente", "Profesional", "Servicio", "Estado", "Acciones"],
      fields: [
        { key: "slotDateTime", label: "Fecha y Hora", type: "text", placeholder: "Ma\xF1ana 10:00 AM" },
        { key: "patientOrClient", label: "Cliente / Paciente", type: "text", placeholder: "Mar\xEDa Fernanda L\xF3pez" },
        { key: "professionalAssigned", label: "Profesional / Especialista", type: "text", placeholder: "Dr. Alejandro Mart\xEDnez" },
        { key: "serviceProcedure", label: "Motivo / Servicio", type: "text", placeholder: "Consulta General / Valoraci\xF3n" }
      ]
    },
    {
      moduleKey: "mod-staff-schedules",
      parentServiceKey: "srv-appointments",
      externalSubmoduleName: "Horarios de Profesionales",
      tabIcon: "\u{1F552}",
      summary: "",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "+ Guardar Horario",
      tableHeaders: ["ID", "Profesional", "D\xEDas de Atenci\xF3n", "Horario", "Consultorio / Sede", "Estado", "Acciones"],
      fields: [
        { key: "staffName", label: "Profesional", type: "text", placeholder: "Dra. Carolina G\xF3mez" },
        { key: "workDays", label: "D\xEDas de Atenci\xF3n", type: "text", placeholder: "Lunes a Viernes" },
        { key: "shiftHours", label: "Horario", type: "text", placeholder: "08:00 AM a 05:00 PM" }
      ]
    },
    {
      moduleKey: "mod-queue-turnador",
      parentServiceKey: "srv-appointments",
      externalSubmoduleName: "Turnos y Sala de Espera",
      tabIcon: "\u{1F514}",
      summary: "",
      monthlyAddonUsd: 25e3,
      actionButtonLabel: "+ Llamar Turno",
      tableHeaders: ["Turno", "Cliente / Paciente", "M\xF3dulo / Consultorio", "Profesional", "Estado", "Acciones"],
      fields: [
        { key: "turnCode", label: "Turno", type: "text", placeholder: "A-015" },
        { key: "waitingPerson", label: "Nombre", type: "text", placeholder: "Jorge Iv\xE1n Cano" },
        { key: "deskRoom", label: "Consultorio / M\xF3dulo", type: "text", placeholder: "Consultorio 2" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-overbooking-guard", parentServiceKey: "srv-appointments", externalName: "Bloqueo de Cruce de Horarios", description: "Evita citas duplicadas.", monthlyAddonUsd: 15e3 },
    { componentKey: "comp-whatsapp-ai-reschedule", parentServiceKey: "srv-appointments", externalName: "Recordatorio por WhatsApp", description: "Env\xEDa confirmaci\xF3n de cita.", monthlyAddonUsd: 19e3 }
  ]
};

// apps/srv-crm/frontend/crm-service.view.ts
var SRV_CRM_FRONTEND_VIEW = {
  serviceKey: "srv-crm",
  externalPrincipalModuleName: "Clientes",
  icon: "\u{1F465}",
  subtitle: "Directorio de clientes, convenios y seguimiento comercial.",
  standaloneMonthlyUsd: 115e3,
  submodules: [
    {
      moduleKey: "mod-directory",
      parentServiceKey: "srv-crm",
      externalSubmoduleName: "Directorio de Clientes",
      tabIcon: "\u{1F465}",
      summary: "",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "+ Guardar Cliente",
      tableHeaders: ["NIT / C\xE9dula", "Cliente", "Tel\xE9fono / Ciudad", "Cupo Cr\xE9dito", "Saldo Pendiente", "Acciones"],
      fields: [
        { key: "docType", label: "Tipo Doc.", type: "select", options: ["NIT", "CC", "CE", "Pasaporte"] },
        { key: "taxId", label: "NIT / C\xE9dula", type: "text", placeholder: "900.812.441-9" },
        { key: "legalName", label: "Nombre o Raz\xF3n Social", type: "text", placeholder: "Comercializadora del Norte S.A.S." },
        { key: "cityPhone", label: "Tel\xE9fono / WhatsApp", type: "text", placeholder: "300 412 8890" },
        { key: "billingEmail", label: "Ciudad / Direcci\xF3n", type: "text", placeholder: "Bogot\xE1 \u2014 Calle 80 # 15-20" },
        { key: "creditLimit", label: "Cupo de Cr\xE9dito ($)", type: "number", placeholder: "5000000" }
      ]
    },
    {
      moduleKey: "mod-contracts",
      parentServiceKey: "srv-crm",
      externalSubmoduleName: "Contratos y Convenios",
      tabIcon: "\u{1F4D1}",
      summary: "",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "+ Crear Convenio",
      tableHeaders: ["C\xF3digo", "Empresa / Convenio", "Tarifa / Descuento", "Cupo Total", "Consumido", "Disponible"],
      fields: [
        { key: "contractNumber", label: "C\xF3digo Convenio", type: "text", placeholder: "CNV-2026-01" },
        { key: "companyName", label: "Empresa Cliente", type: "text", placeholder: "Transportes del Caribe S.A." },
        { key: "validityRange", label: "Tarifa Aplicada", type: "select", options: ["Convenio Corporativo (-12%)", "Mayorista (-15%)", "Tarifa Plena (0%)"] },
        { key: "budgetCeiling", label: "Cupo Aprobado ($)", type: "number", placeholder: "25000000" }
      ]
    },
    {
      moduleKey: "mod-pipelines",
      parentServiceKey: "srv-crm",
      externalSubmoduleName: "Cotizaciones en Seguimiento",
      tabIcon: "\u{1F3AF}",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Registrar Seguimiento",
      tableHeaders: ["C\xF3digo", "Cliente", "Inter\xE9s / Cotizaci\xF3n", "Valor Estimado", "Etapa", "Acciones"],
      fields: [
        { key: "leadName", label: "Cliente / Prospecto", type: "text", placeholder: "Constructora Los Alpes" },
        { key: "interest", label: "Producto o Servicio de Inter\xE9s", type: "text", placeholder: "Suministro mensual de insumos" },
        { key: "dealValue", label: "Valor Estimado ($)", type: "number", placeholder: "4500000" },
        { key: "stage", label: "Estado", type: "select", options: ["Contactado", "Cotizaci\xF3n Enviada", "En Negociaci\xF3n", "Cerrado Ganado"] }
      ]
    },
    {
      moduleKey: "mod-loyalty",
      parentServiceKey: "srv-crm",
      externalSubmoduleName: "Puntos y Fidelizaci\xF3n",
      tabIcon: "\u2B50",
      summary: "",
      monthlyAddonUsd: 25e3,
      actionButtonLabel: "+ Asignar Puntos",
      tableHeaders: ["ID", "Cliente", "Nivel", "Puntos Acumulados", "Beneficio", "Acciones"],
      fields: [
        { key: "memberName", label: "Cliente", type: "text", placeholder: "Juan Sebasti\xE1n G\xF3mez" },
        { key: "tier", label: "Categor\xEDa", type: "select", options: ["Cliente Oro", "Cliente Plata", "Frecuente"] },
        { key: "points", label: "Puntos", type: "number", placeholder: "1200" },
        { key: "reward", label: "Beneficio Disponible", type: "text", placeholder: "10% Descuento pr\xF3xima compra" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-nit-dv-auto", parentServiceKey: "srv-crm", externalName: "C\xE1lculo de D\xEDgito de Verificaci\xF3n NIT", description: "Calcula el DV autom\xE1ticamente.", monthlyAddonUsd: 15e3 },
    { componentKey: "comp-credit-quota-lock", parentServiceKey: "srv-crm", externalName: "Control de Cupo de Cr\xE9dito", description: "Alerta cuando el cliente supera su cupo.", monthlyAddonUsd: 19e3 },
    { componentKey: "comp-contract-budget-alert", parentServiceKey: "srv-crm", externalName: "Control de Saldo de Convenios", description: "Descuenta autom\xE1ticamente del cupo del contrato.", monthlyAddonUsd: 25e3 }
  ]
};

// apps/srv-finance/frontend/finance-service.view.ts
var SRV_FINANCE_FRONTEND_VIEW = {
  serviceKey: "srv-finance",
  externalPrincipalModuleName: "Contabilidad",
  icon: "\u{1F4D8}",
  subtitle: "Cuentas contables, asientos, centros de costo, activos fijos e impuestos.",
  standaloneMonthlyUsd: 169e3,
  submodules: [
    {
      moduleKey: "mod-puc",
      parentServiceKey: "srv-finance",
      externalSubmoduleName: "Asientos y Cuentas Contables",
      tabIcon: "\u{1F4D8}",
      summary: "",
      monthlyAddonUsd: 55e3,
      actionButtonLabel: "+ Registrar Asiento Contable",
      tableHeaders: ["Comprobante", "Cuenta Contable", "Tercero", "D\xE9bito", "Cr\xE9dito", "Acciones"],
      fields: [
        { key: "accountCode", label: "Cuenta Contable", type: "text", placeholder: "110505 \u2014 Caja General / 4135 \u2014 Ventas" },
        { key: "thirdPartyNit", label: "Cliente o Proveedor", type: "text", placeholder: "NIT 900.812.441-9" },
        { key: "debitAmount", label: "Valor D\xE9bito ($)", type: "number", placeholder: "500000" },
        { key: "creditAmount", label: "Valor Cr\xE9dito ($)", type: "number", placeholder: "500000" }
      ]
    },
    {
      moduleKey: "mod-cost-centers",
      parentServiceKey: "srv-finance",
      externalSubmoduleName: "Centros de Costo / Sedes",
      tabIcon: "\u{1F3E2}",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Crear Centro de Costo",
      tableHeaders: ["C\xF3digo", "Centro de Costo / Sede", "Responsable", "Presupuesto Mensual", "Ejecutado", "Acciones"],
      fields: [
        { key: "ccCode", label: "C\xF3digo", type: "text", placeholder: "CC-01" },
        { key: "ccName", label: "Nombre de Sede o Proyecto", type: "text", placeholder: "Sede Principal / Taller" },
        { key: "monthlyBudget", label: "Presupuesto Mensual ($)", type: "number", placeholder: "15000000" }
      ]
    },
    {
      moduleKey: "mod-fixed-assets",
      parentServiceKey: "srv-finance",
      externalSubmoduleName: "Equipos y Activos Fijos",
      tabIcon: "\u{1F3D7}\uFE0F",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Registrar Activo o Equipo",
      tableHeaders: ["C\xF3digo", "Equipo / Activo", "Ubicaci\xF3n", "Valor Compra", "Estado", "Acciones"],
      fields: [
        { key: "assetPlate", label: "Placa / Serial Inventario", type: "text", placeholder: "ACT-001" },
        { key: "assetName", label: "Nombre del Equipo o Maquinaria", type: "text", placeholder: "Elevador Hidr\xE1ulico / Horno Industrial" },
        { key: "purchaseCost", label: "Valor de Compra ($)", type: "number", placeholder: "8500000" }
      ]
    },
    {
      moduleKey: "mod-exogena-taxes",
      parentServiceKey: "srv-finance",
      externalSubmoduleName: "Certificados y Retenciones",
      tabIcon: "\u{1F3DB}\uFE0F",
      summary: "",
      monthlyAddonUsd: 49e3,
      actionButtonLabel: "+ Generar Certificado",
      tableHeaders: ["C\xF3digo", "Tercero / Proveedor", "Tipo de Certificado", "A\xF1o / Per\xEDodo", "Valor Retenido", "Acciones"],
      fields: [
        { key: "formatCode", label: "Tipo de Certificado", type: "select", options: ["Certificado Retenci\xF3n en la Fuente", "Certificado ReteICA", "Certificado ReteIVA", "Reporte Anual"] },
        { key: "fiscalYear", label: "Proveedor / Tercero", type: "text", placeholder: "Distribuidora Nacional S.A.S." },
        { key: "totalReported", label: "Valor Retenido ($)", type: "number", placeholder: "420000" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-dian-xml-exporter", parentServiceKey: "srv-finance", externalName: "Exportaci\xF3n Contable a Excel", description: "Descarga asientos y balances.", monthlyAddonUsd: 19e3 }
  ]
};

// apps/srv-fleet/frontend/fleet-service.view.ts
var SRV_FLEET_FRONTEND_VIEW = {
  serviceKey: "srv-fleet",
  externalPrincipalModuleName: "Transporte y B\xE1scula",
  icon: "\u{1F69B}",
  subtitle: "Pesaje en b\xE1scula, despachos de carga, anticipos de viaje y mantenimiento.",
  standaloneMonthlyUsd: 159e3,
  submodules: [
    {
      moduleKey: "mod-fleet-scale",
      parentServiceKey: "srv-fleet",
      externalSubmoduleName: "Pesaje en B\xE1scula",
      tabIcon: "\u2696\uFE0F",
      summary: "",
      monthlyAddonUsd: 49e3,
      actionButtonLabel: "+ Registrar Tiquete de B\xE1scula",
      hasTruckScaleWeighbridge: true,
      tableHeaders: ["Tiquete", "Placa", "Conductor", "Producto", "Peso Neto", "Estado", "Acciones"],
      fields: [
        { key: "ticketCode", label: "N\xB0 Tiquete", type: "text", placeholder: "BAS-001" },
        { key: "tractorPlate", label: "Placa del Cami\xF3n", type: "text", placeholder: "SXT-881" },
        { key: "driverFullName", label: "Conductor", type: "text", placeholder: "Ramiro C\xF3rdoba" },
        { key: "cargoType", label: "Carga / Producto", type: "text", placeholder: "Granel / Cemento / Ma\xEDz" }
      ]
    },
    {
      moduleKey: "mod-fleet-dispatch-rndc",
      parentServiceKey: "srv-fleet",
      externalSubmoduleName: "Manifiestos y Despachos",
      tabIcon: "\u{1F4CB}",
      summary: "",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "+ Emitir Manifiesto de Carga",
      tableHeaders: ["Manifiesto", "Placa", "Origen - Destino", "Conductor", "Valor Flete", "Estado", "Acciones"],
      fields: [
        { key: "manifestNo", label: "N\xB0 Manifiesto", type: "text", placeholder: "MNF-2026-01" },
        { key: "originDest", label: "Ruta (Origen - Destino)", type: "text", placeholder: "Buenaventura \u2014 Bogot\xE1" },
        { key: "vehicleAssigned", label: "Placa y Conductor", type: "text", placeholder: "SXT-881 \u2014 Ramiro C\xF3rdoba" },
        { key: "freightValue", label: "Valor del Flete ($)", type: "number", placeholder: "4200000" }
      ]
    },
    {
      moduleKey: "mod-trip-settlements",
      parentServiceKey: "srv-fleet",
      externalSubmoduleName: "Anticipos y Gastos de Viaje",
      tabIcon: "\u26FD",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Legalizar Viaje",
      tableHeaders: ["Liquidaci\xF3n", "Viaje / Placa", "Anticipo Entregado", "Peajes y Combustible", "Saldo a Pagar", "Acciones"],
      fields: [
        { key: "tripRef", label: "Viaje / Placa", type: "text", placeholder: "MNF-2026-01 \u2014 SXT-881" },
        { key: "advanceGiven", label: "Anticipo Entregado ($)", type: "number", placeholder: "1500000" },
        { key: "tollsAndFuel", label: "Gastos de Peajes y Combustible ($)", type: "number", placeholder: "1320000" }
      ]
    },
    {
      moduleKey: "mod-tires-fleet-maint",
      parentServiceKey: "srv-fleet",
      externalSubmoduleName: "Llantas y Documentos de Flota",
      tabIcon: "\u{1F6DE}",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Registrar Control de Veh\xEDculo",
      tableHeaders: ["ID", "Placa", "Kilometraje", "Estado Llantas", "Vencimiento SOAT / Tecno", "Acciones"],
      fields: [
        { key: "unitPlate", label: "Placa", type: "text", placeholder: "SXT-881" },
        { key: "tireAxisStatus", label: "Novedad o Revisi\xF3n", type: "text", placeholder: "Rotaci\xF3n de llantas eje trasero" },
        { key: "soatTecnoDate", label: "Fecha Vencimiento SOAT / Tecno", type: "text", placeholder: "2026-12-15" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-weighbridge-humidity-discount", parentServiceKey: "srv-fleet", externalName: "Descuento por Humedad / Impureza", description: "Ajusta el peso neto en compras agr\xEDcolas.", monthlyAddonUsd: 19e3 },
    { componentKey: "comp-rndc-manifest-sync", parentServiceKey: "srv-fleet", externalName: "Control de Manifiestos de Carga", description: "Genera hoja de ruta y flete.", monthlyAddonUsd: 25e3 }
  ]
};

// apps/srv-gastro/frontend/gastro-service.view.ts
var SRV_GASTRO_FRONTEND_VIEW = {
  serviceKey: "srv-gastro",
  externalPrincipalModuleName: "Mesas y Comandas",
  icon: "\u{1F37D}\uFE0F",
  subtitle: "Atenci\xF3n de mesas, toma de comandas, cocina/barra y domicilios.",
  standaloneMonthlyUsd: 139e3,
  submodules: [
    {
      moduleKey: "mod-tables",
      parentServiceKey: "srv-gastro",
      externalSubmoduleName: "Sal\xF3n, Mesas y Tomar Comanda (Mesero)",
      tabIcon: "\u{1F37D}\uFE0F",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Abrir Mesa / Agregar Comanda",
      tableHeaders: ["Mesa", "Zona", "Mesero", "Personas", "Consumo Actual", "Estado", "Acciones"],
      fields: [
        { key: "tableCode", label: "Mesa / Ubicaci\xF3n", type: "text", placeholder: "Mesa 5 / Terraza" },
        { key: "guestsCount", label: "N\xB0 Personas", type: "number", placeholder: "4" },
        { key: "waiterAssigned", label: "Mesero", type: "text", placeholder: "Camila Torres" }
      ]
    },
    {
      moduleKey: "mod-kds",
      parentServiceKey: "srv-gastro",
      externalSubmoduleName: "Vista Cocina y Barra (Preparaci\xF3n)",
      tabIcon: "\u{1F468}\u200D\u{1F373}",
      summary: "",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "+ Enviar Comanda a Cocina",
      tableHeaders: ["Comanda", "Mesa", "Platos / Bebidas", "Notas de Cocina", "Estado", "Acciones"],
      fields: [
        { key: "station", label: "Estaci\xF3n Destino", type: "select", options: ["Cocina Caliente", "Parrilla", "Barra / Licores", "Postres y Caf\xE9"] },
        { key: "orderTicket", label: "Mesa y Pedido", type: "text", placeholder: "Mesa 4 \u2014 2x Churrasco, 1x Limonada" },
        { key: "prepTime", label: "Observaciones", type: "text", placeholder: "T\xE9rmino 3/4, sin ensalada" }
      ]
    },
    {
      moduleKey: "mod-modifiers-menu",
      parentServiceKey: "srv-gastro",
      externalSubmoduleName: "Carta, Platos y Precios",
      tabIcon: "\u{1F4D6}",
      summary: "",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "+ Agregar Plato a la Carta",
      tableHeaders: ["C\xF3digo", "Plato / Bebida", "Categor\xEDa", "Opciones / Adiciones", "Precio Venta", "Acciones"],
      fields: [
        { key: "dishItem", label: "Nombre del Plato o Bebida", type: "text", placeholder: "Punta de Anca 350g" },
        { key: "cookingTerm", label: "Categor\xEDa de la Carta", type: "select", options: ["Platos Fuertes", "Entradas", "Bebidas y Jugos", "Cervezas y Licores", "Adiciones"] },
        { key: "paidAddons", label: "Precio de Venta ($)", type: "number", placeholder: "42000" }
      ]
    },
    {
      moduleKey: "mod-split",
      parentServiceKey: "srv-gastro",
      externalSubmoduleName: "Dividir Cuentas (Cajero)",
      tabIcon: "\u2797",
      summary: "",
      monthlyAddonUsd: 25e3,
      actionButtonLabel: "+ Dividir Cuenta de Mesa",
      tableHeaders: ["C\xF3digo", "Mesa", "Tipo de Divisi\xF3n", "Valor por Persona", "Propina", "Acciones"],
      fields: [
        { key: "tableOrigin", label: "Mesa a Dividir", type: "text", placeholder: "Mesa 2" },
        { key: "splitMode", label: "Forma de Divisi\xF3n", type: "select", options: ["Partes Iguales", "Por Consumo Individual"] },
        { key: "subcheckTotal", label: "Valor a Cobrar ($)", type: "number", placeholder: "65000" }
      ]
    },
    {
      moduleKey: "mod-deliveries",
      parentServiceKey: "srv-gastro",
      externalSubmoduleName: "Domicilios (Despacho)",
      tabIcon: "\u{1F6F5}",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Despachar Domicilio",
      tableHeaders: ["Pedido", "Cliente y Direcci\xF3n", "Tel\xE9fono", "Domiciliario", "Total", "Estado", "Acciones"],
      fields: [
        { key: "channel", label: "Cliente y Direcci\xF3n de Entrega", type: "text", placeholder: "Juan P\xE9rez \u2014 Cra 15 # 104-20 Apto 402" },
        { key: "customerAddress", label: "Tel\xE9fono Cliente", type: "text", placeholder: "310 445 9988" },
        { key: "riderName", label: "Domiciliario Asignado", type: "text", placeholder: "Andr\xE9s Moto #2" },
        { key: "deliveryTotal", label: "Valor del Pedido ($)", type: "number", placeholder: "58000" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-waiter-assign", parentServiceKey: "srv-gastro", externalName: "Control por Mesero", description: "Asigna mesero a cada mesa.", monthlyAddonUsd: 15e3 },
    { componentKey: "comp-courtesy-auth", parentServiceKey: "srv-gastro", externalName: "Autorizaci\xF3n de Cortes\xEDas", description: "Controla descuentos y cortes\xEDas.", monthlyAddonUsd: 15e3 },
    { componentKey: "comp-bar-shot-measure", parentServiceKey: "srv-gastro", externalName: "Control de Licores por Trago/Botella", description: "Descuenta tragos de cada botella.", monthlyAddonUsd: 25e3 },
    { componentKey: "comp-happy-hour-pricing", parentServiceKey: "srv-gastro", externalName: "Precios Especiales por Horario", description: "Activa promociones autom\xE1ticas.", monthlyAddonUsd: 19e3 }
  ]
};

// apps/srv-hotel/frontend/hotel-service.view.ts
var SRV_HOTEL_FRONTEND_VIEW = {
  serviceKey: "srv-hotel",
  externalPrincipalModuleName: "Hoteler\xEDa y Alojamiento",
  icon: "\u{1F3E8}",
  subtitle: "Habitaciones, check-in, reservas, consumos a la habitaci\xF3n y camareras.",
  standaloneMonthlyUsd: 159e3,
  submodules: [
    {
      moduleKey: "mod-rooms",
      parentServiceKey: "srv-hotel",
      externalSubmoduleName: "Habitaciones y Check-In (Recepci\xF3n)",
      tabIcon: "\u{1F6CF}\uFE0F",
      summary: "",
      monthlyAddonUsd: 49e3,
      actionButtonLabel: "+ Registrar Check-In",
      tableHeaders: ["Habitaci\xF3n", "Tipo", "Hu\xE9sped Actual", "Noches", "Saldo Consumos", "Estado", "Acciones"],
      fields: [
        { key: "roomNumber", label: "Habitaci\xF3n / Caba\xF1a", type: "text", placeholder: "Habitaci\xF3n 204" },
        { key: "guestDocument", label: "Nombre del Hu\xE9sped", type: "text", placeholder: "Carlos Alberto R\xEDos" },
        { key: "extraCharges", label: "Documento / Tel\xE9fono", type: "text", placeholder: "CC 79.884.112 \u2014 315 220 1190" },
        { key: "folioBalance", label: "Tarifa por Noche ($)", type: "number", placeholder: "180000" }
      ]
    },
    {
      moduleKey: "mod-bookings",
      parentServiceKey: "srv-hotel",
      externalSubmoduleName: "Reservas",
      tabIcon: "\u{1F4C5}",
      summary: "",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "+ Crear Reserva",
      tableHeaders: ["C\xF3digo", "Hu\xE9sped", "Habitaci\xF3n / Caba\xF1a", "Llegada - Salida", "Abono", "Estado", "Acciones"],
      fields: [
        { key: "guestName", label: "Hu\xE9sped", type: "text", placeholder: "Familia Mart\xEDnez" },
        { key: "unitType", label: "Habitaci\xF3n / Caba\xF1a", type: "select", options: ["Habitaci\xF3n Doble", "Suite Principal", "Caba\xF1a Familiar", "Sal\xF3n de Eventos"] },
        { key: "checkInOut", label: "Fecha Entrada y Salida", type: "text", placeholder: "12 Nov al 15 Nov" },
        { key: "totalStay", label: "Valor Reserva ($)", type: "number", placeholder: "540000" }
      ]
    },
    {
      moduleKey: "mod-housekeeping",
      parentServiceKey: "srv-hotel",
      externalSubmoduleName: "Aseo y Camareras",
      tabIcon: "\u{1F9F9}",
      summary: "",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "+ Asignar Aseo / Mantenimiento",
      tableHeaders: ["ID", "Habitaci\xF3n", "Estado Aseo", "Camarera Asignada", "Novedad", "Acciones"],
      fields: [
        { key: "roomCode", label: "Habitaci\xF3n", type: "text", placeholder: "Habitaci\xF3n 102" },
        { key: "cleaningStatus", label: "Estado", type: "select", options: ["Sucia \u2014 Por Asear", "En Limpieza", "Limpia y Lista", "En Mantenimiento"] },
        { key: "staffAssigned", label: "Encargada", type: "text", placeholder: "Marta Luc\xEDa" }
      ]
    },
    {
      moduleKey: "mod-seasonal-rates",
      parentServiceKey: "srv-hotel",
      externalSubmoduleName: "Tarifas y Planes",
      tabIcon: "\u{1F3F7}\uFE0F",
      summary: "",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "+ Guardar Tarifa",
      tableHeaders: ["C\xF3digo", "Plan / Temporada", "Tipo Habitaci\xF3n", "Incluye", "Tarifa Noche", "Acciones"],
      fields: [
        { key: "seasonName", label: "Nombre del Plan o Temporada", type: "text", placeholder: "Temporada Alta / Fin de Semana" },
        { key: "planIncluded", label: "Qu\xE9 Incluye", type: "select", options: ["Alojamiento + Desayuno", "Todo Incluido", "Solo Alojamiento"] },
        { key: "nightRate", label: "Valor por Noche ($)", type: "number", placeholder: "220000" }
      ]
    },
    {
      moduleKey: "mod-tickets",
      parentServiceKey: "srv-hotel",
      externalSubmoduleName: "Pasad\xEDas y Entradas",
      tabIcon: "\u{1F39F}\uFE0F",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Vender Pasad\xEDa",
      tableHeaders: ["Ticket", "Visitante", "Plan Pasad\xEDa", "Personas", "Total Pagado", "Acciones"],
      fields: [
        { key: "visitorName", label: "Visitante", type: "text", placeholder: "Laura M\xE9ndez" },
        { key: "passType", label: "Tipo de Pasad\xEDa", type: "select", options: ["Pasad\xEDa Piscina + Almuerzo", "Pasad\xEDa Infantil", "Entrada General"] },
        { key: "passPrice", label: "Valor Total ($)", type: "number", placeholder: "95000" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-qr-ticket", parentServiceKey: "srv-hotel", externalName: "Manilla / Ticket QR", description: "Control de ingreso de hu\xE9spedes y pasad\xEDas.", monthlyAddonUsd: 19e3 }
  ]
};

// apps/srv-hr-payroll/frontend/hr-payroll-service.view.ts
var SRV_HR_PAYROLL_FRONTEND_VIEW = {
  serviceKey: "srv-hr-payroll",
  externalPrincipalModuleName: "N\xF3mina y Empleados",
  icon: "\u{1F454}",
  subtitle: "Empleados, contratos, pago de n\xF3mina, horas extras y seguridad social.",
  standaloneMonthlyUsd: 149e3,
  submodules: [
    {
      moduleKey: "mod-employees-contracts",
      parentServiceKey: "srv-hr-payroll",
      externalSubmoduleName: "Empleados y Contratos",
      tabIcon: "\u{1F465}",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Registrar Empleado",
      tableHeaders: ["C\xE9dula", "Empleado", "Cargo", "Tipo Contrato", "Salario Base", "Estado", "Acciones"],
      fields: [
        { key: "empDoc", label: "C\xE9dula", type: "text", placeholder: "1.020.445.890" },
        { key: "empName", label: "Nombre Completo", type: "text", placeholder: "Valentina R\xEDos" },
        { key: "jobRole", label: "Cargo", type: "text", placeholder: "Cajera / Administrador / T\xE9cnico" },
        { key: "baseSalary", label: "Salario Mensual ($)", type: "number", placeholder: "1650000" }
      ]
    },
    {
      moduleKey: "mod-payroll-settlement",
      parentServiceKey: "srv-hr-payroll",
      externalSubmoduleName: "Pago de N\xF3mina y Turnos",
      tabIcon: "\u{1F4B5}",
      summary: "",
      monthlyAddonUsd: 49e3,
      actionButtonLabel: "+ Liquidar Pago de N\xF3mina",
      tableHeaders: ["Comprobante", "Empleado", "Per\xEDodo", "Salario + Extras", "Descuentos", "Neto Pagado", "Acciones"],
      fields: [
        { key: "payrollPeriod", label: "Empleado", type: "text", placeholder: "Valentina R\xEDos" },
        { key: "overtimeHours", label: "Quincena / Mes", type: "select", options: ["Primera Quincena", "Segunda Quincena", "Mes Completo"] },
        { key: "netPayable", label: "Neto a Pagar ($)", type: "number", placeholder: "825000" }
      ]
    },
    {
      moduleKey: "mod-social-benefits-pila",
      parentServiceKey: "srv-hr-payroll",
      externalSubmoduleName: "Primas, Vacaciones y Liquidaciones",
      tabIcon: "\u{1F3D6}\uFE0F",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Registrar Pago de Prestaciones",
      tableHeaders: ["ID", "Empleado", "Concepto", "Per\xEDodo", "Valor Pagado", "Estado", "Acciones"],
      fields: [
        { key: "benefitType", label: "Concepto", type: "select", options: ["Prima de Servicios", "Vacaciones", "Cesant\xEDas", "Liquidaci\xF3n de Contrato", "Seguridad Social"] },
        { key: "pilaOperator", label: "Empleado", type: "text", placeholder: "Nombre del empleado" },
        { key: "provisionTotal", label: "Valor ($)", type: "number", placeholder: "950000" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-ley1607-exoneration", parentServiceKey: "srv-hr-payroll", externalName: "C\xE1lculo Autom\xE1tico de Horas Extras", description: "Liquida recargos diurnos, nocturnos y festivos.", monthlyAddonUsd: 19e3 },
    { componentKey: "comp-cune-dian-payroll", parentServiceKey: "srv-hr-payroll", externalName: "Soporte de N\xF3mina Electr\xF3nica", description: "Genera desprendible electr\xF3nico.", monthlyAddonUsd: 25e3 }
  ]
};

// apps/srv-inventory/frontend/inventory-service.view.ts
var SRV_INVENTORY_FRONTEND_VIEW = {
  serviceKey: "srv-inventory",
  externalPrincipalModuleName: "Inventario",
  icon: "\u{1F4E6}",
  subtitle: "Productos, existencias, proveedores, bodegas, traslados, insumos y transportistas.",
  standaloneMonthlyUsd: 149e3,
  submodules: [
    {
      moduleKey: "mod-stock",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Productos y Existencias",
      tabIcon: "\u{1F4E6}",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Guardar Producto",
      tableHeaders: ["SKU", "Producto", "Proveedor / Bodega", "Costo", "Precio Venta", "Existencias", "Acciones"],
      fields: [
        { key: "sku", label: "C\xF3digo / SKU", type: "text", placeholder: "REF-001" },
        { key: "productName", label: "Nombre del Producto", type: "text", placeholder: "Nombre del producto" },
        { key: "onHandQty", label: "Cantidad Inicial", type: "number", placeholder: "20" },
        { key: "unitCost", label: "Costo Compra ($)", type: "number", placeholder: "25000" }
      ]
    },
    {
      moduleKey: "mod-warehouses",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Bodegas",
      tabIcon: "\u{1F3ED}",
      summary: "",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "+ Crear Bodega",
      tableHeaders: ["C\xF3digo", "Bodega", "Ciudad / Ubicaci\xF3n", "Responsable", "Estado", "Acciones"],
      fields: [
        { key: "warehouseCode", label: "C\xF3digo", type: "text", placeholder: "BOD-01" },
        { key: "warehouseTitle", label: "Nombre de la Bodega", type: "text", placeholder: "Bodega Principal" },
        { key: "cityLocation", label: "Ubicaci\xF3n / Sede", type: "text", placeholder: "Sede Central" },
        { key: "managerSignature", label: "Encargado", type: "text", placeholder: "Jorge Pardo" }
      ]
    },
    {
      moduleKey: "mod-transfers",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Solicitudes y Traslados",
      tabIcon: "\u{1F504}",
      summary: "",
      monthlyAddonUsd: 55e3,
      actionButtonLabel: "+ Solicitar Traslado",
      tableHeaders: ["N\xB0 Solicitud", "Bodega Origen", "Bodega Destino", "Producto y Cantidad", "Transportista", "Estado", "Acciones"],
      fields: [
        { key: "originWarehouse", label: "Bodega Origen", type: "select", options: ["Bodega Central Principal", "Bodega Punto de Venta", "Bodega Insumos"] },
        { key: "targetWarehouse", label: "Bodega Destino", type: "select", options: ["Bodega Punto de Venta", "Bodega Norte", "Bodega Central Principal"] },
        { key: "itemSummary", label: "Producto y Cantidad", type: "text", placeholder: "20 unidades \u2014 Aceite 20W50" },
        { key: "carrierName", label: "Transportista Asignado", type: "select", options: ["Transporte Interno Empresa", "Servientrega / Interrapidisimo", "Transportadora Nacional"] }
      ]
    },
    {
      moduleKey: "mod-tech-reception",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Proveedores y Entradas",
      tabIcon: "\u{1F69A}",
      summary: "",
      monthlyAddonUsd: 42e3,
      actionButtonLabel: "+ Guardar Proveedor",
      tableHeaders: ["NIT", "Proveedor", "Contacto", "Tel\xE9fono", "Ciudad", "Acciones"],
      fields: [
        { key: "actaNumber", label: "NIT Proveedor", type: "text", placeholder: "900.331.220-1" },
        { key: "supplierInvoice", label: "Nombre del Proveedor", type: "text", placeholder: "Distribuidora Nacional S.A.S." },
        { key: "lotAndTemp", label: "Nombre de Contacto", type: "text", placeholder: "Ricardo G\xF3mez" },
        { key: "technicalConcept", label: "Tel\xE9fono / WhatsApp", type: "text", placeholder: "310 555 8899" }
      ]
    },
    {
      moduleKey: "mod-recipes",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Insumos y Recetas",
      tabIcon: "\u{1F9EA}",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Guardar Insumo / Receta",
      hasVisualRecipeBuilder: true,
      tableHeaders: ["C\xF3digo", "Plato o Producto Final", "Insumo Requerido", "Cantidad por Unidad", "Costo Insumo", "Acciones"],
      fields: [
        { key: "dishName", label: "Producto / Plato", type: "text", placeholder: "Hamburguesa Artesanal / Kit Mantenimiento" },
        { key: "ingredientName", label: "Insumo Descontado", type: "text", placeholder: "Carne Res 180g / Filtro" },
        { key: "qtyUsed", label: "Cantidad Usada", type: "text", placeholder: "1 Unidad" },
        { key: "ingredientCost", label: "Costo ($)", type: "number", placeholder: "8500" }
      ]
    },
    {
      moduleKey: "mod-scale",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Transportistas y Pesaje",
      tabIcon: "\u{1F69B}",
      summary: "",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "+ Registrar Transportista / Despacho",
      hasTruckScaleWeighbridge: true,
      tableHeaders: ["C\xF3digo", "Transportista / Conductor", "Placa Veh\xEDculo", "Ruta / Destino", "Tel\xE9fono", "Acciones"],
      fields: [
        { key: "carrierDriver", label: "Transportista / Conductor", type: "text", placeholder: "Hernando Rojas" },
        { key: "truckPlate", label: "Placa del Veh\xEDculo", type: "text", placeholder: "WXY-412" },
        { key: "routeDest", label: "Ruta / Ciudad Destino", type: "text", placeholder: "Medell\xEDn - Bogot\xE1" },
        { key: "driverPhone", label: "Tel\xE9fono Conductor", type: "text", placeholder: "315 222 3344" }
      ]
    },
    {
      moduleKey: "mod-lots",
      parentServiceKey: "srv-inventory",
      externalSubmoduleName: "Kardex de Movimientos",
      tabIcon: "\u{1F4CA}",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Registrar Ajuste Manual",
      tableHeaders: ["ID", "Fecha", "Tipo", "Producto", "Cantidad", "Saldo", "Referencia"],
      fields: [
        { key: "lotNumber", label: "Producto", type: "text", placeholder: "Nombre del producto" },
        { key: "expiryDate", label: "Tipo de Movimiento", type: "select", options: ["Entrada de Mercanc\xEDa", "Salida por Ajuste", "Baja por Aver\xEDa"] },
        { key: "qtyLot", label: "Cantidad", type: "number", placeholder: "5" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-manager-signature", parentServiceKey: "srv-inventory", externalName: "Responsable de Bodega", description: "Registra qui\xE9n autoriza traslados.", monthlyAddonUsd: 15e3 },
    { componentKey: "comp-carrier-select", parentServiceKey: "srv-inventory", externalName: "Control de Transportistas", description: "Asigna transportista en despachos.", monthlyAddonUsd: 19e3 },
    { componentKey: "comp-scale-tare", parentServiceKey: "srv-inventory", externalName: "C\xE1lculo de Peso Neto", description: "Destare autom\xE1tico de pesaje.", monthlyAddonUsd: 25e3 },
    { componentKey: "comp-expiry-semaphore", parentServiceKey: "srv-inventory", externalName: "Alertas de Stock M\xEDnimo", description: "Resalta productos por agotarse.", monthlyAddonUsd: 15e3 }
  ]
};

// apps/srv-invoicing/frontend/invoicing-service.view.ts
var SRV_INVOICING_FRONTEND_VIEW = {
  serviceKey: "srv-invoicing",
  externalPrincipalModuleName: "Facturar y Punto de Venta",
  icon: "\u{1F9FE}",
  subtitle: "Ventas en mostrador, facturaci\xF3n, cotizaciones y listas de precios.",
  standaloneMonthlyUsd: 145e3,
  submodules: [
    {
      moduleKey: "mod-pos",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Punto de Venta (Facturar)",
      tabIcon: "\u{1F6D2}",
      summary: "",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Facturar Venta",
      tableHeaders: ["Factura", "Cliente", "Medio de Pago", "Total", "Estado"],
      hasInteractivePosCart: true,
      fields: [
        { key: "customerName", label: "Cliente", type: "text", placeholder: "Consumidor Final" },
        { key: "customerNit", label: "NIT / C\xE9dula", type: "text", placeholder: "222222222-2" },
        { key: "paymentMethod", label: "Medio de Pago", type: "select", options: ["Efectivo", "Transferencia / Nequi", "Tarjeta", "Cr\xE9dito / Cartera"] }
      ]
    },
    {
      moduleKey: "mod-dian",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Historial de Facturas",
      tabIcon: "\u{1F9FE}",
      summary: "",
      monthlyAddonUsd: 69e3,
      actionButtonLabel: "Registrar Factura",
      tableHeaders: ["N\xB0 Factura", "Cliente", "NIT / C\xE9dula", "Total", "Estado", "Fecha"],
      fields: [
        { key: "resolutionPrefix", label: "Tipo de Comprobante", type: "select", options: ["Factura de Venta", "Nota Cr\xE9dito", "Nota D\xE9bito"] },
        { key: "buyerLegalName", label: "Cliente", type: "text", placeholder: "Nombre o Raz\xF3n Social" },
        { key: "buyerTaxId", label: "NIT / C\xE9dula", type: "text", placeholder: "901.452.110-4" },
        { key: "buyerEmail", label: "Correo del Cliente", type: "text", placeholder: "cliente@correo.com" },
        { key: "totalAmount", label: "Valor Total ($)", type: "number", placeholder: "150000" }
      ]
    },
    {
      moduleKey: "mod-quotes",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Cotizaciones y Pedidos",
      tabIcon: "\u{1F4CB}",
      summary: "",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "Guardar Cotizaci\xF3n",
      tableHeaders: ["N\xB0 Cotizaci\xF3n", "Cliente", "Concepto", "Valor Total", "Vence", "Estado"],
      fields: [
        { key: "quoteNumber", label: "N\xB0 Cotizaci\xF3n", type: "text", placeholder: "COT-001" },
        { key: "customerName", label: "Cliente", type: "text", placeholder: "Nombre del cliente" },
        { key: "itemsSummary", label: "Productos o Servicios Cotizados", type: "text", placeholder: "Descripci\xF3n de productos o servicios" },
        { key: "quotedTotal", label: "Valor Total ($)", type: "number", placeholder: "250000" },
        { key: "validUntil", label: "Validez", type: "select", options: ["15 D\xEDas", "30 D\xEDas", "Contado Inmediato"] }
      ]
    },
    {
      moduleKey: "mod-tariffs",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Listas de Precios y Descuentos",
      tabIcon: "\u{1F3F7}\uFE0F",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "Guardar Lista de Precios",
      tableHeaders: ["C\xF3digo", "Nombre de Lista", "Tipo de Descuento", "Vigencia", "Valor / %"],
      fields: [
        { key: "tariffCode", label: "C\xF3digo", type: "text", placeholder: "MAYORISTA" },
        { key: "tariffName", label: "Nombre de la Lista", type: "text", placeholder: "Cliente Frecuente (-10%)" },
        { key: "pricingRule", label: "Tipo de Beneficio", type: "select", options: ["Descuento % sobre Precio", "Precio Fijo Especial", "Precio Mayorista"] },
        { key: "sampleRateCop", label: "Porcentaje o Valor", type: "number", placeholder: "10" }
      ]
    },
    {
      moduleKey: "mod-grouped-billing",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Facturaci\xF3n por Lotes / Empresas",
      tabIcon: "\u{1F4E6}",
      summary: "",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Generar Factura Agrupada",
      tableHeaders: ["Consecutivo", "Empresa / Convenio", "\xD3rdenes Incluidas", "Mes", "Total Facturado"],
      fields: [
        { key: "batchCode", label: "Consecutivo", type: "text", placeholder: "FAC-EMP-01" },
        { key: "contractClient", label: "Empresa Cliente", type: "text", placeholder: "Nombre de la empresa" },
        { key: "ordersIncluded", label: "\xD3rdenes o Remisiones Incluidas", type: "text", placeholder: "15 servicios del mes" },
        { key: "consolidatedTotal", label: "Valor Total ($)", type: "number", placeholder: "3500000" }
      ]
    },
    {
      moduleKey: "mod-glosas-disputes",
      parentServiceKey: "srv-invoicing",
      externalSubmoduleName: "Devoluciones y Reclamos de Facturas",
      tabIcon: "\u2696\uFE0F",
      summary: "",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "Registrar Devoluci\xF3n / Reclamo",
      tableHeaders: ["N\xB0 Caso", "Factura", "Motivo", "Valor", "Estado"],
      fields: [
        { key: "disputeCode", label: "N\xB0 Caso", type: "text", placeholder: "DEV-001" },
        { key: "invoiceRef", label: "Factura Asociada", type: "text", placeholder: "FEVP-9010" },
        { key: "disputeReason", label: "Motivo", type: "select", options: ["Devoluci\xF3n de Producto", "Ajuste de Precio", "Cambio por Garant\xEDa"] },
        { key: "disputedAmount", label: "Valor ($)", type: "number", placeholder: "48000" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-cashier-name", parentServiceKey: "srv-invoicing", externalName: "Control de Cajero por Turno", description: "Registra qui\xE9n realiza cada cobro.", monthlyAddonUsd: 15e3 },
    { componentKey: "comp-line-discount", parentServiceKey: "srv-invoicing", externalName: "Descuentos en Caja", description: "Permite aplicar descuentos por cliente o producto.", monthlyAddonUsd: 19e3 },
    { componentKey: "comp-tip", parentServiceKey: "srv-invoicing", externalName: "Propina en Cuenta", description: "Permite agregar propina sugerida en caja.", monthlyAddonUsd: 15e3 }
  ]
};

// apps/srv-procurement/frontend/procurement-service.view.ts
var SRV_PROCUREMENT_FRONTEND_VIEW = {
  serviceKey: "srv-procurement",
  externalPrincipalModuleName: "Compras y Proveedores",
  icon: "\u{1F69A}",
  subtitle: "\xD3rdenes de compra, facturas de proveedores y recepci\xF3n de mercanc\xEDa.",
  standaloneMonthlyUsd: 129e3,
  submodules: [
    {
      moduleKey: "mod-purchase-orders",
      parentServiceKey: "srv-procurement",
      externalSubmoduleName: "\xD3rdenes de Compra",
      tabIcon: "\u{1F4DD}",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Crear Orden de Compra",
      tableHeaders: ["N\xB0 Orden", "Proveedor", "Productos Solicitados", "Bodega Destino", "Total", "Estado", "Acciones"],
      fields: [
        { key: "poNumber", label: "N\xB0 Orden", type: "text", placeholder: "OC-2026-01" },
        { key: "supplierName", label: "Proveedor", type: "text", placeholder: "Distribuidora Nacional" },
        { key: "itemsRequested", label: "Productos y Cantidades", type: "text", placeholder: "20 Cajas Aceite / 50 Filtros" },
        { key: "totalOrderCop", label: "Valor Total ($)", type: "number", placeholder: "1850000" }
      ]
    },
    {
      moduleKey: "mod-purchase-invoices",
      parentServiceKey: "srv-procurement",
      externalSubmoduleName: "Facturas de Compra",
      tabIcon: "\u{1F4E5}",
      summary: "",
      monthlyAddonUsd: 42e3,
      actionButtonLabel: "+ Registrar Factura de Compra",
      tableHeaders: ["N\xB0 Factura", "Proveedor", "Fecha", "Condici\xF3n Pago", "Total", "Estado", "Acciones"],
      fields: [
        { key: "supplierInvoiceNo", label: "N\xB0 Factura Proveedor", type: "text", placeholder: "FC-9940" },
        { key: "supplierVendor", label: "Proveedor", type: "text", placeholder: "Importadora Andina" },
        { key: "paymentDue", label: "Forma de Pago", type: "select", options: ["Contado", "Cr\xE9dito 30 D\xEDas", "Cr\xE9dito 60 D\xEDas"] },
        { key: "invoiceTotal", label: "Valor Total ($)", type: "number", placeholder: "2400000" }
      ]
    },
    {
      moduleKey: "mod-support-doc-dse",
      parentServiceKey: "srv-procurement",
      externalSubmoduleName: "Compras a No Obligados (Doc. Soporte)",
      tabIcon: "\u{1F4C4}",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Emitir Documento Soporte",
      tableHeaders: ["Consecutivo", "Proveedor / Persona", "C\xE9dula", "Concepto", "Valor", "Estado", "Acciones"],
      fields: [
        { key: "dseNumber", label: "Consecutivo", type: "text", placeholder: "DSE-001" },
        { key: "informalSeller", label: "Nombre de la Persona", type: "text", placeholder: "Pedro Nel Ospina" },
        { key: "sellerDoc", label: "C\xE9dula", type: "text", placeholder: "71.224.890" },
        { key: "serviceOrGood", label: "Servicio o Producto Comprado", type: "text", placeholder: "Arreglo el\xE9ctrico / Transporte" },
        { key: "dseAmount", label: "Valor Pagado ($)", type: "number", placeholder: "180000" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-margin-drop-alert", parentServiceKey: "srv-procurement", externalName: "Alerta de Subida de Costo", description: "Avisa si un proveedor sube el precio.", monthlyAddonUsd: 15e3 }
  ]
};

// apps/srv-reports/frontend/reports-service.view.ts
var SRV_REPORTS_FRONTEND_VIEW = {
  serviceKey: "srv-reports",
  externalPrincipalModuleName: "Reportes",
  icon: "\u{1F4CA}",
  subtitle: "Resumen de ventas, ganancias, inventario y descargas en Excel.",
  standaloneMonthlyUsd: 119e3,
  submodules: [
    {
      moduleKey: "mod-sales-profitability-reports",
      parentServiceKey: "srv-reports",
      externalSubmoduleName: "Resumen de Ventas y Descargas Excel",
      tabIcon: "\u{1F4CA}",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Generar Corte de Ventas",
      tableHeaders: ["Reporte", "Per\xEDodo", "Ventas Totales", "Utilidad Neta", "Formato"],
      fields: [
        { key: "dateRange", label: "Per\xEDodo a Consultar", type: "select", options: ["Hoy", "\xDAltimos 7 D\xEDas", "Mes Actual", "Mes Anterior"] },
        { key: "branchFilter", label: "Sede / Caja", type: "select", options: ["Todas las Sedes", "Caja Principal", "Punto de Venta Norte"] }
      ]
    },
    {
      moduleKey: "mod-financial-reports",
      parentServiceKey: "srv-reports",
      externalSubmoduleName: "Ingresos vs Gastos (Ganancias)",
      tabIcon: "\u{1F4C8}",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Generar Balance",
      tableHeaders: ["Per\xEDodo", "Ingresos por Ventas", "Costo de Mercanc\xEDa", "Gastos Operativos", "Ganancia Neta"],
      fields: [
        { key: "reportType", label: "Tipo de Balance", type: "select", options: ["Ingresos vs Gastos del Mes", "Balance por Cliente", "Resumen de Caja y Bancos"] },
        { key: "periodMonth", label: "Mes / A\xF1o", type: "text", placeholder: "Noviembre 2026" }
      ]
    },
    {
      moduleKey: "mod-inventory-reports",
      parentServiceKey: "srv-reports",
      externalSubmoduleName: "Reporte de Inventario y Rotaci\xF3n",
      tabIcon: "\u{1F4E6}",
      summary: "",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "+ Consultar Inventario",
      tableHeaders: ["Bodega", "Total Referencias", "Costo en Bodega", "Valor de Venta", "Alertas Stock Bajo"],
      fields: [
        { key: "warehouseReport", label: "Bodega", type: "select", options: ["Todas las Bodegas", "Bodega Principal", "Bodega Punto de Venta"] }
      ]
    },
    {
      moduleKey: "mod-tax-dian-reports",
      parentServiceKey: "srv-reports",
      externalSubmoduleName: "Resumen de Impuestos",
      tabIcon: "\u{1F3DB}\uFE0F",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Generar Resumen Tributario",
      tableHeaders: ["Impuesto", "Per\xEDodo", "Base Gravable", "Impuesto Generado", "Estado"],
      fields: [
        { key: "taxType", label: "Tipo de Impuesto", type: "select", options: ["IVA Ventas vs Compras", "Impuesto al Consumo", "Retenciones Aplicadas"] },
        { key: "taxPeriod", label: "Bimestre / Mes", type: "text", placeholder: "Bimestre Actual" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-dian-xml-exporter", parentServiceKey: "srv-reports", externalName: "Exportaci\xF3n directa a Excel (.CSV)", description: "Descarga reportes listos para Excel.", monthlyAddonUsd: 15e3 }
  ]
};

// apps/srv-ticketing/frontend/ticketing-service.view.ts
var SRV_TICKETING_FRONTEND_VIEW = {
  serviceKey: "srv-ticketing",
  externalPrincipalModuleName: "Taquilla y Soporte",
  icon: "\u{1F39F}\uFE0F",
  subtitle: "Venta de entradas/covers, control de ingreso y atenci\xF3n de reclamos.",
  standaloneMonthlyUsd: 119e3,
  submodules: [
    {
      moduleKey: "mod-event-tickets",
      parentServiceKey: "srv-ticketing",
      externalSubmoduleName: "Venta de Entradas y Covers",
      tabIcon: "\u{1F39F}\uFE0F",
      summary: "",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "+ Vender Entrada / Cover",
      tableHeaders: ["Ticket", "Evento / Zona", "Cliente", "Cantidad", "Total Pagado", "Estado", "Acciones"],
      fields: [
        { key: "eventName", label: "Evento / Localidad", type: "select", options: ["Cover General", "Zona VIP / Palco", "Preventa Evento Especial"] },
        { key: "buyerAttendee", label: "Cliente", type: "text", placeholder: "Sebasti\xE1n Restrepo" },
        { key: "ticketPriceCop", label: "Valor Total ($)", type: "number", placeholder: "50000" }
      ]
    },
    {
      moduleKey: "mod-gate-scanner",
      parentServiceKey: "srv-ticketing",
      externalSubmoduleName: "Control de Entrada en Puerta",
      tabIcon: "\u{1F4F2}",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Validar Entrada",
      tableHeaders: ["C\xF3digo Ticket", "Asistente", "Zona", "Hora Ingreso", "Estado", "Acciones"],
      fields: [
        { key: "qrToken", label: "C\xF3digo de Boleta / QR", type: "text", placeholder: "TCK-9921" },
        { key: "gateDoor", label: "Puerta de Acceso", type: "select", options: ["Entrada Principal", "Acceso VIP"] }
      ]
    },
    {
      moduleKey: "mod-pqrsf-helpdesk",
      parentServiceKey: "srv-ticketing",
      externalSubmoduleName: "Solicitudes y Garant\xEDas de Clientes",
      tabIcon: "\u{1F3A7}",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Crear Caso de Atenci\xF3n",
      tableHeaders: ["Caso", "Cliente", "Tipo", "Descripci\xF3n", "Estado", "Acciones"],
      fields: [
        { key: "ticketType", label: "Tipo de Solicitud", type: "select", options: ["Soporte / Garant\xEDa", "Petici\xF3n", "Reclamo", "Sugerencia"] },
        { key: "requesterName", label: "Cliente", type: "text", placeholder: "Nombre del cliente" },
        { key: "caseSubject", label: "Detalle del Caso", type: "text", placeholder: "Descripci\xF3n breve" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-anti-clone-qr-gate", parentServiceKey: "srv-ticketing", externalName: "Lector de C\xF3digo QR en Puerta", description: "Evita doble uso de entradas.", monthlyAddonUsd: 19e3 }
  ]
};

// apps/srv-treasury/frontend/treasury-service.view.ts
var SRV_TREASURY_FRONTEND_VIEW = {
  serviceKey: "srv-treasury",
  externalPrincipalModuleName: "Caja y Cartera",
  icon: "\u{1F4B5}",
  subtitle: "Cuadre de caja, cuentas por cobrar a clientes, pagos a proveedores y gastos.",
  standaloneMonthlyUsd: 129e3,
  submodules: [
    {
      moduleKey: "mod-petty-cash",
      parentServiceKey: "srv-treasury",
      externalSubmoduleName: "Caja del D\xEDa y Gastos",
      tabIcon: "\u{1F4B5}",
      summary: "",
      monthlyAddonUsd: 35e3,
      actionButtonLabel: "+ Registrar Gasto de Caja",
      tableHeaders: ["Recibo", "Fecha", "Categor\xEDa", "Concepto del Gasto", "Origen", "Valor", "Acciones"],
      fields: [
        { key: "expenseConcept", label: "Concepto del Gasto", type: "text", placeholder: "Compra de insumos / Domicilio" },
        { key: "expenseCategory", label: "Categor\xEDa", type: "select", options: ["Insumos Operativos", "Transporte / Domicilios", "Servicios / Aseo", "Adelanto / Vale"] },
        { key: "expenseAmount", label: "Valor ($)", type: "number", placeholder: "25000" }
      ]
    },
    {
      moduleKey: "mod-receivables-cxc",
      parentServiceKey: "srv-treasury",
      externalSubmoduleName: "Cuentas por Cobrar (Clientes)",
      tabIcon: "\u{1F4D2}",
      summary: "",
      monthlyAddonUsd: 45e3,
      actionButtonLabel: "+ Registrar Abono de Cliente",
      tableHeaders: ["Factura", "Cliente", "Total Factura", "Total Abonado", "Saldo Pendiente", "Estado", "Acciones"],
      fields: [
        { key: "receiptNumber", label: "N\xB0 Factura", type: "text", placeholder: "FEVP-9010" },
        { key: "customerDebtor", label: "Cliente", type: "text", placeholder: "Nombre del cliente" },
        { key: "amountCollected", label: "Valor Abonado ($)", type: "number", placeholder: "100000" },
        { key: "paymentChannel", label: "Medio de Pago", type: "select", options: ["Efectivo", "Transferencia / Nequi", "Tarjeta"] }
      ]
    },
    {
      moduleKey: "mod-payables-cxp",
      parentServiceKey: "srv-treasury",
      externalSubmoduleName: "Cuentas por Pagar (Proveedores)",
      tabIcon: "\u{1F4E4}",
      summary: "",
      monthlyAddonUsd: 42e3,
      actionButtonLabel: "+ Registrar Pago a Proveedor",
      tableHeaders: ["Comprobante", "Proveedor", "Factura Proveedor", "Medio de Pago", "Valor Pagado", "Estado", "Acciones"],
      fields: [
        { key: "voucherCode", label: "N\xB0 Comprobante", type: "text", placeholder: "CE-001" },
        { key: "supplierCreditor", label: "Proveedor", type: "text", placeholder: "Distribuidora Nacional" },
        { key: "invoiceRef", label: "Factura que se Paga", type: "text", placeholder: "FC-4410" },
        { key: "amountPaid", label: "Valor a Pagar ($)", type: "number", placeholder: "450000" }
      ]
    },
    {
      moduleKey: "mod-banks-reconciliation",
      parentServiceKey: "srv-treasury",
      externalSubmoduleName: "Bancos y Cuentas",
      tabIcon: "\u{1F3E6}",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Registrar Movimiento Bancario",
      tableHeaders: ["ID", "Cuenta / Billetera", "Tipo Movimiento", "Referencia", "Valor", "Saldo", "Acciones"],
      fields: [
        { key: "bankAccount", label: "Cuenta o Billetera Digital", type: "select", options: ["Bancolombia Ahorros", "Nequi Negocios", "Daviplata", "Banco de Bogot\xE1"] },
        { key: "txDescription", label: "Concepto / Referencia", type: "text", placeholder: "Transferencia cliente / Consignaci\xF3n" },
        { key: "txAmount", label: "Valor ($)", type: "number", placeholder: "320000" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-withholding-calc", parentServiceKey: "srv-treasury", externalName: "Descuento por Retenciones", description: "Permite registrar retenciones en pagos.", monthlyAddonUsd: 19e3 }
  ]
};

// apps/srv-workshop/frontend/workshop-service.view.ts
var SRV_WORKSHOP_FRONTEND_VIEW = {
  serviceKey: "srv-workshop",
  externalPrincipalModuleName: "Taller y Servicios",
  icon: "\u{1F527}",
  subtitle: "Recepci\xF3n de veh\xEDculos o equipos, \xF3rdenes de trabajo y comisiones de t\xE9cnicos.",
  standaloneMonthlyUsd: 129e3,
  submodules: [
    {
      moduleKey: "mod-work-orders-kanban",
      parentServiceKey: "srv-workshop",
      externalSubmoduleName: "\xD3rdenes de Trabajo (Tablero)",
      tabIcon: "\u{1F4CB}",
      summary: "",
      monthlyAddonUsd: 49e3,
      actionButtonLabel: "+ Ingresar Orden de Trabajo",
      tableHeaders: ["Orden", "Placa", "Cliente", "T\xE9cnico", "Estado", "Total Estimado", "Acciones"],
      fields: [
        { key: "otNumber", label: "Placa", type: "text", placeholder: "KLM-84G" },
        { key: "vehicleAndClient", label: "Cliente", type: "text", placeholder: "Nombre del propietario" },
        { key: "servicesChecklist", label: "Trabajo a Realizar", type: "text", placeholder: "Cambio de aceite y revisi\xF3n de frenos" },
        { key: "estimatedTotal", label: "Valor Mano de Obra ($)", type: "number", placeholder: "85000" }
      ]
    },
    {
      moduleKey: "mod-vehicles-assets",
      parentServiceKey: "srv-workshop",
      externalSubmoduleName: "Veh\xEDculos y Equipos",
      tabIcon: "\u{1F697}",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Registrar Veh\xEDculo / Equipo",
      tableHeaders: ["Placa / Serial", "Marca y L\xEDnea", "Propietario", "Kilometraje / Pr\xF3x. Aceite", "SOAT / Tecno", "Acciones"],
      fields: [
        { key: "plate", label: "Placa o Serial", type: "text", placeholder: "KLM-84G" },
        { key: "makeModel", label: "Marca / L\xEDnea / Modelo", type: "text", placeholder: "Mazda CX-30 2024" },
        { key: "ownerName", label: "Propietario", type: "text", placeholder: "Andr\xE9s Toro" },
        { key: "mileageInfo", label: "Kilometraje Actual", type: "number", placeholder: "45000" }
      ]
    },
    {
      moduleKey: "mod-worker-commissions",
      parentServiceKey: "srv-workshop",
      externalSubmoduleName: "Comisiones de T\xE9cnicos",
      tabIcon: "\u{1F477}",
      summary: "",
      monthlyAddonUsd: 39e3,
      actionButtonLabel: "+ Registrar T\xE9cnico",
      tableHeaders: ["T\xE9cnico", "Especialidad", "% Comisi\xF3n", "Producido Hoy", "Pago al T\xE9cnico", "Utilidad Taller", "Acciones"],
      fields: [
        { key: "workerName", label: "Nombre del T\xE9cnico", type: "text", placeholder: "Carlos M\xE9ndez" },
        { key: "settlementCode", label: "Especialidad", type: "text", placeholder: "Mec\xE1nica General / Inyecci\xF3n" },
        { key: "grossLabor", label: "% Comisi\xF3n T\xE9cnico", type: "number", placeholder: "40" }
      ]
    },
    {
      moduleKey: "mod-warranties",
      parentServiceKey: "srv-workshop",
      externalSubmoduleName: "Garant\xEDas",
      tabIcon: "\u{1F6E1}\uFE0F",
      summary: "",
      monthlyAddonUsd: 29e3,
      actionButtonLabel: "+ Registrar Garant\xEDa",
      tableHeaders: ["N\xB0 Caso", "Factura / Orden", "Placa / Repuesto", "Soluci\xF3n", "Costo", "Acciones"],
      fields: [
        { key: "warrantyCode", label: "Factura u Orden Origen", type: "text", placeholder: "OT-3041" },
        { key: "itemOrService", label: "Placa y Motivo de Garant\xEDa", type: "text", placeholder: "KLM-84G \u2014 Ajuste de frenos" },
        { key: "resolutionType", label: "Soluci\xF3n Aplicada", type: "select", options: ["Ajuste sin Costo", "Cambio de Repuesto por Proveedor", "No Aplica Garant\xEDa"] },
        { key: "assumedCost", label: "Costo Asumido ($)", type: "number", placeholder: "0" }
      ]
    }
  ],
  features: [
    { componentKey: "comp-intake-checklist-sign", parentServiceKey: "srv-workshop", externalName: "Alertas de Cambio de Aceite y SOAT", description: "Calcula pr\xF3ximo cambio de aceite.", monthlyAddonUsd: 19e3 },
    { componentKey: "comp-warranty-vin-alert", parentServiceKey: "srv-workshop", externalName: "Control de Garant\xEDas por Placa", description: "Historial por placa.", monthlyAddonUsd: 15e3 }
  ]
};

// apps/web-app/src/application/registries/platform-centers.registry.ts
var MICROSERVICE_FRONTEND_CATALOG = [
  SRV_INVOICING_FRONTEND_VIEW,
  SRV_INVENTORY_FRONTEND_VIEW,
  SRV_GASTRO_FRONTEND_VIEW,
  SRV_WORKSHOP_FRONTEND_VIEW,
  SRV_CRM_FRONTEND_VIEW,
  SRV_TREASURY_FRONTEND_VIEW,
  SRV_PROCUREMENT_FRONTEND_VIEW,
  SRV_HOTEL_FRONTEND_VIEW,
  SRV_APPOINTMENTS_FRONTEND_VIEW,
  SRV_FLEET_FRONTEND_VIEW,
  SRV_TICKETING_FRONTEND_VIEW,
  SRV_FINANCE_FRONTEND_VIEW,
  SRV_HR_PAYROLL_FRONTEND_VIEW,
  SRV_REPORTS_FRONTEND_VIEW
];
var ALL_SUBMODULES_FLAT = MICROSERVICE_FRONTEND_CATALOG.flatMap((svc) => svc.submodules);
var ALL_FEATURES_FLAT = MICROSERVICE_FRONTEND_CATALOG.flatMap((svc) => svc.features);
var BUSINESS_TYPE_PRESETS = [
  {
    id: "comercio-retail",
    name: "Comercio, Tienda y Ferreter\xEDa",
    badge: "Comercio y Ventas",
    description: "Punto de Venta, Inventario, Proveedores, Clientes, Caja y Reportes.",
    baseMonthlyUsd: 169e3,
    includedPrincipalServices: ["srv-invoicing", "srv-inventory", "srv-procurement", "srv-crm", "srv-treasury", "srv-reports"],
    includedSubmodules: ["mod-pos", "mod-quotes", "mod-stock", "mod-warehouses", "mod-purchase-orders", "mod-directory", "mod-receivables-cxc", "mod-sales-profitability-reports"],
    includedFeatures: ["comp-cashier-name", "comp-line-discount", "comp-manager-signature", "comp-nit-dv-auto"]
  },
  {
    id: "restaurante-gastro",
    name: "Restaurante, Gastrobar y Cafeter\xEDa",
    badge: "Gastronom\xEDa",
    description: "Mesas, Comandas para Cocina/Barra, Carta, Divisi\xF3n de Cuentas, Domicilios, Caja e Inventario.",
    baseMonthlyUsd: 199e3,
    includedPrincipalServices: ["srv-gastro", "srv-invoicing", "srv-inventory", "srv-procurement", "srv-treasury", "srv-reports"],
    includedSubmodules: ["mod-tables", "mod-kds", "mod-modifiers-menu", "mod-split", "mod-deliveries", "mod-pos", "mod-stock", "mod-recipes", "mod-petty-cash", "mod-sales-profitability-reports"],
    includedFeatures: ["comp-cashier-name", "comp-tip", "comp-waiter-assign", "comp-courtesy-auth"]
  },
  {
    id: "bares-discotecas",
    name: "Bares, Licores y Eventos",
    badge: "Bares y Eventos",
    description: "Mesas y Barra, Comandas, Taquilla/Covers, Control de Puerta, Inventario de Licores y Caja.",
    baseMonthlyUsd: 199e3,
    includedPrincipalServices: ["srv-gastro", "srv-ticketing", "srv-invoicing", "srv-inventory", "srv-treasury", "srv-reports"],
    includedSubmodules: ["mod-tables", "mod-kds", "mod-split", "mod-event-tickets", "mod-gate-scanner", "mod-pos", "mod-stock", "mod-recipes", "mod-petty-cash"],
    includedFeatures: ["comp-bar-shot-measure", "comp-happy-hour-pricing", "comp-waiter-assign", "comp-tip", "comp-cashier-name", "comp-anti-clone-qr-gate"]
  },
  {
    id: "talleres-fixmotor",
    name: "Talleres Automotrices y Servicio T\xE9cnico",
    badge: "Talleres y Repuestos",
    description: "Recepci\xF3n de Veh\xEDculos, Tablero de \xD3rdenes, Comisiones de T\xE9cnicos, Inventario de Repuestos, Clientes y Facturaci\xF3n.",
    baseMonthlyUsd: 229e3,
    includedPrincipalServices: ["srv-workshop", "srv-inventory", "srv-procurement", "srv-invoicing", "srv-crm", "srv-treasury", "srv-reports"],
    includedSubmodules: ["mod-vehicles-assets", "mod-work-orders-kanban", "mod-worker-commissions", "mod-warranties", "mod-stock", "mod-warehouses", "mod-purchase-orders", "mod-pos", "mod-dian", "mod-directory"],
    includedFeatures: ["comp-intake-checklist-sign", "comp-warranty-vin-alert", "comp-nit-dv-auto", "comp-cashier-name"]
  },
  {
    id: "servicios-citas-v2",
    name: "Consultorios, Centros de Servicios y Citas",
    badge: "Citas y Convenios",
    description: "Agenda de Citas, Horarios de Profesionales, Clientes, Convenios, Facturaci\xF3n y Cartera.",
    baseMonthlyUsd: 249e3,
    includedPrincipalServices: ["srv-appointments", "srv-crm", "srv-invoicing", "srv-inventory", "srv-treasury", "srv-reports"],
    includedSubmodules: ["mod-calendar-slots", "mod-staff-schedules", "mod-queue-turnador", "mod-directory", "mod-contracts", "mod-tariffs", "mod-grouped-billing", "mod-glosas-disputes", "mod-dian", "mod-tech-reception", "mod-lots"],
    includedFeatures: ["comp-overbooking-guard", "comp-whatsapp-ai-reschedule", "comp-contract-budget-alert", "comp-expiry-semaphore"]
  },
  {
    id: "reservas-tickets-hotel",
    name: "Hoteles, Caba\xF1as, Clubes y Pasad\xEDas",
    badge: "Hoteler\xEDa y Turismo",
    description: "Habitaciones y Check-In, Reservas, Camareras, Pasad\xEDas, Restaurante y Facturaci\xF3n.",
    baseMonthlyUsd: 229e3,
    includedPrincipalServices: ["srv-hotel", "srv-ticketing", "srv-gastro", "srv-invoicing", "srv-crm", "srv-treasury"],
    includedSubmodules: ["mod-bookings", "mod-rooms", "mod-seasonal-rates", "mod-housekeeping", "mod-tickets", "mod-tables", "mod-pos", "mod-dian", "mod-directory"],
    includedFeatures: ["comp-qr-ticket", "comp-cashier-name", "comp-nit-dv-auto"]
  },
  {
    id: "distribuidora-mayorista",
    name: "Distribuidora Mayorista y Multi-Bodega",
    badge: "Mayorista y Bodegas",
    description: "Facturaci\xF3n, Listas de Precios, Bodegas, Traslados, Compras, Cartera Clientes/Proveedores y Contabilidad.",
    baseMonthlyUsd: 259e3,
    includedPrincipalServices: ["srv-invoicing", "srv-inventory", "srv-procurement", "srv-treasury", "srv-crm", "srv-finance", "srv-reports"],
    includedSubmodules: ["mod-pos", "mod-dian", "mod-tariffs", "mod-quotes", "mod-stock", "mod-warehouses", "mod-transfers", "mod-purchase-orders", "mod-purchase-invoices", "mod-receivables-cxc", "mod-payables-cxp", "mod-directory", "mod-puc"],
    includedFeatures: ["comp-manager-signature", "comp-carrier-select", "comp-credit-quota-lock", "comp-margin-drop-alert"]
  },
  {
    id: "agro-logistica-bascula",
    name: "Agroindustria, Transporte de Carga y B\xE1scula",
    badge: "Transporte y Pesaje",
    description: "Pesaje en B\xE1scula, Despachos de Carga, Anticipos de Viaje, Bodegas, Compras y Facturaci\xF3n.",
    baseMonthlyUsd: 289e3,
    includedPrincipalServices: ["srv-fleet", "srv-inventory", "srv-procurement", "srv-invoicing", "srv-treasury", "srv-crm", "srv-finance"],
    includedSubmodules: ["mod-fleet-scale", "mod-fleet-dispatch-rndc", "mod-trip-settlements", "mod-tires-fleet-maint", "mod-stock", "mod-warehouses", "mod-transfers", "mod-lots", "mod-scale", "mod-support-doc-dse", "mod-dian", "mod-receivables-cxc", "mod-payables-cxp", "mod-directory"],
    includedFeatures: ["comp-manager-signature", "comp-carrier-select", "comp-scale-tare", "comp-weighbridge-humidity-discount", "comp-rndc-manifest-sync"]
  },
  {
    id: "erp-corporativo-integral",
    name: "Empresa Integral Multi-Sede (Todos los M\xF3dulos)",
    badge: "Plan Empresarial Completo",
    description: "Incluye Facturaci\xF3n, Inventario, Compras, Clientes, Caja, Contabilidad, N\xF3mina y Reportes.",
    baseMonthlyUsd: 389e3,
    includedPrincipalServices: ["srv-invoicing", "srv-inventory", "srv-gastro", "srv-workshop", "srv-procurement", "srv-treasury", "srv-finance", "srv-hr-payroll", "srv-reports", "srv-crm", "srv-hotel", "srv-appointments", "srv-fleet", "srv-ticketing"],
    includedSubmodules: ["mod-pos", "mod-dian", "mod-tariffs", "mod-grouped-billing", "mod-stock", "mod-warehouses", "mod-transfers", "mod-purchase-orders", "mod-purchase-invoices", "mod-support-doc-dse", "mod-receivables-cxc", "mod-payables-cxp", "mod-banks-reconciliation", "mod-puc", "mod-cost-centers", "mod-fixed-assets", "mod-exogena-taxes", "mod-employees-contracts", "mod-payroll-settlement", "mod-social-benefits-pila", "mod-financial-reports", "mod-tax-dian-reports", "mod-directory", "mod-contracts"],
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

// apps/web-app/src/presentation/client-runtime/crm-360-cxc-hub.runtime.ts
function renderCrm360CxcHubRuntimeJs() {
  return `
  function pkRenderLook360Hub(subKey) {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;

    var q = (STATE.look360Search || '').trim().toLowerCase();
    var cntOpts = '';
    for (var k1 = 0; k1 < db.contracts.length; k1++) {
      cntOpts += '<option value="' + pkEsc(db.contracts[k1].id) + '">' + pkEsc(db.contracts[k1].code + ' \u2014 ' + db.contracts[k1].entityName) + '</option>';
    }
    var trfOpts = '';
    for (var k2 = 0; k2 < db.tariffs.length; k2++) {
      trfOpts += '<option value="' + pkEsc(db.tariffs[k2].id) + '">' + pkEsc(db.tariffs[k2].name + ' (-' + db.tariffs[k2].discountPct + '%)') + '</option>';
    }
    var custOpts = '';
    for (var k3 = 0; k3 < db.customers.length; k3++) {
      custOpts += '<option value="' + pkEsc(db.customers[k3].name) + '">' + pkEsc(db.customers[k3].name + ' (' + db.customers[k3].nit + ')') + '</option>';
    }

    if (subKey === 'mod-contracts') {
      var nextCntCode = 'CNV-2026-' + (100 + db.contracts.length + 1);
      var ctRows = '';
      for (var ct = 0; ct < db.contracts.length; ct++) {
        var co = db.contracts[ct];
        ctRows += '<tr><td><code>' + pkEsc(co.code) + '</code></td><td><strong>' + pkEsc(co.entityName || co.name) + '</strong></td>' +
          '<td><span class="badge badge-blue">' + pkEsc(co.tariffName || 'Tarifa Convenio') + '</span></td>' +
          '<td>' + pkCop(co.budgetCeiling) + '</td><td>' + pkCop(co.consumedAmount) + '</td>' +
          '<td><strong style="color:var(--pk-emerald)">' + pkCop(co.availableBalance) + '</strong></td>' +
          '<td><button type="button" class="btn btn-outline btn-sm" data-print-contract="' + pkEsc(co.id) + '">\u{1F5A8}\uFE0F Imprimir Convenio</button></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">\u{1F4D1} Contratos y Convenios Empresariales</div>' +
        '<button type="button" class="btn btn-outline btn-sm" data-open-new-customer-modal="1">+ Nuevo Cliente</button></div>' +
        '<div class="card-body"><div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
        '<div class="field"><label>C\xF3digo Convenio (Autom\xE1tico)</label><input type="text" id="cnt-new-code" value="' + nextCntCode + '" readonly style="background:#e2e8f0;font-weight:800" /></div>' +
        '<div class="field"><label>Seleccionar Cliente / Empresa</label><select id="cnt-new-entity">' + custOpts + '</select></div>' +
        '<div class="field"><label>Lista de Precios / Tarifa</label><select id="cnt-new-tariff">' + trfOpts + '</select></div>' +
        '<div class="field"><label>Cupo Presupuestal ($)</label><div class="row-actions"><input type="number" id="cnt-new-ceiling" value="25000000" style="flex:1" />' +
        '<button type="button" class="btn btn-primary" id="btn-cnt-add">\u2713 Crear Convenio</button></div></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>C\xF3digo</th><th>Empresa</th><th>Tarifa</th><th>Cupo Total</th><th>Consumido</th><th>Disponible</th><th>Acciones</th></tr></thead><tbody>' + ctRows + '</tbody></table></div></div></div>';
      return;
    }

    if (subKey === 'mod-receivables-cxc' || subKey === 'mod-dian') {
      var dRows = ''; var totalPending = 0;
      for (var d = 0; d < db.invoices.length; d++) {
        var f = db.invoices[d];
        var hasDebt = Number(f.pendingBalance || 0) > 0;
        if (subKey === 'mod-receivables-cxc' && !hasDebt && db.invoices.length > 2) continue;
        totalPending += Number(f.pendingBalance || 0);
        dRows += '<tr>' +
          '<td><strong>' + pkEsc(f.id) + '</strong><div style="font-size:11px;color:var(--pk-muted)">' + pkEsc(f.date) + '</div></td>' +
          '<td><strong>' + pkEsc(f.customerName) + '</strong><div style="font-size:11px;color:var(--pk-muted)">' + pkEsc(f.plate || 'Mostrador') + '</div></td>' +
          '<td>' + pkCop(f.total) + '</td>' +
          '<td style="color:var(--pk-emerald);font-weight:700">' + pkCop(f.amountPaid) + '</td>' +
          '<td><span class="badge ' + (hasDebt ? 'badge-amber' : 'badge-emerald') + '">' + (hasDebt ? 'Debe: ' + pkCop(f.pendingBalance) : '\u2713 Pagada') + '</span></td>' +
          '<td><div class="row-actions">' +
          (hasDebt ? '<button type="button" class="btn btn-emerald btn-sm" data-open-abono-modal="' + pkEsc(f.id) + '">\u{1F4B5} Abonar</button>' : '') +
          '<button type="button" class="btn btn-outline btn-sm" data-open-invoice-modal="' + pkEsc(f.id) + '">\u{1F441}\uFE0F Detalle</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-print-invoice="' + pkEsc(f.id) + '">\u{1F5A8}\uFE0F Imprimir</button>' +
          '</div></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head">' +
        '<div class="card-title">' + (subKey === 'mod-receivables-cxc' ? '\u{1F4D2} Cuentas por Cobrar a Clientes (Cartera)' : '\u{1F9FE} Historial de Facturas Emitidas') + '</div>' +
        '<div class="row-actions"><span class="badge badge-amber" style="font-size:13px">Total por Cobrar: ' + pkCop(totalPending) + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-export-csv="invoices">\u{1F4E5} Exportar Excel</button></div></div>' +
        '<div class="card-body"><div class="table-wrap"><table><thead><tr>' +
        '<th>Factura / Fecha</th><th>Cliente</th><th>Total Factura</th><th>Abonado</th><th>Saldo Pendiente</th><th>Acciones</th>' +
        '</tr></thead><tbody>' + (dRows || '<tr><td colspan="6" style="text-align:center;padding:16px">No hay facturas pendientes de cobro.</td></tr>') + '</tbody></table></div></div></div>';
      return;
    }

    if (subKey === 'mod-tech-reception') {
      var sRows = '';
      for (var s = 0; s < db.suppliers.length; s++) {
        var sp = db.suppliers[s];
        sRows += '<tr><td><code>' + pkEsc(sp.nit) + '</code></td><td><strong>' + pkEsc(sp.name) + '</strong></td><td>' + pkEsc(sp.contactName || 'Comercial') + '</td><td>' + pkEsc(sp.phone) + '</td><td>' + pkEsc(sp.city) + '</td>' +
          '<td><div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-print-supplier="' + pkEsc(sp.id) + '">\u{1F5A8}\uFE0F Ficha</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-sup-delete-id="' + pkEsc(sp.id) + '">\u{1F5D1}\uFE0F</button></div></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">\u{1F69A} Proveedores Registrados (' + db.suppliers.length + ')</div></div>' +
        '<div class="card-body"><div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
        '<div class="field"><label>NIT Proveedor</label><input type="text" id="sup-new-nit" placeholder="Ej: 900.441.220-1" /></div>' +
        '<div class="field"><label>Raz\xF3n Social del Proveedor *</label><input type="text" id="sup-new-name" placeholder="Ej: Importadora Nacional S.A.S." /></div>' +
        '<div class="field"><label>Ciudad</label><select id="sup-new-city"><option>Bogot\xE1 D.C.</option><option>Medell\xEDn</option><option>Cali</option><option>Barranquilla</option><option>Cartagena</option><option>Bucaramanga</option></select></div>' +
        '<div class="field"><label>Tel\xE9fono</label><div class="row-actions"><input type="text" id="sup-new-phone" placeholder="Ej: 310 555 8899" style="flex:1" />' +
        '<button type="button" class="btn btn-primary" id="btn-sup-add">\u2713 Guardar Proveedor</button></div></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>NIT</th><th>Proveedor</th><th>Contacto</th><th>Tel\xE9fono</th><th>Ciudad</th><th>Acciones</th></tr></thead><tbody>' + sRows + '</tbody></table></div></div></div>';
      return;
    }

    if (subKey === 'mod-lots') {
      var kRows = '';
      for (var km = 0; km < db.kardexMovements.length; km++) {
        var kv = db.kardexMovements[km];
        kRows += '<tr><td>' + pkEsc(kv.date) + '</td><td><span class="badge ' + (kv.qty > 0 ? 'badge-emerald' : 'badge-amber') + '">' + pkEsc(kv.movementType) + '</span></td>' +
          '<td><strong>' + pkEsc(kv.productName) + '</strong></td><td>' + (kv.qty > 0 ? '+' + kv.qty : kv.qty) + ' und</td><td><strong>' + kv.balanceAfter + ' und</strong></td><td><code>' + pkEsc(kv.referenceDoc) + '</code></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">\u{1F4CA} Kardex de Movimientos de Inventario</div>' +
        '<button type="button" class="btn btn-outline btn-sm" id="btn-std-print-table">\u{1F5A8}\uFE0F Imprimir Kardex PDF</button></div>' +
        '<div class="card-body"><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Cantidad</th><th>Saldo en Bodega</th><th>Referencia</th></tr></thead><tbody>' + kRows + '</tbody></table></div></div></div>';
      return;
    }

    var cRows = '';
    for (var c = 0; c < db.customers.length; c++) {
      var cu = db.customers[c];
      if (q && (cu.name + ' ' + cu.nit + ' ' + cu.city).toLowerCase().indexOf(q) === -1) continue;
      cRows += '<tr>' +
        '<td><code>' + pkEsc((cu.docType || 'NIT') + ' ' + cu.nit + (cu.dv ? '-' + cu.dv : '')) + '</code></td>' +
        '<td><strong>' + pkEsc(cu.name) + '</strong></td>' +
        '<td>\u{1F4DE} ' + pkEsc(cu.phone) + ' \xB7 ' + pkEsc(cu.city) + '</td>' +
        '<td>' + pkCop(cu.creditLimit) + '</td>' +
        '<td><strong style="color:' + (cu.currentDebt > 0 ? 'var(--pk-amber)' : 'var(--pk-emerald)') + '">' + pkCop(cu.currentDebt) + '</strong></td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" data-open-customer-360="' + pkEsc(cu.id) + '">\u{1F441}\uFE0F Expediente</button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-print-customer="' + pkEsc(cu.id) + '">\u{1F5A8}\uFE0F Imprimir</button>' +
        '<button type="button" class="btn btn-emerald btn-sm" data-pos-select-cust-go="' + pkEsc(cu.id) + '">\u{1F6D2} Facturarle</button>' +
        '<button type="button" class="btn btn-outline btn-sm" style="color:var(--pk-rose)" data-cust-delete-id="' + pkEsc(cu.id) + '">\u{1F5D1}\uFE0F</button>' +
        '</div></td></tr>';
    }
    stage.innerHTML =
      '<div class="card" style="border:2px solid #bfdbfe;background:#f8fafc">' +
      '<div class="card-head"><div><div class="card-title">\u2795 Registrar Nuevo Cliente</div>' +
      '<div class="card-sub">El cliente queda disponible de inmediato en Facturaci\xF3n, Taller, Hoteler\xEDa, Reservas y Cartera</div></div>' +
      '<button type="button" class="btn btn-emerald" id="btn-inline-save-customer">\u2713 Guardar Cliente</button></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>Tipo de Documento</label><select id="inline-cust-doctype"><option value="NIT">NIT Empresa</option><option value="CC">C\xE9dula (CC)</option><option value="CE">C\xE9dula Extranjer\xEDa</option></select></div>' +
      '<div class="field"><label>N\xFAmero Documento / NIT *</label><input type="text" id="inline-cust-nit" placeholder="Ej: 901452110" /></div>' +
      '<div class="field"><label>Nombre o Raz\xF3n Social *</label><input type="text" id="inline-cust-name" placeholder="Ej: Ferreter\xEDa y Suministros del Sur S.A.S." /></div>' +
      '<div class="field"><label>Tel\xE9fono / WhatsApp</label><input type="text" id="inline-cust-phone" placeholder="Ej: 315 890 1122" /></div>' +
      '<div class="field"><label>Ciudad</label><select id="inline-cust-city"><option>Bogot\xE1 D.C.</option><option>Medell\xEDn</option><option>Cali</option><option>Barranquilla</option><option>Cartagena</option><option>Bucaramanga</option><option>Pereira</option></select></div>' +
      '<div class="field"><label>Convenio / Contrato</label><select id="inline-cust-contract">' + cntOpts + '</select></div>' +
      '<div class="field"><label>Lista de Precios / Tarifa</label><select id="inline-cust-tariff">' + trfOpts + '</select></div>' +
      '<div class="field"><label>Cupo de Cr\xE9dito Autorizado</label><select id="inline-cust-credit"><option value="0">Contado ($0)</option><option value="2000000">$2.000.000 COP</option><option value="5000000" selected>$5.000.000 COP</option><option value="15000000">$15.000.000 COP</option><option value="50000000">$50.000.000 COP</option></select></div>' +
      '</div></div></div>' +

      '<div class="card"><div class="card-head"><div class="card-title">\u{1F465} Clientes Registrados (' + db.customers.length + ')</div>' +
      '<div class="row-actions">' +
      '<input type="text" id="look360-search-input" value="' + pkEsc(STATE.look360Search || '') + '" placeholder="\u{1F50E} Buscar por nombre, NIT o ciudad..." style="padding:7px 12px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;min-width:240px" />' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-std-print-table">\u{1F5A8}\uFE0F Imprimir Directorio</button>' +
      '</div></div>' +
      '<div class="card-body"><div class="table-wrap"><table><thead><tr>' +
      '<th>Documento</th><th>Nombre o Raz\xF3n Social</th><th>Tel\xE9fono / Ciudad</th><th>Cupo Cr\xE9dito</th><th>Saldo Cartera</th><th>Acciones</th>' +
      '</tr></thead><tbody>' + cRows + '</tbody></table></div></div></div>';
  }
`;
}

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
  var DEMO_STORAGE_KEY = 'proveko_demo_localstorage_v4';
  var defaultDemoClient = (BOOT.initialClients && BOOT.initialClients[0]) ? JSON.parse(JSON.stringify(BOOT.initialClients[0])) : null;

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
    roleViewFilter: 'ALL',           // 'ALL' | 'CAJERO' | 'MESERO' | 'COCINA' | 'BODEGA' | 'TECNICO' | 'RECEPCION'
    selectedTableId: 'tbl-1',
    submoduleRows: JSON.parse(JSON.stringify(BOOT.initialRows || {})),
    featureRequests: [],
    relDb: pkCreateInitialRelationalDb(),
    posCustomerId: 'cust-1',
    posVehicleId: 'veh-1',
    posPaymentMethod: 'Efectivo',
    posCashReceived: 250000,
    posCreditInitialAbono: 50000,
    posLinkedOrderId: '',
    posLinkedTableId: '',
    posCart: [
      { kind: 'PRODUCTO', refId: 'prd-1', code: 'ACE-10W40', name: 'Aceite Sint\xE9tico 10W-40 Alto Rendimiento (Gal\xF3n)', qty: 1, price: 145000, taxPct: 19 },
      { kind: 'SERVICIO', refId: 'SRV-INI', code: 'MO', name: 'Sincronizaci\xF3n Electr\xF3nica y Esc\xE1ner', qty: 1, price: 85000, taxPct: 0, workerId: 'wk-1', workerName: 'Carlos Andr\xE9s M\xE9ndez' }
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
      if (parsed && parsed.demoClient && defaultDemoClient) {
        STATE.demoClient = parsed.demoClient;
        STATE.demoClient.activePrincipalServices = defaultDemoClient.activePrincipalServices.slice();
        STATE.demoClient.activeSubmodules = defaultDemoClient.activeSubmodules.slice();
        STATE.demoClient.activeFeatures = defaultDemoClient.activeFeatures.slice();
      }
      if (parsed && parsed.submoduleRows) {
        for (var k in parsed.submoduleRows) {
          if (Object.prototype.hasOwnProperty.call(parsed.submoduleRows, k)) {
            STATE.submoduleRows[k] = parsed.submoduleRows[k];
          }
        }
      }
      if (parsed && parsed.relDb) STATE.relDb = pkNormalizeRelDb(parsed.relDb);
    } catch (_e) {}
  }
  function pkSaveDemoToLocalStorage() {
    try {
      if (window.localStorage) window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ demoClient: STATE.demoClient, submoduleRows: STATE.submoduleRows, relDb: STATE.relDb }));
    } catch (_e) {}
  }
  pkLoadDemoFromLocalStorage();

  function pkHydrateClientRelationalWorkspace(dbName) {
    if (!dbName || dbName.indexOf('localStorage') !== -1) return;
    fetch('/api/v1/client-workspace/state?dbName=' + encodeURIComponent(dbName)).then(function(r) { return r.json(); }).then(function(res) {
      var remoteDb = res && (res.relationalState || res.state);
      if (remoteDb && remoteDb.customers && remoteDb.customers.length > 0) {
        STATE.relDb = pkNormalizeRelDb(remoteDb);
        pkRenderWorkstation();
      } else {
        pkPersistRelationalTx('INIT_SEED', {});
      }
    }).catch(function() {});
  }

  function pkEsc(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
          '<span class="badge badge-blue">M\xF3dulo</span></div>' +
          '<div class="center-pick-desc">' + pkEsc(s.subtitle) + '</div>' +
          '<div style="font-size:11px;font-weight:700;color:var(--pk-muted);margin-bottom:6px">Secciones incluidas:</div>' +
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
          '<button type="button" class="btn btn-primary btn-sm" data-showcase-preset="' + pkEsc(p.id) + '">Elegir este Plan &rarr;</button></div>';
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
      preset: preset, baseUsd: baseUsd, extraUsd: extraUsd, totalUsd: baseUsd + extraUsd,
      services: finalSvcs, submodules: finalSubs, features: incFeats.slice()
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
  function pkGetRoleAllowedServices(roleView) {
    if (roleView === 'CAJERO') return ['srv-invoicing', 'srv-treasury', 'srv-crm', 'srv-reports'];
    if (roleView === 'MESERO' || roleView === 'COCINA') return ['srv-gastro', 'srv-invoicing'];
    if (roleView === 'BODEGA') return ['srv-inventory', 'srv-procurement', 'srv-fleet'];
    if (roleView === 'TECNICO') return ['srv-workshop', 'srv-inventory', 'srv-appointments'];
    if (roleView === 'RECEPCION') return ['srv-hospitality', 'srv-appointments', 'srv-ticketing', 'srv-crm'];
    return null;
  }

  function pkRenderWorkstation() {
    var client = pkGetActiveClient();
    if (!client) return;
    var demoBanner = document.getElementById('demo-mode-banner');
    if (demoBanner) demoBanner.style.display = (STATE.publicTab === 'demo' && !STATE.session) ? 'flex' : 'none';
    var roleSel = document.getElementById('ws-role-view-selector');
    if (roleSel && roleSel.value !== (STATE.roleViewFilter || 'ALL')) roleSel.value = STATE.roleViewFilter || 'ALL';
    var navEl = document.getElementById('ws-principal-modules-nav');
    var svcs = BOOT.services || [];
    var roleFilterList = pkGetRoleAllowedServices(STATE.roleViewFilter || 'ALL');
    var activeSvc = null;
    if (navEl) {
      var nHtml = '';
      for (var i = 0; i < svcs.length; i++) {
        var s = svcs[i];
        if (client.activePrincipalServices && client.activePrincipalServices.length > 0 && client.activePrincipalServices.indexOf(s.serviceKey) === -1) continue;
        if (roleFilterList && roleFilterList.indexOf(s.serviceKey) === -1) continue;
        if (!activeSvc || s.serviceKey === STATE.activeServiceKey) activeSvc = s;
      }
      if (!activeSvc && svcs.length > 0) activeSvc = svcs[0];
      for (var n = 0; n < svcs.length; n++) {
        var sv = svcs[n];
        if (client.activePrincipalServices && client.activePrincipalServices.length > 0 && client.activePrincipalServices.indexOf(sv.serviceKey) === -1) continue;
        if (roleFilterList && roleFilterList.indexOf(sv.serviceKey) === -1) continue;
        var isCurrent = (STATE.activeWorkstationPane === 'module' && activeSvc && sv.serviceKey === activeSvc.serviceKey);
        nHtml += '<button type="button" class="ws-nav-btn ' + (isCurrent ? 'active' : '') + '" data-ws-service="' + pkEsc(sv.serviceKey) + '"><span class="ws-nav-icon">' + pkEsc(sv.icon) + '</span><span class="ws-nav-title">' + pkEsc(sv.externalPrincipalModuleName) + '</span></button>';
      }
      navEl.innerHTML = nHtml;
    }
    var rbacBtn = document.getElementById('btn-nav-internal-rbac'); var featBtn = document.getElementById('btn-nav-need-feature');
    if (rbacBtn) rbacBtn.className = 'ws-nav-btn ' + (STATE.activeWorkstationPane === 'rbac' ? 'active' : '');
    if (featBtn) featBtn.className = 'ws-nav-btn ' + (STATE.activeWorkstationPane === 'need-feature' ? 'active' : '');
    var paneMod = document.getElementById('ws-pane-module-operation'); var paneRbac = document.getElementById('ws-pane-internal-rbac'); var paneFeat = document.getElementById('ws-pane-need-feature');
    if (paneMod) paneMod.style.display = STATE.activeWorkstationPane === 'module' ? 'block' : 'none';
    if (paneRbac) paneRbac.style.display = STATE.activeWorkstationPane === 'rbac' ? 'block' : 'none';
    if (paneFeat) paneFeat.style.display = STATE.activeWorkstationPane === 'need-feature' ? 'block' : 'none';
    if (STATE.activeWorkstationPane === 'rbac') { pkRenderInternalRbacPane(client); return; }
    if (STATE.activeWorkstationPane === 'need-feature') { pkRenderNeedFeaturePane(client); return; }
    if (!activeSvc) return;
    STATE.activeServiceKey = activeSvc.serviceKey;
    var iconEl = document.getElementById('ws-active-service-icon'); var titleEl = document.getElementById('ws-active-service-title');
    if (iconEl) iconEl.textContent = activeSvc.icon; if (titleEl) titleEl.textContent = activeSvc.externalPrincipalModuleName;
    var availableSubs = []; var activeSub = null;
    for (var j = 0; j < activeSvc.submodules.length; j++) {
      var sm = activeSvc.submodules[j];
      if (!client.activeSubmodules || client.activeSubmodules.length === 0 || client.activeSubmodules.indexOf(sm.moduleKey) !== -1) { availableSubs.push(sm); if (sm.moduleKey === STATE.activeSubmoduleKey) activeSub = sm; }
    }
    if (availableSubs.length === 0) availableSubs = activeSvc.submodules.slice();
    if (!activeSub && availableSubs.length > 0) { activeSub = availableSubs[0]; STATE.activeSubmoduleKey = activeSub.moduleKey; }
    var tabsEl = document.getElementById('ws-submodule-tabs');
    if (tabsEl) {
      var tHtml = '';
      for (var k = 0; k < availableSubs.length; k++) { var subTab = availableSubs[k]; tHtml += '<button type="button" class="ws-subtab-pill ' + (activeSub && subTab.moduleKey === activeSub.moduleKey ? 'active' : '') + '" data-ws-submodule="' + pkEsc(subTab.moduleKey) + '">' + pkEsc(subTab.tabIcon + ' ' + subTab.externalSubmoduleName) + '</button>'; }
      tabsEl.innerHTML = tHtml;
    }
    if (!activeSub) return;
    var mKey = activeSub.moduleKey;
    if (mKey === 'mod-pos') { pkRenderPosHub(); return; }
    if (mKey === 'mod-stock') { pkRenderInventoryHub(); return; }
    if (mKey === 'mod-tables' || mKey === 'mod-kds') { pkRenderGastroHub(mKey); return; }
    if (mKey === 'mod-rooms') { pkRenderHotelHub(); return; }
    if (mKey === 'mod-work-orders-kanban' || mKey === 'mod-vehicles-assets' || mKey === 'mod-worker-commissions') { pkRenderKanbanHub(mKey); return; }
    if (mKey === 'mod-directory' || mKey === 'mod-contracts' || mKey === 'mod-receivables-cxc' || mKey === 'mod-dian' || mKey === 'mod-tech-reception' || mKey === 'mod-lots') { pkRenderLook360Hub(mKey); return; }
    if (mKey === 'mod-petty-cash') { pkRenderPettyCashHub(); return; }
    if (activeSvc.serviceKey === 'srv-reports') { pkRenderReportsAndCashboxHub(); return; }
    pkRenderStandardSectionStage(activeSub, client);
  }

  function pkBuildRelationalFieldHtml(fld, db, nextAutoCode) {
    var lbl = fld.label || ''; var lLow = (lbl + ' ' + fld.key).toLowerCase();
    if (fld.type === 'select' && fld.options && fld.options.length > 0) {
      var sOpts = ''; for (var o = 0; o < fld.options.length; o++) sOpts += '<option value="' + pkEsc(fld.options[o]) + '">' + pkEsc(fld.options[o]) + '</option>';
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '">' + sOpts + '</select></div>';
    }
    if (lLow.indexOf('ticket') !== -1 || lLow.indexOf('tiquete') !== -1 || lLow.indexOf('consecutivo') !== -1 || lLow.indexOf('c\xF3digo') !== -1 || lLow.indexOf('codigo') !== -1 || lLow.indexOf('manifiesto') !== -1 || lLow.indexOf('n\xB0') !== -1 || lLow.indexOf('prefijo') !== -1 || lLow.indexOf('qr') !== -1) {
      return '<div class="field"><label>' + pkEsc(lbl) + ' (\u26A1 Autom\xE1tico)</label><input type="text" data-ws-field="' + pkEsc(fld.key) + '" value="' + pkEsc(nextAutoCode) + '" readonly style="background:#e2e8f0;font-weight:800" /></div>';
    }
    if (lLow.indexOf('conductor') !== -1) {
      var dOpts = ''; for (var d = 0; d < db.drivers.length; d++) dOpts += '<option value="' + pkEsc(db.drivers[d].name + ' \u2014 CC ' + db.drivers[d].docNumber + ' (' + db.drivers[d].assignedPlate + ')') + '">' + pkEsc(db.drivers[d].name + ' (CC ' + db.drivers[d].docNumber + ' \xB7 Placa ' + db.drivers[d].assignedPlate + ')') + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-quick-entity="DRIVER" style="color:var(--pk-primary)">+ Nuevo Conductor</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + dOpts + '</select></div>';
    }
    if (lLow.indexOf('transportista') !== -1) {
      var cOpts = ''; for (var cr = 0; cr < db.carriers.length; cr++) cOpts += '<option value="' + pkEsc(db.carriers[cr].name) + '">' + pkEsc(db.carriers[cr].name + ' (' + db.carriers[cr].nit + ')') + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-quick-entity="CARRIER" style="color:var(--pk-primary)">+ Nuevo Transportista</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + cOpts + '</select></div>';
    }
    if (lLow.indexOf('placa') !== -1 || lLow.indexOf('veh\xEDculo') !== -1 || lLow.indexOf('vehiculo') !== -1 || lLow.indexOf('tractomula') !== -1 || lLow.indexOf('cabezote') !== -1) {
      var vOpts = ''; for (var v = 0; v < db.vehicles.length; v++) vOpts += '<option value="' + pkEsc(db.vehicles[v].plate + ' \u2014 ' + db.vehicles[v].brand) + '">' + pkEsc(db.vehicles[v].plate + ' \u2014 ' + db.vehicles[v].brand) + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-quick-entity="VEHICLE" style="color:var(--pk-primary)">+ Nueva Placa</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + vOpts + '</select></div>';
    }
    if (lLow.indexOf('cliente') !== -1 || lLow.indexOf('hu\xE9sped') !== -1 || lLow.indexOf('huesped') !== -1 || lLow.indexOf('paciente') !== -1 || lLow.indexOf('tercero') !== -1 || lLow.indexOf('comprador') !== -1 || lLow.indexOf('visitante') !== -1 || lLow.indexOf('empresa') !== -1 || lLow.indexOf('titular') !== -1) {
      var cuOpts = ''; for (var cu = 0; cu < db.customers.length; cu++) cuOpts += '<option value="' + pkEsc(db.customers[cu].name) + '">' + pkEsc(db.customers[cu].name + ' (' + db.customers[cu].nit + ')') + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-new-customer-modal="1" style="color:var(--pk-primary)">+ Nuevo Cliente</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + cuOpts + '</select></div>';
    }
    if (lLow.indexOf('bodega') !== -1 || lLow.indexOf('almac\xE9n') !== -1 || lLow.indexOf('sucursal') !== -1) {
      var wOpts = ''; for (var w = 0; w < db.warehouses.length; w++) wOpts += '<option value="' + pkEsc(db.warehouses[w].name) + '">' + pkEsc(db.warehouses[w].name + ' (' + db.warehouses[w].city + ')') + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-quick-entity="WAREHOUSE" style="color:var(--pk-primary)">+ Nueva Bodega</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + wOpts + '</select></div>';
    }
    if (lLow.indexOf('proveedor') !== -1) {
      var spOpts = ''; for (var s = 0; s < db.suppliers.length; s++) spOpts += '<option value="' + pkEsc(db.suppliers[s].name) + '">' + pkEsc(db.suppliers[s].name + ' (' + db.suppliers[s].nit + ')') + '</option>';
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '">' + spOpts + '</select></div>';
    }
    if (lLow.indexOf('producto') !== -1 || lLow.indexOf('insumo') !== -1 || lLow.indexOf('mercanc\xEDa') !== -1 || lLow.indexOf('item') !== -1 || lLow.indexOf('\xEDtem') !== -1 || lLow.indexOf('plato') !== -1) {
      var prOpts = ''; for (var p = 0; p < db.products.length; p++) prOpts += '<option value="' + pkEsc(db.products[p].name + ' (' + pkCop(db.products[p].salePrice) + ')') + '">' + pkEsc(db.products[p].name + ' \u2014 Stock: ' + db.products[p].stock + ' \u2014 ' + pkCop(db.products[p].salePrice)) + '</option>';
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '">' + prOpts + '</select></div>';
    }
    if (lLow.indexOf('habitaci\xF3n') !== -1 || lLow.indexOf('habitacion') !== -1 || lLow.indexOf('caba\xF1a') !== -1 || lLow.indexOf('espacio') !== -1) {
      var rmOpts = ''; for (var rm = 0; rm < db.hotelRooms.length; rm++) rmOpts += '<option value="' + pkEsc(db.hotelRooms[rm].roomNumber + ' (' + pkCop(db.hotelRooms[rm].nightlyRate) + ')') + '">' + pkEsc(db.hotelRooms[rm].roomNumber + ' \u2014 ' + db.hotelRooms[rm].roomType + ' (' + pkCop(db.hotelRooms[rm].nightlyRate) + ')') + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-quick-entity="ROOM" style="color:var(--pk-primary)">+ Habitaci\xF3n</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + rmOpts + '</select></div>';
    }
    if (lLow.indexOf('puc') !== -1 || lLow.indexOf('cuenta contable') !== -1) {
      var pcOpts = ''; for (var pc = 0; pc < db.pucAccounts.length; pc++) pcOpts += '<option value="' + pkEsc(db.pucAccounts[pc].name) + '">' + pkEsc(db.pucAccounts[pc].name) + '</option>';
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '">' + pcOpts + '</select></div>';
    }
    if (lLow.indexOf('t\xE9cnico') !== -1 || lLow.indexOf('profesional') !== -1 || lLow.indexOf('vendedor') !== -1 || lLow.indexOf('empleado') !== -1 || lLow.indexOf('encargado') !== -1 || lLow.indexOf('responsable') !== -1 || lLow.indexOf('mesero') !== -1 || lLow.indexOf('autorizado') !== -1) {
      var wkOpts = ''; for (var wk = 0; wk < db.workers.length; wk++) wkOpts += '<option value="' + pkEsc(db.workers[wk].name) + '">' + pkEsc(db.workers[wk].name + ' \u2014 ' + db.workers[wk].specialty) + '</option>';
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '">' + wkOpts + '</select></div>';
    }
    if (lLow.indexOf('carga') !== -1 || lLow.indexOf('ruta') !== -1 || lLow.indexOf('origen') !== -1 || lLow.indexOf('destino') !== -1) {
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '"><option>Carga General Contenedor \u2014 Ruta Nacional</option><option>Granel Agr\xEDcola e Insumos \u2014 Puerto a Planta</option><option>Acero y Materiales \u2014 Bodega Central a Norte</option><option>Mercanc\xEDa Refrigerada \u2014 Cadena de Fr\xEDo</option><option>Paqueter\xEDa Consolidada \u2014 Distribuci\xF3n Urbana</option></select></div>';
    }
    if (fld.type === 'date' || lLow.indexOf('fecha') !== -1 || lLow.indexOf('vencimiento') !== -1 || lLow.indexOf('vigencia') !== -1) {
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><input type="date" data-ws-field="' + pkEsc(fld.key) + '" value="2026-11-05" /></div>';
    }
    var defVal = fld.type === 'number' ? '1' : '';
    if (lLow.indexOf('bruto') !== -1) defVal = '52400';
    else if (lLow.indexOf('tara') !== -1) defVal = '16800';
    else if (lLow.indexOf('valor') !== -1 || lLow.indexOf('precio') !== -1 || lLow.indexOf('tarifa') !== -1 || lLow.indexOf('monto') !== -1 || lLow.indexOf('costo') !== -1 || lLow.indexOf('total') !== -1 || lLow.indexOf('sueldo') !== -1) defVal = '185000';
    return '<div class="field"><label>' + pkEsc(lbl) + '</label><input type="' + pkEsc(fld.type) + '" data-ws-field="' + pkEsc(fld.key) + '" value="' + defVal + '" placeholder="' + pkEsc(fld.placeholder || '') + '" /></div>';
  }

  function pkRenderStandardSectionStage(activeSub, client) {
    var stage = document.getElementById('ws-module-stage');
    if (!stage) return;
    var db = STATE.relDb;
    var rows = STATE.submoduleRows[activeSub.moduleKey] || [];
    var prefix = activeSub.moduleKey.replace('mod-', '').slice(0, 3).toUpperCase();
    var nextAutoCode = prefix + '-' + (1001 + rows.length);

    var fHtml = '';
    for (var m = 0; m < activeSub.fields.length; m++) {
      fHtml += pkBuildRelationalFieldHtml(activeSub.fields[m], db, nextAutoCode);
    }

    var hHtml = '<tr>';
    for (var h = 0; h < activeSub.tableHeaders.length; h++) hHtml += '<th>' + pkEsc(activeSub.tableHeaders[h]) + '</th>';
    hHtml += '<th>Acciones</th></tr>';

    var qFilter = (STATE.v2FilterText || '').trim().toLowerCase();
    var rHtml = ''; var matchedCount = 0;
    for (var r = 0; r < rows.length; r++) {
      var rowStr = rows[r].join(' ').toLowerCase();
      if (qFilter && rowStr.indexOf(qFilter) === -1) continue;
      matchedCount++;
      rHtml += '<tr>';
      for (var c = 0; c < rows[r].length; c++) rHtml += '<td>' + (c === 0 ? '<strong>' + pkEsc(rows[r][c]) + '</strong>' : pkEsc(rows[r][c])) + '</td>';
      rHtml += '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-std-print-idx="' + r + '">\u{1F5A8}\uFE0F Imprimir</button>' +
        '<button type="button" class="btn btn-outline btn-sm" style="color:var(--pk-rose)" data-std-del-idx="' + r + '">\u{1F5D1}\uFE0F</button>' +
        '</div></td></tr>';
    }

    stage.innerHTML =
      '<div class="card" style="border:2px solid #bfdbfe;background:#f8fafc;margin-bottom:14px">' +
      '<div class="card-head"><div><div class="card-title">\u2795 ' + pkEsc(activeSub.externalSubmoduleName) + ' (Consecutivo Autom\xE1tico: ' + nextAutoCode + ')</div>' +
      '<div class="card-sub">' + pkEsc(activeSub.summary) + '</div></div>' +
      '<button type="button" class="btn btn-emerald" id="btn-ws-save-record">\u2713 ' + pkEsc(activeSub.actionButtonLabel) + '</button></div>' +
      '<div id="ws-specialized-widget-slot" style="padding:0 16px"></div>' +
      '<div class="card-body"><div class="form-grid">' + fHtml + '</div></div></div>' +
      '<div class="card"><div class="card-head"><div><div class="card-title">\u{1F4CB} Registros Guardados en ' + pkEsc(activeSub.externalSubmoduleName) + '</div></div>' +
      '<div class="row-actions"><input type="text" id="ws-v2-filter-input" value="' + pkEsc(STATE.v2FilterText || '') + '" placeholder="\u{1F50D} Buscar registro..." style="padding:7px 12px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;min-width:220px" />' +
      '<span class="badge badge-blue">' + matchedCount + ' registros</span>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-std-print-table">\u{1F5A8}\uFE0F Imprimir Listado PDF</button></div></div>' +
      '<div class="table-wrap"><table><thead>' + hHtml + '</thead><tbody>' +
      (rHtml || '<tr><td colspan="' + (activeSub.tableHeaders.length + 1) + '" style="text-align:center;color:var(--pk-muted)">Sin registros a\xFAn.</td></tr>') +
      '</tbody></table></div></div>';

    pkRenderSpecializedWidget(activeSub, client);
  }
`;
}

// apps/web-app/src/presentation/client-runtime/inventory-wms-hub.runtime.ts
function renderInventoryWmsHubRuntimeJs() {
  return `
  function pkRenderInventoryHub() {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;

    var totalCostVal = 0; var totalSaleVal = 0; var lowStockCount = 0;
    var whFilter = STATE.invWarehouseFilter || 'ALL';
    var qSearch = (STATE.invSearchText || '').trim().toLowerCase();

    var whOpts = '<option value="ALL">Todas las Bodegas (' + db.warehouses.length + ')</option>';
    var whSelectForm = '';
    for (var w = 0; w < db.warehouses.length; w++) {
      var wh = db.warehouses[w];
      whOpts += '<option value="' + pkEsc(wh.id) + '" ' + (whFilter === wh.id ? 'selected' : '') + '>' + pkEsc(wh.name) + '</option>';
      whSelectForm += '<option value="' + pkEsc(wh.id) + '">' + pkEsc(wh.name) + '</option>';
    }

    var supOpts = '<option value="">Sin proveedor espec\xEDfico</option>';
    for (var s = 0; s < db.suppliers.length; s++) {
      var sp = db.suppliers[s];
      supOpts += '<option value="' + pkEsc(sp.id) + '">' + pkEsc(sp.name) + '</option>';
    }

    var rowsHtml = '';
    for (var i = 0; i < db.products.length; i++) {
      var p = db.products[i];
      totalCostVal += Number(p.costPrice || 0) * Number(p.stock || 0);
      totalSaleVal += Number(p.salePrice || 0) * Number(p.stock || 0);
      if (Number(p.stock || 0) <= Number(p.minStock || 5)) lowStockCount++;

      if (whFilter !== 'ALL' && p.warehouseId !== whFilter) continue;
      if (qSearch && (p.code + ' ' + p.name + ' ' + p.category).toLowerCase().indexOf(qSearch) === -1) continue;

      var whObj = pkFindById(db.warehouses, p.warehouseId);
      var supObj = pkFindById(db.suppliers, p.supplierId);
      var unitProfit = Number(p.salePrice || 0) - Number(p.costPrice || 0);
      var marginPct = p.salePrice > 0 ? Math.round((unitProfit / p.salePrice) * 100) : 0;
      var isLow = Number(p.stock || 0) <= Number(p.minStock || 5);

      rowsHtml += '<tr>' +
        '<td><code>' + pkEsc(p.code) + '</code></td>' +
        '<td><strong>' + pkEsc(p.name) + '</strong>' +
        '<div style="font-size:11px;color:var(--pk-muted)">\u{1F69A} ' + pkEsc(supObj ? supObj.name : 'Directo') + ' \xB7 \u{1F3ED} ' + pkEsc(whObj ? whObj.name : 'Principal') + '</div></td>' +
        '<td>' + pkCop(p.costPrice) + '</td>' +
        '<td><strong>' + pkCop(p.salePrice) + '</strong></td>' +
        '<td><span class="badge badge-emerald">+' + pkCop(unitProfit) + ' (' + marginPct + '%)</span></td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" title="Quitar 1 unidad" data-inv-delta="-1" data-inv-id="' + pkEsc(p.id) + '">\u2796</button>' +
        '<span class="badge ' + (isLow ? 'badge-amber' : 'badge-blue') + '" style="font-size:13px;min-width:64px;text-align:center">' + p.stock + ' und' + (isLow ? ' \u26A0\uFE0F' : '') + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" title="Agregar 1 unidad" data-inv-delta="1" data-inv-id="' + pkEsc(p.id) + '">\u2795</button>' +
        '</div></td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-emerald btn-sm" data-open-restock-modal="' + pkEsc(p.id) + '">\u{1F4E5} Surtir</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-open-transfer-modal="' + pkEsc(p.id) + '">\u{1F504} Trasladar</button>' +
        '<button type="button" class="btn btn-outline btn-sm" title="Imprimir Ficha" data-print-product="' + pkEsc(p.id) + '">\u{1F5A8}\uFE0F</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-inv-delete-id="' + pkEsc(p.id) + '">\u{1F5D1}\uFE0F</button>' +
        '</div></td></tr>';
    }
    if (!rowsHtml) {
      rowsHtml = '<tr><td colspan="7" style="text-align:center;color:var(--pk-muted);padding:18px">No se encontraron productos con ese filtro.</td></tr>';
    }

    var potentialProfit = Math.max(0, totalSaleVal - totalCostVal);
    var nextSku = 'PRD-' + (105 + db.products.length);

    stage.innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Capital en Bodega (Costo)</div><div class="kpi-val">' + pkCop(totalCostVal) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Valor Comercial (Venta)</div><div class="kpi-val" style="color:var(--pk-primary)">' + pkCop(totalSaleVal) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Ganancia Estimada</div><div class="kpi-val" style="color:var(--pk-emerald)">' + pkCop(potentialProfit) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Productos por Agotarse</div><div class="kpi-val" style="color:' + (lowStockCount > 0 ? 'var(--pk-amber)' : 'var(--pk-emerald)') + '">' + lowStockCount + ' productos</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><div class="card-title">\u2795 Agregar Nuevo Producto al Inventario (' + nextSku + ')</div>' +
      '<button type="button" class="btn btn-outline btn-sm" data-open-quick-entity="WAREHOUSE">+ Nueva Bodega</button></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>C\xF3digo / SKU (Autom\xE1tico)</label><input type="text" id="inv-new-sku" value="' + nextSku + '" readonly style="background:#e2e8f0;font-weight:800" /></div>' +
      '<div class="field"><label>Nombre del Producto o Repuesto *</label><input type="text" id="inv-new-name" placeholder="Ej: Pastillas de Freno / Bebida / Insumo" /></div>' +
      '<div class="field"><label>Proveedor</label><select id="inv-new-supplier">' + supOpts + '</select></div>' +
      '<div class="field"><label>Bodega</label><select id="inv-new-warehouse">' + whSelectForm + '</select></div>' +
      '<div class="field"><label>Costo de Compra ($)</label><input type="number" id="inv-new-cost" value="22000" /></div>' +
      '<div class="field"><label>Precio de Venta ($) *</label><input type="number" id="inv-new-sale" value="38000" /></div>' +
      '<div class="field"><label>Cantidad Inicial (Stock) *</label><input type="number" id="inv-new-stock" value="15" /></div>' +
      '<div class="field" style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-primary" style="width:100%" id="btn-inv-create-product">+ Guardar Producto</button></div>' +
      '</div></div></div>' +
      '<div class="card"><div class="card-head">' +
      '<div class="card-title">\u{1F4E6} Productos en Inventario (' + db.products.length + ')</div>' +
      '<div class="row-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-print-inventory-all">\u{1F5A8}\uFE0F Imprimir Inventario</button>' +
      '<select id="inv-filter-warehouse" style="padding:6px 10px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px">' + whOpts + '</select>' +
      '<input type="text" id="inv-search-input" value="' + pkEsc(STATE.invSearchText || '') + '" placeholder="\u{1F50E} Buscar por c\xF3digo o nombre..." style="padding:6px 10px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;min-width:220px" />' +
      '</div></div>' +
      '<div class="card-body"><div class="table-wrap"><table><thead><tr>' +
      '<th>C\xF3digo</th><th>Producto / Proveedor / Bodega</th><th>Costo Compra</th><th>Precio Venta</th><th>Margen</th><th>Quitar / Agregar Stock</th><th>Acciones</th>' +
      '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div></div>';
  }

  function pkHandleGastroAndInventoryActions(target, db) {
    if (target.closest('#btn-inv-create-product')) {
      var nName = ((document.getElementById('inv-new-name') || {}).value || '').trim();
      if (!nName) { pkToast('Escribe el nombre del producto.'); return true; }
      var nSku = ((document.getElementById('inv-new-sku') || {}).value || ('PRD-' + String(Date.now()).slice(-4))).trim().toUpperCase();
      var nWh = (document.getElementById('inv-new-warehouse') || {}).value || (db.warehouses[0] ? db.warehouses[0].id : 'wh-1');
      var nSup = (document.getElementById('inv-new-supplier') || {}).value || (db.suppliers[0] ? db.suppliers[0].id : 'sup-1');
      var nStock = Math.max(0, Number((document.getElementById('inv-new-stock') || {}).value || 10));
      var nCost = Math.max(0, Number((document.getElementById('inv-new-cost') || {}).value || 22000));
      var nSale = Math.max(nCost, Number((document.getElementById('inv-new-sale') || {}).value || 38000));
      var newPrd = { id: 'prd-' + Date.now(), code: nSku, name: nName, category: 'General', warehouseId: nWh, supplierId: nSup, costPrice: nCost, salePrice: nSale, taxPct: 19, stock: nStock, minStock: 5, lotCode: 'LOTE-2026', expiryDate: '2028-12-31' };
      db.products.unshift(newPrd);
      db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: newPrd.id, productName: newPrd.name, warehouseId: nWh, movementType: 'INVENTARIO_INICIAL', qty: nStock, unitCost: nCost, balanceAfter: nStock, referenceDoc: 'ALTA-PRODUCTO', actor: 'Inventario' });
      pkPersistRelationalTx('PURCHASE_ENTRY', { productCode: newPrd.code, productName: newPrd.name, costPrice: nCost, salePrice: nSale, stock: nStock });
      pkRenderWorkstation(); pkToast('Producto guardado en inventario: ' + nName);
      return true;
    }
    var invDel = target.closest('[data-inv-delete-id]');
    if (invDel) {
      var idDel = invDel.getAttribute('data-inv-delete-id');
      for (var d1 = 0; d1 < db.products.length; d1++) if (db.products[d1].id === idDel) { db.products.splice(d1, 1); break; }
      pkRenderWorkstation(); pkToast('Producto eliminado del inventario.'); return true;
    }
    var selTbl = target.closest('[data-select-table]');
    if (selTbl) { STATE.selectedTableId = selTbl.getAttribute('data-select-table'); pkRenderWorkstation(); return true; }
    if (target.closest('#btn-gastro-new-table')) {
      var nTblNum = db.diningTables.length + 1; var nTblId = 'tbl-' + Date.now();
      db.diningTables.push({ id: nTblId, name: 'Mesa ' + nTblNum, waiter: 'Mesero Turno', diners: 0, status: 'Libre', items: [], total: 0 });
      STATE.selectedTableId = nTblId; pkRenderWorkstation(); pkToast('Mesa ' + nTblNum + ' creada.'); return true;
    }
    if (target.closest('#btn-cmd-add-item')) {
      var tbC = pkFindById(db.diningTables, STATE.selectedTableId) || db.diningTables[0];
      if (tbC) {
        var dishVal = (document.getElementById('cmd-dish-select') || {}).value || 'Plato Especial|35000';
        var customName = ((document.getElementById('cmd-custom-name') || {}).value || '').trim();
        var customPrice = Number((document.getElementById('cmd-custom-price') || {}).value || 0);
        var parts = dishVal.split('|');
        var itemName = customName || parts[0];
        var itemPrice = customPrice > 0 ? customPrice : Number(parts[1] || 25000);
        var itemQty = Math.max(1, Number((document.getElementById('cmd-qty') || {}).value || 1));
        var itemNote = ((document.getElementById('cmd-note') || {}).value || '').trim();
        tbC.waiter = ((document.getElementById('cmd-waiter') || {}).value || 'Mesero').trim();
        tbC.diners = Math.max(1, Number((document.getElementById('cmd-diners') || {}).value || 2));
        if (tbC.status === 'Libre') tbC.status = 'Ocupada';
        tbC.items.push({ productId: 'cmd-' + Date.now(), name: itemName, qty: itemQty, price: itemPrice, note: itemNote });
        var sumT = 0; for (var k = 0; k < tbC.items.length; k++) sumT += tbC.items[k].qty * tbC.items[k].price;
        tbC.total = sumT; pkPersistRelationalTx('GASTRO_ORDER', { tableId: tbC.id }); pkRenderWorkstation(); pkToast('Agregado a ' + tbC.name + ': ' + itemQty + 'x ' + itemName);
      }
      return true;
    }
    var cmdQty = target.closest('[data-cmd-qty]');
    if (cmdQty) {
      var tbQ = pkFindById(db.diningTables, STATE.selectedTableId) || db.diningTables[0];
      var idxC = Number(cmdQty.getAttribute('data-cmd-idx'));
      if (tbQ && tbQ.items[idxC]) {
        tbQ.items[idxC].qty = Math.max(1, tbQ.items[idxC].qty + Number(cmdQty.getAttribute('data-cmd-qty')));
        var sQ = 0; for (var q1 = 0; q1 < tbQ.items.length; q1++) sQ += tbQ.items[q1].qty * tbQ.items[q1].price;
        tbQ.total = sQ; pkRenderWorkstation();
      }
      return true;
    }
    var cmdDel = target.closest('[data-cmd-del]');
    if (cmdDel) {
      var tbX = pkFindById(db.diningTables, STATE.selectedTableId) || db.diningTables[0];
      if (tbX) {
        tbX.items.splice(Number(cmdDel.getAttribute('data-cmd-del')), 1);
        var sX = 0; for (var x1 = 0; x1 < tbX.items.length; x1++) sX += tbX.items[x1].qty * tbX.items[x1].price;
        tbX.total = sX; if (tbX.items.length === 0) tbX.status = 'Libre'; pkRenderWorkstation();
      }
      return true;
    }
    if (target.closest('#btn-cmd-send-kitchen')) {
      var tbK = pkFindById(db.diningTables, STATE.selectedTableId) || db.diningTables[0];
      if (tbK) {
        if (!tbK.items || tbK.items.length === 0) { pkToast('Agrega al menos un plato o bebida antes de enviar a cocina.'); return true; }
        tbK.status = 'En Cocina'; pkRenderWorkstation(); pkToast('Comanda de ' + tbK.name + ' enviada a Cocina y Barra.');
      }
      return true;
    }
    var kdsReady = target.closest('[data-kds-ready-table]');
    if (kdsReady) {
      var tbR = pkFindById(db.diningTables, kdsReady.getAttribute('data-kds-ready-table'));
      if (tbR) { tbR.status = 'Ocupada'; pkRenderWorkstation(); pkToast('Pedido de ' + tbR.name + ' marcado como entregado.'); }
      return true;
    }
    return false;
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
      '<div class="card-head"><div><div class="card-title">\u{1F465} Perfiles y Roles de tu Equipo</div>' +
      '<div style="font-size:12px;color:var(--pk-muted)">Configura qu\xE9 secciones puede usar cada perfil de trabajo en tu empresa.</div></div>' +
      '<span class="badge badge-blue">Roles: ' + client.internalRoles.length + ' / ' + client.maxRolesAllowed + '</span></div>' +
      '<div class="card-body">' +
      '<div class="grid-3" style="margin-bottom:12px">' +
      '<div class="field"><label>Nombre del Rol</label><input type="text" id="new-role-name" placeholder="Ej: Jefe de Bodega / Mesero / Cajero" /></div>' +
      '<div class="field"><label>Funciones Permitidas</label><input type="text" id="new-role-desc" placeholder="Ej: Control de entradas, salidas y traslados" /></div>' +
      '<div class="field" style="justify-content:flex-end"><button type="button" class="btn btn-primary" id="btn-create-internal-role">+ Crear Rol</button></div>' +
      '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Rol</th><th>Descripci\xF3n</th><th>Secciones Habilitadas</th></tr></thead><tbody>' + rRows + '</tbody></table></div>' +
      '</div></div>' +
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">\u{1F510} Usuarios de tu Empresa</div>' +
      '<div style="font-size:12px;color:var(--pk-muted)">Crea cuentas de acceso para tus empleados y as\xEDgnales su rol correspondiente.</div></div>' +
      '<span class="badge badge-emerald">Usuarios: ' + client.internalUsers.length + ' / ' + client.maxUsersAllowed + '</span></div>' +
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

// apps/web-app/src/presentation/client-runtime/pos-hybrid-hub.runtime.ts
function renderPosHybridHubRuntimeJs() {
  return `
  function pkRenderPosHub() {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;

    var cust = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
    if (cust) STATE.posCustomerId = cust.id;
    var contract = cust && cust.contractId ? pkFindById(db.contracts, cust.contractId) : null;
    var tariff = cust && cust.tariffId ? pkFindById(db.tariffs, cust.tariffId) : null;
    var selectedVehicle = pkFindById(db.vehicles, STATE.posVehicleId) || null;

    var pendingOrders = [];
    for (var o = 0; o < db.workOrders.length; o++) {
      if (db.workOrders[o].status !== 'Facturado') pendingOrders.push(db.workOrders[o]);
    }
    var openTables = [];
    for (var dt = 0; dt < db.diningTables.length; dt++) {
      if (db.diningTables[dt].status !== 'Libre' && db.diningTables[dt].items && db.diningTables[dt].items.length > 0) openTables.push(db.diningTables[dt]);
    }

    var custOpts = '';
    for (var cIdx = 0; cIdx < db.customers.length; cIdx++) {
      var cItem = db.customers[cIdx];
      custOpts += '<option value="' + pkEsc(cItem.id) + '" ' + (cust && cust.id === cItem.id ? 'selected' : '') + '>' +
        pkEsc(cItem.name + ' (' + (cItem.docType || 'NIT') + ' ' + cItem.nit + ')') + '</option>';
    }
    var vehOpts = '<option value="">\u2014 Venta de Mostrador (Sin veh\xEDculo) \u2014</option>';
    for (var vIdx = 0; vIdx < db.vehicles.length; vIdx++) {
      var vItem = db.vehicles[vIdx];
      vehOpts += '<option value="' + pkEsc(vItem.id) + '" ' + (selectedVehicle && selectedVehicle.id === vItem.id ? 'selected' : '') + '>' +
        pkEsc(vItem.plate + ' \u2014 ' + vItem.brand + ' (' + vItem.customerName + ')') + '</option>';
    }
    var prodOpts = '';
    for (var pIdx = 0; pIdx < db.products.length; pIdx++) {
      var pr = db.products[pIdx];
      prodOpts += '<option value="' + pkEsc(pr.id) + '">' + pkEsc(pr.name + ' [' + pr.code + '] \u2014 Stock: ' + pr.stock + ' \u2014 ' + pkCop(pr.salePrice)) + '</option>';
    }
    var workerOpts = '';
    for (var wIdx = 0; wIdx < db.workers.length; wIdx++) {
      var wk = db.workers[wIdx];
      workerOpts += '<option value="' + pkEsc(wk.id) + '">' + pkEsc(wk.name + ' (' + wk.specialty + ')') + '</option>';
    }

    var quickLoadHtml = '';
    if (pendingOrders.length > 0 || openTables.length > 0) {
      quickLoadHtml = '<div style="margin-top:10px;padding:9px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<span style="font-size:12px;font-weight:700;color:#1e3a8a">\u26A1 Pasar a Caja para cobrar:</span><div class="row-actions">';
      for (var po = 0; po < pendingOrders.length; po++) {
        var ord = pendingOrders[po];
        quickLoadHtml += '<button type="button" class="btn btn-primary btn-sm" data-pos-load-order="' + pkEsc(ord.id) + '">\u{1F527} Orden ' + pkEsc(ord.plate) + ' (' + pkCop(ord.totalEstimated) + ')</button>';
      }
      for (var ot = 0; ot < openTables.length; ot++) {
        var tbl = openTables[ot];
        quickLoadHtml += '<button type="button" class="btn btn-emerald btn-sm" data-pos-load-table="' + pkEsc(tbl.id) + '">\u{1F37D}\uFE0F ' + pkEsc(tbl.name) + ' (' + pkCop(tbl.total) + ')</button>';
      }
      quickLoadHtml += '</div></div>';
    }

    var subTotal = 0; var discountTotal = 0;
    var discountPct = tariff ? Number(tariff.discountPct || 0) : 0;
    var cartRowsHtml = '';
    for (var i = 0; i < STATE.posCart.length; i++) {
      var it = STATE.posCart[i];
      var lineGross = Number(it.price || 0) * Number(it.qty || 1);
      var lineDisc = Math.round(lineGross * (discountPct / 100));
      var lineNet = lineGross - lineDisc;
      subTotal += lineGross; discountTotal += lineDisc;
      cartRowsHtml += '<tr>' +
        '<td><span class="badge ' + (it.kind === 'SERVICIO' ? 'badge-amber' : 'badge-blue') + '">' + pkEsc(it.kind === 'SERVICIO' ? 'Servicio' : 'Producto') + '</span></td>' +
        '<td><strong>' + pkEsc(it.name) + '</strong>' + (it.workerName ? '<div style="font-size:11px;color:var(--pk-muted)">T\xE9cnico: ' + pkEsc(it.workerName) + '</div>' : '') + '</td>' +
        '<td><div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-pos-qty-delta="-1" data-pos-idx="' + i + '">\u2796</button>' +
        '<strong style="min-width:22px;text-align:center">' + it.qty + '</strong>' +
        '<button type="button" class="btn btn-outline btn-sm" data-pos-qty-delta="1" data-pos-idx="' + i + '">\u2795</button></div></td>' +
        '<td>' + pkCop(it.price) + '</td>' +
        '<td><strong>' + pkCop(lineNet) + '</strong></td>' +
        '<td><button type="button" class="btn btn-outline btn-sm" style="color:var(--pk-rose)" data-pos-del-idx="' + i + '">\u{1F5D1}\uFE0F</button></td></tr>';
    }
    if (!cartRowsHtml) {
      cartRowsHtml = '<tr><td colspan="6" style="text-align:center;color:var(--pk-muted);padding:18px">El carrito est\xE1 vac\xEDo. Agrega un producto o servicio a la izquierda.</td></tr>';
    }
    var grandTotal = subTotal - discountTotal;
    var cashRec = Number(STATE.posCashReceived || grandTotal);
    var changeDue = Math.max(0, cashRec - grandTotal);

    var recentInvRows = '';
    for (var r = 0; r < Math.min(6, db.invoices.length); r++) {
      var inv = db.invoices[r];
      recentInvRows += '<tr><td><strong>' + pkEsc(inv.id) + '</strong></td><td>' + pkEsc(inv.date) + '</td><td>' + pkEsc(inv.customerName) + '</td>' +
        '<td>' + pkEsc(inv.paymentMethod) + '</td><td><strong>' + pkCop(inv.total) + '</strong></td>' +
        '<td><span class="badge ' + (inv.pendingBalance > 0 ? 'badge-amber' : 'badge-emerald') + '">' + (inv.pendingBalance > 0 ? 'Debe ' + pkCop(inv.pendingBalance) : 'Pagada') + '</span></td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" data-open-invoice-modal="' + pkEsc(inv.id) + '">\u{1F441}\uFE0F Ver</button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-print-invoice="' + pkEsc(inv.id) + '">\u{1F5A8}\uFE0F Imprimir</button>' +
        (inv.pendingBalance > 0 ? '<button type="button" class="btn btn-emerald btn-sm" data-open-abono-modal="' + pkEsc(inv.id) + '">\u{1F4B5} Abonar</button>' : '') +
        '</div></td></tr>';
    }

    stage.innerHTML =
      '<div class="grid-2" style="align-items:start">' +
      '<div>' +
      '<div class="card"><div class="card-head"><div class="card-title">\u{1F464} 1. Cliente de la Venta</div>' +
      '<div class="row-actions"><button type="button" class="btn btn-primary btn-sm" data-open-new-customer-modal="1">+ Nuevo Cliente</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-open-customer-360="' + pkEsc(cust ? cust.id : '') + '">\u{1F441}\uFE0F Ficha del Cliente</button></div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>Seleccionar Cliente</label><select id="pos-select-customer">' + custOpts + '</select></div>' +
      '<div class="field"><label>Veh\xEDculo / Referencia (Opcional)</label><select id="pos-select-vehicle">' + vehOpts + '</select></div>' +
      '<div class="field"><label>Lista de Precios / Convenio</label><input type="text" readonly value="' + pkEsc((tariff ? tariff.name + ' (-' + tariff.discountPct + '%)' : 'Precio General') + (contract && contract.id !== 'cnt-particular' ? ' \xB7 Cupo: ' + pkCop(contract.availableBalance) : '')) + '" style="background:#f8fafc;font-weight:700" /></div>' +
      '</div>' + quickLoadHtml + '</div></div>' +

      '<div class="card"><div class="card-head"><div class="card-title">\u{1F4E6} 2A. Agregar Producto del Inventario</div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field" style="grid-column:span 2"><label>Elegir Producto</label><select id="pos-select-product">' + prodOpts + '</select></div>' +
      '<div class="field"><label>Cantidad</label><input type="number" id="pos-product-qty" value="1" min="1" /></div>' +
      '</div><div style="margin-top:10px;display:flex;gap:8px;align-items:center">' +
      '<input type="text" id="pos-sku-input" placeholder="Lector c\xF3digo de barras / SKU (Opcional)" style="flex:1;padding:8px 11px;border:1px solid var(--pk-border);border-radius:8px;font-size:13px" />' +
      '<button type="button" class="btn btn-primary" id="btn-pos-add-product">+ Agregar Producto</button></div></div></div>' +

      '<div class="card"><div class="card-head"><div class="card-title">\u{1F527} 2B. Agregar Servicio / Mano de Obra</div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field" style="grid-column:span 2"><label>Descripci\xF3n del Servicio</label><input type="text" id="pos-service-desc" placeholder="Ej: Instalaci\xF3n, Mantenimiento o Consulta" /></div>' +
      '<div class="field"><label>Valor ($)</label><input type="number" id="pos-service-price" value="65000" /></div>' +
      '</div><div style="margin-top:10px;display:flex;gap:8px;align-items:center">' +
      '<select id="pos-select-worker" style="flex:1;padding:8px 11px;border:1px solid var(--pk-border);border-radius:8px;font-size:13px">' + workerOpts + '</select>' +
      '<button type="button" class="btn btn-amber" id="btn-pos-add-service">+ Agregar Servicio</button></div></div></div>' +
      '</div>' +

      '<div class="card" style="border:2px solid #023047"><div class="card-head" style="background:#023047;color:#fff">' +
      '<div class="card-title" style="color:#fff;font-size:15px">\u{1F9FE} 3. Cuenta a Cobrar en Caja</div>' +
      '<span class="badge badge-amber" style="font-size:14px;padding:5px 12px">Total: ' + pkCop(grandTotal) + '</span></div>' +
      '<div class="card-body"><div class="table-wrap" style="margin-bottom:14px"><table><thead><tr><th>Tipo</th><th>Descripci\xF3n</th><th>Cant.</th><th>Unitario</th><th>Subtotal</th><th></th></tr></thead><tbody>' + cartRowsHtml + '</tbody></table></div>' +
      '<div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Medio de Pago</label><select id="pos-payment-method">' +
      '<option value="Efectivo" ' + (STATE.posPaymentMethod === 'Efectivo' ? 'selected' : '') + '>\u{1F4B5} Efectivo</option>' +
      '<option value="Transferencia / Nequi" ' + (STATE.posPaymentMethod === 'Transferencia / Nequi' ? 'selected' : '') + '>\u{1F4F2} Transferencia / Nequi / QR</option>' +
      '<option value="Tarjeta" ' + (STATE.posPaymentMethod === 'Tarjeta' ? 'selected' : '') + '>\u{1F4B3} Tarjeta / Dat\xE1fono</option>' +
      '<option value="Cr\xE9dito / Cartera CxC" ' + (STATE.posPaymentMethod === 'Cr\xE9dito / Cartera CxC' ? 'selected' : '') + '>\u{1F4D2} Cr\xE9dito / Fiado (Pasa a Cartera)</option></select></div>' +
      '<div class="field"><label>' + (STATE.posPaymentMethod === 'Cr\xE9dito / Cartera CxC' ? 'Abono Inicial Hoy ($)' : 'Efectivo Recibido ($)') + '</label><input type="number" id="pos-cash-received" value="' + (STATE.posPaymentMethod === 'Cr\xE9dito / Cartera CxC' ? (STATE.posCreditInitialAbono || 0) : cashRec) + '" /></div>' +
      '<div class="field"><label>' + (STATE.posPaymentMethod === 'Cr\xE9dito / Cartera CxC' ? 'Saldo Pendiente por Cobrar' : 'Cambio a Devolver') + '</label>' +
      '<input type="text" readonly value="' + (STATE.posPaymentMethod === 'Cr\xE9dito / Cartera CxC' ? pkCop(Math.max(0, grandTotal - Number(STATE.posCreditInitialAbono || 0))) : pkCop(changeDue)) + '" style="font-weight:800;color:var(--pk-emerald);background:#fff" /></div>' +
      '</div>' +
      '<div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<div class="row-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-pos-print-quote">\u{1F5A8}\uFE0F Cotizaci\xF3n</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-pos-whatsapp-quote">\u{1F4AC} WhatsApp</button></div>' +
      '<button type="button" class="btn btn-emerald" style="font-size:14px;padding:10px 20px" id="btn-pos-checkout-invoice">\u2705 Cobrar y Emitir Factura</button>' +
      '</div></div></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><div class="card-title">\u{1F4CB} \xDAltimas Facturas Emitidas en Caja</div>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="invoices">\u{1F4E5} Descargar Excel</button></div>' +
      '<div class="card-body"><div class="table-wrap"><table><thead><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th>Medio de Pago</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>' + recentInvRows + '</tbody></table></div></div></div>';
  }
`;
}

// apps/web-app/src/presentation/client-runtime/relational-hub-actions.runtime.ts
function renderRelationalHubActionsRuntimeJs() {
  return `
  function pkPrintHtmlDocument(title, htmlContent) {
    var win = window.open('', '_blank', 'width=840,height=700');
    if (!win) { pkToast('Permite ventanas emergentes para imprimir.'); return; }
    win.document.write('<html><head><title>' + pkEsc(title) + '</title>' +
      '<style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:12px}th{background:#f1f5f9}.head{display:flex;justify-content:space-between;border-bottom:2px solid #1d4ed8;padding-bottom:12px;margin-bottom:14px}</style>' +
      '</head><body>' + htmlContent + '<script>setTimeout(function(){window.print();},350);<\\/script></body></html>');
    win.document.close();
  }

  function pkCloseRelModal() {
    var m = document.getElementById('pk-relational-modal');
    if (m) m.classList.remove('open');
  }

  function pkHandleRelationalHubClick(target) {
    var db = STATE.relDb;
    if (!db) return false;

    if (target.closest('#btn-close-rel-modal')) { pkCloseRelModal(); return true; }
    if (target.closest('[data-open-new-customer-modal]')) { pkOpenNewCustomerModal(); return true; }

    if (target.closest('#btn-modal-save-customer') || target.closest('#btn-inline-save-customer')) {
      var isInl = !!target.closest('#btn-inline-save-customer');
      var pfx = isInl ? 'inline-cust-' : 'modal-cust-';
      var dType = (document.getElementById(pfx + 'doctype') || {}).value || 'CC';
      var nitVal = ((document.getElementById(pfx + 'nit') || {}).value || ('901' + String(Date.now()).slice(-6))).trim();
      var nameVal = ((document.getElementById(pfx + 'name') || {}).value || '').trim();
      if (!nameVal) { pkToast('Escribe el nombre o raz\xF3n social del cliente.'); return true; }
      var phoneVal = ((document.getElementById(pfx + 'phone') || {}).value || '3001234567').trim();
      var emailVal = ((document.getElementById(pfx + 'email') || {}).value || 'cliente@correo.com').trim();
      var cityVal = ((document.getElementById(pfx + 'city') || document.getElementById(pfx + 'address') || {}).value || 'Bogot\xE1').trim();
      var cntId = (document.getElementById(pfx + 'contract') || {}).value || 'cnt-particular';
      var trfId = (document.getElementById(pfx + 'tariff') || {}).value || 'trf-plena';
      var credLim = Number((document.getElementById(pfx + 'credit') || {}).value || 2000000);
      var newCId = 'cust-' + Date.now();
      db.customers.unshift({ id: newCId, docType: dType, nit: nitVal, dv: dType === 'NIT' ? '4' : '', name: nameVal, businessType: dType === 'NIT' ? 'Jur\xEDdica' : 'Natural', taxRegime: dType === 'NIT' ? 'Responsable de IVA' : 'No Responsable', phone: phoneVal, email: emailVal, city: cityVal.split('\u2014')[0].trim(), address: cityVal, contractId: cntId, tariffId: trfId, creditLimit: credLim, currentDebt: 0 });
      STATE.posCustomerId = newCId;
      pkPersistRelationalTx('CREATE_CUSTOMER', { id: newCId, name: nameVal });
      pkCloseRelModal(); pkRenderWorkstation(); pkToast('\u2713 Cliente guardado: ' + nameVal + ' (' + dType + ' ' + nitVal + ')');
      return true;
    }

    var qEntOpen = target.closest('[data-open-quick-entity]');
    if (qEntOpen) { pkOpenQuickEntityModal(qEntOpen.getAttribute('data-open-quick-entity')); return true; }

    var qEntSave = target.closest('[data-save-quick-entity]');
    if (qEntSave) {
      var kindE = qEntSave.getAttribute('data-save-quick-entity');
      var f1 = ((document.getElementById('qe-f1') || {}).value || '').trim();
      var f2 = ((document.getElementById('qe-f2') || {}).value || '').trim();
      var f3 = ((document.getElementById('qe-f3') || {}).value || '').trim();
      var f4 = ((document.getElementById('qe-f4') || {}).value || '').trim();
      if (!f1) { pkToast('Completa el campo principal antes de guardar.'); return true; }
      if (kindE === 'DRIVER') db.drivers.unshift({ id: 'drv-' + Date.now(), name: f1, docNumber: f2 || '79000111', licenseCategory: f3 || 'C3', phone: f4 || '3100000000', assignedPlate: 'WXY-987', status: 'Disponible' });
      else if (kindE === 'CARRIER') db.carriers.unshift({ id: 'car-' + Date.now(), nit: f2 || '900555111-2', name: f1, vehicleType: f3 || 'Tractomula', routeZone: f4 || 'Ruta Nacional', phone: '3150000000' });
      else if (kindE === 'VEHICLE') {
        var cOw = pkFindById(db.customers, f3) || db.customers[0];
        db.vehicles.unshift({ id: 'veh-' + Date.now(), plate: f1.toUpperCase(), brand: f2 || 'Veh\xEDculo', modelYear: '2025', customerId: cOw ? cOw.id : 'cust-1', customerName: cOw ? cOw.name : 'Cliente', currentKm: Number(f4 || 35000), nextOilChangeKm: Number(f4 || 35000) + 5000, soatExpiry: '2026-12-31', tecnoExpiry: '2026-12-31', notes: 'Registrado' });
      } else if (kindE === 'WAREHOUSE') db.warehouses.push({ id: 'wh-' + Date.now(), code: f2 || ('BOD-0' + (db.warehouses.length + 1)), name: f1, city: f3 || 'Bogot\xE1', manager: f4 || 'Jefe Bodega' });
      else if (kindE === 'ROOM') db.hotelRooms.push({ id: 'rm-' + Date.now(), roomNumber: f1, roomType: f2 || 'Est\xE1ndar', nightlyRate: Number(f3 || 140000), floor: f4 || 'Piso 1', status: 'Disponible', guestId: '', guestName: '', checkInDate: '', nights: 0, extrasTotal: 0 });
      pkPersistRelationalTx('QUICK_ENTITY_' + kindE, { name: f1 });
      pkCloseRelModal(); pkRenderWorkstation(); pkToast('\u2713 Registro agregado al cat\xE1logo seleccionable: ' + f1);
      return true;
    }

    if (target.closest('#btn-hotel-checkin')) {
      var rmSel = pkFindById(db.hotelRooms, (document.getElementById('hotel-room-select') || {}).value) || db.hotelRooms[0];
      var gstSel = pkFindById(db.customers, (document.getElementById('hotel-guest-select') || {}).value) || db.customers[0];
      var nts = Math.max(1, Number((document.getElementById('hotel-nights-select') || {}).value || 2));
      if (rmSel && gstSel) {
        rmSel.status = 'Ocupada'; rmSel.guestId = gstSel.id; rmSel.guestName = gstSel.name;
        rmSel.checkInDate = new Date().toISOString().slice(0, 10); rmSel.nights = nts; rmSel.extrasTotal = 0;
        pkPersistRelationalTx('HOTEL_CHECKIN', { roomId: rmSel.id, guestName: gstSel.name });
        pkRenderWorkstation(); pkToast('\u2713 Check-In confirmado: ' + gstSel.name + ' en ' + rmSel.roomNumber);
      }
      return true;
    }
    var hExtra = target.closest('[data-hotel-add-extra]');
    if (hExtra) {
      var rmEx = pkFindById(db.hotelRooms, hExtra.getAttribute('data-hotel-add-extra'));
      if (rmEx) { rmEx.extrasTotal = Number(rmEx.extrasTotal || 0) + 25000; pkRenderWorkstation(); pkToast('+ $25.000 de consumo cargado a ' + rmEx.roomNumber); }
      return true;
    }
    var hOut = target.closest('[data-hotel-checkout-pos]');
    if (hOut) {
      var rmO = pkFindById(db.hotelRooms, hOut.getAttribute('data-hotel-checkout-pos'));
      if (rmO) {
        STATE.posCustomerId = rmO.guestId || (db.customers[0] ? db.customers[0].id : '');
        STATE.posCart = [{ kind: 'SERVICIO', refId: rmO.id, code: 'HOTEL', name: 'Alojamiento ' + rmO.roomNumber + ' (' + rmO.nights + ' noches)', qty: rmO.nights || 1, price: rmO.nightlyRate, taxPct: 19 }];
        if (rmO.extrasTotal > 0) STATE.posCart.push({ kind: 'PRODUCTO', refId: rmO.id, code: 'CONSUMO', name: 'Consumos Extra / Room Service (' + rmO.roomNumber + ')', qty: 1, price: rmO.extrasTotal, taxPct: 8 });
        rmO.status = 'Disponible'; rmO.guestId = ''; rmO.guestName = ''; rmO.extrasTotal = 0;
        STATE.activeServiceKey = 'srv-invoicing'; STATE.activeSubmoduleKey = 'mod-pos'; pkRenderWorkstation();
        pkToast('Cuenta de ' + rmO.roomNumber + ' cargada en Punto de Venta para facturar.');
      }
      return true;
    }
    var restockOpen = target.closest('[data-open-restock-modal]');
    if (restockOpen) { pkOpenRestockModal(restockOpen.getAttribute('data-open-restock-modal')); return true; }
    var restockConf = target.closest('[data-confirm-restock-id]');
    if (restockConf) {
      var prR = pkFindById(db.products, restockConf.getAttribute('data-confirm-restock-id'));
      if (prR) {
        var qIn = Math.max(1, Number((document.getElementById('modal-restock-qty') || {}).value || 10));
        var cIn = Math.max(100, Number((document.getElementById('modal-restock-cost') || {}).value || prR.costPrice));
        var sIn = Math.max(cIn, Number((document.getElementById('modal-restock-sale') || {}).value || prR.salePrice));
        var supIn = (document.getElementById('modal-restock-sup') || {}).value || prR.supplierId;
        var refIn = ((document.getElementById('modal-restock-ref') || {}).value || 'ENTRADA-INV').trim();
        prR.stock = Number(prR.stock || 0) + qIn; prR.costPrice = cIn; prR.salePrice = sIn; prR.supplierId = supIn;
        db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: prR.id, productName: prR.name, warehouseId: prR.warehouseId, movementType: 'ENTRADA_COMPRA', qty: qIn, unitCost: cIn, balanceAfter: prR.stock, referenceDoc: refIn, actor: 'Inventario' });
        pkPersistRelationalTx('PURCHASE_ENTRY', { productCode: prR.code, productName: prR.name, costPrice: cIn, salePrice: sIn, stock: prR.stock });
        pkCloseRelModal(); pkRenderWorkstation(); pkToast('Se agregaron +' + qIn + ' unidades a ' + prR.name);
      }
      return true;
    }

    var trfOpen = target.closest('[data-open-transfer-modal]');
    if (trfOpen) { pkOpenTransferModal(trfOpen.getAttribute('data-open-transfer-modal')); return true; }

    var trfConf = target.closest('[data-confirm-transfer-id]');
    if (trfConf) {
      var prT = pkFindById(db.products, trfConf.getAttribute('data-confirm-transfer-id'));
      if (prT) {
        var whDest = (document.getElementById('modal-transfer-wh') || {}).value || prT.warehouseId;
        var qTrf = Math.max(1, Number((document.getElementById('modal-transfer-qty') || {}).value || 1));
        var ntTrf = ((document.getElementById('modal-transfer-note') || {}).value || 'Traslado').trim();
        prT.warehouseId = whDest;
        db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: prT.id, productName: prT.name, warehouseId: whDest, movementType: 'TRASLADO_BODEGA', qty: qTrf, unitCost: prT.costPrice, balanceAfter: prT.stock, referenceDoc: ntTrf, actor: 'Bodega' });
        pkCloseRelModal(); pkRenderWorkstation(); pkToast('Producto trasladado a la bodega seleccionada.');
      }
      return true;
    }

    var c360 = target.closest('[data-open-customer-360]'); if (c360) { pkOpenCustomer360Modal(c360.getAttribute('data-open-customer-360')); return true; }
    var v360 = target.closest('[data-open-vehicle-360]'); if (v360) { pkOpenVehicle360Modal(v360.getAttribute('data-open-vehicle-360')); return true; }
    var abOpen = target.closest('[data-open-abono-modal]'); if (abOpen) { pkOpenAbonoModal(abOpen.getAttribute('data-open-abono-modal')); return true; }
    var invOpen = target.closest('[data-open-invoice-modal]'); if (invOpen) { pkOpenInvoiceModal(invOpen.getAttribute('data-open-invoice-modal')); return true; }

    var goCustPos = target.closest('[data-pos-select-cust-go]');
    if (goCustPos) { STATE.posCustomerId = goCustPos.getAttribute('data-pos-select-cust-go'); STATE.posVehicleId = ''; STATE.activeServiceKey = 'srv-invoicing'; STATE.activeSubmoduleKey = 'mod-pos'; pkRenderWorkstation(); return true; }

    var loadOrd = target.closest('[data-pos-load-order]');
    if (loadOrd) {
      var wo = pkFindById(db.workOrders, loadOrd.getAttribute('data-pos-load-order'));
      if (wo) {
        STATE.posCustomerId = wo.customerId; STATE.posVehicleId = wo.vehicleId; STATE.posLinkedOrderId = wo.id; STATE.posCart = [];
        for (var s = 0; s < (wo.services || []).length; s++) STATE.posCart.push({ kind: 'SERVICIO', refId: wo.id, code: 'OT-SRV', name: wo.services[s].description + ' (Placa ' + wo.plate + ')', qty: 1, price: Number(wo.services[s].price || 0), taxPct: 0, workerId: wo.workerId, workerName: wo.workerName });
        STATE.activeServiceKey = 'srv-invoicing'; STATE.activeSubmoduleKey = 'mod-pos'; pkRenderWorkstation(); pkToast('Orden ' + wo.id + ' (' + wo.plate + ') lista para cobrar en Caja.');
      }
      return true;
    }

    var loadTbl = target.closest('[data-pos-load-table]');
    if (loadTbl) {
      var tbl = pkFindById(db.diningTables, loadTbl.getAttribute('data-pos-load-table'));
      if (tbl) {
        if (!tbl.items || tbl.items.length === 0) { pkToast('Agrega primero platos o bebidas a la comanda de ' + tbl.name); return true; }
        STATE.posLinkedTableId = tbl.id; STATE.posCart = [];
        for (var ti = 0; ti < tbl.items.length; ti++) STATE.posCart.push({ kind: 'PRODUCTO', refId: tbl.items[ti].productId, code: 'MESA', name: tbl.items[ti].name + ' (' + tbl.name + ')', qty: tbl.items[ti].qty, price: tbl.items[ti].price, taxPct: 8 });
        STATE.activeServiceKey = 'srv-invoicing'; STATE.activeSubmoduleKey = 'mod-pos'; pkRenderWorkstation(); pkToast('Cuenta de ' + tbl.name + ' cargada en Caja para facturar.');
      }
      return true;
    }

    if (target.closest('#btn-pos-add-product')) {
      var skuVal = ((document.getElementById('pos-sku-input') || {}).value || '').trim().toUpperCase();
      var selProdId = (document.getElementById('pos-select-product') || {}).value;
      var qtyP = Math.max(1, Number((document.getElementById('pos-product-qty') || {}).value || 1));
      var prod = null;
      if (skuVal) { for (var pi = 0; pi < db.products.length; pi++) if (db.products[pi].code.toUpperCase() === skuVal) { prod = db.products[pi]; break; } }
      if (!prod) prod = pkFindById(db.products, selProdId) || db.products[0];
      if (prod) { STATE.posCart.push({ kind: 'PRODUCTO', refId: prod.id, code: prod.code, name: prod.name, qty: qtyP, price: prod.salePrice, taxPct: prod.taxPct || 19 }); pkRenderWorkstation(); pkToast('Agregado: ' + prod.name); }
      return true;
    }

    if (target.closest('#btn-pos-add-service')) {
      var sDesc = ((document.getElementById('pos-service-desc') || {}).value || '').trim() || 'Mano de Obra / Servicio';
      var sPrice = Math.max(1000, Number((document.getElementById('pos-service-price') || {}).value || 65000));
      var wkObj = pkFindById(db.workers, (document.getElementById('pos-select-worker') || {}).value) || db.workers[0];
      STATE.posCart.push({ kind: 'SERVICIO', refId: 'SRV-' + Date.now(), code: 'MO', name: sDesc, qty: 1, price: sPrice, taxPct: 0, workerId: wkObj ? wkObj.id : '', workerName: wkObj ? wkObj.name : 'T\xE9cnico' });
      pkRenderWorkstation(); pkToast('Servicio agregado al carrito.'); return true;
    }

    var qDelta = target.closest('[data-pos-qty-delta]');
    if (qDelta) { var idxQ = Number(qDelta.getAttribute('data-pos-idx')); if (STATE.posCart[idxQ]) { STATE.posCart[idxQ].qty = Math.max(1, STATE.posCart[idxQ].qty + Number(qDelta.getAttribute('data-pos-qty-delta'))); pkRenderWorkstation(); } return true; }
    var delCart = target.closest('[data-pos-del-idx]');
    if (delCart) { STATE.posCart.splice(Number(delCart.getAttribute('data-pos-del-idx')), 1); pkRenderWorkstation(); return true; }

    return pkHandleSecondaryHubActions(target, db);
  }
`;
}

// apps/web-app/src/presentation/client-runtime/relational-hub-secondary-actions.runtime.ts
function renderRelationalHubSecondaryActionsRuntimeJs() {
  return `
  function pkHandleSecondaryHubActions(target, db) {
    if (pkHandleGastroAndInventoryActions(target, db)) return true;

    if (target.closest('#btn-pos-checkout-invoice')) {
      if (STATE.posCart.length === 0) { pkToast('Agrega al menos un producto o servicio para facturar.'); return true; }
      var cust = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
      var veh = pkFindById(db.vehicles, STATE.posVehicleId);
      var contract = cust && cust.contractId ? pkFindById(db.contracts, cust.contractId) : null;
      var tariff = cust && cust.tariffId ? pkFindById(db.tariffs, cust.tariffId) : null;
      var discPct = tariff ? Number(tariff.discountPct || 0) : 0;
      var subT = 0; var discT = 0; var taxT = 0;
      for (var c = 0; c < STATE.posCart.length; c++) {
        var item = STATE.posCart[c]; var gross = item.price * item.qty; var disc = Math.round(gross * (discPct / 100)); var net = gross - disc;
        subT += gross; discT += disc; taxT += Math.round(net * (Number(item.taxPct || 0) / 100));
        if (item.kind === 'PRODUCTO') {
          var prObj = pkFindById(db.products, item.refId);
          if (prObj) { prObj.stock = Math.max(0, Number(prObj.stock || 0) - item.qty); db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: prObj.id, productName: prObj.name, warehouseId: prObj.warehouseId, movementType: 'SALIDA_VENTA', qty: -item.qty, unitCost: prObj.costPrice, balanceAfter: prObj.stock, referenceDoc: 'POS-FACT', actor: cust ? cust.name : 'Caja' }); }
        } else if (item.kind === 'SERVICIO' && item.workerId) {
          var wkTarget = pkFindById(db.workers, item.workerId); if (wkTarget) wkTarget.totalDayGross = Number(wkTarget.totalDayGross || 0) + net;
        }
      }
      var totalNet = subT - discT + taxT;
      var payMethod = (document.getElementById('pos-payment-method') || {}).value || STATE.posPaymentMethod || 'Efectivo';
      var cashInputVal = Number((document.getElementById('pos-cash-received') || {}).value || 0);
      var isCredit = payMethod.indexOf('Cr\xE9dito') !== -1;
      var paidNow = isCredit ? Math.min(totalNet, Math.max(0, cashInputVal)) : totalNet;
      var pendingBal = isCredit ? Math.max(0, totalNet - paidNow) : 0;
      if (contract) { contract.consumedAmount += totalNet; contract.availableBalance = Math.max(0, contract.budgetCeiling - contract.consumedAmount); }
      if (cust && pendingBal > 0) cust.currentDebt = Number(cust.currentDebt || 0) + pendingBal;
      if (STATE.posLinkedOrderId) { var linkedWo = pkFindById(db.workOrders, STATE.posLinkedOrderId); if (linkedWo) linkedWo.status = 'Facturado'; STATE.posLinkedOrderId = ''; }
      if (STATE.posLinkedTableId) { var linkedTb = pkFindById(db.diningTables, STATE.posLinkedTableId); if (linkedTb) { linkedTb.status = 'Libre'; linkedTb.items = []; linkedTb.total = 0; linkedTb.diners = 0; } STATE.posLinkedTableId = ''; }
      var invId = 'FEVP-' + (9011 + db.invoices.length);
      db.invoices.unshift({ id: invId, cufe: 'CUFE-' + Date.now(), date: new Date().toISOString().slice(0, 16).replace('T', ' '), customerId: cust ? cust.id : 'cust-1', customerName: cust ? cust.name : 'Consumidor Final', customerNit: cust ? cust.nit : '222222222222', contractId: contract ? contract.id : '', vehicleId: veh ? veh.id : '', plate: veh ? veh.plate : 'MOSTRADOR', items: STATE.posCart.slice(), subtotal: subT, discountTotal: discT, taxTotal: taxT, total: totalNet, paymentMethod: payMethod, amountPaid: paidNow, pendingBalance: pendingBal, status: pendingBal > 0 ? 'Pendiente CxC' : 'Pagada', glosaStatus: 'Sin Glosa', abonosHistory: paidNow > 0 ? [{ id: 'RC-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 10), amount: paidNow, method: payMethod, note: 'Pago en Caja' }] : [] });
      STATE.posCart = []; pkPersistRelationalTx('CREATE_INVOICE', { invoiceId: invId, total: totalNet }); pkRenderWorkstation(); pkToast('Factura ' + invId + ' emitida con \xE9xito.');
      return true;
    }

    if (target.closest('#btn-pos-print-quote')) {
      var custQ = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
      var rowsQ = ''; var sumQ = 0;
      for (var q = 0; q < STATE.posCart.length; q++) { var itQ = STATE.posCart[q]; var subQ = itQ.qty * itQ.price; sumQ += subQ; rowsQ += '<tr><td>' + pkEsc(itQ.kind) + '</td><td>' + pkEsc(itQ.name) + '</td><td>' + itQ.qty + '</td><td>' + pkCop(itQ.price) + '</td><td>' + pkCop(subQ) + '</td></tr>'; }
      pkPrintHtmlDocument('Cotizaci\xF3n Formal', '<div class="head"><div><h2>COTIZACI\xD3N COMERCIAL</h2></div><div><strong>Cliente:</strong> ' + pkEsc(custQ ? custQ.name : '') + '<br/><strong>NIT/CC:</strong> ' + pkEsc(custQ ? custQ.nit : '') + '</div></div><table><thead><tr><th>Tipo</th><th>Concepto</th><th>Cant.</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + rowsQ + '</tbody></table><h3 style="text-align:right;margin-top:16px">Total Cotizado: ' + pkCop(sumQ) + '</h3>');
      return true;
    }
    var prInv = target.closest('[data-print-invoice]');
    if (prInv) {
      var invP = pkFindById(db.invoices, prInv.getAttribute('data-print-invoice'));
      if (invP) {
        var rowsI = '';
        for (var ii = 0; ii < (invP.items || []).length; ii++) { var itI = invP.items[ii]; rowsI += '<tr><td>' + pkEsc(itI.kind) + '</td><td>' + pkEsc(itI.name) + '</td><td>' + itI.qty + '</td><td>' + pkCop(itI.price) + '</td><td>' + pkCop(itI.qty * itI.price) + '</td></tr>'; }
        pkPrintHtmlDocument('Factura ' + invP.id, '<div class="head"><div><h2>FACTURA DE VENTA ' + pkEsc(invP.id) + '</h2></div><div><strong>Cliente:</strong> ' + pkEsc(invP.customerName) + '<br/><strong>NIT:</strong> ' + pkEsc(invP.customerNit) + '</div></div><table><thead><tr><th>Tipo</th><th>Descripci\xF3n</th><th>Cant.</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + rowsI + '</tbody></table><h3 style="text-align:right;margin-top:16px">Total: ' + pkCop(invP.total) + ' | Saldo Pendiente: ' + pkCop(invP.pendingBalance) + '</h3>');
      }
      return true;
    }
    if (target.closest('#btn-pos-whatsapp-quote')) {
      var custW = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
      var phoneW = (custW && custW.phone ? custW.phone : '3001234567').replace(/\\D/g, '');
      var totalW = 0; for (var w = 0; w < STATE.posCart.length; w++) totalW += STATE.posCart[w].qty * STATE.posCart[w].price;
      window.open('https://wa.me/57' + phoneW + '?text=' + encodeURIComponent('Hola ' + (custW ? custW.name : '') + ', tu cotizaci\xF3n es por valor de ' + pkCop(totalW) + '.'), '_blank');
      return true;
    }
    var woWa = target.closest('[data-wo-whatsapp]');
    if (woWa) {
      var ordW = pkFindById(db.workOrders, woWa.getAttribute('data-wo-whatsapp'));
      if (ordW) window.open('https://wa.me/573104558899?text=' + encodeURIComponent('Hola ' + ordW.customerName + ', tu veh\xEDculo placa ' + ordW.plate + ' est\xE1 en estado: ' + ordW.status + '. Total: ' + pkCop(ordW.totalEstimated)), '_blank');
      return true;
    }
    var prHot = target.closest('[data-print-hotel-room]');
    if (prHot) {
      var rmP = pkFindById(db.hotelRooms, prHot.getAttribute('data-print-hotel-room'));
      if (rmP) { var stayT = (Number(rmP.nights || 1) * Number(rmP.nightlyRate || 0)) + Number(rmP.extrasTotal || 0); pkPrintHtmlDocument('Cuenta Hotelera ' + rmP.roomNumber, '<div class="head"><div><h2>REGISTRO Y ESTADO DE CUENTA HOTELERA</h2><div>' + pkEsc(rmP.roomNumber + ' \u2014 ' + rmP.roomType + ' (' + rmP.floor + ')') + '</div></div><div><strong>Estado:</strong> ' + pkEsc(rmP.status) + '<br/><strong>Fecha:</strong> ' + pkEsc(rmP.checkInDate || new Date().toISOString().slice(0, 10)) + '</div></div><table><thead><tr><th>Concepto</th><th>Hu\xE9sped</th><th>Cant. Noches</th><th>Tarifa / Noche</th><th>Consumos Extra</th><th>Total</th></tr></thead><tbody><tr><td>Alojamiento y Servicios</td><td>' + pkEsc(rmP.guestName || 'Disponible') + '</td><td>' + (rmP.nights || 1) + '</td><td>' + pkCop(rmP.nightlyRate) + '</td><td>' + pkCop(rmP.extrasTotal || 0) + '</td><td><strong>' + pkCop(stayT) + '</strong></td></tr></tbody></table>'); }
      return true;
    }
    var prWo = target.closest('[data-print-wo]');
    if (prWo) { var woP = pkFindById(db.workOrders, prWo.getAttribute('data-print-wo')); if (woP) pkPrintHtmlDocument('Orden de Servicio ' + woP.id, '<div class="head"><div><h2>ORDEN DE TRABAJO ' + pkEsc(woP.id) + '</h2><div>Placa: <strong>' + pkEsc(woP.plate) + '</strong> \xB7 ' + pkEsc(woP.vehicleBrand) + '</div></div><div><strong>Cliente:</strong> ' + pkEsc(woP.customerName) + '<br/><strong>T\xE9cnico:</strong> ' + pkEsc(woP.workerName) + '</div></div><table><thead><tr><th>Estado</th><th>Km Ingreso</th><th>Pr\xF3ximo Cambio</th><th>Servicio Realizado</th><th>Total Estimado</th></tr></thead><tbody><tr><td>' + pkEsc(woP.status) + '</td><td>' + woP.currentKm + ' km</td><td>' + woP.nextOilKm + ' km</td><td>' + pkEsc((woP.services && woP.services[0]) ? woP.services[0].description : 'Mantenimiento') + '</td><td><strong>' + pkCop(woP.totalEstimated) + '</strong></td></tr></tbody></table>'); return true; }
    var prVeh = target.closest('[data-print-veh]');
    if (prVeh) { var vhP = pkFindById(db.vehicles, prVeh.getAttribute('data-print-veh')); if (vhP) pkPrintHtmlDocument('Ficha Veh\xEDculo ' + vhP.plate, '<div class="head"><div><h2>HOJA DE VIDA DE VEH\xCDCULO \u2014 ' + pkEsc(vhP.plate) + '</h2></div><div><strong>Propietario:</strong> ' + pkEsc(vhP.customerName) + '</div></div><table><thead><tr><th>Placa</th><th>Marca / L\xEDnea</th><th>Km Actual</th><th>Pr\xF3x. Aceite</th><th>Venc. SOAT</th><th>Observaciones</th></tr></thead><tbody><tr><td>' + pkEsc(vhP.plate) + '</td><td>' + pkEsc(vhP.brand) + '</td><td>' + vhP.currentKm + ' km</td><td>' + vhP.nextOilChangeKm + ' km</td><td>' + pkEsc(vhP.soatExpiry) + '</td><td>' + pkEsc(vhP.notes) + '</td></tr></tbody></table>'); return true; }
    var prCust = target.closest('[data-print-customer]');
    if (prCust) { var csP = pkFindById(db.customers, prCust.getAttribute('data-print-customer')); if (csP) pkPrintHtmlDocument('Ficha Cliente ' + csP.name, '<div class="head"><div><h2>FICHA Y ESTADO DE CUENTA DE CLIENTE</h2></div><div><strong>Documento:</strong> ' + pkEsc(csP.docType + ' ' + csP.nit) + '</div></div><table><thead><tr><th>Cliente / Raz\xF3n Social</th><th>Tel\xE9fono</th><th>Ciudad</th><th>Cupo Cr\xE9dito</th><th>Saldo Pendiente CxC</th></tr></thead><tbody><tr><td>' + pkEsc(csP.name) + '</td><td>' + pkEsc(csP.phone) + '</td><td>' + pkEsc(csP.city) + '</td><td>' + pkCop(csP.creditLimit) + '</td><td><strong>' + pkCop(csP.currentDebt) + '</strong></td></tr></tbody></table>'); return true; }
    var prGst = target.closest('[data-print-gastro-table]');
    if (prGst) {
      var tbP = pkFindById(db.diningTables, prGst.getAttribute('data-print-gastro-table'));
      if (tbP) { var rG = ''; for (var gi = 0; gi < (tbP.items || []).length; gi++) { var itG = tbP.items[gi]; rG += '<tr><td>' + pkEsc(itG.name) + '</td><td>' + itG.qty + '</td><td>' + pkEsc(itG.note || 'Est\xE1ndar') + '</td><td>' + pkCop(itG.price) + '</td><td>' + pkCop(itG.qty * itG.price) + '</td></tr>'; } pkPrintHtmlDocument('Comanda ' + tbP.name, '<div class="head"><div><h2>PRECUENTA / COMANDA \u2014 ' + pkEsc(tbP.name) + '</h2></div><div><strong>Mesero:</strong> ' + pkEsc(tbP.waiter || 'Turno') + '</div></div><table><thead><tr><th>Plato / Bebida</th><th>Cant.</th><th>Preparaci\xF3n</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + rG + '</tbody></table><h3 style="text-align:right;margin-top:14px">Total Mesa: ' + pkCop(tbP.total) + '</h3>'); }
      return true;
    }
    var prPrd = target.closest('[data-print-product]');
    if (prPrd) { var pdP = pkFindById(db.products, prPrd.getAttribute('data-print-product')); if (pdP) pkPrintHtmlDocument('Ficha Producto ' + pdP.code, '<div class="head"><div><h2>FICHA KARDEX DE PRODUCTO \u2014 ' + pkEsc(pdP.code) + '</h2></div></div><table><thead><tr><th>SKU</th><th>Producto</th><th>Costo</th><th>Precio Venta</th><th>Existencia Actual</th></tr></thead><tbody><tr><td>' + pkEsc(pdP.code) + '</td><td>' + pkEsc(pdP.name) + '</td><td>' + pkCop(pdP.costPrice) + '</td><td>' + pkCop(pdP.salePrice) + '</td><td><strong>' + pdP.stock + ' und</strong></td></tr></tbody></table>'); return true; }
    if (target.closest('#btn-print-inventory-all')) {
      var rInvAll = ''; for (var ia = 0; ia < db.products.length; ia++) { var pa = db.products[ia]; rInvAll += '<tr><td>' + pkEsc(pa.code) + '</td><td>' + pkEsc(pa.name) + '</td><td>' + pkCop(pa.costPrice) + '</td><td>' + pkCop(pa.salePrice) + '</td><td>' + pa.stock + ' und</td></tr>'; }
      pkPrintHtmlDocument('Inventario General Valorizado', '<div class="head"><div><h2>REPORTE DE INVENTARIO VALORIZADO</h2></div><div><strong>Total Referencias:</strong> ' + db.products.length + '</div></div><table><thead><tr><th>C\xF3digo</th><th>Producto</th><th>Costo</th><th>Precio Venta</th><th>Stock</th></tr></thead><tbody>' + rInvAll + '</tbody></table>'); return true;
    }
    if (target.closest('#btn-print-cashbox') || target.closest('[data-print-expense]') || target.closest('[data-print-contract]') || target.closest('[data-print-supplier]') || target.closest('[data-print-worker]')) {
      var mCash = pkComputeCashMetrics(db); pkPrintHtmlDocument('Comprobante Operativo / Arqueo', '<div class="head"><div><h2>COMPROBANTE OFICIAL Y ARQUEO DE OPERACI\xD3N</h2></div><div><strong>Fecha:</strong> ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '</div></div><table><thead><tr><th>Total Facturado</th><th>Efectivo Neto en Caja</th><th>Pagos Digitales</th><th>Total Gastos</th><th>Cartera CxC</th></tr></thead><tbody><tr><td>' + pkCop(mCash.totalInvoiced) + '</td><td><strong>' + pkCop(mCash.netCash) + '</strong></td><td>' + pkCop(mCash.digitalIn) + '</td><td>-' + pkCop(mCash.totalExpenses) + '</td><td>' + pkCop(mCash.totalCxc) + '</td></tr></tbody></table>'); return true;
    }
    var stdPrRow = target.closest('[data-std-print-idx]');
    if (stdPrRow) {
      var rIdx = Number(stdPrRow.getAttribute('data-std-print-idx')); var rowsList = STATE.submoduleRows[STATE.activeSubmoduleKey] || []; var rData = rowsList[rIdx];
      if (rData) { var bodyCells = ''; for (var rc = 0; rc < rData.length; rc++) bodyCells += '<td>' + pkEsc(rData[rc]) + '</td>'; pkPrintHtmlDocument('Comprobante ' + rData[0], '<div class="head"><div><h2>COMPROBANTE OFICIAL DE REGISTRO \u2014 ' + pkEsc(rData[0]) + '</h2></div><div><strong>Fecha Impresi\xF3n:</strong> ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '</div></div><table><tbody><tr>' + bodyCells + '</tr></tbody></table>'); }
      return true;
    }
    if (target.closest('#btn-std-print-table')) { var tblEl = document.querySelector('#ws-module-stage table'); pkPrintHtmlDocument('Listado Oficial de M\xF3dulo', '<div class="head"><div><h2>REPORTE IMPRESO DE M\xD3DULO</h2></div><div><strong>Fecha:</strong> ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '</div></div>' + (tblEl ? tblEl.outerHTML : '')); return true; }
    if (target.closest('#btn-wo-suggest-oil')) { var curKm = Number((document.getElementById('wo-current-km') || {}).value || 45000); var nextEl = document.getElementById('wo-next-oil-km'); if (nextEl) nextEl.value = String(curKm + 3000); pkToast('Pr\xF3ximo cambio sugerido a los ' + (curKm + 3000).toLocaleString('es-CO') + ' km.'); return true; }
    if (target.closest('#btn-wo-create-order')) {
      var custObj = pkFindById(db.customers, (document.getElementById('wo-customer-id') || {}).value) || db.customers[0];
      var plate = ((document.getElementById('wo-plate') || {}).value || 'ABC-123').trim().toUpperCase();
      var curK = Number((document.getElementById('wo-current-km') || {}).value || 45000);
      var nxtK = Number((document.getElementById('wo-next-oil-km') || {}).value || (curK + 3000));
      var wkObj = pkFindById(db.workers, (document.getElementById('wo-worker-id') || {}).value) || db.workers[0];
      var rawSvc = ((document.getElementById('wo-service-desc') || {}).value || 'Mantenimiento Preventivo|140000');
      var sDesc = rawSvc.split('|')[0];
      var sPrc = Number((document.getElementById('wo-service-price') || {}).value || rawSvc.split('|')[1] || 140000);
      var vehObj = null;
      for (var v = 0; v < db.vehicles.length; v++) if (db.vehicles[v].plate.toUpperCase() === plate) { vehObj = db.vehicles[v]; break; }
      var brand = vehObj ? vehObj.brand : 'Veh\xEDculo Registrado';
      if (vehObj) { vehObj.currentKm = curK; vehObj.nextOilChangeKm = nxtK; }
      var newWoId = 'OT-' + (3043 + db.workOrders.length);
      db.workOrders.unshift({ id: newWoId, createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '), customerId: custObj ? custObj.id : 'cust-1', customerName: custObj ? custObj.name : 'Cliente', vehicleId: vehObj ? vehObj.id : 'veh-1', plate: plate, vehicleBrand: brand, currentKm: curK, nextOilKm: nxtK, workerId: wkObj ? wkObj.id : 'wk-1', workerName: wkObj ? wkObj.name : 'T\xE9cnico', status: 'Recibido', services: [{ description: sDesc, price: sPrc }], totalEstimated: sPrc });
      pkPersistRelationalTx('CREATE_WORK_ORDER', { orderId: newWoId, plate: plate }); pkRenderWorkstation(); pkToast('Orden ' + newWoId + ' (' + plate + ') registrada.'); return true;
    }
    var woMove = target.closest('[data-wo-move]');
    if (woMove) {
      var ordM = pkFindById(db.workOrders, woMove.getAttribute('data-wo-move'));
      var nextStg = woMove.getAttribute('data-wo-stage');
      if (ordM && nextStg) { ordM.status = nextStg; pkPersistRelationalTx('MOVE_WORK_ORDER', { orderId: ordM.id, stage: nextStg }); pkRenderWorkstation(); pkToast('Orden ' + ordM.id + ' pasada a: ' + nextStg); }
      return true;
    }
    var invDelta = target.closest('[data-inv-delta]');
    if (invDelta) {
      var prD = pkFindById(db.products, invDelta.getAttribute('data-inv-id'));
      var dStock = Number(invDelta.getAttribute('data-inv-delta'));
      if (prD) {
        prD.stock = Math.max(0, Number(prD.stock || 0) + dStock);
        db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: prD.id, productName: prD.name, warehouseId: prD.warehouseId, movementType: dStock > 0 ? 'ENTRADA_RAPIDA' : 'SALIDA_RAPIDA', qty: dStock, unitCost: prD.costPrice, balanceAfter: prD.stock, referenceDoc: 'AJUSTE', actor: 'Operador' });
        pkPersistRelationalTx('ADJUST_STOCK', { productId: prD.id, stock: prD.stock }); pkRenderWorkstation();
      }
      return true;
    }
    if (target.closest('#btn-inv-register-purchase')) {
      var pSel = (document.getElementById('inv-entry-product-id') || {}).value;
      var supId = (document.getElementById('inv-entry-supplier-id') || {}).value;
      var whId = (document.getElementById('inv-entry-warehouse-id') || {}).value;
      var refDoc = ((document.getElementById('inv-entry-invoice-ref') || {}).value || 'FAC-COMPRA').trim();
      var qtyIn = Math.max(1, Number((document.getElementById('inv-entry-qty') || {}).value || 10));
      var costIn = Math.max(100, Number((document.getElementById('inv-entry-cost') || {}).value || 35000));
      var saleIn = Math.max(costIn, Number((document.getElementById('inv-entry-sale') || {}).value || 58000));
      var targetProd = pkFindById(db.products, pSel) || db.products[0];
      if (targetProd) {
        targetProd.stock = Number(targetProd.stock || 0) + qtyIn; targetProd.costPrice = costIn; targetProd.salePrice = saleIn; targetProd.warehouseId = whId; targetProd.supplierId = supId;
        db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: targetProd.id, productName: targetProd.name, warehouseId: whId, movementType: 'ENTRADA_COMPRA', qty: qtyIn, unitCost: costIn, balanceAfter: targetProd.stock, referenceDoc: refDoc, actor: 'Compras' });
        pkPersistRelationalTx('PURCHASE_ENTRY', { productCode: targetProd.code, productName: targetProd.name, costPrice: costIn, salePrice: saleIn, stock: targetProd.stock });
        pkRenderWorkstation(); pkToast('Compra ingresada: +' + qtyIn + ' und a ' + targetProd.name);
      }
      return true;
    }
    var abConf = target.closest('[data-confirm-abono-inv]');
    if (abConf) {
      var invAb = pkFindById(db.invoices, abConf.getAttribute('data-confirm-abono-inv'));
      if (invAb) {
        var amt = Math.min(invAb.pendingBalance, Math.max(1000, Number((document.getElementById('modal-abono-amount') || {}).value || invAb.pendingBalance)));
        var mth = (document.getElementById('modal-abono-method') || {}).value || 'Efectivo';
        var nt = ((document.getElementById('modal-abono-note') || {}).value || 'Abono').trim();
        invAb.amountPaid = Number(invAb.amountPaid || 0) + amt; invAb.pendingBalance = Math.max(0, Number(invAb.pendingBalance || 0) - amt);
        invAb.status = invAb.pendingBalance === 0 ? 'Pagada' : 'Pendiente CxC';
        if (!invAb.abonosHistory) invAb.abonosHistory = [];
        invAb.abonosHistory.unshift({ id: 'RC-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 10), amount: amt, method: mth, note: nt });
        var custAb = pkFindById(db.customers, invAb.customerId); if (custAb) custAb.currentDebt = Math.max(0, Number(custAb.currentDebt || 0) - amt);
        pkPersistRelationalTx('REGISTER_ABONO', { invoiceId: invAb.id, amount: amt }); pkOpenAbonoModal(invAb.id); pkRenderWorkstation(); pkToast('Abono por ' + pkCop(amt) + ' registrado.');
      }
      return true;
    }
    return false;
  }
`;
}

// apps/web-app/src/presentation/client-runtime/relational-modals.runtime.ts
function renderRelationalModalsRuntimeJs() {
  return `
  function pkOpenModal(title, sub, bodyHtml) {
    var modal = document.getElementById('pk-relational-modal');
    var tEl = document.getElementById('pk-rel-modal-title');
    var sEl = document.getElementById('pk-rel-modal-sub');
    var bEl = document.getElementById('pk-rel-modal-body');
    if (!modal || !bEl) return;
    if (tEl) tEl.textContent = title;
    if (sEl) sEl.textContent = sub;
    bEl.innerHTML = bodyHtml;
    modal.classList.add('open');
  }

  function pkOpenQuickEntityModal(kind) {
    var db = STATE.relDb;
    if (kind === 'DRIVER') {
      var carOpts = ''; for (var c = 0; c < db.carriers.length; c++) carOpts += '<option value="' + pkEsc(db.carriers[c].name) + '">' + pkEsc(db.carriers[c].name) + '</option>';
      var vehOpts = ''; for (var v = 0; v < db.vehicles.length; v++) vehOpts += '<option value="' + pkEsc(db.vehicles[v].plate) + '">' + pkEsc(db.vehicles[v].plate + ' \u2014 ' + db.vehicles[v].brand) + '</option>';
      pkOpenModal('\u{1F69B} Registrar Nuevo Conductor', 'Se guarda en la tabla de Conductores y queda seleccionable en B\xE1scula y Despachos',
        '<div class="form-grid"><div class="field"><label>C\xE9dula del Conductor *</label><input type="text" id="qe-drv-doc" placeholder="Ej: 72.184.990" /></div>' +
        '<div class="field"><label>Nombre Completo *</label><input type="text" id="qe-drv-name" placeholder="Ej: Hernando Valencia R\xEDos" /></div>' +
        '<div class="field"><label>Categor\xEDa Licencia</label><select id="qe-drv-lic"><option>C3 Tractocami\xF3n / Pesados</option><option>C2 Cami\xF3n R\xEDgido</option><option>C1 Servicio P\xFAblico</option></select></div>' +
        '<div class="field"><label>Tel\xE9fono / Celular</label><input type="text" id="qe-drv-phone" placeholder="Ej: 310 884 2211" /></div>' +
        '<div class="field"><label>Empresa Transportista</label><select id="qe-drv-carrier">' + carOpts + '</select></div>' +
        '<div class="field"><label>Placa Asignada</label><select id="qe-drv-plate">' + vehOpts + '</select></div></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="btn btn-emerald" data-save-quick-entity="DRIVER">\u2713 Guardar Conductor</button></div>');
      return;
    }
    if (kind === 'CARRIER') {
      pkOpenModal('\u{1F3E2} Registrar Nueva Empresa Transportista', 'Se guarda en la tabla de Transportistas para Traslados y B\xE1scula',
        '<div class="form-grid"><div class="field"><label>NIT Transportista *</label><input type="text" id="qe-car-nit" placeholder="Ej: 900.771.220-8" /></div>' +
        '<div class="field"><label>Raz\xF3n Social *</label><input type="text" id="qe-car-name" placeholder="Ej: Transportes del Caribe S.A.S." /></div>' +
        '<div class="field"><label>Ciudad Base</label><select id="qe-car-city"><option>Barranquilla</option><option>Bogot\xE1 D.C.</option><option>Medell\xEDn</option><option>Cali</option><option>Cartagena</option><option>Buenaventura</option></select></div>' +
        '<div class="field"><label>Tel\xE9fono Despachos</label><input type="text" id="qe-car-phone" placeholder="Ej: 300 441 9080" /></div></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="btn btn-emerald" data-save-quick-entity="CARRIER">\u2713 Guardar Transportista</button></div>');
      return;
    }
    if (kind === 'VEHICLE') {
      var custOpts = ''; for (var cu = 0; cu < db.customers.length; cu++) custOpts += '<option value="' + pkEsc(db.customers[cu].id) + '">' + pkEsc(db.customers[cu].name) + '</option>';
      pkOpenModal('\u{1F697} Registrar Nueva Placa / Veh\xEDculo', 'Disponible en Taller, Facturaci\xF3n y B\xE1scula Camionera',
        '<div class="form-grid"><div class="field"><label>Placa / Matr\xEDcula *</label><input type="text" id="qe-veh-plate" placeholder="Ej: SXT-942" style="text-transform:uppercase;font-weight:800" /></div>' +
        '<div class="field"><label>Marca y L\xEDnea *</label><input type="text" id="qe-veh-brand" placeholder="Ej: Kenworth T800 / Toyota Hilux" /></div>' +
        '<div class="field"><label>Propietario / Empresa</label><select id="qe-veh-cust">' + custOpts + '</select></div>' +
        '<div class="field"><label>Kilometraje Actual</label><input type="number" id="qe-veh-km" value="45000" /></div></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="btn btn-emerald" data-save-quick-entity="VEHICLE">\u2713 Guardar Placa / Veh\xEDculo</button></div>');
      return;
    }
    if (kind === 'WAREHOUSE') {
      var wkOpts = ''; for (var w = 0; w < db.workers.length; w++) wkOpts += '<option value="' + pkEsc(db.workers[w].name) + '">' + pkEsc(db.workers[w].name) + '</option>';
      pkOpenModal('\u{1F3ED} Registrar Nueva Bodega o Sucursal', 'Se guarda en la tabla de Bodegas para Inventario y Traslados',
        '<div class="form-grid"><div class="field"><label>Nombre de la Bodega *</label><input type="text" id="qe-wh-name" placeholder="Ej: Bodega Sur / Almac\xE9n Central" /></div>' +
        '<div class="field"><label>Ciudad / Ubicaci\xF3n</label><select id="qe-wh-city"><option>Sede Principal</option><option>Bogot\xE1 D.C.</option><option>Medell\xEDn</option><option>Cali</option><option>Barranquilla</option></select></div>' +
        '<div class="field"><label>Responsable de Bodega</label><select id="qe-wh-mgr">' + wkOpts + '</select></div></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="btn btn-emerald" data-save-quick-entity="WAREHOUSE">\u2713 Guardar Bodega</button></div>');
      return;
    }
    if (kind === 'ROOM') {
      pkOpenModal('\u{1F6CF}\uFE0F Registrar Nueva Habitaci\xF3n / Caba\xF1a', 'Se agrega al inventario de Alojamiento y Recepci\xF3n',
        '<div class="form-grid"><div class="field"><label>N\xFAmero o Nombre *</label><input type="text" id="qe-rm-num" placeholder="Ej: Habitaci\xF3n 205 / Caba\xF1a 05" /></div>' +
        '<div class="field"><label>Tipo de Acomodaci\xF3n</label><select id="qe-rm-type"><option>Sencilla Ejecutiva</option><option>Doble Superior</option><option>Suite Familiar</option><option>Caba\xF1a Campestre</option></select></div>' +
        '<div class="field"><label>Ubicaci\xF3n / Piso</label><select id="qe-rm-floor"><option>Piso 1</option><option>Piso 2</option><option>Piso 3</option><option>Zona Campestre</option></select></div>' +
        '<div class="field"><label>Tarifa por Noche ($)</label><input type="number" id="qe-rm-rate" value="180000" /></div></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="btn btn-emerald" data-save-quick-entity="ROOM">\u2713 Guardar Habitaci\xF3n</button></div>');
      return;
    }
  }

  function pkOpenNewCustomerModal() {
    var db = STATE.relDb;
    var cntOpts = ''; for (var c = 0; c < db.contracts.length; c++) cntOpts += '<option value="' + pkEsc(db.contracts[c].id) + '">' + pkEsc(db.contracts[c].code + ' \u2014 ' + db.contracts[c].entityName) + '</option>';
    var trfOpts = ''; for (var t = 0; t < db.tariffs.length; t++) trfOpts += '<option value="' + pkEsc(db.tariffs[t].id) + '">' + pkEsc(db.tariffs[t].name + ' (-' + db.tariffs[t].discountPct + '%)') + '</option>';
    pkOpenModal('\u{1F464} Registrar Nuevo Cliente', 'Se guarda en la tabla de Clientes y queda seleccionado autom\xE1ticamente',
      '<div class="form-grid" style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Tipo de Documento</label><select id="modal-cust-doctype"><option value="NIT">NIT Empresa</option><option value="CC">C\xE9dula (CC)</option><option value="CE">C\xE9dula Extranjer\xEDa</option></select></div>' +
      '<div class="field"><label>N\xFAmero de Documento / NIT *</label><input type="text" id="modal-cust-nit" placeholder="Ej: 901452110" /></div>' +
      '<div class="field"><label>Nombre Completo o Raz\xF3n Social *</label><input type="text" id="modal-cust-name" placeholder="Ej: Comercializadora del Norte S.A.S." /></div>' +
      '<div class="field"><label>Tel\xE9fono / WhatsApp</label><input type="text" id="modal-cust-phone" placeholder="Ej: 315 890 1122" /></div>' +
      '<div class="field"><label>Correo Electr\xF3nico</label><input type="email" id="modal-cust-email" placeholder="cliente@correo.com" /></div>' +
      '<div class="field"><label>Ciudad</label><select id="modal-cust-address"><option>Bogot\xE1 D.C.</option><option>Medell\xEDn</option><option>Cali</option><option>Barranquilla</option><option>Cartagena</option><option>Bucaramanga</option></select></div>' +
      '<div class="field"><label>Convenio / Contrato</label><select id="modal-cust-contract">' + cntOpts + '</select></div>' +
      '<div class="field"><label>Lista de Precios / Tarifa</label><select id="modal-cust-tariff">' + trfOpts + '</select></div>' +
      '<div class="field"><label>Cupo de Cr\xE9dito Autorizado</label><select id="modal-cust-credit"><option value="0">Contado ($0)</option><option value="2000000">$2.000.000 COP</option><option value="5000000" selected>$5.000.000 COP</option><option value="20000000">$20.000.000 COP</option></select></div></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button type="button" class="btn btn-emerald" id="btn-modal-save-customer">\u2713 Guardar Cliente y Seleccionar</button></div>');
  }

  function pkOpenRestockModal(prodId) {
    var db = STATE.relDb; var prod = pkFindById(db.products, prodId) || db.products[0]; if (!prod) return;
    var supOpts = ''; for (var s = 0; s < db.suppliers.length; s++) supOpts += '<option value="' + pkEsc(db.suppliers[s].id) + '">' + pkEsc(db.suppliers[s].name) + '</option>';
    pkOpenModal('\u{1F4E5} Surtir Inventario \u2014 ' + prod.name, 'C\xF3digo: ' + prod.code + ' \xB7 Existencia actual: ' + prod.stock + ' und',
      '<div class="form-grid" style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Cantidad que Entra (+)</label><input type="number" id="modal-restock-qty" value="12" min="1" /></div>' +
      '<div class="field"><label>Costo Unitario Compra ($)</label><input type="number" id="modal-restock-cost" value="' + prod.costPrice + '" /></div>' +
      '<div class="field"><label>Precio de Venta ($)</label><input type="number" id="modal-restock-sale" value="' + prod.salePrice + '" /></div>' +
      '<div class="field"><label>Proveedor</label><select id="modal-restock-sup">' + supOpts + '</select></div>' +
      '<div class="field"><label>Soporte (Autom\xE1tico)</label><input type="text" id="modal-restock-ref" value="ENT-' + String(Date.now()).slice(-4) + '" readonly style="background:#e2e8f0" /></div>' +
      '<div class="field"><button type="button" class="btn btn-emerald" style="width:100%" data-confirm-restock-id="' + pkEsc(prod.id) + '">\u2713 Ingresar Unidades</button></div></div>');
  }

  function pkOpenTransferModal(prodId) {
    var db = STATE.relDb; var prod = pkFindById(db.products, prodId) || db.products[0]; if (!prod) return;
    var whOpts = ''; for (var w = 0; w < db.warehouses.length; w++) whOpts += '<option value="' + pkEsc(db.warehouses[w].id) + '">' + pkEsc(db.warehouses[w].name) + '</option>';
    var carOpts = ''; for (var c = 0; c < db.carriers.length; c++) carOpts += '<option value="' + pkEsc(db.carriers[c].name) + '">' + pkEsc(db.carriers[c].name) + '</option>';
    pkOpenModal('\u{1F504} Trasladar Producto de Bodega \u2014 ' + prod.name, 'C\xF3digo: ' + prod.code + ' \xB7 Disponible: ' + prod.stock + ' und',
      '<div class="form-grid" style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Bodega Destino</label><select id="modal-transfer-wh">' + whOpts + '</select></div>' +
      '<div class="field"><label>Transportista Asignado</label><select id="modal-transfer-note">' + carOpts + '</select></div>' +
      '<div class="field"><label>Cantidad a Trasladar</label><input type="number" id="modal-transfer-qty" value="5" min="1" max="' + prod.stock + '" /></div>' +
      '<div class="field"><button type="button" class="btn btn-primary" style="width:100%" data-confirm-transfer-id="' + pkEsc(prod.id) + '">\u2713 Confirmar Traslado</button></div></div>');
  }

  function pkOpenCustomer360Modal(custId) {
    var db = STATE.relDb; var cust = pkFindById(db.customers, custId) || db.customers[0]; if (!cust) return;
    var contract = cust.contractId ? pkFindById(db.contracts, cust.contractId) : null;
    var tariff = cust.tariffId ? pkFindById(db.tariffs, cust.tariffId) : null;
    var vehHtml = ''; for (var v = 0; v < db.vehicles.length; v++) { var ve = db.vehicles[v]; if (ve.customerId === cust.id) vehHtml += '<tr><td><span class="badge badge-blue">\u{1F697} ' + pkEsc(ve.plate) + '</span></td><td><strong>' + pkEsc(ve.brand) + '</strong></td><td>' + Number(ve.currentKm || 0).toLocaleString('es-CO') + ' km</td><td>SOAT: ' + pkEsc(ve.soatExpiry) + '</td></tr>'; }
    var invHtml = ''; var totalHistorical = 0; for (var i = 0; i < db.invoices.length; i++) { var inv = db.invoices[i]; if (inv.customerId === cust.id) { totalHistorical += Number(inv.total || 0); invHtml += '<tr><td><strong>' + pkEsc(inv.id) + '</strong> (' + pkEsc(inv.date) + ')</td><td>' + pkCop(inv.total) + '</td><td>' + pkCop(inv.pendingBalance) + '</td><td><span class="badge ' + (inv.pendingBalance > 0 ? 'badge-amber' : 'badge-emerald') + '">' + pkEsc(inv.status) + '</span></td></tr>'; } }
    pkOpenModal('\u{1F441}\uFE0F Ficha del Cliente \u2014 ' + cust.name, (cust.docType || 'NIT') + ' ' + cust.nit + ' \xB7 Tel: ' + cust.phone + ' \xB7 ' + cust.city,
      '<div class="kpi-row"><div class="kpi-box"><div class="kpi-label">Compras Acumuladas</div><div class="kpi-val">' + pkCop(totalHistorical) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Saldo por Cobrar</div><div class="kpi-val" style="color:var(--pk-amber)">' + pkCop(cust.currentDebt) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Convenio</div><div class="kpi-val" style="font-size:13px">' + pkEsc(contract ? contract.code : 'Contado') + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Tarifa</div><div class="kpi-val" style="font-size:13px;color:var(--pk-primary)">' + pkEsc(tariff ? tariff.name : 'General') + '</div></div></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0"><strong style="font-size:13px">\u{1F697} Veh\xEDculos Asociados:</strong><button type="button" class="btn btn-primary btn-sm" data-print-customer="' + pkEsc(cust.id) + '">\u{1F5A8}\uFE0F Imprimir Estado de Cuenta</button></div>' +
      '<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Placa</th><th>Veh\xEDculo</th><th>Kilometraje</th><th>SOAT</th></tr></thead><tbody>' + (vehHtml || '<tr><td colspan="4">Sin veh\xEDculos registrados</td></tr>') + '</tbody></table></div>' +
      '<div style="font-size:13px;font-weight:800;margin:8px 0">\u{1F9FE} Facturas y Cartera:</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Factura</th><th>Total</th><th>Saldo Pendiente</th><th>Estado</th></tr></thead><tbody>' + (invHtml || '<tr><td colspan="4">Sin facturas registradas</td></tr>') + '</tbody></table></div>');
  }

  function pkOpenVehicle360Modal(vehId) {
    var db = STATE.relDb; var ve = pkFindById(db.vehicles, vehId) || db.vehicles[0]; if (!ve) return;
    var histHtml = ''; for (var o = 0; o < db.workOrders.length; o++) { var wo = db.workOrders[o]; if (wo.vehicleId === ve.id || wo.plate === ve.plate) { var sList = []; for (var k = 0; k < (wo.services || []).length; k++) sList.push(wo.services[k].description + ' (' + pkCop(wo.services[k].price) + ')'); histHtml += '<tr><td><code>' + pkEsc(wo.id) + '</code> (' + pkEsc(wo.createdAt) + ')</td><td>' + pkEsc(wo.workerName) + '</td><td>' + pkEsc(sList.join(' + ')) + '</td><td><span class="badge badge-blue">' + pkEsc(wo.status) + '</span></td></tr>'; } }
    pkOpenModal('\u{1F697} Historial de Placa \u2014 ' + ve.plate + ' (' + ve.brand + ')', 'Propietario: ' + ve.customerName + ' \xB7 Km Actual: ' + Number(ve.currentKm || 0).toLocaleString('es-CO') + ' km',
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:12px"><strong>SOAT:</strong> ' + pkEsc(ve.soatExpiry) + ' \xB7 <strong>Pr\xF3x. Aceite:</strong> ' + Number(ve.nextOilChangeKm || 0).toLocaleString('es-CO') + ' km</span><button type="button" class="btn btn-primary btn-sm" data-print-veh="' + pkEsc(ve.id) + '">\u{1F5A8}\uFE0F Imprimir Hoja de Vida</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Orden / Fecha</th><th>T\xE9cnico</th><th>Trabajos Realizados</th><th>Estado</th></tr></thead><tbody>' + (histHtml || '<tr><td colspan="4">Sin \xF3rdenes previas</td></tr>') + '</tbody></table></div>');
  }

  function pkOpenAbonoModal(invId) {
    var db = STATE.relDb; var inv = pkFindById(db.invoices, invId); if (!inv) return;
    var abRows = ''; var abList = inv.abonosHistory || [];
    for (var a = 0; a < abList.length; a++) abRows += '<tr><td><code>' + pkEsc(abList[a].id) + '</code></td><td>' + pkEsc(abList[a].date) + '</td><td>' + pkEsc(abList[a].method) + '</td><td>' + pkEsc(abList[a].note) + '</td><td style="color:var(--pk-emerald);font-weight:800">+' + pkCop(abList[a].amount) + '</td></tr>';
    pkOpenModal('\u{1F4B5} Registrar Abono o Pago \u2014 Factura ' + inv.id, 'Cliente: ' + inv.customerName + ' \xB7 Saldo Pendiente: ' + pkCop(inv.pendingBalance),
      '<div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
      '<div class="field"><label>Valor del Abono ($)</label><input type="number" id="modal-abono-amount" value="' + inv.pendingBalance + '" max="' + inv.pendingBalance + '" /></div>' +
      '<div class="field"><label>Medio de Pago</label><select id="modal-abono-method"><option value="Efectivo">\u{1F4B5} Efectivo</option><option value="Transferencia / Nequi">\u{1F4F2} Transferencia / Nequi</option><option value="Tarjeta">\u{1F4B3} Tarjeta</option></select></div>' +
      '<div class="field"><label>Observaci\xF3n</label><div class="row-actions"><input type="text" id="modal-abono-note" value="Abono a factura" style="flex:1" /><button type="button" class="btn btn-emerald btn-sm" data-confirm-abono-inv="' + pkEsc(inv.id) + '">\u2713 Guardar Abono</button></div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fecha</th><th>Medio</th><th>Nota</th><th>Valor</th></tr></thead><tbody>' + (abRows || '<tr><td colspan="5">Sin abonos registrados a\xFAn</td></tr>') + '</tbody></table></div>');
  }

  function pkOpenInvoiceModal(invId) {
    var db = STATE.relDb; var inv = pkFindById(db.invoices, invId); if (!inv) return;
    var itRows = ''; for (var i = 0; i < (inv.items || []).length; i++) { var it = inv.items[i]; itRows += '<tr><td>' + pkEsc(it.kind) + '</td><td><strong>' + pkEsc(it.name) + '</strong></td><td>' + it.qty + '</td><td>' + pkCop(it.price) + '</td><td><strong>' + pkCop(it.qty * it.price) + '</strong></td></tr>'; }
    pkOpenModal('\u{1F9FE} Detalle de Factura ' + inv.id + ' (' + inv.status + ')', 'Cliente: ' + inv.customerName + ' \xB7 Fecha: ' + inv.date,
      '<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Tipo</th><th>Descripci\xF3n</th><th>Cant.</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + itRows + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f8fafc;border-radius:10px"><div><strong>Total: ' + pkCop(inv.total) + '</strong> \xB7 Pagado: ' + pkCop(inv.amountPaid) + ' \xB7 Saldo: ' + pkCop(inv.pendingBalance) + '</div><button type="button" class="btn btn-primary btn-sm" data-print-invoice="' + pkEsc(inv.id) + '">\u{1F5A8}\uFE0F Imprimir Factura / Tirilla</button></div>');
  }
`;
}

// apps/web-app/src/presentation/client-runtime/relational-seed-data.runtime.ts
function renderRelationalSeedDataRuntimeJs() {
  return `
  function pkCreateInitialRelationalDb() {
    return {
      tariffs: [
        { id: 'trf-plena', code: 'TAR-NORMAL', name: 'Precio General Mostrador', discountPct: 0 },
        { id: 'trf-corp-15', code: 'TAR-CORP-15', name: 'Tarifa Convenio Empresarial', discountPct: 15 },
        { id: 'trf-vip-10', code: 'TAR-MAYOR-10', name: 'Lista Mayorista / Cliente Frecuente', discountPct: 10 }
      ],
      contracts: [
        { id: 'cnt-particular', code: 'CONTADO', entityName: 'Venta Directa / Particular', tariffName: 'Precio General (0%)', budgetCeiling: 0, consumedAmount: 0, availableBalance: 0, status: 'Activo' },
        { id: 'cnt-0084', code: 'CNV-2026-084', entityName: 'Comercializadora del Valle S.A.S.', tariffName: 'Tarifa Convenio (-15%)', budgetCeiling: 120000000, consumedAmount: 35500000, availableBalance: 84500000, status: 'Activo' },
        { id: 'cnt-0112', code: 'CNV-2026-112', entityName: 'Transportes del Norte S.A.S.', tariffName: 'Lista Mayorista (-10%)', budgetCeiling: 80000000, consumedAmount: 19200000, availableBalance: 60800000, status: 'Activo' }
      ],
      customers: [
        { id: 'cust-1', docType: 'NIT', nit: '901452110', dv: '4', name: 'Comercializadora del Valle S.A.S.', businessType: 'Jur\xEDdica', taxRegime: 'Responsable de IVA', phone: '3104458890', email: 'compras@comvalle.co', city: 'Cali', address: 'Av. 6N # 28-10', creditLimit: 35000000, currentDebt: 425000, contractId: 'cnt-0084', tariffId: 'trf-corp-15' },
        { id: 'cust-2', docType: 'NIT', nit: '900812441', dv: '9', name: 'Inversiones y Transportes del Norte S.A.S.', businessType: 'Jur\xEDdica', taxRegime: 'Responsable de IVA', phone: '3157782210', email: 'logistica@transnorte.co', city: 'Barranquilla', address: 'V\xEDa 40 # 73-290', creditLimit: 25000000, currentDebt: 0, contractId: 'cnt-0112', tariffId: 'trf-vip-10' },
        { id: 'cust-3', docType: 'CC', nit: '79884120', dv: '', name: 'Andr\xE9s Felipe Ospina (Particular)', businessType: 'Natural', taxRegime: 'No Responsable', phone: '3005541190', email: 'aospina@gmail.com', city: 'Bogot\xE1', address: 'Calle 80 # 15-40', creditLimit: 5000000, currentDebt: 0, contractId: 'cnt-particular', tariffId: 'trf-plena' }
      ],
      suppliers: [
        { id: 'sup-1', nit: '900412889-1', name: 'Distribuidora Nacional de Repuestos e Insumos S.A.S.', contactName: 'Roberto Ariza', city: 'Bogot\xE1', phone: '3189901122' },
        { id: 'sup-2', nit: '901220410-8', name: 'Importadora Andina de Lubricantes y Suministros S.A.', contactName: 'Claudia G\xF3mez', city: 'Medell\xEDn', phone: '3124405566' }
      ],
      warehouses: [
        { id: 'wh-central', code: 'BOD-01', name: 'Bodega Central Principal', city: 'Sede Principal', manager: 'Jorge Pardo' },
        { id: 'wh-norte', code: 'BOD-02', name: 'Bodega Punto de Venta Norte', city: 'Sede Norte', manager: 'Andr\xE9s Mej\xEDa' }
      ],
      carriers: [
        { id: 'car-1', nit: '900771220-8', name: 'Transportes R\xE1pidos del Norte S.A.S.', city: 'Barranquilla', phone: '3004419080', rndcCode: 'RNDC-4410' },
        { id: 'car-2', nit: '890102440-3', name: 'TransCarga Pesada Nacional S.A.', city: 'Bogot\xE1', phone: '3158821090', rndcCode: 'RNDC-8821' },
        { id: 'car-3', nit: '901550310-1', name: 'Log\xEDstica y Fletes del Pac\xEDfico S.A.S.', city: 'Cali', phone: '3116654321', rndcCode: 'RNDC-5503' }
      ],
      drivers: [
        { id: 'drv-1', docNumber: '72.184.990', name: 'Hernando Valencia R\xEDos', licenseCategory: 'C3 Pesados', phone: '3108842211', carrierId: 'car-2', carrierName: 'TransCarga Pesada Nacional S.A.', assignedPlate: 'SXT-942' },
        { id: 'drv-2', docNumber: '80.412.330', name: 'Jairo Alberto Morales', licenseCategory: 'C3 Tractocami\xF3n', phone: '3159914400', carrierId: 'car-1', carrierName: 'Transportes R\xE1pidos del Norte S.A.S.', assignedPlate: 'WXY-812' },
        { id: 'drv-3', docNumber: '1.045.712.800', name: 'Luis Fernando Cano', licenseCategory: 'C2 Cami\xF3n R\xEDgido', phone: '3014458812', carrierId: 'car-3', carrierName: 'Log\xEDstica y Fletes del Pac\xEDfico S.A.S.', assignedPlate: 'KLM-482' }
      ],
      hotelRooms: [
        { id: 'rm-101', roomNumber: 'Habitaci\xF3n 101', roomType: 'Sencilla Ejecutiva', floor: 'Piso 1', nightlyRate: 145000, status: 'Disponible', guestId: '', guestName: '', checkInDate: '', nights: 1, extrasTotal: 0 },
        { id: 'rm-204', roomNumber: 'Habitaci\xF3n 204', roomType: 'Doble Superior', floor: 'Piso 2', nightlyRate: 210000, status: 'Ocupada', guestId: 'cust-1', guestName: 'Comercializadora del Valle S.A.S.', checkInDate: '2026-11-05', nights: 2, extrasTotal: 45000 },
        { id: 'rm-301', roomNumber: 'Suite 301', roomType: 'Suite Familiar / Balc\xF3n', floor: 'Piso 3', nightlyRate: 320000, status: 'Ocupada', guestId: 'cust-3', guestName: 'Andr\xE9s Felipe Ospina (Particular)', checkInDate: '2026-11-05', nights: 1, extrasTotal: 0 },
        { id: 'rm-102', roomNumber: 'Caba\xF1a 04', roomType: 'Caba\xF1a Campestre (4 Pers.)', floor: 'Zona Verde', nightlyRate: 380000, status: 'Disponible', guestId: '', guestName: '', checkInDate: '', nights: 1, extrasTotal: 0 }
      ],
      pucAccounts: [
        { id: 'puc-1105', code: '110505', name: '110505 - Caja General Principal' },
        { id: 'puc-1110', code: '111005', name: '111005 - Bancos Moneda Nacional' },
        { id: 'puc-1305', code: '130505', name: '130505 - Clientes Nacionales (Cartera)' },
        { id: 'puc-1435', code: '143501', name: '143501 - Mercanc\xEDas no Fabricadas por la Empresa' },
        { id: 'puc-2205', code: '220505', name: '220505 - Proveedores Nacionales' },
        { id: 'puc-4135', code: '413501', name: '413501 - Comercio al por Mayor y al por Menor' },
        { id: 'puc-5105', code: '510506', name: '510506 - Sueldos y Gastos de Personal' }
      ],
      products: [
        { id: 'prd-1', code: 'ACE-10W40', sku: 'ACE-10W40', name: 'Aceite Sint\xE9tico 10W-40 Alto Rendimiento (Gal\xF3n)', category: 'Lubricantes y Fluidos', warehouseId: 'wh-central', supplierId: 'sup-2', costPrice: 95000, salePrice: 145000, taxPct: 19, stock: 28, minStock: 6, lotCode: 'LOT-2026-901', expiryDate: '2027-08-15' },
        { id: 'prd-2', code: 'FRE-204', sku: 'FRE-204', name: 'Juego Pastillas de Freno Cer\xE1micas Delanteras', category: 'Frenos y Seguridad', warehouseId: 'wh-central', supplierId: 'sup-1', costPrice: 110000, salePrice: 185000, taxPct: 19, stock: 14, minStock: 5, lotCode: 'LOT-2026-412', expiryDate: '2028-12-31' },
        { id: 'prd-3', code: 'FIL-309', sku: 'FIL-309', name: 'Filtro de Aire y Combustible Original', category: 'Filtros y Motor', warehouseId: 'wh-central', supplierId: 'sup-1', costPrice: 32000, salePrice: 58000, taxPct: 19, stock: 4, minStock: 8, lotCode: 'LOT-2026-109', expiryDate: '2027-05-20' },
        { id: 'prd-4', code: 'BAT-800A', sku: 'BAT-800A', name: 'Bater\xEDa Sellada Libre Mantenimiento 800 Amp', category: 'El\xE9ctricos y Bater\xEDas', warehouseId: 'wh-norte', supplierId: 'sup-1', costPrice: 310000, salePrice: 460000, taxPct: 19, stock: 9, minStock: 3, lotCode: 'LOT-2026-774', expiryDate: '2027-11-30' }
      ],
      vehicles: [
        { id: 'veh-1', plate: 'KLM-482', brand: 'Toyota Hilux SRX 4x4 Diesel', modelYear: '2024', customerId: 'cust-2', customerName: 'Inversiones y Transportes del Norte S.A.S.', currentKm: 42850, nextOilChangeKm: 42500, soatExpiry: '2026-10-15', tecnoExpiry: '2027-04-20', notes: 'Revisi\xF3n de inyectores y cambio de aceite' },
        { id: 'veh-2', plate: 'WXY-812', brand: 'Kenworth T800 Tractocami\xF3n 3S3', modelYear: '2023', customerId: 'cust-1', customerName: 'Comercializadora del Valle S.A.S.', currentKm: 184200, nextOilChangeKm: 185000, soatExpiry: '2027-06-10', tecnoExpiry: '2027-06-10', notes: 'Mantenimiento preventivo de flota' },
        { id: 'veh-3', plate: 'SXT-942', brand: 'International ProStar Cabezote + R-4481', modelYear: '2025', customerId: 'cust-2', customerName: 'Inversiones y Transportes del Norte S.A.S.', currentKm: 64900, nextOilChangeKm: 70000, soatExpiry: '2027-02-18', tecnoExpiry: '2027-02-18', notes: 'Tractomula de carga pesada' }
      ],
      workers: [
        { id: 'wk-1', docNumber: '79412880', name: 'Carlos Andr\xE9s M\xE9ndez', specialty: 'Mec\xE1nico L\xEDder / Especialista', commissionPct: 50, totalDayGross: 380000, phone: '3112233445' },
        { id: 'wk-2', docNumber: '1032488910', name: 'Juli\xE1n David Torres', specialty: 'T\xE9cnico de Diagn\xF3stico y Servicio', commissionPct: 45, totalDayGross: 240000, phone: '3145566778' },
        { id: 'wk-3', docNumber: '52889104', name: 'Laura Marcela G\xF3mez', specialty: 'Asesora Comercial / Atenci\xF3n', commissionPct: 40, totalDayGross: 150000, phone: '3168899001' }
      ],
      workOrders: [
        { id: 'OT-3041', createdAt: '2026-11-05 08:30', customerId: 'cust-2', customerName: 'Inversiones y Transportes del Norte S.A.S.', vehicleId: 'veh-1', plate: 'KLM-482', vehicleBrand: 'Toyota Hilux SRX 4x4', currentKm: 42850, nextOilKm: 47850, workerId: 'wk-1', workerName: 'Carlos Andr\xE9s M\xE9ndez', status: 'En Proceso', services: [{ description: 'Mantenimiento 40.000 Km + Esc\xE1ner', price: 220000 }, { description: 'Limpieza Ultrasonido de Inyectores', price: 160000 }], totalEstimated: 380000 },
        { id: 'OT-3042', createdAt: '2026-11-05 09:15', customerId: 'cust-3', customerName: 'Andr\xE9s Felipe Ospina', vehicleId: 'veh-3', plate: 'SXT-942', vehicleBrand: 'International ProStar', currentKm: 64900, nextOilKm: 70000, workerId: 'wk-2', workerName: 'Juli\xE1n David Torres', status: 'Listo para Entrega', services: [{ description: 'Sincronizaci\xF3n e Inyecci\xF3n Electr\xF3nica', price: 140000 }, { description: 'Cambio de Pastillas de Freno', price: 60000 }], totalEstimated: 200000 },
        { id: 'OT-3043', createdAt: '2026-11-05 10:00', customerId: 'cust-1', customerName: 'Comercializadora del Valle S.A.S.', vehicleId: 'veh-2', plate: 'WXY-812', vehicleBrand: 'Kenworth T800', currentKm: 184200, nextOilKm: 190000, workerId: 'wk-1', workerName: 'Carlos Andr\xE9s M\xE9ndez', status: 'Recibido', services: [{ description: 'Diagn\xF3stico El\xE9ctrico Computarizado 24V', price: 180000 }], totalEstimated: 180000 }
      ],
      invoices: [
        {
          id: 'FEVP-9010', cufe: 'CUFE-9010-2026', date: '2026-11-05 09:40',
          customerId: 'cust-1', customerName: 'Comercializadora del Valle S.A.S.', customerNit: '901452110-4',
          contractId: 'cnt-0084', vehicleId: 'veh-2', plate: 'WXY-812',
          items: [{ kind: 'PRODUCTO', refId: 'prd-1', code: 'ACE-10W40', name: 'Aceite Sint\xE9tico 10W-40 (Gal\xF3n)', qty: 2, price: 145000 }, { kind: 'SERVICIO', refId: 'SRV-1', code: 'MO', name: 'Mantenimiento Preventivo y Frenos', qty: 1, price: 435000 }],
          subtotal: 725000, discountTotal: 0, taxTotal: 0, total: 725000,
          paymentMethod: 'Cr\xE9dito / Cartera CxC', amountPaid: 300000, pendingBalance: 425000,
          status: 'Pendiente CxC', glosaStatus: 'Vigente',
          abonosHistory: [{ id: 'RC-1001', date: '2026-11-05', amount: 300000, method: 'Transferencia / Nequi', note: 'Anticipo inicial' }]
        },
        {
          id: 'FEVP-9009', cufe: 'CUFE-9009-2026', date: '2026-11-05 08:20',
          customerId: 'cust-2', customerName: 'Inversiones y Transportes del Norte S.A.S.', customerNit: '900812441-9',
          contractId: 'cnt-0112', vehicleId: 'veh-1', plate: 'KLM-482',
          items: [{ kind: 'PRODUCTO', refId: 'prd-4', code: 'BAT-800A', name: 'Bater\xEDa Sellada 800 Amp', qty: 1, price: 460000 }, { kind: 'SERVICIO', refId: 'SRV-2', code: 'MO', name: 'Instalaci\xF3n y Prueba de Alternador', qty: 1, price: 90000 }],
          subtotal: 550000, discountTotal: 0, taxTotal: 0, total: 550000,
          paymentMethod: 'Efectivo', amountPaid: 550000, pendingBalance: 0,
          status: 'Pagada', glosaStatus: 'Cerrada',
          abonosHistory: [{ id: 'RC-1000', date: '2026-11-05', amount: 550000, method: 'Efectivo', note: 'Pago en Caja' }]
        }
      ],
      kardexMovements: [
        { id: 'KDX-101', date: '2026-11-05 08:00', productId: 'prd-1', productName: 'Aceite Sint\xE9tico 10W-40 (Gal\xF3n)', warehouseId: 'wh-central', movementType: 'ENTRADA_COMPRA', qty: 30, unitCost: 95000, balanceAfter: 30, referenceDoc: 'FAC-PROV-118', actor: 'Bodega' },
        { id: 'KDX-102', date: '2026-11-05 09:40', productId: 'prd-1', productName: 'Aceite Sint\xE9tico 10W-40 (Gal\xF3n)', warehouseId: 'wh-central', movementType: 'SALIDA_VENTA', qty: -2, unitCost: 95000, balanceAfter: 28, referenceDoc: 'FEVP-9010', actor: 'Caja' }
      ],
      expenses: [
        { id: 'EGR-201', date: '2026-11-05 08:50', category: 'Insumos Operativos', description: 'Compra de insumos de limpieza y papeler\xEDa', paymentSource: 'Efectivo Caja', amount: 68000, responsible: 'Caja' },
        { id: 'EGR-202', date: '2026-11-05 10:10', category: 'Transporte y Mensajer\xEDa', description: 'Domicilio de repuestos urgentes', paymentSource: 'Efectivo Caja', amount: 35000, responsible: 'Caja' }
      ],
      settlements: [
        { id: 'LIQ-301', date: '2026-11-04 18:00', workerId: 'wk-1', workerName: 'Carlos Andr\xE9s M\xE9ndez', grossLabor: 680000, commissionPct: 50, technicianPayout: 340000, companyRetention: 340000 }
      ],
      diningTables: [
        { id: 'tbl-1', name: 'Mesa 1 \u2014 Terraza', waiter: 'Mateo R\xEDos', diners: 4, status: 'Ocupada', items: [{ productId: 'cmd-1', name: 'Punta de Anca a la Parrilla', qty: 2, price: 42000, note: 'T\xE9rmino 3/4' }, { productId: 'cmd-2', name: 'Limonada de Coco', qty: 2, price: 12000, note: 'Sin az\xFAcar' }], total: 108000 },
        { id: 'tbl-2', name: 'Mesa 2 \u2014 Sal\xF3n Principal', waiter: 'Laura G\xF3mez', diners: 0, status: 'Libre', items: [], total: 0 },
        { id: 'tbl-3', name: 'Mesa 3 \u2014 VIP', waiter: 'Mateo R\xEDos', diners: 3, status: 'En Cocina', items: [{ productId: 'cmd-3', name: 'Picada Especial para Compartir', qty: 1, price: 58000, note: 'Extra patac\xF3n' }, { productId: 'cmd-4', name: 'Cerveza Club Colombia', qty: 3, price: 9000, note: 'Bien fr\xEDa' }], total: 85000 },
        { id: 'tbl-4', name: 'Barra 1', waiter: 'Laura G\xF3mez', diners: 0, status: 'Libre', items: [], total: 0 }
      ]
    };
  }

  function pkFindById(list, id) {
    if (!Array.isArray(list) || !id) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function pkNormalizeRelDb(raw) {
    var seed = pkCreateInitialRelationalDb();
    if (!raw || typeof raw !== 'object') return seed;
    var keys = ['tariffs', 'contracts', 'customers', 'suppliers', 'warehouses', 'carriers', 'drivers', 'hotelRooms', 'pucAccounts', 'products', 'vehicles', 'workers', 'workOrders', 'invoices', 'kardexMovements', 'expenses', 'settlements', 'diningTables'];
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (!Array.isArray(raw[key]) || raw[key].length === 0) raw[key] = seed[key];
    }
    return raw;
  }

  function pkPersistRelationalTx(actionType, entityPayload) {
    if (pkIsDemoMode()) { pkSaveDemoToLocalStorage(); return; }
    var cl = pkGetActiveClient();
    if (!cl || !cl.dbName) return;
    fetch('/api/v1/client-workspace/transaction', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dbName: cl.dbName, actionType: actionType || 'SYNC_STATE', entityPayload: entityPayload || {}, fullRelationalState: STATE.relDb })
    }).catch(function() {});
  }

  function pkDownloadCsvUtf8(filename, headers, rows) {
    var escCell = function(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [headers.map(escCell).join(';')];
    for (var i = 0; i < rows.length; i++) lines.push(rows[i].map(escCell).join(';'));
    var blob = new Blob(['\\uFEFF' + lines.join('\\r\\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.setAttribute('download', filename);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
`;
}

// apps/web-app/src/presentation/client-runtime/reports-cashbox-commissions-hub.runtime.ts
function renderReportsCashboxCommissionsHubRuntimeJs() {
  return `
  function pkComputeCashMetrics(db) {
    var totalInvoiced = 0; var cashIn = 0; var digitalIn = 0; var totalCxc = 0; var partsProfit = 0;
    for (var i = 0; i < db.invoices.length; i++) {
      var inv = db.invoices[i];
      totalInvoiced += Number(inv.total || 0);
      totalCxc += Number(inv.pendingBalance || 0);
      var paid = Number(inv.amountPaid || 0);
      if (inv.paymentMethod === 'Efectivo' || inv.paymentMethod === 'Cr\xE9dito / Cartera CxC') cashIn += paid;
      else digitalIn += paid;
      for (var k = 0; k < (inv.items || []).length; k++) {
        var it = inv.items[k];
        if (it.kind === 'PRODUCTO') {
          var pr = pkFindById(db.products, it.refId);
          var uCost = pr ? Number(pr.costPrice || 0) : Math.round(Number(it.price || 0) * 0.6);
          partsProfit += (Number(it.price || 0) - uCost) * Number(it.qty || 1);
        }
      }
    }
    var cashExpenses = 0; var totalExpenses = 0;
    for (var e = 0; e < db.expenses.length; e++) {
      totalExpenses += Number(db.expenses[e].amount || 0);
      if (db.expenses[e].paymentSource === 'Efectivo Caja') cashExpenses += Number(db.expenses[e].amount || 0);
    }
    return { totalInvoiced: totalInvoiced, cashIn: cashIn, digitalIn: digitalIn, totalCxc: totalCxc, partsProfit: partsProfit, totalExpenses: totalExpenses, netCash: cashIn - cashExpenses };
  }

  function pkRenderPettyCashHub() {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;
    var m = pkComputeCashMetrics(db);
    var expRows = '';
    for (var e = 0; e < db.expenses.length; e++) {
      var ex = db.expenses[e];
      expRows += '<tr><td><code>' + pkEsc(ex.id) + '</code></td><td>' + pkEsc(ex.date) + '</td><td><span class="badge badge-slate">' + pkEsc(ex.category) + '</span></td><td><strong>' + pkEsc(ex.description) + '</strong></td><td>' + pkEsc(ex.paymentSource) + '</td><td style="color:var(--pk-amber);font-weight:800">-' + pkCop(ex.amount) + '</td><td><div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-print-expense="' + pkEsc(ex.id) + '">\u{1F5A8}\uFE0F</button><button type="button" class="btn btn-outline btn-sm" data-exp-delete-id="' + pkEsc(ex.id) + '">\u{1F5D1}\uFE0F</button></div></td></tr>';
    }
    var nextEgr = 'EGR-' + (101 + db.expenses.length);
    stage.innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Efectivo Neto en Caja (Ingresos - Gastos)</div><div class="kpi-val" style="color:var(--pk-emerald)">' + pkCop(m.netCash) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Transferencias y Tarjetas</div><div class="kpi-val" style="color:var(--pk-primary)">' + pkCop(m.digitalIn) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Total Gastos Registrados</div><div class="kpi-val" style="color:var(--pk-amber)">-' + pkCop(m.totalExpenses) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Total Facturado</div><div class="kpi-val">' + pkCop(m.totalInvoiced) + '</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><div class="card-title">\u{1F4B8} Registrar Salida o Gasto de Caja (' + nextEgr + ')</div>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-print-cashbox">\u{1F5A8}\uFE0F Imprimir Arqueo de Caja</button></div>' +
      '<div class="card-body"><div class="form-grid" style="margin-bottom:12px">' +
      '<div class="field"><label>Comprobante (Autom\xE1tico)</label><input type="text" value="' + nextEgr + '" readonly style="background:#e2e8f0;font-weight:800" /></div>' +
      '<div class="field"><label>Categor\xEDa del Gasto</label><select id="exp-new-cat"><option value="Insumos Operativos">Insumos Operativos</option><option value="Transporte / Fletes">Transporte / Fletes</option><option value="Servicios P\xFAblicos">Servicios P\xFAblicos</option><option value="Mantenimiento / Aseo">Mantenimiento / Aseo</option><option value="Adelanto / Vale">Adelanto / Vale</option></select></div>' +
      '<div class="field"><label>Concepto / Detalle *</label><input type="text" id="exp-new-desc" placeholder="Ej: Compra insumos de aseo / Domicilio" /></div>' +
      '<div class="field"><label>Sale de y Valor ($)</label><div class="row-actions">' +
      '<select id="exp-new-source" style="width:140px"><option value="Efectivo Caja">Efectivo Caja</option><option value="Transferencia Bancaria">Banco / Nequi</option></select>' +
      '<input type="number" id="exp-new-amount" value="25000" style="flex:1" />' +
      '<button type="button" class="btn btn-amber btn-sm" id="btn-exp-add">+ Guardar Gasto</button></div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>N\xB0 Egreso</th><th>Fecha</th><th>Categor\xEDa</th><th>Concepto</th><th>Origen</th><th>Valor</th><th>Acciones</th></tr></thead><tbody>' + expRows + '</tbody></table></div></div></div>';
  }

  function pkRenderReportsAndCashboxHub() {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;
    var m = pkComputeCashMetrics(db);
    var invRows = '';
    for (var i = 0; i < db.invoices.length; i++) {
      var iv = db.invoices[i];
      invRows += '<tr><td><strong>' + pkEsc(iv.id) + '</strong></td><td>' + pkEsc(iv.date) + '</td><td>' + pkEsc(iv.customerName) + '</td><td>' + pkEsc(iv.paymentMethod) + '</td><td><strong>' + pkCop(iv.total) + '</strong></td><td><span class="badge ' + (iv.pendingBalance > 0 ? 'badge-amber' : 'badge-emerald') + '">' + pkEsc(iv.status) + '</span></td><td><button type="button" class="btn btn-outline btn-sm" data-print-invoice="' + pkEsc(iv.id) + '">\u{1F5A8}\uFE0F Imprimir</button></td></tr>';
    }
    stage.innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Ventas Totales Facturadas</div><div class="kpi-val">' + pkCop(m.totalInvoiced) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Ganancia en Productos</div><div class="kpi-val" style="color:var(--pk-emerald)">+' + pkCop(m.partsProfit) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Efectivo Neto en Caja</div><div class="kpi-val" style="color:var(--pk-primary)">' + pkCop(m.netCash) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Cuentas por Cobrar (Cartera)</div><div class="kpi-val" style="color:var(--pk-amber)">' + pkCop(m.totalCxc) + '</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><div class="card-title">\u{1F4E5} Descargar e Imprimir Reportes Gerenciales</div>' +
      '<button type="button" class="btn btn-primary btn-sm" id="btn-print-cashbox">\u{1F5A8}\uFE0F Imprimir Balance General del D\xEDa</button></div>' +
      '<div class="card-body"><div class="row-actions">' +
      '<button type="button" class="btn btn-primary btn-sm" data-export-csv="invoices">\u{1F4CA} Descargar Reporte de Ventas (.CSV)</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="inventory">\u{1F4E6} Descargar Inventario Valorizado (.CSV)</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="expenses">\u{1F4B8} Descargar Gastos de Caja (.CSV)</button>' +
      '</div></div></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">\u{1F9FE} Detalle de Ventas Recientes</div></div>' +
      '<div class="card-body"><div class="table-wrap"><table><thead><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th>Medio de Pago</th><th>Total</th><th>Estado</th><th>Acci\xF3n</th></tr></thead><tbody>' + invRows + '</tbody></table></div></div></div>';
  }

  function pkRenderGastroHub(subKey) {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;

    if (subKey === 'mod-kds') {
      var kdsCards = '';
      for (var k = 0; k < db.diningTables.length; k++) {
        var tk = db.diningTables[k];
        if (!tk.items || tk.items.length === 0) continue;
        var listK = '';
        for (var m = 0; m < tk.items.length; m++) {
          listK += '<div style="padding:6px 0;border-bottom:1px dashed var(--pk-border);font-size:13px"><strong>' + tk.items[m].qty + 'x ' + pkEsc(tk.items[m].name) + '</strong>' +
            (tk.items[m].note ? '<div style="font-size:11px;color:#b45309">Nota: ' + pkEsc(tk.items[m].note) + '</div>' : '') + '</div>';
        }
        kdsCards += '<div class="card"><div class="card-head" style="background:#fef3c7"><div class="card-title">\u{1F468}\u200D\u{1F373} ' + pkEsc(tk.name) + '</div><span class="badge badge-amber">Mesero: ' + pkEsc(tk.waiter) + '</span></div>' +
          '<div class="card-body">' + listK + '<div class="row-actions" style="margin-top:12px"><button type="button" class="btn btn-outline btn-sm" data-print-gastro-table="' + pkEsc(tk.id) + '">\u{1F5A8}\uFE0F Imprimir Comanda</button><button type="button" class="btn btn-emerald btn-sm" style="flex:1" data-kds-ready-table="' + pkEsc(tk.id) + '">\u2705 Marcar Listo</button></div></div></div>';
      }
      stage.innerHTML = '<div class="grid-3">' + (kdsCards || '<div class="card"><div class="card-body">No hay comandas pendientes en cocina en este momento.</div></div>') + '</div>';
      return;
    }

    var selTable = pkFindById(db.diningTables, STATE.selectedTableId) || db.diningTables[0];
    if (selTable) STATE.selectedTableId = selTable.id;

    var tableButtons = '';
    for (var i = 0; i < db.diningTables.length; i++) {
      var t = db.diningTables[i];
      var isSel = selTable && selTable.id === t.id;
      var isOcc = t.items && t.items.length > 0;
      tableButtons += '<button type="button" data-select-table="' + pkEsc(t.id) + '" style="padding:12px 16px;border-radius:12px;cursor:pointer;text-align:left;min-width:165px;border:2px solid ' + (isSel ? '#023047' : (isOcc ? '#10b981' : '#cbd5e1')) + ';background:' + (isSel ? '#023047' : (isOcc ? '#ecfdf5' : '#fff')) + ';color:' + (isSel ? '#fff' : '#0f172a') + '">' +
        '<div style="font-weight:800;font-size:14px">\u{1F37D}\uFE0F ' + pkEsc(t.name) + '</div>' +
        '<div style="font-size:11px;opacity:0.85">' + pkEsc(t.waiter || 'Mesero') + ' \xB7 ' + (isOcc ? pkCop(t.total) : 'Libre') + '</div></button>';
    }

    var menuOpts = '<option value="Punta de Anca 350g|48000">Punta de Anca 350g \u2014 $48.000</option><option value="Bandeja Especial Ejecutiva|32000">Bandeja Especial Ejecutiva \u2014 $32.000</option><option value="Hamburguesa Artesanal Doble|28000">Hamburguesa Artesanal Doble \u2014 $28.000</option><option value="Limonada Cerezada / Natural|9500">Limonada Cerezada / Natural \u2014 $9.500</option>';
    for (var p = 0; p < db.products.length; p++) {
      menuOpts += '<option value="' + pkEsc(db.products[p].name + '|' + db.products[p].salePrice) + '">' + pkEsc(db.products[p].name + ' \u2014 ' + pkCop(db.products[p].salePrice)) + '</option>';
    }
    var waiterOpts = '<option value="Camila (Mesera)">Camila (Mesera)</option><option value="Mateo (Barra)">Mateo (Barra)</option><option value="Laura (Terraza)">Laura (Terraza)</option>';
    for (var w = 0; w < db.workers.length; w++) waiterOpts += '<option value="' + pkEsc(db.workers[w].name) + '">' + pkEsc(db.workers[w].name) + '</option>';

    var cmdRows = '';
    if (selTable && selTable.items) {
      for (var c = 0; c < selTable.items.length; c++) {
        var it = selTable.items[c];
        cmdRows += '<tr><td><strong>' + pkEsc(it.name) + '</strong>' + (it.note ? '<div style="font-size:11px;color:var(--pk-muted)">Nota: ' + pkEsc(it.note) + '</div>' : '') + '</td>' +
          '<td><div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-cmd-qty="-1" data-cmd-idx="' + c + '">\u2796</button><strong>' + it.qty + '</strong><button type="button" class="btn btn-outline btn-sm" data-cmd-qty="1" data-cmd-idx="' + c + '">\u2795</button></div></td>' +
          '<td>' + pkCop(it.price) + '</td><td><strong>' + pkCop(it.price * it.qty) + '</strong></td>' +
          '<td><button type="button" class="btn btn-outline btn-sm" data-cmd-del="' + c + '">\u{1F5D1}\uFE0F</button></td></tr>';
      }
    }
    if (!cmdRows) cmdRows = '<tr><td colspan="5" style="text-align:center;color:var(--pk-muted);padding:16px">Mesa libre. Selecciona un plato o bebida arriba y haz clic en "+ Agregar a la Comanda".</td></tr>';

    stage.innerHTML =
      '<div class="card"><div class="card-head"><div class="card-title">1. Selecciona la Mesa (Haz clic en una mesa para ver o crear su comanda)</div>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-gastro-new-table">+ Crear Nueva Mesa</button></div>' +
      '<div class="card-body"><div style="display:flex;gap:10px;flex-wrap:wrap">' + tableButtons + '</div></div></div>' +

      (selTable ? (
        '<div class="card"><div class="card-head" style="background:#f8fafc"><div class="card-title">\u{1F4DD} 2. Comanda de ' + pkEsc(selTable.name) + '</div>' +
        '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-print-gastro-table="' + pkEsc(selTable.id) + '">\u{1F5A8}\uFE0F Imprimir Precuenta / Comanda</button>' +
        '<span class="badge badge-emerald" style="font-size:14px">Total Mesa: ' + pkCop(selTable.total) + '</span></div></div>' +
        '<div class="card-body">' +
        '<div class="form-grid" style="background:#f1f5f9;padding:12px;border-radius:10px;margin-bottom:14px">' +
        '<div class="field"><label>Plato / Bebida / Producto (Cat\xE1logo)</label><select id="cmd-dish-select">' + menuOpts + '</select></div>' +
        '<div class="field"><label>Mesero Asignado</label><select id="cmd-waiter">' + waiterOpts + '</select></div>' +
        '<div class="field"><label>Cantidad</label><select id="cmd-qty"><option value="1" selected>1 Unidad</option><option value="2">2 Unidades</option><option value="3">3 Unidades</option><option value="4">4 Unidades</option><option value="6">6 Unidades</option></select></div>' +
        '<div class="field"><label>Preparaci\xF3n / Nota Cocina</label><select id="cmd-note"><option value="Est\xE1ndar">Est\xE1ndar</option><option value="T\xE9rmino 3/4">T\xE9rmino 3/4</option><option value="Bien asado">Bien asado</option><option value="Sin cebolla / Sin salsa">Sin cebolla / Sin salsa</option><option value="Fr\xEDa con hielo">Fr\xEDa con hielo</option><option value="Para llevar">Para llevar</option></select></div>' +
        '<div class="field"><button type="button" class="btn btn-primary" style="width:100%" id="btn-cmd-add-item">+ Agregar a la Comanda</button></div>' +
        '</div>' +
        '<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Plato / Bebida</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th><th>Quitar</th></tr></thead><tbody>' + cmdRows + '</tbody></table></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<button type="button" class="btn btn-amber" id="btn-cmd-send-kitchen">\u{1F468}\u200D\u{1F373} Enviar Comanda a Cocina / Barra</button>' +
        '<button type="button" class="btn btn-outline" data-print-gastro-table="' + pkEsc(selTable.id) + '">\u{1F5A8}\uFE0F Imprimir Comanda / Precuenta</button>' +
        '<button type="button" class="btn btn-emerald" data-pos-load-table="' + pkEsc(selTable.id) + '">\u{1F4B5} Pasar Cuenta de ' + pkEsc(selTable.name) + ' a Caja para Cobrar</button>' +
        '</div></div></div>'
      ) : '');
  }
`;
}

// apps/web-app/src/presentation/client-runtime/superadmin-and-shell.runtime.ts
function renderSuperAdminAndShellRuntimeJs() {
  return `
  function pkRenderSuperAdmin() {
    var kpiEl = document.getElementById('sa-kpi-row');
    if (kpiEl) {
      var pgList = (STATE.pgDatabases && STATE.pgDatabases.length > 0) ? STATE.pgDatabases : ['proveko_control_db', 'proveko_groups_db'];
      kpiEl.innerHTML =
        '<div class="kpi-box"><div class="kpi-label">Bases del Sistema</div><div class="kpi-val" style="font-size:13px">proveko_control_db \xB7 proveko_groups_db</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Total Bases Activas</div><div class="kpi-val">' + pgList.length + ' (' + pkEsc(pgList.join(', ')) + ')</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Empresas Clientes</div><div class="kpi-val" style="color:var(--pk-emerald)">' + STATE.clients.length + ' Empresas</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Solicitudes de M\xF3dulos</div><div class="kpi-val" style="font-size:13px;color:var(--pk-primary)">' + STATE.featureRequests.length + ' Solicitudes</div></div>';
    }
    var gridEl = document.getElementById('sa-tenants-grid');
    if (gridEl) {
      var gHtml = '';
      if (STATE.clients.length === 0) {
        gHtml = '<div class="card"><div class="card-body" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
          '<div><strong>A\xFAn no hay empresas registradas.</strong><div style="font-size:12px;color:var(--pk-muted)">Registra la primera empresa cliente para habilitar su cuenta administrativa.</div></div>' +
          '<button type="button" class="btn btn-emerald btn-sm" id="btn-sa-empty-new-client">+ Registrar Primera Empresa</button></div></div>';
      }
      for (var i = 0; i < STATE.clients.length; i++) {
        var t = STATE.clients[i];
        gHtml += '<div class="card"><div class="card-head">' +
          '<div><div style="display:flex;align-items:center;gap:8px"><strong style="font-size:15px">' + pkEsc(t.companyName) + '</strong>' +
          '<span class="badge badge-blue">NIT: ' + pkEsc(t.nit) + '</span><span class="badge badge-emerald">Base: ' + pkEsc(t.dbName) + '</span></div>' +
          '<div style="font-size:12px;color:var(--pk-muted);margin-top:4px">Usuario Admin: <code>' + pkEsc(t.adminUsername) + '</code> \xB7 Clave: <code>' + pkEsc(t.adminPasswordHint) + '</code></div></div>' +
          '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-sa-regen="' + pkEsc(t.tenantId) + '">\u{1F511} Nueva Clave</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-sa-open="' + pkEsc(t.tenantId) + '">\u{1F3E2} Abrir Empresa</button></div></div>' +
          '<div class="card-body"><div class="grid-2">' +
          '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-size:11px;color:var(--pk-muted);font-weight:700">CUPO DE ROLES</div><div style="font-size:14px;font-weight:800">Usados: ' + t.internalRoles.length + ' / M\xE1x: ' + t.maxRolesAllowed + '</div></div>' +
          '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-sa-quota-role="-1" data-sa-tenant="' + pkEsc(t.tenantId) + '">-1</button><button type="button" class="btn btn-outline btn-sm" data-sa-quota-role="1" data-sa-tenant="' + pkEsc(t.tenantId) + '">+1</button></div></div>' +
          '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-size:11px;color:var(--pk-muted);font-weight:700">CUPO DE USUARIOS</div><div style="font-size:14px;font-weight:800">Usados: ' + t.internalUsers.length + ' / M\xE1x: ' + t.maxUsersAllowed + '</div></div>' +
          '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-sa-quota-user="-1" data-sa-tenant="' + pkEsc(t.tenantId) + '">-1</button><button type="button" class="btn btn-outline btn-sm" data-sa-quota-user="1" data-sa-tenant="' + pkEsc(t.tenantId) + '">+1</button></div></div>' +
          '</div></div></div>';
      }
      gridEl.innerHTML = gHtml;
    }
    var reqCount = document.getElementById('sa-requests-count'); if (reqCount) reqCount.textContent = STATE.featureRequests.length + ' solicitudes';
    var reqBody = document.getElementById('sa-feature-requests-body');
    if (reqBody) {
      if (STATE.featureRequests.length === 0) reqBody.innerHTML = '<div style="font-size:12px;color:var(--pk-muted)">No hay solicitudes pendientes.</div>';
      else {
        var rHtml = '<table><thead><tr><th>Empresa</th><th>Tipo</th><th>Solicitud</th><th>Estado</th></tr></thead><tbody>';
        for (var r = 0; r < STATE.featureRequests.length; r++) rHtml += '<tr><td><strong>' + pkEsc(STATE.featureRequests[r].companyName) + '</strong></td><td>' + pkEsc(STATE.featureRequests[r].tier) + '</td><td>' + pkEsc(STATE.featureRequests[r].label) + '</td><td><span class="badge badge-emerald">Activada</span></td></tr>';
        reqBody.innerHTML = rHtml + '</tbody></table>';
      }
    }
    if (typeof pkRenderGroupsCatalogAdmin === 'function') pkRenderGroupsCatalogAdmin();
  }

  function pkUpdateShellNavigation() {
    var pubNav = document.getElementById('public-nav-tabs');
    var sessBar = document.getElementById('authenticated-session-bar');
    var topCtx = document.getElementById('top-context-label');
    var sShow = document.getElementById('surface-showcase'); var sAuth = document.getElementById('surface-auth'); var sSa = document.getElementById('surface-superadmin'); var sWs = document.getElementById('surface-workstation');
    if (sShow) sShow.classList.remove('active'); if (sAuth) sAuth.classList.remove('active'); if (sSa) sSa.classList.remove('active'); if (sWs) sWs.classList.remove('active');

    if (STATE.session) {
      if (pubNav) pubNav.style.display = 'none'; if (sessBar) sessBar.style.display = 'flex';
      var rBadge = document.getElementById('session-role-badge'); var dBadge = document.getElementById('session-db-badge'); var uLabel = document.getElementById('session-user-label');
      if (STATE.session.role === 'superadmin' || STATE.session.role === 'desarrollador' || STATE.session.role === 'auxiliar') {
        if (rBadge) rBadge.textContent = 'Perfil: ' + STATE.session.role.toUpperCase(); if (dBadge) dBadge.textContent = 'Administraci\xF3n Central'; if (uLabel) uLabel.textContent = STATE.session.username; if (topCtx) topCtx.textContent = '| Administraci\xF3n Central';
        if (sSa) sSa.classList.add('active'); pkRenderSuperAdmin();
      } else {
        var cl = pkGetActiveClient();
        if (rBadge) rBadge.textContent = STATE.session.internalRoleName || 'Administrador'; if (dBadge) dBadge.textContent = cl ? cl.companyName : 'Mi Empresa'; if (uLabel) uLabel.textContent = STATE.session.username; if (topCtx) topCtx.textContent = '| ' + (cl ? cl.companyName : 'Mi Empresa');
        if (sWs) sWs.classList.add('active'); if (cl && cl.dbName) pkHydrateClientRelationalWorkspace(cl.dbName); pkRenderWorkstation();
      }
      return;
    }

    if (pubNav) pubNav.style.display = 'flex'; if (sessBar) sessBar.style.display = 'none';
    var tShow = document.getElementById('tab-nav-showcase'); var tAuth = document.getElementById('tab-nav-auth'); var tDemo = document.getElementById('tab-nav-demo');
    if (tShow) tShow.className = 'pk-tab-btn ' + (STATE.publicTab === 'showcase' ? 'active' : '');
    if (tAuth) tAuth.className = 'pk-tab-btn ' + (STATE.publicTab === 'auth' ? 'active' : '');
    if (tDemo) tDemo.className = 'pk-tab-btn ' + (STATE.publicTab === 'demo' ? 'active' : '');

    if (STATE.publicTab === 'showcase') { if (topCtx) topCtx.textContent = '| Soluciones para tu Empresa'; if (sShow) sShow.classList.add('active'); pkRenderShowcase(); }
    else if (STATE.publicTab === 'auth') {
      if (topCtx) topCtx.textContent = STATE.authMode === 'register' ? '| Registra tu Negocio' : '| Iniciar Sesi\xF3n'; if (sAuth) sAuth.classList.add('active');
      var pLogin = document.getElementById('auth-pane-login'); var pReg = document.getElementById('auth-pane-register'); var bLogin = document.getElementById('btn-auth-mode-login'); var bReg = document.getElementById('btn-auth-mode-register');
      if (pLogin) pLogin.style.display = STATE.authMode === 'login' ? 'block' : 'none'; if (pReg) pReg.style.display = STATE.authMode === 'register' ? 'block' : 'none';
      if (bLogin) bLogin.className = 'btn ' + (STATE.authMode === 'login' ? 'btn-primary' : 'btn-outline'); if (bReg) bReg.className = 'btn ' + (STATE.authMode === 'register' ? 'btn-primary' : 'btn-outline');
      pkRenderRegistrationWizard();
    } else if (STATE.publicTab === 'demo') { STATE.activeTenantId = 'tnt-demo'; if (topCtx) topCtx.textContent = '| Plataforma en Vivo'; if (sWs) sWs.classList.add('active'); pkRenderWorkstation(); }
  }

  function pkHandleSuperAdminAction(target) {
    if (target.closest('#btn-create-internal-role')) {
      var clR = pkGetActiveClient(); if (clR.internalRoles.length >= clR.maxRolesAllowed) { pkToast('Cupo m\xE1ximo de roles alcanzado.'); return true; }
      var rName = ((document.getElementById('new-role-name') || {}).value || '').trim(); if (!rName) { pkToast('Ingresa el nombre del rol.'); return true; }
      clR.internalRoles.push({ roleId: 'rol-' + Date.now(), name: rName, description: ((document.getElementById('new-role-desc') || {}).value || 'Rol operativo').trim(), allowedSubmodules: clR.activeSubmodules.slice(0, 4) });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage(); pkRenderWorkstation(); pkToast('Rol creado: ' + rName); return true;
    }
    if (target.closest('#btn-create-internal-user')) {
      var clU = pkGetActiveClient(); if (clU.internalUsers.length >= clU.maxUsersAllowed) { pkToast('Cupo m\xE1ximo de usuarios alcanzado.'); return true; }
      var uFull = ((document.getElementById('new-user-fullname') || {}).value || '').trim(); var uName = ((document.getElementById('new-user-username') || {}).value || '').trim();
      if (!uFull || !uName) { pkToast('Completa nombre y usuario.'); return true; }
      clU.internalUsers.push({ userId: 'u-' + Date.now(), username: uName, fullName: uFull, email: uName + '@empresa.co', internalRoleId: 'rol-operador', internalRoleName: 'Usuario Operativo', passwordHint: 'Usr#2026!', isClientAdmin: false });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage(); pkRenderWorkstation(); pkToast('Usuario creado: ' + uName); return true;
    }
    var reqBtn = target.closest('[data-req-key]');
    if (reqBtn) {
      var clF = pkGetActiveClient(); var rTier = reqBtn.getAttribute('data-req-tier'); var rKey = reqBtn.getAttribute('data-req-key'); var rLbl = reqBtn.getAttribute('data-req-label');
      if (rTier === 'SUBMODULO' && clF.activeSubmodules.indexOf(rKey) === -1) clF.activeSubmodules.push(rKey);
      if (rTier === 'FUNCIONALIDAD' && clF.activeFeatures.indexOf(rKey) === -1) clF.activeFeatures.push(rKey);
      STATE.featureRequests.push({ companyName: clF.companyName, tier: rTier, key: rKey, label: rLbl });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage(); pkRenderWorkstation(); pkToast('M\xF3dulo activado: ' + rLbl); return true;
    }
    if (typeof pkHandleDeveloperCatalogAction === 'function' && pkHandleDeveloperCatalogAction(target)) return true;
    var qRoleBtn = target.closest('[data-sa-quota-role]');
    if (qRoleBtn) {
      var tidR = qRoleBtn.getAttribute('data-sa-tenant'); var deltaR = Number(qRoleBtn.getAttribute('data-sa-quota-role'));
      for (var qr = 0; qr < STATE.clients.length; qr++) if (STATE.clients[qr].tenantId === tidR) STATE.clients[qr].maxRolesAllowed = Math.max(1, STATE.clients[qr].maxRolesAllowed + deltaR);
      pkRenderSuperAdmin(); return true;
    }
    var qUserBtn = target.closest('[data-sa-quota-user]');
    if (qUserBtn) {
      var tidU = qUserBtn.getAttribute('data-sa-tenant'); var deltaU = Number(qUserBtn.getAttribute('data-sa-quota-user'));
      for (var qu = 0; qu < STATE.clients.length; qu++) if (STATE.clients[qu].tenantId === tidU) STATE.clients[qu].maxUsersAllowed = Math.max(1, STATE.clients[qu].maxUsersAllowed + deltaU);
      pkRenderSuperAdmin(); return true;
    }
    var saOpen = target.closest('[data-sa-open]');
    if (saOpen) { STATE.activeTenantId = saOpen.getAttribute('data-sa-open'); STATE.session = { role: 'cliente', username: 'admin', tenantId: STATE.activeTenantId, internalRoleName: 'Administrador General' }; pkUpdateShellNavigation(); return true; }
    var saRegen = target.closest('[data-sa-regen]');
    if (saRegen) { var tidG = saRegen.getAttribute('data-sa-regen'); for (var g = 0; g < STATE.clients.length; g++) if (STATE.clients[g].tenantId === tidG) STATE.clients[g].adminPasswordHint = 'PkReset#' + String(Date.now()).slice(-4) + '!'; pkRenderSuperAdmin(); pkToast('Nueva clave generada.'); return true; }
    return false;
  }
`;
}

// apps/web-app/src/presentation/client-runtime/workshop-kanban-hub.runtime.ts
function renderWorkshopKanbanHubRuntimeJs() {
  return `
  function pkRenderKanbanHub(subKey) {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;

    if (subKey === 'mod-vehicles-assets') {
      var vRows = '';
      for (var v = 0; v < db.vehicles.length; v++) {
        var ve = db.vehicles[v];
        var oilDiff = ve.nextOilChangeKm - ve.currentKm;
        vRows += '<tr><td><span class="badge badge-blue">\u{1F697} ' + pkEsc(ve.plate) + '</span></td>' +
          '<td><strong>' + pkEsc(ve.brand) + '</strong> (' + pkEsc(ve.modelYear || '2025') + ')</td>' +
          '<td><strong>' + pkEsc(ve.customerName) + '</strong></td>' +
          '<td>Actual: <strong>' + Number(ve.currentKm || 0).toLocaleString('es-CO') + ' km</strong> \xB7 Pr\xF3x: ' + Number(ve.nextOilChangeKm || 0).toLocaleString('es-CO') + ' km ' +
          (oilDiff <= 500 ? '<span class="badge badge-amber">\u26A0\uFE0F Cambio Pronto</span>' : '') + '</td>' +
          '<td>SOAT: ' + pkEsc(ve.soatExpiry) + '</td>' +
          '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" data-open-vehicle-360="' + pkEsc(ve.id) + '">\u{1F441}\uFE0F Historial</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-print-veh="' + pkEsc(ve.id) + '">\u{1F5A8}\uFE0F Imprimir</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-veh-delete-id="' + pkEsc(ve.id) + '">\u{1F5D1}\uFE0F</button></div></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">\u{1F697} Veh\xEDculos y Placas Registradas (' + db.vehicles.length + ')</div>' +
        '<button type="button" class="btn btn-primary btn-sm" data-open-quick-entity="VEHICLE">+ Registrar Nueva Placa / Veh\xEDculo</button></div>' +
        '<div class="card-body"><div class="table-wrap"><table><thead><tr><th>Placa</th><th>Marca y L\xEDnea</th><th>Propietario</th><th>Kilometraje / Aceite</th><th>SOAT</th><th>Acciones</th></tr></thead><tbody>' + vRows + '</tbody></table></div></div></div>';
      return;
    }

    if (subKey === 'mod-worker-commissions') {
      var wkRows = '';
      for (var w = 0; w < db.workers.length; w++) {
        var wk = db.workers[w];
        var gross = Number(wk.totalDayGross || 0);
        var techPay = Math.round(gross * (Number(wk.commissionPct || 40) / 100));
        wkRows += '<tr><td><strong>' + pkEsc(wk.name) + '</strong><div style="font-size:11px;color:var(--pk-muted)">' + pkEsc(wk.specialty) + '</div></td>' +
          '<td><span class="badge badge-blue">' + wk.commissionPct + '% T\xE9cnico</span></td><td>' + pkCop(gross) + '</td>' +
          '<td style="color:var(--pk-primary);font-weight:800">' + pkCop(techPay) + '</td><td style="color:var(--pk-emerald);font-weight:800">' + pkCop(gross - techPay) + '</td>' +
          '<td><div class="row-actions">' + (gross > 0 ? '<button type="button" class="btn btn-emerald btn-sm" data-settle-worker="' + pkEsc(wk.id) + '">\u26A1 Liquidar (' + pkCop(techPay) + ')</button>' : '<span class="badge badge-slate">\u2713 Al d\xEDa</span>') +
          '<button type="button" class="btn btn-outline btn-sm" data-print-worker="' + pkEsc(wk.id) + '">\u{1F5A8}\uFE0F Comprobante</button></div></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">\u{1F477} Comisiones de T\xE9cnicos y Especialistas</div></div>' +
        '<div class="card-body"><div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
        '<div class="field"><label>Nombre del T\xE9cnico / Profesional</label><input type="text" id="wk-new-name" placeholder="Ej: Jorge Iv\xE1n R\xEDos" /></div>' +
        '<div class="field"><label>Especialidad / Cargo</label><select id="wk-new-spec"><option>Mec\xE1nica General y Sincronizaci\xF3n</option><option>Electricidad y Esc\xE1ner</option><option>Frenos, Suspensi\xF3n y Alineaci\xF3n</option><option>Latoner\xEDa y Pintura</option><option>Especialista de Servicio</option></select></div>' +
        '<div class="field"><label>% Comisi\xF3n</label><div class="row-actions"><select id="wk-new-pct" style="flex:1"><option value="30">30%</option><option value="40" selected>40%</option><option value="45">45%</option><option value="50">50%</option></select>' +
        '<button type="button" class="btn btn-primary" id="btn-wk-add">+ Agregar T\xE9cnico</button></div></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>T\xE9cnico</th><th>Porcentaje</th><th>Producido Hoy</th><th>Pago T\xE9cnico</th><th>Utilidad Empresa</th><th>Acciones</th></tr></thead><tbody>' + wkRows + '</tbody></table></div></div></div>';
      return;
    }

    var stages = ['Recibido', 'En Diagn\xF3stico', 'Esperando Repuesto', 'En Proceso', 'Listo para Entrega'];
    var stageBadges = ['badge-slate', 'badge-blue', 'badge-amber', 'badge-blue', 'badge-emerald'];
    var custOpts = ''; for (var c = 0; c < db.customers.length; c++) custOpts += '<option value="' + pkEsc(db.customers[c].id) + '">' + pkEsc(db.customers[c].name) + '</option>';
    var vehOpts = ''; for (var vp = 0; vp < db.vehicles.length; vp++) vehOpts += '<option value="' + pkEsc(db.vehicles[vp].plate) + '" data-brand="' + pkEsc(db.vehicles[vp].brand) + '">' + pkEsc(db.vehicles[vp].plate + ' \u2014 ' + db.vehicles[vp].brand) + '</option>';
    var workerOpts = ''; for (var wkIdx = 0; wkIdx < db.workers.length; wkIdx++) workerOpts += '<option value="' + pkEsc(db.workers[wkIdx].id) + '">' + pkEsc(db.workers[wkIdx].name + ' \u2014 ' + db.workers[wkIdx].specialty) + '</option>';
    var nextWoCode = 'OT-' + (3041 + db.workOrders.length);

    var columnsHtml = '';
    for (var s = 0; s < stages.length; s++) {
      var stg = stages[s]; var cardsHtml = ''; var count = 0;
      for (var o = 0; o < db.workOrders.length; o++) {
        var wo = db.workOrders[o]; if (wo.status !== stg) continue; count++;
        var svcsSummary = ''; for (var k = 0; k < (wo.services || []).length; k++) svcsSummary += '<div style="font-size:11px">\u2022 ' + pkEsc(wo.services[k].description) + '</div>';
        var nextStage = s < stages.length - 1 ? stages[s + 1] : null; var prevStage = s > 0 ? stages[s - 1] : null;
        cardsHtml += '<div style="background:#fff;border:1px solid var(--pk-border);border-radius:10px;padding:10px;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="badge ' + stageBadges[s] + '">\u{1F697} ' + pkEsc(wo.plate) + '</span><strong style="font-size:12px;color:var(--pk-emerald)">' + pkCop(wo.totalEstimated) + '</strong></div>' +
          '<div style="font-size:12px;font-weight:800">' + pkEsc(wo.id + ' \xB7 ' + wo.vehicleBrand) + '</div>' +
          '<div style="font-size:11px;color:var(--pk-muted);margin-bottom:6px">\u{1F464} ' + pkEsc(wo.customerName) + '<br/>\u{1F477} ' + pkEsc(wo.workerName) + '</div>' +
          '<div style="background:#f8fafc;padding:6px;border-radius:6px;margin-bottom:6px">' + svcsSummary + '</div>' +
          '<div class="row-actions" style="justify-content:space-between;margin-bottom:6px">' +
          (prevStage ? '<button type="button" class="btn btn-outline btn-sm" style="padding:3px 7px;font-size:10px" data-wo-move="' + pkEsc(wo.id) + '" data-wo-stage="' + pkEsc(prevStage) + '">&larr;</button>' : '<span></span>') +
          (nextStage ? '<button type="button" class="btn btn-primary btn-sm" style="padding:3px 8px;font-size:10px" data-wo-move="' + pkEsc(wo.id) + '" data-wo-stage="' + pkEsc(nextStage) + '">Pasar a ' + pkEsc(nextStage) + ' &rarr;</button>' : '') +
          '</div><div class="row-actions" style="border-top:1px dashed var(--pk-border);padding-top:6px">' +
          '<button type="button" class="btn btn-emerald btn-sm" style="flex:1" data-pos-load-order="' + pkEsc(wo.id) + '">\u{1F4B5} Cobrar</button>' +
          '<button type="button" class="btn btn-outline btn-sm" title="Imprimir Orden" data-print-wo="' + pkEsc(wo.id) + '">\u{1F5A8}\uFE0F</button>' +
          '<button type="button" class="btn btn-outline btn-sm" title="WhatsApp" data-wo-whatsapp="' + pkEsc(wo.id) + '">\u{1F4AC}</button></div></div>';
      }
      if (!cardsHtml) cardsHtml = '<div style="font-size:11px;color:var(--pk-muted);text-align:center;padding:16px 6px;border:1px dashed var(--pk-border);border-radius:8px">Sin \xF3rdenes</div>';
      columnsHtml += '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:10px;min-width:210px;flex:1"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="font-size:12px">' + pkEsc(stg) + '</strong><span class="badge ' + stageBadges[s] + '">' + count + '</span></div>' + cardsHtml + '</div>';
    }

    stage.innerHTML =
      '<div class="card"><div class="card-head"><div class="card-title">\u2795 Recibir Veh\xEDculo / Crear Orden de Trabajo (' + nextWoCode + ')</div>' +
      '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-open-new-customer-modal="1">+ Nuevo Cliente</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-open-quick-entity="VEHICLE">+ Nueva Placa / Veh\xEDculo</button></div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>N\xB0 Orden (Autom\xE1tico)</label><input type="text" value="' + nextWoCode + '" readonly style="background:#e2e8f0;font-weight:800" /></div>' +
      '<div class="field"><label>Cliente Propietario</label><select id="wo-customer-id">' + custOpts + '</select></div>' +
      '<div class="field"><label>Seleccionar Placa / Veh\xEDculo</label><select id="wo-plate">' + vehOpts + '</select></div>' +
      '<div class="field"><label>Kilometraje Actual</label><div class="row-actions"><input type="number" id="wo-current-km" value="45000" style="flex:1" /><button type="button" class="btn btn-outline btn-sm" id="btn-wo-suggest-oil">+3.000</button></div></div>' +
      '<div class="field"><label>Pr\xF3ximo Cambio Aceite (Km)</label><input type="number" id="wo-next-oil-km" value="48000" /></div>' +
      '<div class="field"><label>T\xE9cnico Asignado</label><select id="wo-worker-id">' + workerOpts + '</select></div>' +
      '<div class="field"><label>Servicio Principal</label><select id="wo-service-desc"><option value="Mantenimiento Preventivo General|140000">Mantenimiento Preventivo General ($140.000)</option><option value="Cambio de Aceite y Filtros|65000">Cambio de Aceite y Filtros ($65.000)</option><option value="Sincronizaci\xF3n e Inyecci\xF3n Electr\xF3nica|120000">Sincronizaci\xF3n e Inyecci\xF3n ($120.000)</option><option value="Cambio de Pastillas y Revisi\xF3n Frenos|85000">Revisi\xF3n y Pastillas de Freno ($85.000)</option><option value="Diagn\xF3stico Computarizado Esc\xE1ner|90000">Diagn\xF3stico Esc\xE1ner ($90.000)</option></select></div>' +
      '<div class="field"><label>Valor Mano de Obra ($)</label><div class="row-actions"><input type="number" id="wo-service-price" value="140000" style="flex:1" /><button type="button" class="btn btn-primary" id="btn-wo-create-order">\u2713 Crear Orden</button></div></div>' +
      '</div></div></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">\u{1F4CB} Tablero de \xD3rdenes en Vivo</div></div><div class="card-body"><div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px">' + columnsHtml + '</div></div></div>';
  }

  function pkRenderHotelHub() {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;
    var rooms = db.hotelRooms || [];
    var custOpts = ''; for (var c = 0; c < db.customers.length; c++) custOpts += '<option value="' + pkEsc(db.customers[c].id) + '">' + pkEsc(db.customers[c].name + ' (' + db.customers[c].nit + ')') + '</option>';
    var availRoomOpts = '';
    var roomCards = '';
    for (var r = 0; r < rooms.length; r++) {
      var rm = rooms[r];
      var isOcc = rm.status === 'Ocupada';
      if (!isOcc) availRoomOpts += '<option value="' + pkEsc(rm.id) + '">' + pkEsc(rm.roomNumber + ' \u2014 ' + rm.roomType + ' (' + pkCop(rm.nightlyRate) + '/noche)') + '</option>';
      var totalStay = (Number(rm.nights || 1) * Number(rm.nightlyRate || 0)) + Number(rm.extrasTotal || 0);
      roomCards += '<div class="card" style="margin:0;border:2px solid ' + (isOcc ? '#f59e0b' : '#10b981') + '">' +
        '<div class="card-head" style="background:' + (isOcc ? '#fffbeb' : '#ecfdf5') + '">' +
        '<div><div class="card-title">\u{1F6CF}\uFE0F ' + pkEsc(rm.roomNumber) + '</div><div class="card-sub">' + pkEsc(rm.roomType + ' \xB7 ' + rm.floor) + '</div></div>' +
        '<span class="badge ' + (isOcc ? 'badge-amber' : 'badge-emerald') + '">' + pkEsc(rm.status) + '</span></div>' +
        '<div class="card-body">' +
        '<div style="font-size:12px;margin-bottom:8px"><strong>Tarifa/Noche:</strong> ' + pkCop(rm.nightlyRate) + '</div>' +
        (isOcc
          ? '<div style="background:#f8fafc;padding:8px;border-radius:8px;font-size:12px;margin-bottom:10px">' +
            '<div>\u{1F464} <strong>Hu\xE9sped:</strong> ' + pkEsc(rm.guestName) + '</div>' +
            '<div>\u{1F4C5} <strong>Ingreso:</strong> ' + pkEsc(rm.checkInDate) + ' (' + rm.nights + ' noches)</div>' +
            '<div>\u{1F37D}\uFE0F <strong>Consumos Extra:</strong> ' + pkCop(rm.extrasTotal || 0) + '</div>' +
            '<div style="margin-top:4px;font-size:14px;font-weight:800;color:var(--pk-primary)">Total Cuenta: ' + pkCop(totalStay) + '</div></div>' +
            '<div class="row-actions">' +
            '<button type="button" class="btn btn-outline btn-sm" data-hotel-add-extra="' + pkEsc(rm.id) + '">+ Consumo ($25k)</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-print-hotel-room="' + pkEsc(rm.id) + '">\u{1F5A8}\uFE0F Imprimir Cuenta</button>' +
            '<button type="button" class="btn btn-emerald btn-sm" data-hotel-checkout-pos="' + pkEsc(rm.id) + '">\u{1F4B5} Cobrar Check-Out</button></div>'
          : '<div style="color:var(--pk-muted);font-size:12px;margin-bottom:10px">Lista para recibir hu\xE9sped.</div>' +
            '<button type="button" class="btn btn-outline btn-sm" data-print-hotel-room="' + pkEsc(rm.id) + '">\u{1F5A8}\uFE0F Ficha Habitaci\xF3n</button>') +
        '</div></div>';
    }
    if (!availRoomOpts) availRoomOpts = '<option value="' + pkEsc(rooms[0] ? rooms[0].id : '') + '">Todas ocupadas (Seleccionar para actualizar)</option>';

    stage.innerHTML =
      '<div class="card" style="border:2px solid #023047"><div class="card-head" style="background:#023047;color:#fff">' +
      '<div class="card-title" style="color:#fff">\u{1F3E8} 1. Registrar Check-In / Entrada de Hu\xE9sped</div>' +
      '<div class="row-actions"><button type="button" class="btn btn-amber btn-sm" data-open-new-customer-modal="1">+ Nuevo Hu\xE9sped / Cliente</button>' +
      '<button type="button" class="btn btn-outline btn-sm" style="background:#fff;color:#023047" data-open-quick-entity="ROOM">+ Crear Habitaci\xF3n</button></div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>N\xB0 Registro (Autom\xE1tico)</label><input type="text" value="CHK-' + (500 + rooms.length) + '" readonly style="background:#e2e8f0;font-weight:800" /></div>' +
      '<div class="field"><label>Seleccionar Habitaci\xF3n Disponible</label><select id="hotel-room-select">' + availRoomOpts + '</select></div>' +
      '<div class="field"><label>Seleccionar Hu\xE9sped / Empresa</label><select id="hotel-guest-select">' + custOpts + '</select></div>' +
      '<div class="field"><label>Cantidad de Noches</label><select id="hotel-nights-select"><option value="1">1 Noche</option><option value="2" selected>2 Noches</option><option value="3">3 Noches</option><option value="4">4 Noches</option><option value="7">7 Noches (Semana)</option></select></div>' +
      '<div class="field"><button type="button" class="btn btn-emerald" style="width:100%" id="btn-hotel-checkin">\u2713 Confirmar Check-In</button></div>' +
      '</div></div></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">\u{1F6CF}\uFE0F 2. Estado de Habitaciones, Consumos e Impresi\xF3n de Cuentas</div></div>' +
      '<div class="card-body"><div class="center-selector-grid">' + roomCards + '</div></div></div>';
  }
`;
}

// apps/web-app/src/presentation/client-runtime/workstation-controller.runtime.ts
function renderClientRuntimeBundleJs() {
  return `(function() {
${renderRelationalSeedDataRuntimeJs()}
${renderDomSanitizerRuntimeJs()}
${renderFormAndTableRuntimeJs()}
${renderPosHybridHubRuntimeJs()}
${renderWorkshopKanbanHubRuntimeJs()}
${renderInventoryWmsHubRuntimeJs()}
${renderCrm360CxcHubRuntimeJs()}
${renderReportsCashboxCommissionsHubRuntimeJs()}
${renderRelationalModalsRuntimeJs()}
${renderRelationalHubSecondaryActionsRuntimeJs()}
${renderRelationalHubActionsRuntimeJs()}
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

    var shPreset = target.closest('[data-showcase-preset]'); if (shPreset) { pkGoRegister(shPreset.getAttribute('data-showcase-preset')); return; }
    var bTypeBtn = target.closest('[data-select-btype]');
    if (bTypeBtn) { STATE.selectedBusinessTypeId = bTypeBtn.getAttribute('data-select-btype'); STATE.extraServiceKeys = {}; STATE.extraSubmoduleKeys = {}; pkRenderRegistrationWizard(); return; }

    if (target.closest('#btn-submit-login')) {
      var uVal = ((document.getElementById('login-username') || {}).value || '').trim().toLowerCase();
      if (!uVal) { pkToast('Ingresa tu usuario o correo.'); return; }
      if (uVal.indexOf('superadmin') !== -1) STATE.session = { role: 'superadmin', username: uVal };
      else if (uVal.indexOf('dev') !== -1 || uVal.indexOf('desarrollador') !== -1) STATE.session = { role: 'desarrollador', username: uVal };
      else if (uVal.indexOf('aux') !== -1) STATE.session = { role: 'auxiliar', username: uVal };
      else {
        var matchedClient = STATE.clients[STATE.clients.length - 1] || STATE.clients[0];
        for (var i = 0; i < STATE.clients.length; i++) if (STATE.clients[i].adminUsername.toLowerCase() === uVal) matchedClient = STATE.clients[i];
        if (!matchedClient) { pkToast('No hay una empresa registrada con ese usuario.'); return; }
        STATE.activeTenantId = matchedClient.tenantId;
        STATE.session = { role: 'cliente', username: uVal, tenantId: matchedClient.tenantId, internalRoleName: 'Administrador General' };
      }
      pkUpdateShellNavigation(); pkToast('Bienvenido a Proveko.'); return;
    }

    if (target.closest('#btn-open-standby-checkout') || target.closest('#btn-sa-new-client') || target.closest('#btn-sa-empty-new-client')) {
      var cName = ((document.getElementById('reg-company-name') || {}).value || '').trim() || 'Nueva Empresa Cliente S.A.S.';
      var plan = pkComputeRegistrationPlan();
      document.getElementById('pay-modal-company').value = cName; document.getElementById('pay-modal-amount').value = pkCop(plan.totalUsd) + '/mes';
      document.getElementById('payment-step-checkout').style.display = 'block'; document.getElementById('payment-step-credentials').style.display = 'none';
      document.getElementById('standby-payment-modal').classList.add('open'); return;
    }
    if (target.closest('#btn-close-payment-modal')) { document.getElementById('standby-payment-modal').classList.remove('open'); return; }
    if (target.closest('#btn-confirm-standby-payment')) { pkConfirmStandbyCheckout(); return; }
    if (target.closest('#btn-enter-with-generated-creds') && STATE.lastGeneratedClient) {
      var gc = STATE.lastGeneratedClient; document.getElementById('standby-payment-modal').classList.remove('open');
      STATE.activeTenantId = gc.tenantId; STATE.session = { role: 'cliente', username: gc.adminUsername, tenantId: gc.tenantId, internalRoleName: 'Administrador General' };
      pkUpdateShellNavigation(); return;
    }

    if (pkHandleRelationalHubClick(target)) return;

    var db = STATE.relDb;
    if (db) {
      var settleBtn = target.closest('[data-settle-worker]');
      if (settleBtn) {
        var wkS = pkFindById(db.workers, settleBtn.getAttribute('data-settle-worker'));
        if (wkS && wkS.totalDayGross > 0) {
          var g = Number(wkS.totalDayGross); var pay = Math.round(g * (wkS.commissionPct / 100));
          db.settlements.unshift({ id: 'LIQ-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), workerId: wkS.id, workerName: wkS.name, grossLabor: g, commissionPct: wkS.commissionPct, technicianPayout: pay, companyRetention: g - pay });
          wkS.totalDayGross = 0; pkPersistRelationalTx('SETTLE_WORKER', { workerId: wkS.id, payout: pay }); pkRenderWorkstation(); pkToast('Liquidado ' + wkS.name + ' por ' + pkCop(pay));
        }
        return;
      }
      if (target.closest('#btn-wk-add')) {
        var wName = ((document.getElementById('wk-new-name') || {}).value || '').trim(); if (!wName) { pkToast('Ingresa el nombre del t\xE9cnico.'); return; }
        db.workers.push({ id: 'wk-' + Date.now(), name: wName, docNumber: '1020' + String(Date.now()).slice(-5), specialty: ((document.getElementById('wk-new-spec') || {}).value || 'T\xE9cnico').trim(), commissionPct: Number((document.getElementById('wk-new-pct') || {}).value || 40), phone: '3000000000', totalDayGross: 0 });
        pkRenderWorkstation(); pkToast('T\xE9cnico agregado: ' + wName); return;
      }
      if (target.closest('#btn-exp-add')) {
        var eDesc = ((document.getElementById('exp-new-desc') || {}).value || '').trim(); if (!eDesc) { pkToast('Ingresa el concepto del gasto.'); return; }
        var eAmt = Math.max(1000, Number((document.getElementById('exp-new-amount') || {}).value || 25000));
        db.expenses.unshift({ id: 'EGR-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), category: (document.getElementById('exp-new-cat') || {}).value || 'Gastos Operativos', description: eDesc, amount: eAmt, paymentSource: (document.getElementById('exp-new-source') || {}).value || 'Efectivo Caja', responsible: 'Caja' });
        pkPersistRelationalTx('ADD_EXPENSE', { description: eDesc, amount: eAmt }); pkRenderWorkstation(); pkToast('Gasto registrado por ' + pkCop(eAmt)); return;
      }
      if (target.closest('#btn-cnt-add')) {
        var cCode = ((document.getElementById('cnt-new-code') || {}).value || ('CNV-' + String(Date.now()).slice(-3))).trim();
        var cEnt = ((document.getElementById('cnt-new-entity') || {}).value || 'Empresa Convenio').trim();
        var cCeil = Math.max(100000, Number((document.getElementById('cnt-new-ceiling') || {}).value || 15000000));
        db.contracts.unshift({ id: 'cnt-' + Date.now(), code: cCode, entityName: cEnt, tariffName: (document.getElementById('cnt-new-tariff') || {}).value || 'Tarifa Preferencial (-15%)', budgetCeiling: cCeil, consumedAmount: 0, availableBalance: cCeil, status: 'Activo' });
        pkRenderWorkstation(); pkToast('Convenio creado: ' + cCode); return;
      }
      if (target.closest('#btn-sup-add')) {
        var sName = ((document.getElementById('sup-new-name') || {}).value || '').trim(); if (!sName) { pkToast('Escribe la raz\xF3n social del proveedor.'); return; }
        db.suppliers.unshift({ id: 'sup-' + Date.now(), nit: ((document.getElementById('sup-new-nit') || {}).value || '900123456-1').trim(), name: sName, city: ((document.getElementById('sup-new-city') || {}).value || 'Bogot\xE1').trim(), phone: ((document.getElementById('sup-new-phone') || {}).value || '3100000000').trim() });
        pkRenderWorkstation(); pkToast('Proveedor guardado: ' + sName); return;
      }
      var delCust = target.closest('[data-cust-delete-id]'); if (delCust) { var cid = delCust.getAttribute('data-cust-delete-id'); for (var dc = 0; dc < db.customers.length; dc++) if (db.customers[dc].id === cid) { db.customers.splice(dc, 1); break; } pkRenderWorkstation(); return; }
      var delVeh = target.closest('[data-veh-delete-id]'); if (delVeh) { var vid = delVeh.getAttribute('data-veh-delete-id'); for (var dv = 0; dv < db.vehicles.length; dv++) if (db.vehicles[dv].id === vid) { db.vehicles.splice(dv, 1); break; } pkRenderWorkstation(); return; }
      var delExp = target.closest('[data-exp-delete-id]'); if (delExp) { var eid = delExp.getAttribute('data-exp-delete-id'); for (var de = 0; de < db.expenses.length; de++) if (db.expenses[de].id === eid) { db.expenses.splice(de, 1); break; } pkRenderWorkstation(); return; }
      var delSup = target.closest('[data-sup-delete-id]'); if (delSup) { var sid = delSup.getAttribute('data-sup-delete-id'); for (var ds = 0; ds < db.suppliers.length; ds++) if (db.suppliers[ds].id === sid) { db.suppliers.splice(ds, 1); break; } pkRenderWorkstation(); return; }
      var csvBtn = target.closest('[data-export-csv]');
      if (csvBtn) {
        var kind = csvBtn.getAttribute('data-export-csv');
        if (kind === 'invoices') { var rInv = []; for (var i1 = 0; i1 < db.invoices.length; i1++) rInv.push([db.invoices[i1].id, db.invoices[i1].date, db.invoices[i1].customerName, db.invoices[i1].total, db.invoices[i1].amountPaid, db.invoices[i1].pendingBalance, db.invoices[i1].status]); pkDownloadCsvUtf8('facturas_y_cartera.csv', ['Factura', 'Fecha', 'Cliente', 'Total', 'Pagado', 'Saldo', 'Estado'], rInv); }
        else if (kind === 'inventory') { var rPrd = []; for (var i2 = 0; i2 < db.products.length; i2++) rPrd.push([db.products[i2].code, db.products[i2].name, db.products[i2].category, db.products[i2].costPrice, db.products[i2].salePrice, db.products[i2].stock]); pkDownloadCsvUtf8('inventario_productos.csv', ['Codigo', 'Producto', 'Categoria', 'Costo', 'Precio_Venta', 'Existencia'], rPrd); }
        else if (kind === 'expenses') { var rExp = []; for (var i3 = 0; i3 < db.expenses.length; i3++) rExp.push([db.expenses[i3].id, db.expenses[i3].date, db.expenses[i3].category, db.expenses[i3].description, db.expenses[i3].paymentSource, db.expenses[i3].amount]); pkDownloadCsvUtf8('gastos_caja.csv', ['ID', 'Fecha', 'Categoria', 'Concepto', 'Medio', 'Valor'], rExp); }
        pkToast('Archivo Excel CSV descargado.'); return;
      }
    }

    var stdDel = target.closest('[data-std-del-idx]');
    if (stdDel) { var listStd = STATE.submoduleRows[STATE.activeSubmoduleKey]; if (listStd) { listStd.splice(Number(stdDel.getAttribute('data-std-del-idx')), 1); pkRenderWorkstation(); pkToast('Registro eliminado.'); } return; }
    var wsSvc = target.closest('[data-ws-service]');
    if (wsSvc) { STATE.activeWorkstationPane = 'module'; STATE.activeServiceKey = wsSvc.getAttribute('data-ws-service'); STATE.activeSubmoduleKey = ''; pkRenderWorkstation(); return; }
    var wsSub = target.closest('[data-ws-submodule]');
    if (wsSub) { STATE.activeSubmoduleKey = wsSub.getAttribute('data-ws-submodule'); pkRenderWorkstation(); return; }
    if (target.closest('#btn-nav-internal-rbac')) { STATE.activeWorkstationPane = 'rbac'; pkRenderWorkstation(); return; }
    if (target.closest('#btn-nav-need-feature')) { STATE.activeWorkstationPane = 'need-feature'; pkRenderWorkstation(); return; }
    if (target.closest('#btn-ws-save-record')) {
      var inputs = document.querySelectorAll('[data-ws-field]');
      var isAuto0 = inputs.length > 0 && inputs[0].hasAttribute('readonly');
      var recId = isAuto0 ? inputs[0].value : ('REG-' + String(Date.now()).slice(-4));
      var row = isAuto0 ? [] : [recId]; for (var f = 0; f < inputs.length; f++) row.push(inputs[f].value || 'Registrado');
      if (!STATE.submoduleRows[STATE.activeSubmoduleKey]) STATE.submoduleRows[STATE.activeSubmoduleKey] = [];
      STATE.submoduleRows[STATE.activeSubmoduleKey].unshift(row);
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage();
      else { var clRec = pkGetActiveClient(); fetch('/api/v1/control/client-db/record', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dbName: clRec.dbName, submoduleKey: STATE.activeSubmoduleKey, recordId: recId, cells: row }) }).catch(function() {}); }
      pkRenderWorkstation(); pkToast('\u2713 Registro guardado: ' + recId); return;
    }
    if (pkHandleSuperAdminAction(target)) return;
  });

  document.addEventListener('change', function(ev) {
    var t = ev.target; if (!t) return;
    if (t.id === 'ws-role-view-selector') {
      STATE.roleViewFilter = t.value;
      if (t.value === 'MESERO') { STATE.activeServiceKey = 'srv-gastro'; STATE.activeSubmoduleKey = 'mod-tables'; }
      else if (t.value === 'COCINA') { STATE.activeServiceKey = 'srv-gastro'; STATE.activeSubmoduleKey = 'mod-kds'; }
      else if (t.value === 'CAJERO') { STATE.activeServiceKey = 'srv-invoicing'; STATE.activeSubmoduleKey = 'mod-pos'; }
      else if (t.value === 'BODEGA') { STATE.activeServiceKey = 'srv-inventory'; STATE.activeSubmoduleKey = 'mod-stock'; }
      else if (t.value === 'TECNICO') { STATE.activeServiceKey = 'srv-workshop'; STATE.activeSubmoduleKey = 'mod-work-orders-kanban'; }
      else if (t.value === 'RECEPCION') { STATE.activeServiceKey = 'srv-hospitality'; STATE.activeSubmoduleKey = 'mod-rooms'; }
      pkRenderWorkstation(); return;
    }
    if (t.id === 'wo-service-desc') { var prcEl = document.getElementById('wo-service-price'); if (prcEl && t.value.indexOf('|') !== -1) prcEl.value = t.value.split('|')[1]; return; }
    if (t.id === 'pos-select-customer') { STATE.posCustomerId = t.value; STATE.posVehicleId = ''; pkRenderWorkstation(); return; }
    if (t.id === 'pos-select-vehicle') { STATE.posVehicleId = t.value; pkRenderWorkstation(); return; }
    if (t.id === 'pos-payment-method') { STATE.posPaymentMethod = t.value; pkRenderWorkstation(); return; }
    if (t.id === 'inv-filter-warehouse') { STATE.invWarehouseFilter = t.value; pkRenderWorkstation(); return; }
    var exSvc = t.getAttribute('data-extra-service'); if (exSvc) { STATE.extraServiceKeys[exSvc] = !!t.checked; pkRenderRegistrationWizard(); return; }
    var exSub = t.getAttribute('data-extra-submodule'); if (exSub) { STATE.extraSubmoduleKeys[exSub] = !!t.checked; pkRenderRegistrationWizard(); return; }
  });

  document.addEventListener('input', function(ev) {
    var t = ev.target; if (!t) return;
    if (t.id === 'ws-v2-filter-input') { STATE.v2FilterText = t.value || ''; pkRenderWorkstation(); return; }
    if (t.id === 'inv-search-input') { STATE.invSearchText = t.value || ''; pkRenderWorkstation(); return; }
    if (t.id === 'look360-search-input') { STATE.look360Search = t.value || ''; pkRenderWorkstation(); return; }
    if (t.id === 'pos-cash-received') {
      if (STATE.posPaymentMethod.indexOf('Cr\xE9dito') !== -1) STATE.posCreditInitialAbono = Number(t.value || 0);
      else STATE.posCashReceived = Number(t.value || 0);
    }
  });

  pkUpdateShellNavigation();
})();`;
}

// apps/web-app/src/presentation/components/landing-layer.component.ts
function renderLandingLayerHtml() {
  return `
  <!-- APARTADO 1: PORTADA COMERCIAL -->
  <section class="surface active" id="surface-showcase">
    <div class="hero-banner">
      <div>
        <span class="hero-badge">SISTEMA DE VENTAS, INVENTARIO Y CONTROL DE NEGOCIOS</span>
        <h1 class="hero-title">Administra tu negocio de forma f\xE1cil: Facturaci\xF3n, Inventario, Comandas, Taller y Caja en un solo lugar.</h1>
        <p class="hero-sub">
          Selecciona el tipo de negocio que tienes y empieza a vender y controlar tus cuentas hoy mismo.
        </p>
        <div class="row-actions" style="margin-top:16px">
          <button type="button" class="btn btn-primary" id="btn-hero-go-register">\u{1F680} Crear Cuenta para mi Negocio</button>
          <button type="button" class="btn btn-hero-outline" id="btn-hero-go-demo">\u{1F5A5}\uFE0F Ver Demostraci\xF3n en Vivo</button>
          <button type="button" class="btn btn-hero-outline" id="btn-hero-go-login">\u{1F510} Iniciar Sesi\xF3n</button>
        </div>
      </div>
      <div class="quote-card">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#fde68a;font-weight:800">Listo para usar</div>
        <div style="font-size:18px;font-weight:800;margin:6px 0">Todo lo que tu empresa necesita</div>
        <div style="font-size:12px;color:#cbd5e1;line-height:1.6;margin-bottom:12px">
          \u2022 Punto de Venta, Cotizaciones y Facturaci\xF3n.<br/>
          \u2022 Control de Inventario, Bodegas y Proveedores.<br/>
          \u2022 Mesas, Comandas, Taller, Clientes y Cuadre de Caja.
        </div>
        <button type="button" class="btn btn-emerald" style="width:100%" id="btn-card-go-register">
          Empezar Ahora &rarr;
        </button>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <div class="card-title">Planes seg\xFAn tu Tipo de Negocio</div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-showcase-mid-register">Elegir Plan</button>
      </div>
      <div class="card-body">
        <div class="center-selector-grid" id="showcase-presets-grid"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">M\xF3dulos Disponibles</div>
      </div>
      <div class="card-body">
        <div class="center-selector-grid" id="showcase-services-grid"></div>
      </div>
    </div>
  </section>

  <!-- VENTANA DE ACTIVACI\xD3N DE CUENTA -->
  <div class="modal-backdrop" id="standby-payment-modal">
    <div class="modal-box">
      <div class="modal-head">
        <div>
          <span class="badge badge-emerald">ACTIVACI\xD3N INMEDIATA</span>
          <h3 style="margin:6px 0 0;font-size:17px">Confirmar Suscripci\xF3n y Activar Cuenta</h3>
        </div>
        <button type="button" class="btn btn-hero-outline btn-sm" id="btn-close-payment-modal">\u2715</button>
      </div>
      <div class="modal-body" id="payment-step-checkout">
        <div class="grid-2" style="margin-bottom:12px">
          <div class="field">
            <label>Nombre del Negocio</label>
            <input type="text" id="pay-modal-company" readonly />
          </div>
          <div class="field">
            <label>Valor Mensual</label>
            <input type="text" id="pay-modal-amount" readonly />
          </div>
        </div>
        <div class="field" style="margin-bottom:14px">
          <label>Medio de Pago</label>
          <select id="pay-modal-method">
            <option value="PSE_EMPRESARIAL">PSE / Transferencia Bancaria</option>
            <option value="TARJETA_CORPORATIVA">Tarjeta D\xE9bito o Cr\xE9dito</option>
            <option value="FACTURACION_CONTRATO">Facturaci\xF3n Empresarial</option>
          </select>
        </div>
        <button type="button" class="btn btn-emerald" style="width:100%;padding:12px" id="btn-confirm-standby-payment">
          \u2705 Activar mi Cuenta y Entrar al Sistema
        </button>
      </div>

      <div class="modal-body" id="payment-step-credentials" style="display:none">
        <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:12px;margin-bottom:12px">
          <div style="font-weight:800;color:#065f46;font-size:15px">\u{1F389} \xA1Tu cuenta est\xE1 lista!</div>
          <div style="font-size:12px;color:#047857">Datos de acceso de administrador:</div>
        </div>
        <div class="cred-box" id="generated-credentials-box"></div>
        <div class="row-actions" style="margin-top:14px;justify-content:flex-end">
          <button type="button" class="btn btn-primary" id="btn-enter-with-generated-creds">
            \u{1F680} Entrar a mi Sistema
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

// apps/web-app/src/presentation/components/login-and-superadmin.component.ts
function renderLoginAndSuperAdminHtml() {
  return `
  <!-- APARTADO 2: INICIAR SESI\xD3N O CREAR CUENTA -->
  <section class="surface" id="surface-auth">
    <div style="display:flex;justify-content:center;gap:10px;margin-bottom:16px">
      <button type="button" class="btn btn-primary" id="btn-auth-mode-login">\u{1F510} Iniciar Sesi\xF3n</button>
      <button type="button" class="btn btn-outline" id="btn-auth-mode-register">\u{1F680} Crear Cuenta para mi Negocio</button>
    </div>

    <!-- LOGIN LIMPIO -->
    <div id="auth-pane-login" style="max-width:420px;margin:0 auto">
      <div class="card">
        <div class="card-head">
          <h2 style="margin:0;font-size:17px">Iniciar Sesi\xF3n</h2>
        </div>
        <div class="card-body">
          <div class="field" style="margin-bottom:12px">
            <label>Usuario o Correo</label>
            <input type="text" id="login-username" placeholder="Ingresa tu usuario" />
          </div>
          <div class="field" style="margin-bottom:14px">
            <label>Contrase\xF1a</label>
            <input type="password" id="login-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" />
          </div>
          <button type="button" class="btn btn-primary" style="width:100%;padding:11px" id="btn-submit-login">
            Entrar
          </button>
          <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--pk-border);display:flex;justify-content:space-between;align-items:center;font-size:12px">
            <span style="color:var(--pk-muted)">\xBFNuevo en Proveko?</span>
            <button type="button" class="btn btn-outline btn-sm" id="btn-login-switch-to-register">Crear Cuenta &rarr;</button>
          </div>
        </div>
      </div>
    </div>

    <!-- REGISTRO DE NEGOCIO EN 3 PASOS SIMPLES -->
    <div id="auth-pane-register" style="display:none">
      <div class="card">
        <div class="card-head">
          <div>
            <h2 style="margin:0;font-size:18px">Activa el Sistema para tu Negocio</h2>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--pk-muted)">Valor Mensual</div>
            <div style="font-size:22px;font-weight:800;color:var(--pk-primary)" id="reg-quote-total">$169.000 COP/mes</div>
            <div style="font-size:11px;color:var(--pk-muted)" id="reg-quote-breakdown">Plan Base</div>
          </div>
        </div>
        <div class="card-body">
          <div style="margin-bottom:16px">
            <div style="font-weight:800;font-size:14px;margin-bottom:8px">1. \xBFQu\xE9 tipo de negocio tienes?</div>
            <div class="preset-row" id="reg-business-types-row"></div>
            <div id="reg-included-summary" style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:10px;font-size:12px"></div>
          </div>

          <div style="margin-bottom:16px">
            <div style="font-weight:800;font-size:14px;margin-bottom:8px">2. M\xF3dulos incluidos y adicionales (Opcional)</div>
            <div class="center-selector-grid" id="reg-addons-grid"></div>
          </div>

          <div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:14px">
            <div style="font-weight:800;font-size:14px;margin-bottom:10px">3. Datos de tu Negocio</div>
            <div class="grid-3">
              <div class="field">
                <label>Nombre del Negocio o Empresa</label>
                <input type="text" id="reg-company-name" placeholder="Ej: Ferreter\xEDa y Repuestos El Sol" />
              </div>
              <div class="field">
                <label>NIT o C\xE9dula</label>
                <input type="text" id="reg-company-nit" placeholder="Ej: 901.552.310-8" />
              </div>
              <div class="field">
                <label>Correo Electr\xF3nico</label>
                <input type="email" id="reg-company-email" placeholder="contacto@tunegocio.com" />
              </div>
            </div>
            <div class="row-actions" style="margin-top:12px;justify-content:flex-end">
              <button type="button" class="btn btn-emerald" id="btn-open-standby-checkout">
                \u2705 Continuar y Activar mi Cuenta &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- PANEL INTERNO DE ADMINISTRACI\xD3N (SOLO VISIBLE PARA SUPERADMIN / DESARROLLADOR) -->
  <section class="surface" id="surface-superadmin">
    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <div>
          <span class="badge badge-blue" id="staff-console-badge">ADMINISTRACI\xD3N GLOBAL</span>
          <h2 style="margin:4px 0 0;font-size:18px" id="staff-console-title">Empresas Registradas y Control de Accesos</h2>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-sa-new-client">+ Registrar Nueva Empresa</button>
      </div>
      <div class="card-body">
        <div class="kpi-row" id="sa-kpi-row"></div>
        <div id="sa-tenants-grid" style="display:grid;gap:12px"></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <div class="card-title">Configuraci\xF3n de Planes por Tipo de Negocio y M\xF3dulos</div>
      </div>
      <div class="card-body" id="sa-groups-catalog-panel"></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">Solicitudes de Ampliaci\xF3n de M\xF3dulos</div>
        <span class="badge badge-amber" id="sa-requests-count">0</span>
      </div>
      <div class="card-body" id="sa-feature-requests-body"></div>
    </div>
  </section>`;
}

// apps/web-app/src/presentation/components/workstation-layer.component.ts
function renderWorkstationLayerHtml() {
  return `
  <section class="surface" id="surface-workstation">
    <!-- AVISO CORTO EN MODO DEMO -->
    <div id="demo-mode-banner" style="display:none;background:#023047;color:#fff;padding:8px 14px;border-radius:10px;margin-bottom:12px;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="font-size:12px">
        <strong>Modo de Prueba Activo:</strong> Puedes facturar, crear productos, tomar comandas, recibir veh\xEDculos y registrar clientes o abonos libremente.
      </div>
      <button type="button" class="btn btn-emerald btn-sm" id="btn-demo-go-register">
        Crear Cuenta para mi Negocio &rarr;
      </button>
    </div>

    <div class="ws-layout">
      <!-- MEN\xDA LATERAL DE ICONOS Y T\xCDTULOS CORTOS -->
      <aside class="ws-sidebar">
        <div class="ws-nav-head">MEN\xDA PRINCIPAL</div>
        <div class="ws-nav-list" id="ws-principal-modules-nav"></div>

        <div style="border-top:1px solid rgba(255,255,255,0.12);margin:10px 0;padding-top:8px">
          <div class="ws-nav-head">CONFIGURACI\xD3N</div>
          <div class="ws-nav-list" id="ws-company-admin-nav">
            <button type="button" class="ws-nav-btn" id="btn-nav-internal-rbac">
              <span class="ws-nav-icon">\u2699\uFE0F</span>
              <span class="ws-nav-title">Usuarios y Roles</span>
            </button>
            <button type="button" class="ws-nav-btn" id="btn-nav-need-feature">
              <span class="ws-nav-icon">\u2795</span>
              <span class="ws-nav-title">Activar M\xF3dulos</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- \xC1REA PRINCIPAL -->
      <div class="ws-main">
        <!-- VISTA DE M\xD3DULOS Y SECCIONES -->
        <div id="ws-pane-module-operation">
          <!-- BARRA SUPERIOR DEL M\xD3DULO + PESTA\xD1AS DE SECCIONES -->
          <div class="ws-top-subbar">
            <div class="ws-top-subbar-head">
              <div style="display:flex;align-items:center;gap:10px">
                <span id="ws-active-service-icon" style="font-size:22px">\u{1F9FE}</span>
                <h2 style="margin:0;font-size:18px;font-weight:800;color:#023047" id="ws-active-service-title">Facturar y Punto de Venta</h2>
              </div>
              <div class="row-actions">
                <select id="ws-role-view-selector" style="padding:6px 10px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;font-weight:700;background:#f8fafc;color:#023047" title="Filtrar vista seg\xFAn el rol del trabajador">
                  <option value="ALL">\u{1F464} Vista: Administrador (Todas las secciones)</option>
                  <option value="CAJERO">\u{1F4B5} Vista: Cajero / Facturador</option>
                  <option value="MESERO">\u{1F37D}\uFE0F Vista: Mesero / Sal\xF3n</option>
                  <option value="COCINA">\u{1F468}\u200D\u{1F373} Vista: Cocina / Barra</option>
                  <option value="BODEGA">\u{1F4E6} Vista: Bodega / Almac\xE9n</option>
                  <option value="TECNICO">\u{1F527} Vista: T\xE9cnico / Recepci\xF3n</option>
                </select>
                <button type="button" class="btn btn-primary btn-sm" data-open-new-customer-modal="1">+ Nuevo Cliente</button>
              </div>
            </div>
            <!-- PESTA\xD1AS SUPERIORES PARA NAVEGAR ENTRE LAS SECCIONES DEL M\xD3DULO -->
            <div class="ws-subtabs-row" id="ws-submodule-tabs"></div>
          </div>

          <!-- CONTENEDOR \xDANICO DONDE SE RENDERIZA LA SECCI\xD3N ACTIVA -->
          <div id="ws-module-stage" style="margin-top:12px"></div>
        </div>

        <!-- VISTA DE USUARIOS Y ROLES -->
        <div id="ws-pane-internal-rbac" style="display:none"></div>

        <!-- VISTA DE ACTIVAR M\xD3DULOS ADICIONALES -->
        <div id="ws-pane-need-feature" style="display:none"></div>
      </div>
    </div>

    <!-- DIALOG / MODAL EMERGENTE (NUEVO CLIENTE, SURTIR PRODUCTO, ABONAR, HISTORIAL, FACTURA) -->
    <div class="modal-backdrop" id="pk-relational-modal">
      <div class="modal-box" style="max-width:760px;width:95%">
        <div class="card-head" style="background:#023047;color:#fff;border-radius:12px 12px 0 0;padding:12px 16px">
          <div>
            <div class="card-title" style="color:#fff;font-size:15px" id="pk-rel-modal-title">Ventana</div>
            <div style="font-size:11px;color:#cbd5e1" id="pk-rel-modal-sub"></div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" style="background:#fff;color:#023047" id="btn-close-rel-modal">\u2715 Cerrar</button>
        </div>
        <div class="card-body" id="pk-rel-modal-body" style="max-height:78vh;overflow-y:auto"></div>
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
    .center-selector-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 14px; }
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
    .card { background: #fff; border: 1px solid var(--pk-border); border-radius: 12px; overflow: hidden; margin-bottom: 14px; width: 100%; }
    .card-head {
      padding: 12px 16px; border-bottom: 1px solid var(--pk-border);
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      background: #f8fafc;
    }
    .card-title { font-size: 14px; font-weight: 800; color: #023047; }
    .card-sub { font-size: 12px; color: var(--pk-muted); margin-top: 2px; }
    .card-body { padding: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; width: 100%; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: 100%; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; align-items: end; width: 100%; }
    .field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
    .field label { font-size: 11px; font-weight: 700; color: var(--pk-muted); text-transform: uppercase; }
    .field input, .field select {
      width: 100%; padding: 8px 11px; border: 1px solid var(--pk-border); border-radius: 8px;
      font-size: 13px; background: #fff; color: var(--pk-text);
    }
    .btn {
      border: 0; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 700;
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      white-space: nowrap;
    }
    .btn-primary { background: var(--pk-primary); color: #fff; }
    .btn-emerald { background: var(--pk-emerald); color: #fff; }
    .btn-amber { background: #ffb703; color: #023047; }
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
    .table-wrap { overflow-x: auto; width: 100%; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      text-align: left; padding: 10px 12px; background: #f1f5f9; color: var(--pk-muted);
      font-size: 11px; text-transform: uppercase; border-bottom: 1px solid var(--pk-border);
    }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; width: 100%; }
    .kpi-box { background: #fff; border: 1px solid var(--pk-border); border-radius: 12px; padding: 14px; }
    .kpi-label { font-size: 11px; color: var(--pk-muted); font-weight: 700; text-transform: uppercase; }
    .kpi-val { font-size: 20px; font-weight: 800; margin-top: 4px; }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(15,23,42,0.65);
      display: none; align-items: center; justify-content: center; z-index: 80; padding: 20px;
    }
    .modal-backdrop.open { display: flex; }
    .modal-box {
      background: #fff; border-radius: 16px; max-width: 680px; width: 100%;
      border: 1px solid var(--pk-border); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.25);
    }
    .modal-head { padding: 14px 18px; background: #023047; color: #fff; display: flex; justify-content: space-between; align-items: center; }
    .modal-body { padding: 18px; }
    .cred-box {
      background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.6;
    }
    .row-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .toast {
      position: fixed; bottom: 18px; right: 18px; background: #023047; color: #fff;
      padding: 12px 18px; border-radius: 10px; font-size: 12px; font-weight: 700;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25); display: none; z-index: 95;
    }
    .toast.show { display: block; }
    @media (max-width: 1024px) {
      .hero-banner, .ws-layout, .grid-2, .grid-3, .kpi-row { grid-template-columns: 1fr; }
      .ws-sidebar { min-height: auto; }
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
      --pk-primary: #023047;
      --pk-primary-hover: #1e40af;
      --pk-emerald: #059669;
      --pk-amber: #d97706;
      --pk-rose: #e11d48;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100vh;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--pk-bg);
      color: var(--pk-text);
    }
    .pk-shell { width: 100%; min-height: 100vh; display: flex; flex-direction: column; }
    .pk-topbar {
      background: #ffffff;
      border-bottom: 1px solid var(--pk-border);
      padding: 8px 20px;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .pk-brand { display: flex; align-items: center; gap: 10px; }
    .pk-logo {
      width: 34px; height: 34px; border-radius: 9px;
      background: #ffb703;
      color: #023047; font-weight: 900; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
    }
    .pk-title { font-weight: 800; font-size: 15px; letter-spacing: -0.02em; color: #023047; }
    .pk-subtitle { font-size: 11px; color: var(--pk-muted); }
    .pk-surface-tabs {
      display: flex; gap: 4px; background: #f1f5f9; padding: 3px;
      border-radius: 9px; border: 1px solid var(--pk-border);
    }
    .pk-tab-btn {
      border: 0; background: transparent; padding: 6px 12px; border-radius: 7px;
      font-size: 12px; font-weight: 700; color: var(--pk-muted); cursor: pointer;
    }
    .pk-tab-btn.active {
      background: #023047; color: #fff;
      box-shadow: 0 1px 3px rgba(15,23,42,0.12);
    }
    .pk-context-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .surface { display: none; padding: 16px 22px; width: 100%; max-width: 100%; margin: 0; flex: 1; }
    .surface.active { display: block; }
    #surface-workstation.surface { padding: 0; }
    #demo-mode-banner { border-radius: 0 !important; margin-bottom: 0 !important; padding: 8px 20px !important; }
    .hero-banner {
      background: linear-gradient(135deg, #023047 0%, #1e3a8a 100%);
      color: #fff; border-radius: 16px; padding: 24px;
      display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; margin-bottom: 18px;
    }
    .hero-badge {
      display: inline-block; background: rgba(255,183,3,0.2); border: 1px solid rgba(255,183,3,0.45);
      color: #fde68a; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-bottom: 10px;
    }
    .hero-title { font-size: 24px; font-weight: 800; margin: 0 0 8px; line-height: 1.25; }
    .hero-sub { font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5; }
    .quote-card {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 14px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .ws-layout {
      display: grid;
      grid-template-columns: 235px minmax(0, 1fr);
      gap: 0;
      width: 100%;
      min-height: calc(100vh - 52px);
      align-items: stretch;
    }
    .ws-sidebar {
      background: #023047; color: #fff;
      padding: 14px 10px;
      min-height: calc(100vh - 52px);
      border-right: 1px solid rgba(255,255,255,0.1);
    }
    .ws-nav-head { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; padding: 4px 8px; letter-spacing: 0.05em; }
    .ws-nav-list { display: flex; flex-direction: column; gap: 4px; }
    .ws-nav-btn {
      text-align: left; border: 0; background: transparent; color: #e2e8f0;
      padding: 9px 11px; border-radius: 10px; cursor: pointer; transition: 0.15s;
      display: flex; align-items: center; gap: 10px; width: 100%;
    }
    .ws-nav-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .ws-nav-btn.active { background: #ffb703; color: #023047; font-weight: 800; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
    .ws-nav-icon { font-size: 18px; line-height: 1; flex-shrink: 0; }
    .ws-nav-title { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ws-main { display: flex; flex-direction: column; gap: 12px; min-width: 0; width: 100%; padding: 14px 20px; }
    .ws-top-subbar {
      background: #fff; border: 1px solid var(--pk-border); border-radius: 12px;
      padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; width: 100%;
    }
    .ws-top-subbar-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
    .ws-subtabs-row { display: flex; gap: 6px; flex-wrap: wrap; padding-top: 8px; border-top: 1px solid #e2e8f0; }
    .ws-subtab-pill {
      border: 1px solid #cbd5e1; background: #f8fafc; color: #334155;
      padding: 7px 13px; border-radius: 9px; font-size: 12px; font-weight: 700;
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: 0.15s;
    }
    .ws-subtab-pill:hover { background: #e2e8f0; }
    .ws-subtab-pill.active { background: #023047; color: #fff; border-color: #023047; }
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
  if (method === "GET" && url.startsWith("/api/v1/client-workspace/state")) {
    const parsedUrl = new URL(url, "http://localhost");
    const dbName = parsedUrl.searchParams.get("dbName") ?? "";
    const relationalState = PostgresPsqlBootstrapRunner.getClientRelationalStateFromPostgres(dbName);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ dbName, relationalState }));
    return true;
  }
  if (method === "POST" && url === "/api/v1/client-workspace/transaction") {
    const body = await readJsonBody2(req) ?? {};
    const ok = PostgresPsqlBootstrapRunner.executeClientRelationalTransactionInPostgres({
      dbName: String(body.dbName ?? ""),
      actionType: String(body.actionType ?? "SYNC_STATE"),
      entityPayload: typeof body.entityPayload === "object" && body.entityPayload !== null ? body.entityPayload : void 0,
      fullRelationalState: typeof body.fullRelationalState === "object" && body.fullRelationalState !== null ? body.fullRelationalState : void 0
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
