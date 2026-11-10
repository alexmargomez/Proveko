import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  ModuleGate,
  PkAutoCodeInput,
  PkEntitySelect,
  PkEntityDialog,
  PkPrintButton,
  PkKpiRow,
  Worker,
  PrintDocumentPayload,
  formatCop,
} from '@proveko/ui-sdk';

interface PayrollRecord {
  id: string;
  createdAt: string;
  moduleKey: string;
  fields: Record<string, string>;
}

interface NominaAllResponse {
  ok: boolean;
  nextCode: string;
  workers: Worker[];
  payrolls: PayrollRecord[];
}

export const NominaView: React.FC = () => {
  const { apiGet, apiPost, toast, dialogVersion } = useProveko();

  const [nextCode, setNextCode] = useState('NOM-306');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);

  const [workerId, setWorkerId] = useState('');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const ym = now.toISOString().slice(0, 7);
    const half = now.getDate() <= 15 ? 'Q1 (1 al 15)' : 'Q2 (16 al 30)';
    return `${ym} — ${half}`;
  });
  const [baseSalary, setBaseSalary] = useState('1423500');
  const [bonuses, setBonuses] = useState('162000');
  const [deductions, setDeductions] = useState('113880');

  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empDoc, setEmpDoc] = useState('');
  const [empSpecialty, setEmpSpecialty] = useState('Asesor Comercial / Operativo');
  const [empPhone, setEmpPhone] = useState('');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<NominaAllResponse>('/api/v1/nomina/all');
      const wkList = data.workers || [];
      setNextCode(data.nextCode || 'NOM-306');
      setWorkers(wkList);
      setPayrolls(data.payrolls || []);
      setWorkerId((prev) => (prev && wkList.some((w) => w.id === prev) ? prev : wkList[0]?.id || ''));
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload, dialogVersion]);

  const handleBaseSalaryChange = (val: string) => {
    setBaseSalary(val);
    const numericBase = Number(val || 0);
    if (numericBase > 0) {
      setDeductions(String(Math.round(numericBase * 0.08)));
    }
  };

  const handleCreatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const numBase = Number(baseSalary || 0);
    const numBonuses = Number(bonuses || 0);
    const numDeductions = Number(deductions || 0);
    if (!workerId || !period.trim() || numBase <= 0) {
      toast('Selecciona colaborador, periodo y un salario base mayor a cero.');
      return;
    }
    if (numBase + numBonuses - numDeductions < 0) {
      toast('Las deducciones no pueden superar el total devengado.');
      return;
    }

    await apiPost('/api/v1/nomina/payrolls', {
      workerId,
      period,
      baseSalary: numBase,
      bonuses: numBonuses,
      deductions: numDeductions,
    });
    toast('Liquidación de nómina generada correctamente');
    await reload();
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !empDoc.trim()) {
      toast('Ingresa nombre completo y documento del colaborador.');
      return;
    }
    const res = await apiPost<{ worker: Worker }>('/api/v1/nomina/workers', {
      name: empName,
      docNumber: empDoc,
      specialty: empSpecialty,
      phone: empPhone,
    });
    toast('Empleado registrado en nómina');
    setEmpName('');
    setEmpDoc('');
    setEmpPhone('');
    setWorkerModalOpen(false);
    await reload();
    if (res?.worker?.id) {
      setWorkerId(res.worker.id);
    }
  };

  const buildPayslipPayload = (pay: PayrollRecord): PrintDocumentPayload => {
    const base = Number(pay.fields?.baseSalary || 0);
    const bon = Number(pay.fields?.bonuses || 0);
    const ded = Number(pay.fields?.deductions || 0);
    const net = Number(pay.fields?.netPay || base + bon - ded);

    return {
      document_type: 'COMPROBANTE / COLILLA DE PAGO DE NÓMINA',
      layout_variant: 'carta_membrete',
      document_number: pay.id,
      issue_date: pay.createdAt,
      customer_name: pay.fields?.workerName || 'Colaborador',
      customer_nit: pay.fields?.workerDoc || '',
      payment_method: 'Dispersión Nómina / Transferencia',
      extra_fields: {
        'Código Empleado': pay.fields?.workerCode || '—',
        'Cargo / Especialidad': pay.fields?.workerSpecialty || 'Colaborador',
        'Periodo Liquidado': pay.fields?.period || '',
      },
      items: [
        {
          code: 'DEV-01',
          description: 'Salario Básico Ordinario del Periodo',
          quantity: 1,
          unit_price: base,
          subtotal: base,
        },
        {
          code: 'DEV-02',
          description: 'Auxilio de Transporte, Horas Extra y Bonificaciones',
          quantity: 1,
          unit_price: bon,
          subtotal: bon,
        },
        {
          code: 'DED-01',
          description: 'Deducciones Seguridad Social (Salud 4% + Pensión 4%) y Retenciones',
          quantity: 1,
          unit_price: -ded,
          subtotal: -ded,
        },
      ],
      subtotal: base + bon,
      discount_total: ded,
      grand_total: net,
      notes: 'Constancia de liquidación salarial y aportes de ley. Firma del colaborador en señal de conformidad.',
    };
  };

  const previewNet = Number(baseSalary || 0) + Number(bonuses || 0) - Number(deductions || 0);
  const totalPayrollDisbursed = payrolls.reduce(
    (acc, p) => acc + Number(p.fields?.netPay || 0),
    0
  );

  return (
    <ModuleGate module="liquidacion_nomina">
      <PkKpiRow
        items={[
          { label: 'Colaboradores Activos', value: String(workers.length), color: 'var(--pk-primary)' },
          { label: 'Colillas Emitidas', value: String(payrolls.length), color: 'var(--pk-emerald)' },
          { label: 'Total Nómina Pagada', value: formatCop(totalPayrollDisbursed), color: '#0f172a' },
          { label: 'Neto Simulación Actual', value: formatCop(previewNet), color: 'var(--pk-amber)' },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">👔 Liquidación Salarial y Emisión de Colilla</div>
          <span className="pk-badge pk-badge-emerald">Neto a Pagar: {formatCop(previewNet)}</span>
        </div>
        <div className="pk-card-body">
          <form onSubmit={handleCreatePayroll} className="pk-form-grid">
            <PkAutoCodeInput label="Consecutivo Colilla" value={nextCode} />
            <PkEntitySelect
              label="Empleado / Colaborador *"
              items={workers}
              value={workerId}
              onChange={setWorkerId}
              getValue={(w) => w.id}
              getLabel={(w) => `${w.code} — ${w.name} (${w.docNumber})`}
              onCreateNew={() => setWorkerModalOpen(true)}
              createLabel="+ Nuevo Empleado"
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
            <div className="pk-field">
              <button type="submit" className="pk-btn pk-btn-primary">
                📑 Liquidar Nómina
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📋 Historial de Colillas y Desprendibles ({payrolls.length})</div>
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
                        <span className="pk-badge pk-badge-blue">{pay.id}</span>
                      </td>
                      <td>{pay.createdAt}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{pay.fields?.workerName}</div>
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                          CC {pay.fields?.workerDoc} — {pay.fields?.workerSpecialty}
                        </div>
                      </td>
                      <td>{pay.fields?.period}</td>
                      <td>{formatCop(Number(pay.fields?.baseSalary || 0))}</td>
                      <td style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>
                        +{formatCop(Number(pay.fields?.bonuses || 0))}
                      </td>
                      <td style={{ color: 'var(--pk-rose)', fontWeight: 700 }}>
                        -{formatCop(Number(pay.fields?.deductions || 0))}
                      </td>
                      <td style={{ fontWeight: 800, color: '#0f172a' }}>
                        {formatCop(Number(pay.fields?.netPay || 0))}
                      </td>
                      <td>
                        <PkPrintButton label="🖨️ Colilla de Pago" payload={buildPayslipPayload(pay)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PkEntityDialog
        open={workerModalOpen}
        title="➕ Registrar Nuevo Empleado / Colaborador"
        onClose={() => setWorkerModalOpen(false)}
      >
        <form onSubmit={handleCreateWorker} className="pk-form-grid">
          <PkAutoCodeInput label="Código Empleado" value="EMP-AUTO" />
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
            <label>Cargo / Área</label>
            <input
              value={empSpecialty}
              onChange={(e) => setEmpSpecialty(e.target.value)}
              placeholder="Ej: Auxiliar Contable / Cajero"
            />
          </div>
          <div className="pk-field">
            <label>Celular</label>
            <input
              value={empPhone}
              onChange={(e) => setEmpPhone(e.target.value)}
              placeholder="310..."
            />
          </div>
          <div className="pk-field">
            <button type="submit" className="pk-btn pk-btn-primary">
              💾 Guardar Empleado
            </button>
          </div>
        </form>
      </PkEntityDialog>
    </ModuleGate>
  );
};
