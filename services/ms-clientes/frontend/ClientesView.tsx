import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  FeatureGate,
  PkAutoCodeInput,
  PkEntitySelect,
  PkEntityDialog,
  PkPrintButton,
  PkKpiRow,
  downloadCsvUtf8,
  formatCop,
  Customer,
  Contract,
  Tariff,
  Vehicle,
  Driver,
  Carrier,
  Invoice,
  PrintDocumentPayload,
} from '@proveko/ui-sdk';

interface ClientesAllResponse {
  ok: boolean;
  nextCustomerCode: string;
  nextContractCode: string;
  nextDriverCode: string;
  nextCarrierCode: string;
  customers: Customer[];
  contracts: Contract[];
  tariffs: Tariff[];
  vehicles: Vehicle[];
  drivers: Driver[];
  carriers: Carrier[];
  pendingInvoices: Invoice[];
}

export const ClientesView: React.FC = () => {
  const {
    activeModuleKey,
    apiGet,
    apiPost,
    apiDelete,
    toast,
    sendToPosCheckout,
    openQuickDialog,
    dialogVersion,
  } = useProveko();

  const [data, setData] = useState<ClientesAllResponse>({
    ok: true,
    nextCustomerCode: 'CLI-1006',
    nextContractCode: 'CNV-206',
    nextDriverCode: 'COND-306',
    nextCarrierCode: 'TRN-406',
    customers: [],
    contracts: [],
    tariffs: [],
    vehicles: [],
    drivers: [],
    carriers: [],
    pendingInvoices: [],
  });

  const [docType, setDocType] = useState('NIT');
  const [nit, setNit] = useState('');
  const [dv, setDv] = useState('');
  const [custName, setCustName] = useState('');
  const [taxRegime, setTaxRegime] = useState('Responsable de IVA');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Bogotá D.C.');
  const [address, setAddress] = useState('');
  const [contractId, setContractId] = useState('');
  const [tariffId, setTariffId] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [searchCustomer, setSearchCustomer] = useState('');

  const [abonoInvoice, setAbonoInvoice] = useState<Invoice | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState('Transferencia Bancaria');
  const [abonoNote, setAbonoNote] = useState('');

  const [entityName, setEntityName] = useState('');
  const [contractTariffId, setContractTariffId] = useState('');
  const [budgetCeiling, setBudgetCeiling] = useState('10000000');

  const [driverName, setDriverName] = useState('');
  const [driverDoc, setDriverDoc] = useState('');
  const [driverLicense, setDriverLicense] = useState('C3 Carga Pesada');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverVehicleId, setDriverVehicleId] = useState('');

  const [carrierNit, setCarrierNit] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [carrierVehicleType, setCarrierVehicleType] = useState('Tractocamión 3S3');
  const [carrierRoute, setCarrierRoute] = useState('Ruta Nacional');
  const [carrierPhone, setCarrierPhone] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const res = await apiGet<ClientesAllResponse>('/api/v1/clientes/all');
      setData(res);
      if (!contractId && res.contracts.length > 0) setContractId(res.contracts[0].id);
      if (!tariffId && res.tariffs.length > 0) setTariffId(res.tariffs[0].id);
      if (!contractTariffId && res.tariffs.length > 0) setContractTariffId(res.tariffs[0].id);
      if (!driverVehicleId && res.vehicles.length > 0) setDriverVehicleId(res.vehicles[0].id);
    } catch {
    }
  }, [apiGet, contractId, tariffId, contractTariffId, driverVehicleId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, dialogVersion]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/clientes/customers', {
      docType,
      nit,
      dv,
      name: custName,
      taxRegime,
      phone,
      email,
      city,
      address,
      contractId,
      tariffId,
      creditLimit: Number(creditLimit || 0),
    });
    toast('Cliente registrado en el directorio maestro');
    setNit('');
    setDv('');
    setCustName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCreditLimit('0');
    await loadAll();
  };

  const handleDeleteCustomer = async (id: string) => {
    await apiDelete(`/api/v1/clientes/customers/${id}`);
    toast('Cliente eliminado');
    await loadAll();
  };

  const openAbonoModal = (inv: Invoice) => {
    setAbonoInvoice(inv);
    setAbonoAmount(String(inv.pendingBalance));
    setAbonoMethod('Transferencia Bancaria');
    setAbonoNote('');
  };

  const handleConfirmAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abonoInvoice) return;
    await apiPost(`/api/v1/clientes/receivables/${abonoInvoice.id}/abono`, {
      amount: Number(abonoAmount || 0),
      method: abonoMethod,
      note: abonoNote,
    });
    toast(`Abono registrado a la factura ${abonoInvoice.id}`);
    setAbonoInvoice(null);
    await loadAll();
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/clientes/contracts', {
      entityName,
      tariffId: contractTariffId,
      budgetCeiling: Number(budgetCeiling || 0),
    });
    toast('Convenio corporativo registrado');
    setEntityName('');
    await loadAll();
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/clientes/drivers', {
      name: driverName,
      docNumber: driverDoc,
      licenseCategory: driverLicense,
      phone: driverPhone,
      vehicleId: driverVehicleId,
    });
    toast('Conductor registrado');
    setDriverName('');
    setDriverDoc('');
    setDriverPhone('');
    await loadAll();
  };

  const handleCreateCarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/clientes/carriers', {
      nit: carrierNit,
      name: carrierName,
      vehicleType: carrierVehicleType,
      routeZone: carrierRoute,
      phone: carrierPhone,
    });
    toast('Empresa transportadora registrada');
    setCarrierNit('');
    setCarrierName('');
    setCarrierPhone('');
    await loadAll();
  };

  const handleDeleteVehicle = async (id: string) => {
    await apiDelete(`/api/v1/clientes/vehicles/${id}`);
    toast('Vehículo retirado del catálogo');
    await loadAll();
  };

  const buildCustomerCardPayload = (c: Customer): PrintDocumentPayload => {
    const cnt = data.contracts.find((ct) => ct.id === c.contractId);
    const trf = data.tariffs.find((t) => t.id === c.tariffId);
    return {
      document_type: 'FICHA OFICIAL DE CLIENTE / TERCERO',
      document_number: c.code,
      customer_name: c.name,
      customer_nit: c.dv ? `${c.nit}-${c.dv}` : c.nit,
      customer_phone: c.phone,
      customer_address: `${c.address} — ${c.city}`,
      extra_fields: {
        'Código Maestro': c.code,
        'Tipo Documento': c.docType,
        'Régimen Tributario': c.taxRegime,
        Convenio: cnt?.entityName || 'Particular',
        Tarifa: trf?.name || 'Plena',
        'Cupo Crédito': formatCop(c.creditLimit),
      },
      items: [
        {
          code: c.code,
          description: `Saldo actual en Cartera CxC (${c.name})`,
          quantity: 1,
          unit_price: c.currentDebt,
          tax_pct: 0,
          subtotal: c.currentDebt,
        },
      ],
      subtotal: c.currentDebt,
      grand_total: c.currentDebt,
      pending_balance: c.currentDebt,
      notes: `Correo electrónico registrado: ${c.email || 'No reportado'}`,
    };
  };

  const totalPortfolioDebt = data.pendingInvoices.reduce((acc, inv) => acc + inv.pendingBalance, 0);
  const filteredCustomers = searchCustomer.trim()
    ? data.customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
          c.nit.toLowerCase().includes(searchCustomer.toLowerCase()) ||
          c.code.toLowerCase().includes(searchCustomer.toLowerCase())
      )
    : data.customers;

  if (activeModuleKey === 'cartera_cxc') {
    const globalStatementPayload: PrintDocumentPayload = {
      document_type: 'ESTADO GENERAL DE CARTERA POR COBRAR (CXC)',
      document_number: `CXC-${new Date().toISOString().slice(0, 10)}`,
      customer_name: 'Consolidado Cartera Clientes',
      items: data.pendingInvoices.map((inv) => ({
        code: inv.id,
        description: `${inv.customerName} (${inv.date}) — Pagado: ${formatCop(inv.amountPaid)}`,
        quantity: 1,
        unit_price: inv.pendingBalance,
        tax_pct: 0,
        subtotal: inv.pendingBalance,
      })),
      subtotal: totalPortfolioDebt,
      grand_total: totalPortfolioDebt,
      pending_balance: totalPortfolioDebt,
      notes: 'Relación oficial de facturas con saldo pendiente de recaudo.',
    };

    return (
      <div>
        <PkKpiRow
          items={[
            { label: 'Total Cartera por Cobrar', value: formatCop(totalPortfolioDebt), color: 'var(--pk-amber)' },
            { label: 'Facturas con Saldo Pendiente', value: String(data.pendingInvoices.length) },
            {
              label: 'Clientes con Cupo Asignado',
              value: String(data.customers.filter((c) => c.creditLimit > 0).length),
              color: 'var(--pk-primary)',
            },
          ]}
        />

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">💳 Facturas Pendientes de Cobro y Recibos de Caja</div>
            <div className="pk-row-actions">
              <PkPrintButton label="🖨️ Estado de Cuenta General" payload={globalStatementPayload} variant="primary" />
            </div>
          </div>
          <div className="pk-card-body">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Fecha</th>
                    <th>Cliente / NIT</th>
                    <th>Total Factura</th>
                    <th>Abonado</th>
                    <th>Saldo Pendiente</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingInvoices.map((inv) => {
                    const invStatement: PrintDocumentPayload = {
                      document_type: 'ESTADO DE CUENTA Y EXTRACTO DE ABONOS',
                      document_number: inv.id,
                      issue_date: inv.date,
                      customer_name: inv.customerName,
                      customer_nit: inv.customerNit,
                      payment_method: inv.paymentMethod,
                      extra_fields: {
                        'Total Original': formatCop(inv.total),
                        'Total Abonado': formatCop(inv.amountPaid),
                        'Abonos Registrados': String((inv.abonosHistory || []).length),
                      },
                      items: inv.items.map((it) => ({
                        code: it.code,
                        description: it.name,
                        quantity: it.qty,
                        unit_price: it.price,
                        tax_pct: it.taxPct,
                        subtotal: it.qty * it.price,
                      })),
                      subtotal: inv.subtotal,
                      discount_total: inv.discountTotal,
                      tax_total: inv.taxTotal,
                      grand_total: inv.total,
                      pending_balance: inv.pendingBalance,
                      notes:
                        (inv.abonosHistory || [])
                          .map((a) => `${a.id} (${a.date}): ${formatCop(a.amount)} [${a.method}]`)
                          .join(' | ') || 'Sin abonos previos.',
                    };

                    return (
                      <tr key={inv.id}>
                        <td>
                          <strong>{inv.id}</strong>
                        </td>
                        <td>{inv.date}</td>
                        <td>
                          <strong>{inv.customerName}</strong>
                          <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{inv.customerNit}</div>
                        </td>
                        <td>{formatCop(inv.total)}</td>
                        <td style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>{formatCop(inv.amountPaid)}</td>
                        <td>
                          <span className="pk-badge pk-badge-amber">{formatCop(inv.pendingBalance)}</span>
                        </td>
                        <td>
                          <div className="pk-row-actions">
                            <button
                              type="button"
                              className="pk-btn pk-btn-emerald pk-btn-sm"
                              onClick={() => openAbonoModal(inv)}
                            >
                              💵 Registrar Abono
                            </button>
                            <PkPrintButton label="🖨️ Estado de Cuenta" payload={invStatement} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {data.pendingInvoices.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                        Excelente: no existen facturas vencidas o con saldo pendiente por cobrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <PkEntityDialog
          open={Boolean(abonoInvoice)}
          title={`💵 Registrar Abono a Factura ${abonoInvoice?.id || ''}`}
          onClose={() => setAbonoInvoice(null)}
        >
          {abonoInvoice && (
            <form onSubmit={handleConfirmAbono} className="pk-form-grid">
              <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
                <label>Cliente y Saldo Actual</label>
                <input
                  readOnly
                  value={`${abonoInvoice.customerName} — Saldo Pendiente: ${formatCop(abonoInvoice.pendingBalance)}`}
                  style={{ background: '#f8fafc', fontWeight: 700 }}
                />
              </div>
              <div className="pk-field">
                <label>Valor a Abonar ($) *</label>
                <input
                  required
                  type="number"
                  min={1}
                  max={abonoInvoice.pendingBalance}
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(e.target.value)}
                />
              </div>
              <div className="pk-field">
                <label>Medio de Pago</label>
                <select value={abonoMethod} onChange={(e) => setAbonoMethod(e.target.value)}>
                  <option value="Transferencia Bancaria">Transferencia Bancaria / PSE</option>
                  <option value="Efectivo en Caja">Efectivo en Caja</option>
                  <option value="Nequi / Daviplata">Nequi / Daviplata</option>
                  <option value="Tarjeta Débito / Crédito">Tarjeta Débito / Crédito</option>
                </select>
              </div>
              <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
                <label>Comprobante / Observación</label>
                <input
                  value={abonoNote}
                  onChange={(e) => setAbonoNote(e.target.value)}
                  placeholder="Ej: Consignación Bancolombia #849201"
                />
              </div>
              <div className="pk-row-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                <button type="submit" className="pk-btn pk-btn-emerald">
                  💾 Confirmar Recibo de Caja
                </button>
              </div>
            </form>
          )}
        </PkEntityDialog>
      </div>
    );
  }

  if (activeModuleKey === 'contratos_convenios') {
    const totalAvailable = data.contracts.reduce((acc, c) => acc + c.availableBalance, 0);
    return (
      <div>
        <PkKpiRow
          items={[
            { label: 'Convenios Registrados', value: String(data.contracts.length) },
            { label: 'Tarifarios Oficiales', value: String(data.tariffs.length) },
            { label: 'Cupo Convenios Disponible', value: formatCop(totalAvailable), color: 'var(--pk-emerald)' },
          ]}
        />

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">🤝 Crear Nuevo Convenio / Contrato Corporativo</div>
          </div>
          <div className="pk-card-body">
            <form onSubmit={handleCreateContract} className="pk-form-grid">
              <PkAutoCodeInput label="Código Convenio" value={data.nextContractCode} />
              <div className="pk-field">
                <label>Empresa o Entidad Contratante *</label>
                <input
                  required
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="Ej: Cooperativa Santandereana de Transportes"
                />
              </div>
              <PkEntitySelect
                label="Tarifa Aplicable"
                items={data.tariffs}
                value={contractTariffId}
                onChange={setContractTariffId}
                getValue={(t) => t.id}
                getLabel={(t) => `${t.name} (-${t.discountPct}%)`}
              />
              <div className="pk-field">
                <label>Tope Presupuestal ($) *</label>
                <input
                  required
                  type="number"
                  min={0}
                  value={budgetCeiling}
                  onChange={(e) => setBudgetCeiling(e.target.value)}
                />
              </div>
              <div className="pk-field">
                <button type="submit" className="pk-btn pk-btn-primary">
                  ➕ Guardar Convenio
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">📋 Convenios y Tarifarios Vigentes</div>
          </div>
          <div className="pk-card-body">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Entidad / Convenio</th>
                    <th>Tarifa Asociada</th>
                    <th>Tope Contratado</th>
                    <th>Consumido</th>
                    <th>Saldo Disponible</th>
                    <th>Estado</th>
                    <th>Imprimir</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contracts.map((cnt) => (
                    <tr key={cnt.id}>
                      <td>
                        <strong>{cnt.code}</strong>
                      </td>
                      <td>{cnt.entityName}</td>
                      <td>
                        <span className="pk-badge pk-badge-blue">{cnt.tariffName}</span>
                      </td>
                      <td>{formatCop(cnt.budgetCeiling)}</td>
                      <td>{formatCop(cnt.consumedAmount)}</td>
                      <td style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>{formatCop(cnt.availableBalance)}</td>
                      <td>
                        <span className="pk-badge pk-badge-emerald">{cnt.status}</span>
                      </td>
                      <td>
                        <PkPrintButton
                          label="🖨️ Certificado"
                          payload={{
                            document_type: 'CERTIFICADO DE CONVENIO COMERCIAL',
                            document_number: cnt.code,
                            customer_name: cnt.entityName,
                            extra_fields: {
                              Tarifa: cnt.tariffName,
                              Estado: cnt.status,
                              'Tope Presupuestal': formatCop(cnt.budgetCeiling),
                            },
                            items: [
                              {
                                code: cnt.code,
                                description: `Ejecución acumulada convenio ${cnt.entityName}`,
                                quantity: 1,
                                unit_price: cnt.consumedAmount,
                                subtotal: cnt.consumedAmount,
                              },
                            ],
                            subtotal: cnt.consumedAmount,
                            grand_total: cnt.consumedAmount,
                            notes: `Saldo disponible para facturación: ${formatCop(cnt.availableBalance)}`,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeModuleKey === 'flota_terceros') {
    return (
      <div>
        <PkKpiRow
          items={[
            { label: 'Conductores Activos', value: String(data.drivers.length) },
            { label: 'Empresas Transportadoras', value: String(data.carriers.length) },
            { label: 'Vehículos / Placas Registrados', value: String(data.vehicles.length) },
          ]}
        />

        <div className="pk-grid-2">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🧑‍✈️ Catálogo Normalizado de Conductores</div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleCreateDriver} className="pk-form-grid" style={{ marginBottom: 14 }}>
                <PkAutoCodeInput label="Código Conductor" value={data.nextDriverCode} />
                <div className="pk-field">
                  <label>Nombre Completo *</label>
                  <input
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Ej: Hernando Gómez"
                  />
                </div>
                <div className="pk-field">
                  <label>Cédula *</label>
                  <input
                    required
                    value={driverDoc}
                    onChange={(e) => setDriverDoc(e.target.value)}
                    placeholder="79451230"
                  />
                </div>
                <div className="pk-field">
                  <label>Categoría Licencia</label>
                  <select value={driverLicense} onChange={(e) => setDriverLicense(e.target.value)}>
                    <option value="C3 Carga Pesada">C3 Carga Pesada</option>
                    <option value="C2 Camión Rígido">C2 Camión Rígido</option>
                    <option value="C1 Público Liviano">C1 Público Liviano</option>
                    <option value="B2 Particular">B2 Particular</option>
                  </select>
                </div>
                <div className="pk-field">
                  <label>Celular</label>
                  <input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="311..." />
                </div>
                <PkEntitySelect
                  label="Vehículo Asignado"
                  items={data.vehicles}
                  value={driverVehicleId}
                  onChange={setDriverVehicleId}
                  getValue={(v) => v.id}
                  getLabel={(v) => `${v.plate} — ${v.brand}`}
                  onCreateNew={() => openQuickDialog('nueva-placa')}
                  createLabel="+ Nueva Placa"
                />
                <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
                  <button type="submit" className="pk-btn pk-btn-primary">
                    💾 Guardar Conductor
                  </button>
                </div>
              </form>

              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Conductor</th>
                      <th>Licencia</th>
                      <th>Placa</th>
                      <th>Ficha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.drivers.map((drv) => (
                      <tr key={drv.id}>
                        <td>
                          <strong>{drv.code}</strong>
                        </td>
                        <td>
                          {drv.name}
                          <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>CC {drv.docNumber}</div>
                        </td>
                        <td>{drv.licenseCategory}</td>
                        <td>
                          <span className="pk-badge pk-badge-slate">{drv.assignedPlate || '—'}</span>
                        </td>
                        <td>
                          <PkPrintButton
                            label="🖨️ Carnet"
                            payload={{
                              document_type: 'FICHA DE CONDUCTOR HABILITADO',
                              document_number: drv.code,
                              customer_name: drv.name,
                              customer_nit: drv.docNumber,
                              customer_phone: drv.phone,
                              extra_fields: {
                                Licencia: drv.licenseCategory,
                                'Placa Asignada': drv.assignedPlate || 'Sin asignar',
                                Estado: drv.status,
                              },
                              items: [
                                {
                                  code: drv.code,
                                  description: `Registro oficial de conductor ${drv.name}`,
                                  quantity: 1,
                                  unit_price: 0,
                                  subtotal: 0,
                                },
                              ],
                              grand_total: 0,
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🚛 Empresas Transportadoras</div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleCreateCarrier} className="pk-form-grid" style={{ marginBottom: 14 }}>
                <PkAutoCodeInput label="Código Transportista" value={data.nextCarrierCode} />
                <div className="pk-field">
                  <label>NIT *</label>
                  <input
                    required
                    value={carrierNit}
                    onChange={(e) => setCarrierNit(e.target.value)}
                    placeholder="900441122-3"
                  />
                </div>
                <div className="pk-field">
                  <label>Razón Social *</label>
                  <input
                    required
                    value={carrierName}
                    onChange={(e) => setCarrierName(e.target.value)}
                    placeholder="Logística Nacional S.A.S."
                  />
                </div>
                <div className="pk-field">
                  <label>Tipo de Flota</label>
                  <input value={carrierVehicleType} onChange={(e) => setCarrierVehicleType(e.target.value)} />
                </div>
                <div className="pk-field">
                  <label>Ruta / Cobertura</label>
                  <input value={carrierRoute} onChange={(e) => setCarrierRoute(e.target.value)} />
                </div>
                <div className="pk-field">
                  <label>Teléfono Despachos</label>
                  <input value={carrierPhone} onChange={(e) => setCarrierPhone(e.target.value)} />
                </div>
                <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
                  <button type="submit" className="pk-btn pk-btn-primary">
                    💾 Guardar Transportadora
                  </button>
                </div>
              </form>

              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Empresa / NIT</th>
                      <th>Flota / Ruta</th>
                      <th>Ficha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.carriers.map((car) => (
                      <tr key={car.id}>
                        <td>
                          <strong>{car.code}</strong>
                        </td>
                        <td>
                          {car.name}
                          <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>NIT {car.nit}</div>
                        </td>
                        <td>
                          {car.vehicleType}
                          <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{car.routeZone}</div>
                        </td>
                        <td>
                          <PkPrintButton
                            label="🖨️ Ficha"
                            payload={{
                              document_type: 'REGISTRO DE EMPRESA TRANSPORTADORA',
                              document_number: car.code,
                              customer_name: car.name,
                              customer_nit: car.nit,
                              customer_phone: car.phone,
                              extra_fields: {
                                'Tipo Flota': car.vehicleType,
                                'Zona / Ruta': car.routeZone,
                              },
                              items: [
                                {
                                  code: car.code,
                                  description: `Transportadora aliada ${car.name}`,
                                  quantity: 1,
                                  unit_price: 0,
                                  subtotal: 0,
                                },
                              ],
                              grand_total: 0,
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">🚗 Placas y Vehículos Vinculados a Clientes</div>
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              onClick={() => openQuickDialog('nueva-placa')}
            >
              ➕ Registrar Nueva Placa
            </button>
          </div>
          <div className="pk-card-body">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Marca / Línea</th>
                    <th>Modelo</th>
                    <th>Propietario</th>
                    <th>Kilometraje</th>
                    <th>SOAT</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vehicles.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span className="pk-badge pk-badge-blue">{v.plate}</span>
                      </td>
                      <td>{v.brand}</td>
                      <td>{v.modelYear}</td>
                      <td>{v.customerName || '—'}</td>
                      <td>{v.currentKm.toLocaleString('es-CO')} km</td>
                      <td>{v.soatExpiry || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="pk-btn pk-btn-danger pk-btn-sm"
                          onClick={() => void handleDeleteVehicle(v.id)}
                        >
                          🗑️ Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PkKpiRow
        items={[
          { label: 'Clientes Registrados', value: String(data.customers.length) },
          {
            label: 'Cartera Acumulada Clientes',
            value: formatCop(data.customers.reduce((acc, c) => acc + c.currentDebt, 0)),
            color: 'var(--pk-amber)',
          },
          { label: 'Convenios Activos', value: String(data.contracts.length), color: 'var(--pk-primary)' },
          { label: 'Vehículos Asociados', value: String(data.vehicles.length) },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">👤 Registrar Cliente / Empresa en Directorio Maestro</div>
        </div>
        <div className="pk-card-body">
          <form onSubmit={handleCreateCustomer} className="pk-form-grid">
            <PkAutoCodeInput label="Código Cliente" value={data.nextCustomerCode} />

            <div className="pk-field">
              <label>Tipo Documento</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="NIT">NIT Empresarial</option>
                <option value="CC">Cédula de Ciudadanía</option>
                <option value="CE">Cédula de Extranjería</option>
                <option value="PP">Pasaporte</option>
              </select>
            </div>

            <div className="pk-field">
              <label>Número NIT / Cédula *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  required
                  value={nit}
                  onChange={(e) => setNit(e.target.value)}
                  placeholder="900812345"
                  style={{ flex: 1 }}
                />
                <input
                  value={dv}
                  onChange={(e) => setDv(e.target.value)}
                  placeholder="DV"
                  style={{ width: 54 }}
                />
              </div>
            </div>

            <div className="pk-field">
              <label>Nombre Completo o Razón Social *</label>
              <input
                required
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                placeholder="Ej: Transportes del Oriente S.A.S."
              />
            </div>

            <div className="pk-field">
              <label>Régimen Tributario</label>
              <select value={taxRegime} onChange={(e) => setTaxRegime(e.target.value)}>
                <option value="Responsable de IVA">Responsable de IVA</option>
                <option value="No Responsable">No Responsable de IVA</option>
                <option value="Régimen Simple RST">Régimen Simple (RST)</option>
                <option value="Gran Contribuyente">Gran Contribuyente</option>
              </select>
            </div>

            <div className="pk-field">
              <label>Teléfono / WhatsApp</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="310 450 9988" />
            </div>

            <div className="pk-field">
              <label>Correo Electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@empresa.co" />
            </div>

            <div className="pk-field">
              <label>Ciudad</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>

            <div className="pk-field">
              <label>Dirección</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle / Carrera #" />
            </div>

            <PkEntitySelect
              label="Contrato / Convenio"
              items={data.contracts}
              value={contractId}
              onChange={(val) => {
                setContractId(val);
                const found = data.contracts.find((ct) => ct.id === val);
                if (found?.tariffId) setTariffId(found.tariffId);
              }}
              getValue={(c) => c.id}
              getLabel={(c) => `${c.code} — ${c.entityName}`}
            />

            <PkEntitySelect
              label="Tarifa Asignada"
              items={data.tariffs}
              value={tariffId}
              onChange={setTariffId}
              getValue={(t) => t.id}
              getLabel={(t) => `${t.name} (-${t.discountPct}%)`}
            />

            <FeatureGate module="cartera_cxc" feature="cupo_credito_control">
              <div className="pk-field">
                <label>Cupo Máximo de Crédito ($)</label>
                <input
                  type="number"
                  min={0}
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                />
              </div>
            </FeatureGate>

            <div className="pk-field">
              <button type="submit" className="pk-btn pk-btn-primary">
                💾 Guardar Cliente
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📋 Directorio Maestro de Clientes</div>
          <div className="pk-row-actions">
            <input
              value={searchCustomer}
              onChange={(e) => setSearchCustomer(e.target.value)}
              placeholder="🔎 Buscar por nombre, NIT o código..."
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--pk-border)', fontSize: 12.5 }}
            />
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              onClick={() =>
                downloadCsvUtf8(
                  'directorio_clientes_proveko.csv',
                  ['Codigo', 'TipoDoc', 'NIT', 'Nombre', 'Telefono', 'Ciudad', 'CupoCredito', 'DeudaActual'],
                  data.customers.map((c) => [
                    c.code,
                    c.docType,
                    c.dv ? `${c.nit}-${c.dv}` : c.nit,
                    c.name,
                    c.phone,
                    c.city,
                    c.creditLimit,
                    c.currentDebt,
                  ])
                )
              }
            >
              📥 Exportar Excel (.CSV)
            </button>
          </div>
        </div>
        <div className="pk-card-body">
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cliente / Razón Social</th>
                  <th>Documento</th>
                  <th>Ciudad / Contacto</th>
                  <th>Convenio / Tarifa</th>
                  <th>Deuda / Cupo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => {
                  const cnt = data.contracts.find((ct) => ct.id === c.contractId);
                  const trf = data.tariffs.find((t) => t.id === c.tariffId);
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.code}</strong>
                      </td>
                      <td>
                        <strong>{c.name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{c.taxRegime}</div>
                      </td>
                      <td>
                        {c.docType} {c.nit}
                        {c.dv ? `-${c.dv}` : ''}
                      </td>
                      <td>
                        {c.city}
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{c.phone}</div>
                      </td>
                      <td>
                        <div>{cnt?.entityName || 'Particular'}</div>
                        <span className="pk-badge pk-badge-blue">{trf?.name || 'Tarifa Plena'}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: c.currentDebt > 0 ? 'var(--pk-amber)' : 'var(--pk-emerald)' }}>
                          Deuda: {formatCop(c.currentDebt)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>Cupo: {formatCop(c.creditLimit)}</div>
                      </td>
                      <td>
                        <div className="pk-row-actions">
                          <PkPrintButton label="🖨️ Ficha" payload={buildCustomerCardPayload(c)} />
                          <button
                            type="button"
                            className="pk-btn pk-btn-emerald pk-btn-sm"
                            onClick={() => sendToPosCheckout({ customerId: c.id, items: [] })}
                          >
                            🛒 Facturar
                          </button>
                          <button
                            type="button"
                            className="pk-btn pk-btn-danger pk-btn-sm"
                            onClick={() => void handleDeleteCustomer(c.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
