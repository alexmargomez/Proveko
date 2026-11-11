import React from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
  PkSelect,
} from '@platform/ui-sdk';

export interface VehicleOption {
  id: string;
  plate: string;
  brand: string;
  vehicleType?: string;
  modelYear?: string;
  customerId: string;
  customerName: string;
  currentKm: number;
  nextOilKm?: number;
  nextOilChangeKm?: number;
  soatExpiry?: string;
}

export interface WorkerOption {
  id: string;
  code: string;
  name: string;
  docNumber: string;
  specialty: string;
  commissionPct: number;
  phone: string;
  totalDayGross: number;
}

export interface FacturasTallerBoxProps {
  vehicles: VehicleOption[];
  workers: WorkerOption[];
  vehicleId: string;
  onVehicleChange: (vehicleId: string) => void;
  currentKm: string;
  onCurrentKmChange: (km: string) => void;
  nextOilKm: string;
  onNextOilKmChange: (km: string) => void;
  mechanicId: string;
  onMechanicChange: (mechanicId: string) => void;
  workOrderId: string;
  onWorkOrderIdChange: (orderId: string) => void;
  onOpenNewVehicleModal?: () => void;
}

export const FacturasTallerBox: React.FC<FacturasTallerBoxProps> = ({
  vehicles,
  workers,
  vehicleId,
  onVehicleChange,
  currentKm,
  onCurrentKmChange,
  nextOilKm,
  onNextOilKmChange,
  mechanicId,
  onMechanicChange,
  workOrderId,
  onWorkOrderIdChange,
  onOpenNewVehicleModal,
}) => {
  const { hasFeature, hasService } = usePlatform();
  const canManageWorkshop = hasService('ms-taller');

  const vehicleOptions: VehicleOption[] = [
    {
      id: '',
      plate: '',
      brand: '— Venta Mostrador (Sin Placa) —',
      customerId: '',
      customerName: '',
      currentKm: 0,
    },
    ...vehicles,
  ];

  const workerOptions: WorkerOption[] = [
    {
      id: '',
      code: '',
      name: '— Sin técnico / mecánico asignado —',
      docNumber: '',
      specialty: '',
      commissionPct: 0,
      phone: '',
      totalDayGross: 0,
    },
    ...workers,
  ];

  return (
    <ModuleGate module="facturas_taller">
      <div
        style={{
          margin: '12px 0',
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid #93c5fd',
          background: '#eff6ff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ fontSize: 12.5, color: '#1e3a8a' }}>
            🔧 Apartado Automotriz — Placa, Kilometraje y Orden de Taller
          </strong>
          {hasFeature('facturas_taller', 'factura_taller_pdf') && vehicleId && (
            <span className="pk-badge pk-badge-blue">
              🖨️ PDF Estructura Automotriz Activo
            </span>
          )}
        </div>

        <div className="pk-form-grid">
          <PkSelect
            label="Placa / Vehículo"
            items={vehicleOptions}
            value={vehicleId}
            onChange={onVehicleChange}
            getValue={(v) => v.id}
            getLabel={(v) =>
              v.id
                ? `${v.plate} — ${v.brand} (${v.customerName || 'Taller'})`
                : v.brand
            }
            onCreateNew={canManageWorkshop ? onOpenNewVehicleModal : undefined}
            createLabel="+ Nueva Placa"
            searchable
          />

          <div className="pk-field">
            <label>Kilometraje Actual</label>
            <input
              type="text"
              value={currentKm}
              onChange={(e) => onCurrentKmChange(e.target.value)}
              placeholder="Ej: 68.400 km"
            />
          </div>

          <div className="pk-field">
            <label>Próximo Aceite</label>
            <input
              type="text"
              value={nextOilKm}
              onChange={(e) => onNextOilKmChange(e.target.value)}
              placeholder="Ej: 73.400 km"
            />
          </div>

          <div className="pk-field">
            <label>Orden de Servicio (Opcional)</label>
            <input
              type="text"
              value={workOrderId}
              onChange={(e) => onWorkOrderIdChange(e.target.value)}
              placeholder="Ej: OT-705"
            />
          </div>

          <FeatureGate module="facturas_taller" feature="asignar_mecanico">
            <PkSelect
              label="Mecánico / Técnico (Comisión)"
              items={workerOptions}
              value={mechanicId}
              onChange={onMechanicChange}
              getValue={(w) => w.id}
              getLabel={(w) =>
                w.id ? `${w.name} — ${w.specialty} (${w.commissionPct}%)` : w.name
              }
            />
          </FeatureGate>
        </div>
      </div>
    </ModuleGate>
  );
};
