import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-crm` (Módulo Principal: Clientes, Proveedores y Comercial).
 * Submódulos en interpestañas:
 *  - Directorio de Terceros (`mod-directory`)
 *  - Oportunidades y Embudo Comercial (`mod-pipelines`)
 *  - Fidelización y Puntos (`mod-loyalty`)
 */
export const SRV_CRM_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-crm',
  externalPrincipalModuleName: 'Clientes, Proveedores y Terceros (v2)',
  icon: '🤝',
  subtitle: 'Listado maestro estilo v2 de clientes, proveedores y transportistas con filtros, cupos y fidelización.',
  standaloneMonthlyUsd: 95000,
  submodules: [
    {
      moduleKey: 'mod-directory',
      parentServiceKey: 'srv-crm',
      externalSubmoduleName: 'Listado de Clientes y Terceros (v2)',
      tabIcon: '📇',
      summary: 'Directorio completo estilo version2: identificación NIT+DV, clasificación, régimen fiscal, ciudad, correo FE y cupo de crédito.',
      monthlyAddonUsd: 29000,
      actionButtonLabel: 'Guardar Cliente / Tercero en BD',
      tableHeaders: ['NIT / Documento', 'Razón Social / Nombre', 'Tipo de Tercero', 'Ciudad / Teléfono', 'Cupo Aprobado (COP)'],
      fields: [
        { key: 'docType', label: 'Tipo de Documento', type: 'select', options: ['NIT Empresarial', 'Cédula de Ciudadanía (CC)', 'Cédula de Extranjería (CE)', 'Pasaporte'] },
        { key: 'taxId', label: 'Número NIT / Documento (Con DV)', type: 'text', placeholder: '900.812.441-9' },
        { key: 'legalName', label: 'Razón Social o Nombre Completo', type: 'text', placeholder: 'Distribuidora del Caribe S.A.S.' },
        { key: 'partyRole', label: 'Clasificación del Tercero', type: 'select', options: ['Cliente Corporativo', 'Cliente Frecuente / Mostrador', 'Proveedor de Insumos', 'Empresa Transportista', 'Cliente y Proveedor'] },
        { key: 'taxRegime', label: 'Régimen Tributario DIAN', type: 'select', options: ['Responsable de IVA (Régimen Común)', 'No Responsable de IVA', 'Gran Contribuyente', 'Régimen Simple RST'] },
        { key: 'cityPhone', label: 'Ciudad, Dirección y WhatsApp', type: 'text', placeholder: 'Barranquilla — 300 412 8890' },
        { key: 'billingEmail', label: 'Correo Recepción Factura Electrónica', type: 'text', placeholder: 'facturacion@empresa.co' },
        { key: 'paymentTerm', label: 'Condición y Plazo de Pago', type: 'select', options: ['Contado Inmediato', 'Crédito 15 Días', 'Crédito 30 Días', 'Crédito 60 Días'] },
        { key: 'creditLimit', label: 'Cupo de Crédito Aprobado ($ COP)', type: 'number', placeholder: '15000000' },
      ],
    },
    {
      moduleKey: 'mod-pipelines',
      parentServiceKey: 'srv-crm',
      externalSubmoduleName: 'Oportunidades y Embudo',
      tabIcon: '📈',
      summary: 'Seguimiento de negocios en negociación, etapa comercial, ejecutivo asignado y cierre esperado.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Registrar Oportunidad',
      tableHeaders: ['Negocio', 'Cliente Prospecto', 'Etapa del Embudo', 'Ejecutivo', 'Valor Estimado'],
      fields: [
        { key: 'dealTitle', label: 'Nombre del Negocio / Contrato', type: 'text', placeholder: 'Suministro Mensual Dotación Industrial' },
        { key: 'prospectName', label: 'Empresa Prospecto', type: 'text', placeholder: 'Ingenios Unidos S.A.' },
        { key: 'stage', label: 'Etapa Actual', type: 'select', options: ['Contacto Inicial', 'Propuesta Enviada', 'Negociación Final', 'Ganada / Cerrada'] },
        { key: 'expectedValue', label: 'Valor Estimado ($)', type: 'number', placeholder: '18500000' },
      ],
    },
    {
      moduleKey: 'mod-loyalty',
      parentServiceKey: 'srv-crm',
      externalSubmoduleName: 'Fidelización y Puntos',
      tabIcon: '⭐',
      summary: 'Acumulación y redención de puntos por compras frecuentes y categorías de cliente.',
      monthlyAddonUsd: 29000,
      actionButtonLabel: 'Acreditar / Redimir Puntos',
      tableHeaders: ['Cliente', 'Categoría', 'Puntos Acumulados', 'Última Compra', 'Beneficio Activo'],
      fields: [
        { key: 'memberName', label: 'Cliente Afiliado', type: 'text', placeholder: 'Diana Marcela Pineda' },
        { key: 'tierLevel', label: 'Nivel de Fidelidad', type: 'select', options: ['Oro Preferencial', 'Plata', 'Bronce'] },
        { key: 'pointsBalance', label: 'Puntos a Registrar', type: 'number', placeholder: '1250' },
      ],
    },
  ],
  features: [
    {
      componentKey: 'comp-nit-dv-auto',
      externalName: 'Cálculo automático de Dígito de Verificación NIT',
      description: 'Calcula automáticamente el DV fiscal al registrar clientes, proveedores o transportistas.',
      parentModuleKey: 'mod-directory',
      includedByDefault: true,
      monthlyAddonUsd: 15000,
    },
  ],
};
