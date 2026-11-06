import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

export const SRV_HR_PAYROLL_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-hr-payroll',
  externalPrincipalModuleName: 'Nómina y Empleados',
  icon: '👔',
  subtitle: 'Empleados, contratos, pago de nómina, horas extras y seguridad social.',
  standaloneMonthlyUsd: 149000,
  submodules: [
    {
      moduleKey: 'mod-employees-contracts',
      parentServiceKey: 'srv-hr-payroll',
      externalSubmoduleName: 'Empleados y Contratos',
      tabIcon: '👥',
      summary: '',
      monthlyAddonUsd: 39000,
      actionButtonLabel: '+ Registrar Empleado',
      tableHeaders: ['Cédula', 'Empleado', 'Cargo', 'Tipo Contrato', 'Salario Base', 'Estado', 'Acciones'],
      fields: [
        { key: 'empDoc', label: 'Cédula', type: 'text', placeholder: '1.020.445.890' },
        { key: 'empName', label: 'Nombre Completo', type: 'text', placeholder: 'Valentina Ríos' },
        { key: 'jobRole', label: 'Cargo', type: 'text', placeholder: 'Cajera / Administrador / Técnico' },
        { key: 'baseSalary', label: 'Salario Mensual ($)', type: 'number', placeholder: '1650000' },
      ],
    },
    {
      moduleKey: 'mod-payroll-settlement',
      parentServiceKey: 'srv-hr-payroll',
      externalSubmoduleName: 'Pago de Nómina y Turnos',
      tabIcon: '💵',
      summary: '',
      monthlyAddonUsd: 49000,
      actionButtonLabel: '+ Liquidar Pago de Nómina',
      tableHeaders: ['Comprobante', 'Empleado', 'Período', 'Salario + Extras', 'Descuentos', 'Neto Pagado', 'Acciones'],
      fields: [
        { key: 'payrollPeriod', label: 'Empleado', type: 'text', placeholder: 'Valentina Ríos' },
        { key: 'overtimeHours', label: 'Quincena / Mes', type: 'select', options: ['Primera Quincena', 'Segunda Quincena', 'Mes Completo'] },
        { key: 'netPayable', label: 'Neto a Pagar ($)', type: 'number', placeholder: '825000' },
      ],
    },
    {
      moduleKey: 'mod-social-benefits-pila',
      parentServiceKey: 'srv-hr-payroll',
      externalSubmoduleName: 'Primas, Vacaciones y Liquidaciones',
      tabIcon: '🏖️',
      summary: '',
      monthlyAddonUsd: 39000,
      actionButtonLabel: '+ Registrar Pago de Prestaciones',
      tableHeaders: ['ID', 'Empleado', 'Concepto', 'Período', 'Valor Pagado', 'Estado', 'Acciones'],
      fields: [
        { key: 'benefitType', label: 'Concepto', type: 'select', options: ['Prima de Servicios', 'Vacaciones', 'Cesantías', 'Liquidación de Contrato', 'Seguridad Social'] },
        { key: 'pilaOperator', label: 'Empleado', type: 'text', placeholder: 'Nombre del empleado' },
        { key: 'provisionTotal', label: 'Valor ($)', type: 'number', placeholder: '950000' },
      ],
    },
  ],
  features: [
    { componentKey: 'comp-ley1607-exoneration', parentServiceKey: 'srv-hr-payroll', externalName: 'Cálculo Automático de Horas Extras', description: 'Liquida recargos diurnos, nocturnos y festivos.', monthlyAddonUsd: 19000 },
    { componentKey: 'comp-cune-dian-payroll', parentServiceKey: 'srv-hr-payroll', externalName: 'Soporte de Nómina Electrónica', description: 'Genera desprendible electrónico.', monthlyAddonUsd: 25000 },
  ],
};
