import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkSelect,
  PkSimpleSelect,
  PkModal,
  PkPrintButton,
  PkKpiRow,
  PkLiveHeader,
  PkTicketCard,
  PkProcessNodes,
  PkTypeCards,
  PkFullscreenDialog,
  PkProgressBar,
  PkDistributionStrip,
  useAsyncAction,
  formatCop,
  downloadCsvUtf8,
} from '@platform/ui-sdk';

interface Employee {
  id: string;
  code: string;
  name: string;
  docNumber: string;
  position: string;
  baseSalary: number;
  phone: string;
  active: boolean;
  createdAt: string;
}

interface PayrollSettlement {
  id: string;
  code: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeDoc: string;
  employeePosition: string;
  period: string;
  baseSalary: number;
  bonuses: number;
  deductions: number;
  netPay: number;
  createdAt: string;
}

interface NominaAllResponse {
  ok: boolean;
  nextCode: string;
  nextEmployeeCode: string;
  employees: Employee[];
  payrolls: PayrollSettlement[];
}

const PAYROLL_TYPE_CARDS = [
  {
    key: 'ordinaria',
    icon: '📋',
    title: 'Liquidación Ordinaria Mensual/Quincenal',
    description: 'Salario contractual del periodo con auxilio legal y deducción automática de salud y pensión (8%).',
    badge: 'Ordinaria',
  },
  {
    key: 'extras_comisiones',
    icon: '⏱️',
    title: 'Liquidación con Horas Extra y Comisiones',
    description: 'Activa calculadora asistida de horas extra diurnas/nocturnas y comisiones comerciales.',
    badge: 'Recargos',
  },
  {
    key: 'bonificacion_especial',
    icon: '🎯',
    title: 'Bonificación / Novedad Especial',
    description: 'Integra incentivos por metas operativas, rodamiento o bonificaciones extralegales del periodo.',
    badge: 'Incentivo',
  },
];

export const NominaView: React.FC = () => {
  const { apiGet, apiPost, toast } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [activePill, setActivePill] = useState<string>('payrolls');
  const [displayMode, setDisplayMode] = useState<'board' | 'table'>('board');
  const [payrollStudioOpen, setPayrollStudioOpen] = useState(false);
  const [payrollModeType, setPayrollModeType] = useState<string>('ordinaria');

  const [searchQuery, setSearchQuery] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  const [nextCode, setNextCode] = useState('NOM-301');
  const [nextEmployeeCode, setNextEmployeeCode] = useState('EMP-101');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollSettlement[]>([]);

  const [employeeId, setEmployeeId] = useState('');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const ym = now.toISOString().slice(0, 7);
    const half = now.getDate() <= 15 ? 'Q1 (1 al 15)' : 'Q2 (16 al 30)';
    return `${ym} — ${half}`;
  });
  const [baseSalary, setBaseSalary] = useState('1423500');
  const [bonuses, setBonuses] = useState('162000');
  const [deductions, setDeductions] = useState('113880');

  const [extraHoursCount, setExtraHoursCount] = useState('8');
  const [extraHourRate, setExtraHourRate] = useState('11500');
  const [commissionValue, setCommissionValue] = useState('180000');
  const [specialBonusAmount, setSpecialBonusAmount] = useState('350000');

  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empDoc, setEmpDoc] = useState('');
  const [empPosition, setEmpPosition] = useState('Asesor Comercial / Operativo');
  const [empSalary, setEmpSalary] = useState('1423500');
  const [empPhone, setEmpPhone] = useState('');

  const applySalaryDefaults = (monthlyBase: number) => {
    const halfSalary = monthlyBase > 0 ? Math.round(monthlyBase / 2) : 1423500;
    setBaseSalary(String(halfSalary));
    setDeductions(String(Math.round(halfSalary * 0.08)));
  };

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<NominaAllResponse>('/api/v1/nomina/all');
      const empList = data.employees || [];
      setNextCode(data.nextCode || 'NOM-301');
      setNextEmployeeCode(data.nextEmployeeCode || 'EMP-101');
      setEmployees(empList);
      setPayrolls(data.payrolls || []);
      setEmployeeId((prev) => {
        if (prev && empList.some((e) => e.id === prev)) {
          return prev;
        }
        const first = empList[0];
        if (first) {
          applySalaryDefaults(first.baseSalary);
          return first.id;
        }
        return '';
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No fue posible cargar la información de nómina');
    }
  }, [apiGet, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSelectPayrollMode = (modeKey: string) => {
    setPayrollModeType(modeKey);
    if (modeKey === 'ordinaria') {
      setBonuses('100000');
    } else if (modeKey === 'extras_comisiones') {
      const calc = Math.max(0, Number(extraHoursCount || 0) * Number(extraHourRate || 0)) + Math.max(0, Number(commissionValue || 0));
      setBonuses(String(Math.round(calc)));
    } else if (modeKey === 'bonificacion_especial') {
      setBonuses(String(Math.max(0, Math.round(Number(specialBonusAmount || 0)))));
    }
  };

  const syncExtrasCalculator = (hoursStr: string, rateStr: string, commStr: string) => {
    setExtraHoursCount(hoursStr);
    setExtraHourRate(rateStr);
    setCommissionValue(commStr);
    const totalExtras =
      Math.max(0, Number(hoursStr || 0) * Number(rateStr || 0)) + Math.max(0, Number(commStr || 0));
    setBonuses(String(Math.round(totalExtras)));
  };

  const handleSelectEmployee = (newId: string) => {
    setEmployeeId(newId);
    const found = employees.find((e) => e.id === newId);
    if (found && found.baseSalary > 0) {
      applySalaryDefaults(found.baseSalary);
    }
  };

  const handleBaseSalaryChange = (val: string) => {
    setBaseSalary(val);
    const numericBase = Number(val || 0);
    if (Number.isFinite(numericBase) && numericBase > 0) {
      setDeductions(String(Math.round(numericBase * 0.08)));
    }
  };

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const numSalary = Number(empSalary || 0);
    if (!empName.trim() || !empDoc.trim() || !Number.isFinite(numSalary) || numSalary < 0) {
      toast('Completa el nombre, documento de identidad y salario contractual válido.');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ ok: boolean; employee: Employee }>('/api/v1/nomina/employees', {
          name: empName.trim(),
          docNumber: empDoc.trim(),
          position: empPosition.trim(),
          baseSalary: numSalary,
          phone: empPhone.trim(),
        });
        toast(`Colaborador ${res.employee.code} registrado en nómina`);
        setEmpName('');
        setEmpDoc('');
        setEmpPhone('');
        setEmpModalOpen(false);
        await reload();
        if (res.employee?.id) {
          setEmployeeId(res.employee.id);
          applySalaryDefaults(res.employee.baseSalary);
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible registrar el colaborador');
      }
    });
  };

  const handleCreatePayroll = (e: React.FormEvent) => {
    e.preventDefault();
    const numBase = Number(baseSalary || 0);
    const numBonuses = Number(bonuses || 0);
    const numDeductions = Number(deductions || 0);

    if (!employeeId || !period.trim() || !Number.isFinite(numBase) || numBase <= 0) {
      toast('Selecciona un colaborador, periodo y un salario base mayor a cero.');
      return;
    }
    if (!Number.isFinite(numBonuses) || numBonuses < 0 || !Number.isFinite(numDeductions) || numDeductions < 0) {
      toast('Las bonificaciones y deducciones no pueden ser negativas.');
      return;
    }
    if (numBase + numBonuses - numDeductions < 0) {
      toast('Las deducciones no pueden superar el total devengado.');
      return;
    }

    void run(async () => {
      try {
        await apiPost('/api/v1/nomina/payrolls', {
          employeeId,
          period: period.trim(),
          baseSalary: numBase,
          bonuses: numBonuses,
          deductions: numDeductions,
        });
        toast('Liquidación de nómina generada exitosamente');
        await reload();
        setPayrollStudioOpen(false);
        setActivePill('payrolls');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error liquidando periodo salarial');
      }
    });
  };

  const handleExportCsv = () => {
    downloadCsvUtf8(
      'nomina_liquidaciones.csv',
      [
        'Colilla',
        'Fecha',
        'Código Empleado',
        'Colaborador',
        'Documento',
        'Cargo',
        'Periodo',
        'Salario Base',
        'Bonificaciones',
        'Deducciones',
        'Neto Pagado',
      ],
      payrolls.map((p) => [
        p.code,
        p.createdAt,
        p.employeeCode,
        p.employeeName,
        p.employeeDoc,
        p.employeePosition,
        p.period,
        p.baseSalary,
        p.bonuses,
        p.deductions,
        p.netPay,
      ])
    );
  };

  const buildPayslipPayload = (pay: PayrollSettlement): Record<string, unknown> => ({
    document_type: 'COMPROBANTE / DESPRENDIBLE DE PAGO DE NÓMINA',
    layout_variant: 'carta_membrete',
    document_number: pay.code,
    issue_date: pay.createdAt,
    customer_name: pay.employeeName,
    customer_nit: pay.employeeDoc,
    payment_method: 'Dispersión Salarial / Transferencia Bancaria',
    extra_fields: {
      'Código Colaborador': pay.employeeCode,
      'Cargo Contractual': pay.employeePosition,
      'Periodo Liquidado': pay.period,
    },
    items: [
      {
        code: 'DEV-01',
        description: 'Salario Básico Ordinario del Periodo',
        quantity: 1,
        unit_price: pay.baseSalary,
        subtotal: pay.baseSalary,
      },
      {
        code: 'DEV-02',
        description: 'Auxilio de Transporte, Horas Extra y Bonificaciones',
        quantity: 1,
        unit_price: pay.bonuses,
        subtotal: pay.bonuses,
      },
      {
        code: 'DED-01',
        description: 'Deducciones de Ley (Salud 4% + Pensión 4%) y Retenciones',
        quantity: 1,
        unit_price: -pay.deductions,
        subtotal: -pay.deductions,
      },
    ],
    subtotal: pay.baseSalary + pay.bonuses,
    discount_total: pay.deductions,
    grand_total: pay.netPay,
    notes:
      'Constancia de liquidación salarial y aportes de seguridad social. Firma del colaborador en señal de conformidad.',
  });

  const previewBase = Number(baseSalary || 0);
  const previewBonuses = Number(bonuses || 0);
  const previewDeductions = Number(deductions || 0);
  const previewNet = previewBase + previewBonuses - previewDeductions;

  const totals = useMemo(() => {
    let base = 0;
    let bonus = 0;
    let ded = 0;
    let net = 0;
    for (const p of payrolls) {
      base += Number(p.baseSalary || 0);
      bonus += Number(p.bonuses || 0);
      ded += Number(p.deductions || 0);
      net += Number(p.netPay || 0);
    }
    return { base, bonus, ded, net };
  }, [payrolls]);

  const filteredPayrolls = payrolls.filter((pay) => {
    if (employeeFilter && pay.employeeId !== employeeFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      pay.code.toLowerCase().includes(q) ||
      pay.employeeName.toLowerCase().includes(q) ||
      pay.employeeDoc.toLowerCase().includes(q) ||
      pay.period.toLowerCase().includes(q)
    );
  });

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      emp.code.toLowerCase().includes(q) ||
      emp.name.toLowerCase().includes(q) ||
      emp.docNumber.toLowerCase().includes(q) ||
      emp.position.toLowerCase().includes(q)
    );
  });

  return (
    <ModuleGate module="liquidacion_nomina">
      <div className="pk-stack">
        <PkLiveHeader
          title="Gestión Humana y Liquidación Salarial"
          liveLabel="Período activo"
          subtitle="Liquidación asistida de devengados, aportes de seguridad social, dispersión bancaria y desprendibles oficiales."
          pills={[
            { key: 'payrolls', label: '📑 Colillas Emitidas', count: payrolls.length },
            { key: 'employees', label: '👥 Planta de Colaboradores', count: employees.length },
          ]}
          activePill={activePill}
          onPillChange={setActivePill}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          boardLabel="🎛️ Tarjetas de Nómina"
          tableLabel="📋 Vista Tabla"
          primaryActionLabel="+ Liquidar Nómina"
          onPrimaryAction={() => setPayrollStudioOpen(true)}
          extraActions={
            <>
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                onClick={() => setEmpModalOpen(true)}
              >
                + Vincular Colaborador
              </button>
              <button type="button" className="pk-btn pk-btn-outline" onClick={handleExportCsv}>
                📥 Exportar CSV
              </button>
            </>
          }
        />

        <PkKpiRow
          items={[
            { label: 'Colaboradores Activos', value: String(employees.length), color: 'var(--pk-primary)' },
            { label: 'Colillas Emitidas', value: String(payrolls.length), color: 'var(--pk-emerald)' },
            { label: 'Total Nómina Dispersada', value: formatCop(totals.net), color: '#0f172a' },
            {
              label: 'Aportes Salud y Pensión Retenidos',
              value: formatCop(totals.ded),
              color: 'var(--pk-amber)',
            },
          ]}
        />

        <PkDistributionStrip
          title="Estructura Salarial Acumulada: Devengado Ordinario + Auxilios/Extras vs Seguridad Social vs Neto Dispersado"
          segments={[
            {
              label: 'Salario Básico Ordinario',
              value: Math.max(totals.base, 1),
              displayValue: formatCop(totals.base),
              color: '#0284c7',
            },
            {
              label: 'Auxilios, Extras y Comisiones',
              value: Math.max(totals.bonus, 0),
              displayValue: formatCop(totals.bonus),
              color: '#8b5cf6',
            },
            {
              label: 'Aportes Salud / Pensión',
              value: Math.max(totals.ded, 0),
              displayValue: formatCop(totals.ded),
              color: '#f59e0b',
            },
            {
              label: 'Neto Dispersado al Talento',
              value: Math.max(totals.net, 1),
              displayValue: formatCop(totals.net),
              color: '#10b981',
            },
          ]}
        />

        <div className="pk-card">
          <div className="pk-datatable-toolbar" style={{ borderBottom: 'none' }}>
            <input
              className="pk-input pk-datatable-search"
              placeholder={
                activePill === 'payrolls'
                  ? '🔎 Buscar colilla por consecutivo, colaborador, documento o periodo...'
                  : '🔎 Buscar colaborador por código, nombre, documento o cargo...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {activePill === 'payrolls' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 270 }}>
                  <PkSimpleSelect
                    ariaLabel="Filtrar por colaborador"
                    value={employeeFilter}
                    onChange={setEmployeeFilter}
                    allowClear
                    placeholder="Todos los colaboradores"
                    options={[
                      { value: '', label: 'Todos los colaboradores' },
                      ...employees.map((emp) => ({
                        value: emp.id,
                        label: `${emp.code} — ${emp.name}`,
                        sublabel: emp.position,
                      })),
                    ]}
                  />
                </div>
                <span className="pk-badge pk-badge-slate">{filteredPayrolls.length} colillas</span>
              </div>
            ) : (
              <span className="pk-badge pk-badge-slate">{filteredEmployees.length} colaboradores</span>
            )}
          </div>
        </div>

        {activePill === 'payrolls' ? (
          displayMode === 'board' ? (
            filteredPayrolls.length === 0 ? (
              <div className="pk-card">
                <div className="pk-card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--pk-muted)' }}>
                  {payrolls.length === 0
                    ? 'Aún no se han emitido colillas salariales. Haz clic en "+ Liquidar Nómina" para abrir el estudio.'
                    : 'No se encontraron desprendibles con el filtro aplicado.'}
                </div>
              </div>
            ) : (
              <div className="pk-cards-showcase">
                {filteredPayrolls.map((pay) => {
                  const grossEarned = Math.max(1, pay.baseSalary + pay.bonuses);
                  const netRatio = (pay.netPay / grossEarned) * 100;
                  return (
                    <PkTicketCard
                      key={pay.id}
                      code={`#${pay.code}`}
                      timeAgo={pay.createdAt}
                      channelBadge={{ label: pay.period, tone: 'blue' }}
                      title={pay.employeeName}
                      subtitle={`${pay.employeePosition}`}
                      metaLine={`🪪 ${pay.employeeCode} · CC ${pay.employeeDoc}`}
                      items={[
                        { name: 'Salario Básico Periodo', amount: formatCop(pay.baseSalary) },
                        { name: 'Auxilios / Extras / Bonos', amount: `+${formatCop(pay.bonuses)}` },
                        { name: 'Salud (4%) + Pensión (4%)', amount: `-${formatCop(pay.deductions)}` },
                      ]}
                      extraBody={
                        <PkProgressBar
                          label="Proporción Neta Dispersada"
                          valueLabel={`${netRatio.toFixed(1)}%`}
                          pct={netRatio}
                          tone="emerald"
                        />
                      }
                      totalLabel="NETO A PAGAR"
                      totalValue={formatCop(pay.netPay)}
                      paymentLabel="Dispersión Bancaria Directa"
                      processNodes={[
                        { step: 1, label: '1. Novedades', status: 'done' },
                        { step: 2, label: '2. Liquidada', status: 'done' },
                        { step: 3, label: '3. Dispersada', status: 'done' },
                      ]}
                      statusPill={{ label: 'Colilla Emitida y Dispersada', tone: 'emerald' }}
                      secondaryActions={
                        <PkPrintButton
                          label="🖨️ Imprimir Colilla Oficial"
                          payload={buildPayslipPayload(pay)}
                          variant="primary"
                        />
                      }
                    />
                  );
                })}
              </div>
            )
          ) : (
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">📋 Historial de Liquidaciones y Desprendibles ({filteredPayrolls.length})</div>
              </div>
              <div className="pk-card-body">
                <div className="pk-table-wrap">
                  <table className="pk-table">
                    <thead>
                      <tr>
                        <th>Colilla</th>
                        <th>Fecha</th>
                        <th>Colaborador</th>
                        <th>Periodo</th>
                        <th className="pk-num">Salario Base</th>
                        <th className="pk-num">Bonificaciones</th>
                        <th className="pk-num">Deducciones</th>
                        <th className="pk-num">Neto Pagado</th>
                        <th>Flujo</th>
                        <th>Desprendible</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayrolls.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                            Sin colillas registradas para el filtro actual.
                          </td>
                        </tr>
                      ) : (
                        filteredPayrolls.map((pay) => (
                          <tr key={pay.id}>
                            <td>
                              <span className="pk-badge pk-badge-blue">{pay.code}</span>
                            </td>
                            <td>{pay.createdAt}</td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{pay.employeeName}</div>
                              <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                                {pay.employeeCode} · CC {pay.employeeDoc} — {pay.employeePosition}
                              </div>
                            </td>
                            <td>{pay.period}</td>
                            <td className="pk-num">{formatCop(pay.baseSalary)}</td>
                            <td className="pk-num" style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>
                              +{formatCop(pay.bonuses)}
                            </td>
                            <td className="pk-num" style={{ color: 'var(--pk-rose)', fontWeight: 700 }}>
                              -{formatCop(pay.deductions)}
                            </td>
                            <td className="pk-num" style={{ fontWeight: 800, color: '#0f172a' }}>
                              {formatCop(pay.netPay)}
                            </td>
                            <td>
                              <PkProcessNodes
                                compact
                                steps={[
                                  { step: 1, label: 'Novedades', status: 'done' },
                                  { step: 2, label: 'Liquidada', status: 'done' },
                                  { step: 3, label: 'Dispersada', status: 'done' },
                                ]}
                              />
                            </td>
                            <td>
                              <PkPrintButton label="🖨️ Colilla" payload={buildPayslipPayload(pay)} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        ) : displayMode === 'board' ? (
          <div className="pk-cards-showcase">
            {filteredEmployees.map((emp) => {
              const empPayrolls = payrolls.filter((p) => p.employeeId === emp.id);
              const halfEst = Math.round(emp.baseSalary / 2);
              return (
                <PkTicketCard
                  key={emp.id}
                  code={emp.code}
                  channelBadge={{ label: emp.active ? 'Contrato Activo' : 'Inactivo', tone: 'emerald' }}
                  title={emp.name}
                  subtitle={emp.position}
                  metaLine={`🪪 CC ${emp.docNumber} · 📞 ${emp.phone || 'Sin teléfono'}`}
                  items={[
                    { name: 'Asignación Mensual Base', amount: formatCop(emp.baseSalary) },
                    { name: 'Base Quincenal Estimada', amount: formatCop(halfEst) },
                    { name: 'Colillas Históricas', amount: `${empPayrolls.length} periodos` },
                  ]}
                  totalLabel="SALARIO CONTRACTUAL"
                  totalValue={formatCop(emp.baseSalary)}
                  primaryAction={{
                    label: '⚡ Liquidar Periodo en Estudio',
                    tone: 'blue',
                    onClick: () => {
                      handleSelectEmployee(emp.id);
                      setPayrollStudioOpen(true);
                    },
                  }}
                />
              );
            })}
          </div>
        ) : (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">👥 Planta Activa de Colaboradores ({filteredEmployees.length})</div>
              <button
                type="button"
                className="pk-btn pk-btn-outline pk-btn-sm"
                onClick={() => setEmpModalOpen(true)}
              >
                + Vincular Colaborador
              </button>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nombre Completo</th>
                      <th>Documento</th>
                      <th>Cargo Contractual</th>
                      <th className="pk-num">Salario Mensual</th>
                      <th>Teléfono</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td>
                          <span className="pk-badge pk-badge-slate">{emp.code}</span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{emp.name}</td>
                        <td>{emp.docNumber}</td>
                        <td>{emp.position}</td>
                        <td className="pk-num">{formatCop(emp.baseSalary)}</td>
                        <td>{emp.phone || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            onClick={() => {
                              handleSelectEmployee(emp.id);
                              setPayrollStudioOpen(true);
                            }}
                          >
                            ⚡ Liquidar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <PkFullscreenDialog
        open={payrollStudioOpen}
        title="Estudio de Liquidación Salarial y Emisión de Colilla"
        subtitle="Selecciona la modalidad de liquidación del periodo, valida devengados y deducciones de ley, y dispersa el pago."
        badge={{ label: nextCode, tone: 'emerald' }}
        onClose={() => setPayrollStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="1. Modalidad de Liquidación Salarial"
            options={PAYROLL_TYPE_CARDS}
            value={payrollModeType}
            onChange={handleSelectPayrollMode}
          />
        }
        footerLeft={
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span className={`pk-badge ${previewNet >= 0 ? 'pk-badge-emerald' : 'pk-badge-rose'}`}>
              NETO A DISPERSAR: {formatCop(previewNet)}
            </span>
            <span style={{ fontSize: 12.5, color: '#64748b' }}>
              Devengado Bruto: {formatCop(previewBase + previewBonuses)} · Deducciones: -{formatCop(previewDeductions)}
            </span>
          </div>
        }
        footerActions={
          <>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setPayrollStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pk-payroll-studio-form"
              className="pk-btn pk-btn-primary"
              disabled={busy || previewNet < 0}
            >
              {busy ? 'Liquidando...' : '📑 Emitir y Dispersar Colilla'}
            </button>
          </>
        }
      >
        <PkDistributionStrip
          title="Simulación en Vivo de la Colilla Actual"
          segments={[
            {
              label: 'Salario Básico Periodo',
              value: Math.max(previewBase, 1),
              displayValue: formatCop(previewBase),
              color: '#0284c7',
            },
            {
              label: 'Auxilios / Extras / Bonos',
              value: Math.max(previewBonuses, 0),
              displayValue: formatCop(previewBonuses),
              color: '#8b5cf6',
            },
            {
              label: 'Deducciones Ley (Salud + Pensión)',
              value: Math.max(previewDeductions, 0),
              displayValue: formatCop(previewDeductions),
              color: '#f59e0b',
            },
            {
              label: 'Neto Final Colaborador',
              value: Math.max(previewNet, 0),
              displayValue: formatCop(previewNet),
              color: '#10b981',
            },
          ]}
        />

        {payrollModeType === 'extras_comisiones' && (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">⏱️ Calculadora Asistida de Horas Extra y Comisiones</div>
              <span className="pk-badge pk-badge-blue">Se suma automáticamente a Bonificaciones / Auxilios</span>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid">
                <div className="pk-field">
                  <label>Cantidad Horas Extra / Recargos</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={extraHoursCount}
                    onChange={(e) => syncExtrasCalculator(e.target.value, extraHourRate, commissionValue)}
                  />
                </div>
                <div className="pk-field">
                  <label>Valor Hora Extra Promedio ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={extraHourRate}
                    onChange={(e) => syncExtrasCalculator(extraHoursCount, e.target.value, commissionValue)}
                  />
                </div>
                <div className="pk-field">
                  <label>Comisiones de Ventas / Auxilio ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={commissionValue}
                    onChange={(e) => syncExtrasCalculator(extraHoursCount, extraHourRate, e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {payrollModeType === 'bonificacion_especial' && (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🎯 Parámetros de Bonificación o Reconocimiento Especial</div>
              <span className="pk-badge pk-badge-emerald">Incentivo del Periodo</span>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid cols-2">
                <div className="pk-field">
                  <label>Monto de Bonificación / Incentivo ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={specialBonusAmount}
                    onChange={(e) => {
                      setSpecialBonusAmount(e.target.value);
                      setBonuses(String(Math.max(0, Math.round(Number(e.target.value || 0)))));
                    }}
                  />
                </div>
                <div className="pk-field">
                  <label>Plantillas Rápidas de Incentivo</label>
                  <div className="pk-row-actions">
                    <button
                      type="button"
                      className="pk-btn pk-btn-outline pk-btn-sm"
                      onClick={() => {
                        setSpecialBonusAmount('200000');
                        setBonuses('200000');
                      }}
                    >
                      +$200.000 Meta
                    </button>
                    <button
                      type="button"
                      className="pk-btn pk-btn-outline pk-btn-sm"
                      onClick={() => {
                        setSpecialBonusAmount('450000');
                        setBonuses('450000');
                      }}
                    >
                      +$450.000 Desempeño
                    </button>
                    <button
                      type="button"
                      className="pk-btn pk-btn-outline pk-btn-sm"
                      onClick={() => {
                        setSpecialBonusAmount('750000');
                        setBonuses('750000');
                      }}
                    >
                      +$750.000 Bono Sénior
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">2. Datos Oficiales del Desprendible de Pago</div>
            <div style={{ minWidth: 260 }}>
              <PkProcessNodes
                compact
                steps={[
                  { step: 1, label: '1. Novedades', status: 'done' },
                  { step: 2, label: '2. Liquidación', status: previewNet >= 0 ? 'active' : 'error' },
                  { step: 3, label: '3. Dispersión', status: 'pending' },
                ]}
              />
            </div>
          </div>
          <div className="pk-card-body">
            <form id="pk-payroll-studio-form" onSubmit={handleCreatePayroll} className="pk-form-grid">
              <PkAutoCodeInput label="Consecutivo Colilla" value={nextCode} />

              <PkSelect
                label="Colaborador *"
                items={employees}
                value={employeeId}
                onChange={handleSelectEmployee}
                getValue={(emp) => emp.id}
                getLabel={(emp) => `${emp.code} — ${emp.name} (${emp.docNumber})`}
                emptyLabel="-- Seleccionar colaborador --"
                onCreateNew={() => setEmpModalOpen(true)}
                createLabel="+ Vincular Colaborador"
                searchable
              />

              <div className="pk-field">
                <label>Periodo de Liquidación *</label>
                <input
                  required
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="Ej: 2026-11 — Q1 (1 al 15)"
                />
              </div>

              <div className="pk-field">
                <label>Salario Base Periodo ($) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="any"
                  value={baseSalary}
                  onChange={(e) => handleBaseSalaryChange(e.target.value)}
                />
              </div>

              <div className="pk-field">
                <label>Bonificaciones / Auxilios / Extras ($)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={bonuses}
                  onChange={(e) => setBonuses(e.target.value)}
                />
              </div>

              <div className="pk-field">
                <label>Deducciones Salud / Pensión ($)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={deductions}
                  onChange={(e) => setDeductions(e.target.value)}
                />
              </div>
            </form>
          </div>
        </div>
      </PkFullscreenDialog>

      <PkModal
        open={empModalOpen}
        title="Vincular Nuevo Colaborador en Planta"
        onClose={() => setEmpModalOpen(false)}
      >
        <form onSubmit={handleCreateEmployee} className="pk-form-grid cols-2">
          <PkAutoCodeInput label="Código Empleado" value={nextEmployeeCode} />
          <div className="pk-field">
            <label>Nombre Completo *</label>
            <input
              required
              value={empName}
              onChange={(e) => setEmpName(e.target.value)}
              placeholder="Ej: Laura Marcela Gómez"
            />
          </div>
          <div className="pk-field">
            <label>Documento de Identidad *</label>
            <input
              required
              value={empDoc}
              onChange={(e) => setEmpDoc(e.target.value)}
              placeholder="Ej: 1032488910"
            />
          </div>
          <div className="pk-field">
            <label>Cargo / Área *</label>
            <input
              required
              value={empPosition}
              onChange={(e) => setEmpPosition(e.target.value)}
              placeholder="Ej: Analista Contable / Cajero"
            />
          </div>
          <div className="pk-field">
            <label>Salario Mensual Contractual ($) *</label>
            <input
              required
              type="number"
              min="0"
              step="any"
              value={empSalary}
              onChange={(e) => setEmpSalary(e.target.value)}
            />
          </div>
          <div className="pk-field">
            <label>Teléfono Contacto</label>
            <input
              value={empPhone}
              onChange={(e) => setEmpPhone(e.target.value)}
              placeholder="310..."
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setEmpModalOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Guardando...' : 'Guardar Colaborador'}
            </button>
          </div>
        </form>
      </PkModal>
    </ModuleGate>
  );
};

export default NominaView;
