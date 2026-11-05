/**
 * Runtime de Cliente — Centro 3 (Comandas, Mesas, Reserva de Cupos y Tickets)
 * y Centro 4 (Control de Tractomulas, Báscula Camionera y Muelles de Patio) (SOLID SRP).
 */
export function renderWorkstationControllerRuntimeJs(_initialSurface: 'landing' | 'workstation'): string {
  return `
    function renderGastroAndReservationsCenter() {
      const showKds = hasComponent('comp:gastro-tables-kds');
      const showSplit = hasComponent('comp:split-check-seats');
      const showSlots = hasComponent('comp:slot-reservations');
      const showTickets = hasComponent('comp:ticket-issuance');

      document.getElementById('center-kpi-strip').innerHTML =
        '<div class="kpi-card"><span class="kpi-label">Mesas y Comandas</span><div class="kpi-value tabular-nums">' + STATE.db.tablesAndOrders.length + ' Mesas</div><span class="kpi-sub">Control de salón y cocina en vivo</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Reservas y Cupos Activos</span><div class="kpi-value tabular-nums">' + STATE.db.reservationsAndTickets.length + ' Cupos</div><span class="kpi-sub">Agenda y control de aforo</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Tickets / Boletas Emitidas</span><div class="kpi-value">' + (showTickets ? 'Taquilla Activa' : 'Opcional') + '</div><span class="kpi-sub">Verificación por código</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">División de Cuentas</span><div class="kpi-value">' + (showSplit ? 'Por Silla / Partes' : 'Cuenta Única') + '</div><span class="kpi-sub">Cuadre exacto sin centavos perdidos</span></div>';

      const canvas = document.getElementById('center-workspace-canvas');
      canvas.innerHTML =
        (showKds ?
          '<div class="card" style="margin-bottom:16px;">' +
            '<div class="card-header"><span class="card-title">🍽️ Mapa de Mesas, Toma de Comandas y Despacho a Cocina</span><button type="button" class="btn btn-primary" onclick="window.provekoCreateTableOrder()">+ Abrir Nueva Mesa / Comanda</button></div>' +
            '<div class="card-body">' +
              '<div class="form-grid-4" style="margin-bottom:12px;">' +
                '<div class="form-group"><label class="form-label">Mesa / Ubicación</label><input id="tbl-name" class="form-control" value="Mesa 04 · Terraza Cubierta" /></div>' +
                '<div class="form-group"><label class="form-label">Comensales (Cupos)</label><input id="tbl-diners" type="number" class="form-control tabular-nums" value="4" /></div>' +
                '<div class="form-group"><label class="form-label">Mesero / Anfitrión</label><input id="tbl-waiter" class="form-control" value="Camila Londoño" /></div>' +
                '<div class="form-group"><label class="form-label">Pedido Inicial a Cocina</label><input id="tbl-order" class="form-control" value="2x Lomo al Trapo, 2x Jugo Natural" /></div>' +
              '</div>' +
              '<div class="form-grid-3">' +
                STATE.db.tablesAndOrders.map((t, idx) =>
                  '<div class="card" style="border-left:4px solid ' + (t.status === 'DISPONIBLE' ? '#15803D' : '#1D4ED8') + ';">' +
                    '<div class="card-body">' +
                      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">' +
                        '<strong>' + escapeHtml(t.name) + '</strong>' +
                        '<span class="badge ' + (t.status === 'DISPONIBLE' ? 'badge-emerald' : 'badge-amber') + '">' + escapeHtml(t.status) + '</span>' +
                      '</div>' +
                      '<div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">Comensales: <strong>' + t.diners + '</strong> · Mesero: ' + escapeHtml(t.waiter) + '</div>' +
                      '<div style="font-size:12px; margin-bottom:8px;">' + (t.currentOrder.length ? escapeHtml(t.currentOrder.join(' · ')) : 'Sin pedidos activos') + '</div>' +
                      '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                        '<span class="tabular-nums" style="font-weight:800; font-size:15px;">' + formatCop(t.total) + '</span>' +
                        (showSplit && t.total > 0 ? '<span class="badge badge-blue">' + formatCop(Math.round(t.total / Math.max(1, t.diners))) + ' / silla</span>' : '') +
                        '<button type="button" class="btn btn-outline" style="padding:4px 8px; font-size:11px;" onclick="window.provekoAdvanceTableStatus(' + idx + ')">Avanzar Estado</button>' +
                      '</div>' +
                    '</div>' +
                  '</div>'
                ).join('') +
              '</div>' +
            '</div>' +
          '</div>' : '') +
        ((showSlots || showTickets) ?
          '<div class="card"><div class="card-header"><span class="card-title">🎟️ Reserva de Cupos, Alojamiento y Emisión de Tickets / Boletas</span><button type="button" class="btn btn-emerald" onclick="window.provekoCreateReservationOrTicket()">+ Registrar Reserva / Emitir Ticket</button></div>' +
            '<div class="card-body"><div class="form-grid-3" style="margin-bottom:12px;">' +
              '<div class="form-group"><label class="form-label">Modalidad</label><select id="res-kind" class="form-control"><option value="RESERVA_CUPO">Reserva de Cupos / Espacio / Habitación</option><option value="TICKET_ENTRADA">Emisión de Ticket / Boleta de Entrada</option></select></div>' +
              '<div class="form-group"><label class="form-label">Titular / Huésped / Cliente</label><input id="res-holder" class="form-control" value="Dr. Alejandro Vargas" /></div>' +
              '<div class="form-group"><label class="form-label">Documento / NIT</label><input id="res-doc" class="form-control" value="79.441.802" /></div>' +
              '<div class="form-group"><label class="form-label">Espacio, Habitación o Evento</label><input id="res-resource" class="form-control" value="Cupo VIP Terraza / Habitación 204" /></div>' +
              '<div class="form-group"><label class="form-label">Fecha, Hora y Cupos</label><input id="res-date" class="form-control" value="2026-11-08 20:00 (4 Cupos)" /></div>' +
              '<div class="form-group"><label class="form-label">Valor Total ($)</label><input id="res-amount" type="number" class="form-control tabular-nums" value="340000" /></div>' +
            '</div>' +
            '<table class="data-table"><thead><tr><th>Código Ticket</th><th>Modalidad</th><th>Titular</th><th>Espacio / Recurso</th><th>Fecha y Hora</th><th>Cupos</th><th>Valor</th><th>Estado</th></tr></thead><tbody>' +
              STATE.db.reservationsAndTickets.map((r) => '<tr><td class="mono" style="font-weight:700; color:#1D4ED8;">' + escapeHtml(r.ticketCode) + '</td><td><span class="badge badge-blue">' + escapeHtml(r.kind) + '</span></td><td style="font-weight:700;">' + escapeHtml(r.holderName) + '</td><td>' + escapeHtml(r.resourceName) + '</td><td>' + escapeHtml(r.dateSlot) + '</td><td class="tabular-nums">' + r.spots + '</td><td class="tabular-nums" style="font-weight:800;">' + formatCop(r.amount) + '</td><td><span class="badge badge-emerald">' + escapeHtml(r.status) + '</span></td></tr>').join('') +
            '</tbody></table></div></div>' : '');
    }

    function renderLogisticsAndFleetCenter() {
      const showScale = hasComponent('comp:weighbridge-scale');
      const showDock = hasComponent('comp:dock-turn-queue');
      const showSeal = hasComponent('comp:seal-manifest');
      const totalNetKg = STATE.db.trucksInYard.reduce((a, b) => a + b.netWeightKg, 0);

      document.getElementById('center-kpi-strip').innerHTML =
        '<div class="kpi-card"><span class="kpi-label">Tractomulas en Patio</span><div class="kpi-value tabular-nums">' + STATE.db.trucksInYard.length + ' Vehículos</div><span class="kpi-sub">Control de portería, báscula y muelles</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Carga Neta Pesada Hoy</span><div class="kpi-value tabular-nums">' + totalNetKg.toLocaleString('es-CO') + ' kg</div><span class="kpi-sub">' + (totalNetKg / 1000).toFixed(2) + ' Toneladas métricas</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Báscula Camionera</span><div class="kpi-value">' + (showScale ? 'En Línea (Bruto/Tara)' : 'Manual') + '</div><span class="kpi-sub">Cálculo automático de Peso Neto</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Control de Precintos</span><div class="kpi-value">' + (showSeal ? 'Verificado' : 'Estándar') + '</div><span class="kpi-sub">Trazabilidad de seguridad</span></div>';

      const canvas = document.getElementById('center-workspace-canvas');
      canvas.innerHTML =
        '<div class="card"><div class="card-header"><span class="card-title">🚛 Control de Ingreso de Tractomulas, Pesaje en Báscula y Asignación de Muelle</span><button type="button" class="btn btn-primary" onclick="window.provekoRegisterTruckInYard()">+ Registrar Ingreso / Pesaje de Tractomula</button></div>' +
          '<div class="card-body">' +
            '<div class="form-grid-4" style="margin-bottom:14px;">' +
              '<div class="form-group"><label class="form-label">Placa Cabezote</label><input id="trk-plate" class="form-control mono" value="SZN-814" /></div>' +
              '<div class="form-group"><label class="form-label">Placa Remolque / Tráiler</label><input id="trk-trailer" class="form-control mono" value="R-60912" /></div>' +
              '<div class="form-group"><label class="form-label">Configuración Vehicular</label><select id="trk-type" class="form-control"><option>Tractomula 3S3 (6 Ejes - 52 Ton)</option><option>Minimula 2S2 (4 Ejes)</option><option>Dobletroque Rígido</option><option>Camión Sencillo / Turbo</option></select></div>' +
              '<div class="form-group"><label class="form-label">Conductor y Cédula</label><input id="trk-driver" class="form-control" value="Álvaro Morales · CC 14.889.201" /></div>' +
              '<div class="form-group"><label class="form-label">Empresa Transportadora</label><input id="trk-carrier" class="form-control" value="Expreso de Carga Nacional S.A." /></div>' +
              '<div class="form-group"><label class="form-label">Producto / Carga Transportada</label><input id="trk-cargo" class="form-control" value="Maíz Amarillo Industrial a Granel" /></div>' +
              (showDock ? '<div class="form-group"><label class="form-label">Muelle / Silo Asignado (Componente)</label><select id="trk-dock" class="form-control"><option>Muelle #1 - Descargue Granel</option><option>Muelle #2 - Silos Norte</option><option>Muelle #3 - Despacho Producto Terminado</option></select></div>' : '') +
              (showSeal ? '<div class="form-group"><label class="form-label">Precinto / Sello de Seguridad</label><input id="trk-seal" class="form-control mono" value="PREC-99904" /></div>' : '') +
              (showScale ?
                '<div class="form-group"><label class="form-label">Peso Bruto Báscula (kg)</label><input id="trk-gross" type="number" class="form-control tabular-nums" value="51800" oninput="window.provekoRecalcNetWeight()" /></div>' +
                '<div class="form-group"><label class="form-label">Peso Tara Vehículo Vacío (kg)</label><input id="trk-tare" type="number" class="form-control tabular-nums" value="17300" oninput="window.provekoRecalcNetWeight()" /></div>' +
                '<div class="form-group"><label class="form-label">Peso Neto Carga Calculado (kg)</label><input id="trk-net" class="form-control tabular-nums mono" disabled value="34500" style="font-weight:800; color:#15803D; background:#DCFCE7;" /></div>'
                : '') +
            '</div>' +
            '<table class="data-table"><thead><tr><th>Cabezote / Remolque</th><th>Vehículo</th><th>Conductor y Transportadora</th><th>Carga</th>' + (showDock ? '<th>Muelle</th>' : '') + (showScale ? '<th>Bruto (kg)</th><th>Tara (kg)</th><th>Peso Neto (kg)</th>' : '') + (showSeal ? '<th>Precinto</th>' : '') + '<th>Estado en Patio</th><th>Acción</th></tr></thead><tbody>' +
              STATE.db.trucksInYard.map((trk, idx) =>
                '<tr>' +
                  '<td class="mono" style="font-weight:800;">' + escapeHtml(trk.tractorPlate) + ' / ' + escapeHtml(trk.trailerPlate) + '</td>' +
                  '<td>' + escapeHtml(trk.vehicleType) + '</td>' +
                  '<td><strong>' + escapeHtml(trk.driverName) + '</strong><div style="font-size:11px; color:var(--text-muted);">' + escapeHtml(trk.carrier) + '</div></td>' +
                  '<td>' + escapeHtml(trk.cargoProduct) + '</td>' +
                  (showDock ? '<td><span class="badge badge-blue">' + escapeHtml(trk.dock) + '</span></td>' : '') +
                  (showScale ? '<td class="tabular-nums">' + trk.grossWeightKg.toLocaleString('es-CO') + '</td><td class="tabular-nums">' + trk.tareWeightKg.toLocaleString('es-CO') + '</td><td class="tabular-nums mono" style="font-weight:800; color:#15803D;">' + trk.netWeightKg.toLocaleString('es-CO') + ' kg</td>' : '') +
                  (showSeal ? '<td class="mono">' + escapeHtml(trk.sealCode) + '</td>' : '') +
                  '<td><span class="badge badge-emerald">' + escapeHtml(trk.yardStatus) + '</span></td>' +
                  '<td><button type="button" class="btn btn-outline" style="padding:4px 8px; font-size:11px;" onclick="window.provekoAdvanceTruckStatus(' + idx + ')">Avanzar Turno</button></td>' +
                '</tr>'
              ).join('') +
            '</tbody></table>' +
          '</div></div>';
    }
  `;
}
