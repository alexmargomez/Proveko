import React, { useState } from 'react';
import { useProveko, GlobalEntityDialogs } from '@proveko/ui-sdk';
import { SidebarMenu } from './layout/SidebarMenu';
import { TopModuleTabs } from './layout/TopModuleTabs';
import { LandingAndAuth } from './pages/LandingAndAuth';
import { SuperAdminPanel } from './pages/SuperAdminPanel';

import { FacturacionView } from '@services/ms-facturacion/frontend/FacturacionView';
import { ClientesView } from '@services/ms-clientes/frontend/ClientesView';
import { InventarioView } from '@services/ms-inventario/frontend/InventarioView';
import { CajaView } from '@services/ms-caja/frontend/CajaView';
import { ComandasView } from '@services/ms-comandas/frontend/ComandasView';
import { HoteleriaView } from '@services/ms-hoteleria/frontend/HoteleriaView';
import { TallerView } from '@services/ms-taller/frontend/TallerView';
import { BasculaView } from '@services/ms-bascula/frontend/BasculaView';
import { ComprasView } from '@services/ms-compras/frontend/ComprasView';
import { AgendaView } from '@services/ms-agenda/frontend/AgendaView';
import { TaquillaView } from '@services/ms-taquilla/frontend/TaquillaView';
import { NominaView } from '@services/ms-nomina/frontend/NominaView';
import { ContabilidadView } from '@services/ms-contabilidad/frontend/ContabilidadView';
import { ReportesView } from '@services/ms-reportes/frontend/ReportesView';
import { ImpresionesView } from '@services/ms-impresiones/frontend/ImpresionesView';

const SERVICE_VIEW_MAP: Record<string, React.FC> = {
  'ms-facturacion': FacturacionView,
  'ms-clientes': ClientesView,
  'ms-inventario': InventarioView,
  'ms-caja': CajaView,
  'ms-comandas': ComandasView,
  'ms-hoteleria': HoteleriaView,
  'ms-taller': TallerView,
  'ms-bascula': BasculaView,
  'ms-compras': ComprasView,
  'ms-agenda': AgendaView,
  'ms-taquilla': TaquillaView,
  'ms-nomina': NominaView,
  'ms-contabilidad': ContabilidadView,
  'ms-reportes': ReportesView,
  'ms-impresiones': ImpresionesView,
};

export const App: React.FC = () => {
  const { publicView, activeServiceKey } = useProveko();
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  if (publicView !== 'app') {
    return <LandingAndAuth />;
  }

  const ActiveMicroserviceView = SERVICE_VIEW_MAP[activeServiceKey] || FacturacionView;

  return (
    <div style={{ width: '100%', minHeight: '100vh' }}>
      <TopModuleTabs
        showAdminPanel={showAdminPanel}
        onOpenAdmin={() => setShowAdminPanel((prev) => !prev)}
      />

      <div className="pk-workstation">
        <SidebarMenu
          showAdminPanel={showAdminPanel}
          onToggleAdminPanel={setShowAdminPanel}
        />

        <main className="pk-main">
          <div className="pk-stage">
            {showAdminPanel ? (
              <SuperAdminPanel onClose={() => setShowAdminPanel(false)} />
            ) : (
              <ActiveMicroserviceView />
            )}
          </div>
        </main>
      </div>

      <GlobalEntityDialogs />
    </div>
  );
};
