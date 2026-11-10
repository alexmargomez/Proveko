import React, { useState, useEffect } from 'react';
import { useProveko } from '../context/ProvekoContext';
import { PkEntityDialog, PkAutoCodeInput } from './SdkPrimitives';
import { Customer } from '../types/domain';

export const GlobalEntityDialogs: React.FC = () => {
  const { activeDialog, closeQuickDialog, notifyDialogSaved, apiGet, apiPost, toast } = useProveko();

  const [nit, setNit] = useState('');
  const [docType, setDocType] = useState('NIT');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Bogotá D.C.');
  const [creditLimit, setCreditLimit] = useState('0');

  const [licenseCat, setLicenseCat] = useState('C2');
  const [vehicleType, setVehicleType] = useState('Tractocamión 3S3');
  const [routeZone, setRouteZone] = useState('Nacional');

  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [modelYear, setModelYear] = useState('2025');
  const [currentKm, setCurrentKm] = useState('15000');
  const [soatExpiry, setSoatExpiry] = useState('2027-06-30');
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [manager, setManager] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('Doble Ejecutiva');
  const [floor, setFloor] = useState('Piso 2');
  const [nightlyRate, setNightlyRate] = useState('165000');

  useEffect(() => {
    if (activeDialog === 'nueva-placa') {
      apiGet<{ customers: Customer[] }>('/api/v1/clientes/all')
        .then((r) => {
          const list = r.customers || [];
          setCustomers(list);
          if (list.length > 0 && !customerId) setCustomerId(list[0].id);
        })
        .catch(() => {});
    }
  }, [activeDialog, apiGet, customerId]);

  const resetFields = () => {
    setNit('');
    setName('');
    setPhone('');
    setPlate('');
    setBrand('');
    setManager('');
    setRoomNumber('');
  };

  if (!activeDialog) return null;

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/clientes/customers', {
      docType,
      nit,
      name,
      phone,
      city,
      creditLimit: Number(creditLimit || 0),
    });
    toast('Cliente registrado correctamente');
    resetFields();
    notifyDialogSaved();
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/clientes/drivers', {
      name,
      docNumber: nit,
      licenseCategory: licenseCat,
      phone,
    });
    toast('Conductor registrado en catálogo');
    resetFields();
    notifyDialogSaved();
  };

  const handleSaveCarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/clientes/carriers', {
      nit,
      name,
      vehicleType,
      routeZone,
      phone,
    });
    toast('Transportista registrado en catálogo');
    resetFields();
    notifyDialogSaved();
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/clientes/vehicles', {
      plate: plate.toUpperCase(),
      brand,
      modelYear,
      customerId,
      currentKm: Number(currentKm || 0),
      soatExpiry,
    });
    toast('Vehículo / Placa registrado correctamente');
    resetFields();
    notifyDialogSaved();
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/inventario/warehouses', {
      name,
      city,
      manager,
    });
    toast('Nueva bodega creada');
    resetFields();
    notifyDialogSaved();
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/hoteleria/rooms', {
      roomNumber,
      roomType,
      floor,
      nightlyRate: Number(nightlyRate || 0),
    });
    toast('Habitación agregada al inventario hotelero');
    resetFields();
    notifyDialogSaved();
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/compras/suppliers', {
      nit,
      name,
      city,
      phone,
    });
    toast('Proveedor registrado correctamente');
    resetFields();
    notifyDialogSaved();
  };

  return (
    <>
      <PkEntityDialog open={activeDialog === 'nuevo-cliente'} title="➕ Registrar Nuevo Cliente / Huésped" onClose={closeQuickDialog}>
        <form onSubmit={handleSaveCustomer} className="pk-form-grid">
          <PkAutoCodeInput label="Código Cliente" value="CLI-AUTO" />
          <div className="pk-field">
            <label>Tipo Documento</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="NIT">NIT Empresarial</option>
              <option value="CC">Cédula de Ciudadanía</option>
              <option value="CE">Cédula Extranjería</option>
              <option value="PP">Pasaporte</option>
            </select>
          </div>
          <div className="pk-field">
            <label>Número Documento / NIT *</label>
            <input required value={nit} onChange={(e) => setNit(e.target.value)} placeholder="Ej: 901452100-2" />
          </div>
          <div className="pk-field">
            <label>Nombre Completo o Razón Social *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Comercializadora Andina SAS" />
          </div>
          <div className="pk-field">
            <label>Teléfono / WhatsApp</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 3104509988" />
          </div>
          <div className="pk-field">
            <label>Ciudad</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Cupo de Crédito ($)</label>
            <input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
          </div>
          <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="pk-btn pk-btn-primary">💾 Guardar Cliente</button>
          </div>
        </form>
      </PkEntityDialog>

      <PkEntityDialog open={activeDialog === 'nuevo-conductor'} title="➕ Registrar Nuevo Conductor" onClose={closeQuickDialog}>
        <form onSubmit={handleSaveDriver} className="pk-form-grid">
          <PkAutoCodeInput label="Código Conductor" value="COND-AUTO" />
          <div className="pk-field">
            <label>Nombre Completo *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Álvaro Ríos" />
          </div>
          <div className="pk-field">
            <label>Cédula *</label>
            <input required value={nit} onChange={(e) => setNit(e.target.value)} placeholder="Ej: 79854120" />
          </div>
          <div className="pk-field">
            <label>Categoría Licencia</label>
            <select value={licenseCat} onChange={(e) => setLicenseCat(e.target.value)}>
              <option value="C3">C3 — Articulado / Tractocamión</option>
              <option value="C2">C2 — Camión Rígido / Dobletroque</option>
              <option value="C1">C1 — Servicio Público Liviano</option>
              <option value="B2">B2 — Particular Pesado</option>
            </select>
          </div>
          <div className="pk-field">
            <label>Celular</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="312..." />
          </div>
          <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="pk-btn pk-btn-primary">💾 Guardar Conductor</button>
          </div>
        </form>
      </PkEntityDialog>

      <PkEntityDialog open={activeDialog === 'nuevo-transportista'} title="➕ Registrar Empresa Transportadora" onClose={closeQuickDialog}>
        <form onSubmit={handleSaveCarrier} className="pk-form-grid">
          <PkAutoCodeInput label="Código Transportista" value="TRN-AUTO" />
          <div className="pk-field">
            <label>NIT *</label>
            <input required value={nit} onChange={(e) => setNit(e.target.value)} placeholder="900..." />
          </div>
          <div className="pk-field">
            <label>Empresa Transportadora *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Transportes del Magdalena SAS" />
          </div>
          <div className="pk-field">
            <label>Tipo de Flota</label>
            <input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Ruta / Zona</label>
            <input value={routeZone} onChange={(e) => setRouteZone(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Teléfono Despachos</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="pk-btn pk-btn-primary">💾 Guardar Transportista</button>
          </div>
        </form>
      </PkEntityDialog>

      <PkEntityDialog open={activeDialog === 'nueva-placa'} title="➕ Registrar Vehículo / Placa" onClose={closeQuickDialog}>
        <form onSubmit={handleSaveVehicle} className="pk-form-grid">
          <div className="pk-field">
            <label>Placa *</label>
            <input required value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="Ej: KLM-942" />
          </div>
          <div className="pk-field">
            <label>Marca y Línea *</label>
            <input required value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ej: Chevrolet NPR / Mazda CX-30" />
          </div>
          <div className="pk-field">
            <label>Modelo (Año)</label>
            <input value={modelYear} onChange={(e) => setModelYear(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Propietario / Cliente</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.nit})</option>
              ))}
            </select>
          </div>
          <div className="pk-field">
            <label>Kilometraje Actual</label>
            <input type="number" value={currentKm} onChange={(e) => setCurrentKm(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Vencimiento SOAT</label>
            <input type="date" value={soatExpiry} onChange={(e) => setSoatExpiry(e.target.value)} />
          </div>
          <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="pk-btn pk-btn-primary">💾 Guardar Vehículo</button>
          </div>
        </form>
      </PkEntityDialog>

      <PkEntityDialog open={activeDialog === 'nueva-bodega'} title="➕ Registrar Nueva Bodega / Sede" onClose={closeQuickDialog}>
        <form onSubmit={handleSaveWarehouse} className="pk-form-grid">
          <PkAutoCodeInput label="Código Bodega" value="BOD-AUTO" />
          <div className="pk-field">
            <label>Nombre de la Bodega *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Bodega Norte / Almacén Repuestos" />
          </div>
          <div className="pk-field">
            <label>Ciudad</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Jefe de Bodega</label>
            <input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Nombre del responsable" />
          </div>
          <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="pk-btn pk-btn-primary">💾 Crear Bodega</button>
          </div>
        </form>
      </PkEntityDialog>

      <PkEntityDialog open={activeDialog === 'nueva-habitacion'} title="➕ Registrar Nueva Habitación / Cabaña" onClose={closeQuickDialog}>
        <form onSubmit={handleSaveRoom} className="pk-form-grid">
          <div className="pk-field">
            <label>N° Habitación *</label>
            <input required value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="Ej: 301" />
          </div>
          <div className="pk-field">
            <label>Tipo de Acomodación</label>
            <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
              <option value="Sencilla Estándar">Sencilla Estándar</option>
              <option value="Doble Ejecutiva">Doble Ejecutiva</option>
              <option value="Suite Junior">Suite Junior</option>
              <option value="Cabaña Familiar">Cabaña Familiar</option>
            </select>
          </div>
          <div className="pk-field">
            <label>Piso / Zona</label>
            <input value={floor} onChange={(e) => setFloor(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Tarifa por Noche ($) *</label>
            <input required type="number" value={nightlyRate} onChange={(e) => setNightlyRate(e.target.value)} />
          </div>
          <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="pk-btn pk-btn-primary">💾 Guardar Habitación</button>
          </div>
        </form>
      </PkEntityDialog>

      <PkEntityDialog open={activeDialog === 'nuevo-proveedor'} title="➕ Registrar Nuevo Proveedor" onClose={closeQuickDialog}>
        <form onSubmit={handleSaveSupplier} className="pk-form-grid">
          <PkAutoCodeInput label="Código Proveedor" value="PRV-AUTO" />
          <div className="pk-field">
            <label>NIT Proveedor *</label>
            <input required value={nit} onChange={(e) => setNit(e.target.value)} placeholder="800..." />
          </div>
          <div className="pk-field">
            <label>Razón Social / Nombre *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Importadora Nacional SAS" />
          </div>
          <div className="pk-field">
            <label>Ciudad</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Teléfono Contacto</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="pk-btn pk-btn-primary">💾 Guardar Proveedor</button>
          </div>
        </form>
      </PkEntityDialog>
    </>
  );
};
