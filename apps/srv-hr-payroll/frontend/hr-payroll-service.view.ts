import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-hr-payroll` (Módulo Principal: Nómina Electrónica DIAN, PILA y RRHH).
 */
export const SRV_HR_PAYROLL_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-hr-payroll',
  externalPrincipalModuleName: 'Nómina Electrónica DIAN, PILA y RRHH',
  icon: '👥',
  subtitle: 'Contratos laborales, liquidación quincenal/mensual, horas extras, seguridad social PILA, prestaciones y Nómina Electrónica DIAN (CUNE).',
  standaloneMonthlyUsd: 170000,
  submodules: [
    {
      moduleKey: 'mod-employees-contracts',
      parentServiceKey: 'srv-hr-payroll',
      externalSubmoduleName: 'Empleados, Contratos, EPS, AFP, ARL y Fondos',
      tabIcon: '🪪',
      summary: 'Ficha laboral completa, tipo de contrato (término fijo, indefinido, aprendizaje, integral) y nivel de riesgo ARL I-V.',
      monthlyAddonUsd: 45000,
      actionButtonLabel: 'Registrar Contrato Laboral',
      tableHeaders: ['Documento', 'Empleado y Cargo', 'Tipo Contrato', 'EPS / Pensión / ARL', 'Salario Base ($ COP)'],
      fields: [
        { key: 'employeeDoc', label: 'Cédula / Documento Empleado', type: 'text', placeholder: 'CC 1.032.488.910' },
        { key: 'fullNameRole', label: 'Nombre Completo y Cargo', type: 'text', placeholder: 'Julián David Torres — Jefe de Operaciones' },
        { key: 'contractType', label: 'Modalidad de Contrato', type: 'select', options: ['Término Indefinido', 'Término Fijo', 'Obra o Labor', 'Aprendizaje SENA', 'Salario Integral'] },
        { key: 'fundsSummary', label: 'Fondos EPS / Pensión / ARL Riesgo', type: 'text', placeholder: 'Sura EPS / Porvenir AFP / Sura ARL Nivel II' },
        { key: 'baseSalaryCop', label: 'Salario Básico Mensual ($ COP)', type: 'number', placeholder: '2850000' },
      ],
    },
    {
      moduleKey: 'mod-payroll-settlement',
      parentServiceKey: 'srv-hr-payroll',
      externalSubmoduleName: 'Liquidación de Nómina, Horas Extras y Novedades',
      tabIcon: '🧮',
      summary: 'Cálculo de auxilio de transporte, HED (25%), HEN (75%), HRN (35%), dominicales, incapacidades, FSP y libranzas.',
      monthlyAddonUsd: 52000,
      actionButtonLabel: 'Liquidar Período de Nómina',
      tableHeaders: ['Período', 'Colaborador', 'Total Devengado', 'Deducciones Salud/Pensión', 'Neto a Pagar ($ COP)'],
      fields: [
        { key: 'periodCode', label: 'Período de Liquidación', type: 'text', placeholder: 'NOM-2026-11-Q1' },
        { key: 'employeeName', label: 'Colaborador', type: 'text', placeholder: 'Julián David Torres' },
        { key: 'accruedCop', label: 'Total Devengado + Auxilio + Extras ($ COP)', type: 'number', placeholder: '3120000' },
        { key: 'deductedCop', label: 'Deducciones Empleado (Salud 4% + Pensión 4%)', type: 'number', placeholder: '228000' },
        { key: 'netPayCop', label: 'Neto a Dispersar en Banco ($ COP)', type: 'number', placeholder: '2892000' },
      ],
    },
    {
      moduleKey: 'mod-social-benefits-pila',
      parentServiceKey: 'srv-hr-payroll',
      externalSubmoduleName: 'Seguridad Social PILA y Prestaciones Sociales',
      tabIcon: '🏦',
      summary: 'Provisiones mensuales y liquidación de Prima de Servicios, Cesantías, Intereses (12%), Vacaciones y archivo plano PILA.',
      monthlyAddonUsd: 49000,
      actionButtonLabel: 'Generar Planilla PILA / Prestaciones',
      tableHeaders: ['Planilla / Liquidación', 'Concepto', 'Empleados', 'Exoneración Ley 1607', 'Valor Liquidado ($ COP)'],
      fields: [
        { key: 'benefitCode', label: 'Número Planilla PILA / Liquidación', type: 'text', placeholder: 'PILA-2026-11-8841' },
        { key: 'benefitType', label: 'Concepto Liquidado', type: 'select', options: ['Planilla Integrada PILA Mensual', 'Prima Legal de Servicios', 'Consignación Cesantías a Fondo', 'Liquidación Definitiva de Contrato'] },
        { key: 'employeesCount', label: 'Empleados Incluidos', type: 'number', placeholder: '14' },
        { key: 'provisionTotalCop', label: 'Total Aportes / Prestaciones ($ COP)', type: 'number', placeholder: '9450000' },
      ],
    },
    {
      moduleKey: 'mod-electronic-payroll-dian',
      parentServiceKey: 'srv-hr-payroll',
      externalSubmoduleName: 'Transmisión Nómina Electrónica DIAN (NI / CUNE)',
      tabIcon: '🏛️',
      summary: 'Generación XML mensual de Soporte de Pago de Nómina Electrónica (NI) y Notas de Ajuste (NA) con firma digital y CUNE.',
      monthlyAddonUsd: 55000,
      actionButtonLabel: 'Transmitir Nómina Electrónica a DIAN',
      tableHeaders: ['Consecutivo NI', 'Empleado Reportado', 'CUNE DIAN', 'Estado DIAN', 'Neto Reportado ($ COP)'],
      fields: [
        { key: 'niConsecutive', label: 'Consecutivo Soporte Nómina (NI)', type: 'text', placeholder: 'NE-2026-00314' },
        { key: 'employeeName', label: 'Empleado Reportado', type: 'text', placeholder: 'Julián David Torres' },
        { key: 'cuneHash', label: 'CUNE SHA-384 Validado DIAN', type: 'text', placeholder: 'CUNE-9f82a41c-dian-2026-ok' },
        { key: 'reportedTotalCop', label: 'Neto Reportado en XML ($ COP)', type: 'number', placeholder: '2892000' },
      ],
    },
  ],
  features: [
    {
      componentKey: 'comp-ley1607-exoneration',
      externalName: 'Exoneración automática de aportes Ley 1607 (Art. 114-1 E.T.)',
      description: 'Aplica exoneración automática de Salud Patronal (8.5%), SENA (2%) e ICBF (3%) para devengos menores a 10 SMMLV.',
      parentModuleKey: 'mod-employees-contracts',
      includedByDefault: true,
      monthlyAddonUsd: 19000,
    },
    {
      componentKey: 'comp-cune-dian-payroll',
      externalName: 'Firmador XAdES-EPES y validador CUNE de Nómina Electrónica DIAN',
      description: 'Genera el Código Único de Nómina Electrónica (CUNE SHA-384) y valida reglas DIAN antes de transmitir.',
      parentModuleKey: 'mod-electronic-payroll-dian',
      includedByDefault: true,
      monthlyAddonUsd: 25000,
    },
  ],
};
