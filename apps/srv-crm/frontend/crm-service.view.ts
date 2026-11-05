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
  externalPrincipalModuleName: 'Clientes, Proveedores y Comercial',
  icon: '🤝',
  subtitle: 'Directorio unificado de clientes, proveedores y transportistas, seguimiento comercial y fidelización.',
  standaloneMonthlyUsd: 95000,
  submodules: [
    {
      moduleKey: 'mod-directory',
      parentServiceKey: 'srv-crm',
      externalSubmoduleName: 'Directorio de Terceros',
      tabIcon: '📇',
      summary: 'Ficha fiscal y comercial de clientes, proveedores, contratistas y empresas transportadoras.',
      monthlyAddonUsd: 29000,
      actionButtonLabel: 'Guardar Tercero',
      tableHeaders: ['NIT / Cédula', 'Razón Social / Nombre', 'Relación', 'Ciudad / Teléfono', 'Cupo de Crédito'],
      fields: [
        { key: 'taxId', label: 'NIT o Documento', type: 'text', placeholder: '900.812.441-9' },
        { key: 'legalName', label: 'Razón Social o Nombre Completo', type: 'text', placeholder: 'Distribuidora del Caribe S.A.S.' },
        { key: 'partyRole', label: 'Tipo de Relación', type: 'select', options: ['Cliente Corporativo', 'Proveedor de Insumos', 'Empresa Transportista', 'Cliente / Proveedor'] },
        { key: 'cityPhone', label: 'Ciudad y Teléfono', type: 'text', placeholder: 'Barranquilla — 300 412 8890' },
        { key: 'creditLimit', label: 'Cupo de Crédito Aprobado ($)', type: 'number', placeholder: '15000000' },
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
  features: [],
};
