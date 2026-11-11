import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkSelect,
  PkModal,
  PkPrintButton,
  PkKpiRow,
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

export const NominaView: React.FC = () => {
  const { apiGet, apiPost, toast } = usePlatform();
  const { busy, run } = useAsyncAction();

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
      ]),
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
    notes: 'Constancia de liquidación salarial y aportes de seguridad social. Firma del colaborador en señal de conformidad.',
  });

  const previewNet = Number(baseSalary || 0) + Number(bonuses || 0) - Number(deductions || 0);
  const totalDisbursed = payrolls.reduce((acc, p) => acc + Number(p.netPay || 0), 0);

  return (
    <ModuleGate module="liquidacion_nomina">
      <PkKpiRow
        items={[
          { label: 'Colaboradores Activos', value: String(employees.length), color: 'var(--pk-primary)' },
          { label: 'Colillas Emitidas', value: String(payrolls.length), color: 'var(--pk-emerald)' },
          { label: 'Total Nómina Dispersada', value: formatCop(totalDisbursed), color: '#0f172a' },
          {
            label: 'Neto Simulación Actual',
            value: formatCop(previewNet),
            color: previewNet >= 0 ? 'var(--pk-amber)' : 'var(--pk-rose)',
          },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">👔 Liquidación Salarial por Periodo y Emisión de Desprendible</div>
          <span className={`pk-badge ${previewNet >= 0 ? 'pk-badge-emerald' : 'pk-badge-amber'}`}>
            Neto a Pagar: {formatCop(previewNet)}
          </span>
        </div>
        <div className="pk-card-body">
          <form onSubmit={handleCreatePayroll} className="pk-form-grid">
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
              createLabel="+ Nuevo Colaborador"
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
              <label>Bonificaciones / Auxilios ($)</label>
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

            <div className="pk-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                📑 Liquidar Nómina
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📋 Historial de Liquidaciones y Desprendibles ({payrolls.length})</div>
          <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportCsv}>
            📥 Exportar CSV
          </button>
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
                  <th>Salario Base</th>
                  <th>Bonificaciones</th>
                  <th>Deducciones</th>
                  <th>Neto Pagado</th>
                  <th>Desprendible</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                      No hay liquidaciones de nómina registradas todavía.
                    </td>
                  </tr>
                ) : (
                  payrolls.map((pay) => (
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
                      <td>{formatCop(pay.baseSalary)}</td>
                      <td style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>
                        +{formatCop(pay.bonuses)}
                      </td>
                      <td style={{ color: 'var(--pk-rose)', fontWeight: 700 }}>
                        -{formatCop(pay.deductions)}
                      </td>
                      <td style={{ fontWeight: 800, color: '#0f172a' }}>{formatCop(pay.netPay)}</td>
                      <td>
                        <PkPrintButton label="🖨️ Desprendible" payload={buildPayslipPayload(pay)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">👥 Planta de Colaboradores ({employees.length})</div>
          <button
            type="button"
            className="pk-btn pk-btn-outline pk-btn-sm"
            onClick={() => setEmpModalOpen(true)}
          >
            + Nuevo Colaborador
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
                  <th>Salario Mensual</th>
                  <th>Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td><span className="pk-badge pk-badge-slate">{emp.code}</span></td>
                    <td style={{ fontWeight: 700 }}>{emp.name}</td>
                    <td>{emp.docNumber}</td>
                    <td>{emp.position}</td>
                    <td>{formatCop(emp.baseSalary)}</td>
                    <td>{emp.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PkModal
        open={empModalOpen}
        title="Registrar Nuevo Colaborador en Nómina"
        onClose={() => setEmpModalOpen(false)}
      >
        <form onSubmit={handleCreateEmployee} className="pk-form-grid">
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
          <div className="pk-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              Guardar Colaborador
            </button>
          </div>
        </form>
      </PkModal>
    </ModuleGate>
  );
};

export default NominaView;
