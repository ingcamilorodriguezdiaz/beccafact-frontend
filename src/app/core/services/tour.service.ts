import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Shepherd from 'shepherd.js';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

// ─── Internal step definition ────────────────────────────────────────────────
interface TourStepDef {
  id: string;
  title: string;
  text: string;
  category?: string;
  attachTo?: { element: string; on: string };
  navigateTo?: string;   // navigate before showing this step
  isLast?: boolean;
  allowCenterFallback?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

@Injectable({ providedIn: 'root' })
export class TourService {
  // Usamos 'any' para evitar conflictos de tipos entre versiones de shepherd.js
  private tour: any = null;
  private started = false;

  private router = inject(Router);
  private http   = inject(HttpClient);
  private auth   = inject(AuthService);

  private readonly API = `${environment.apiUrl}/users/me/tour-seen`;

  // ── Public entry point ─────────────────────────────────────────────────────

  start(firstName: string): void {
    if (this.started) return;
    this.started = true;

    this.tour = new Shepherd.Tour({
      useModalOverlay: true,
      exitOnEsc: true,
      keyboardNavigation: true,
      defaultStepOptions: {
        classes: 'beccafact-tour',
        scrollTo: { behavior: 'smooth', block: 'center' },
        cancelIcon: { enabled: true, label: 'Cerrar tour' },
        // @ts-ignore
        popperOptions: {
          modifiers: [{ name: 'offset', options: { offset: [0, 14] } }],
        },
      },
    });

    this.tour.on('complete', () => this.markSeen());
    this.tour.on('cancel',   () => this.markSeen());

    const steps = this.buildStepDefs(firstName);
    this.registerSteps(steps);

    // Pequeño delay para que Angular termine de renderizar el layout
    setTimeout(() => this.tour?.start(), 700);
  }

  // ── Backend persistence ────────────────────────────────────────────────────

  private markSeen(): void {
    this.http.patch(this.API, {}).subscribe();
  }

  // ── Plan feature helper ────────────────────────────────────────────────────

  private feat(key: string): boolean {
    const val = this.auth.planFeatures()[key];
    return val !== undefined && val !== 'false' && val !== '0';
  }

  // ── Build step definitions according to enabled plan features ──────────────

  private buildStepDefs(firstName: string): TourStepDef[] {
    const steps: TourStepDef[] = [];

    // ── 1. Bienvenida (Dashboard) ──────────────────────────────────────────
    steps.push({
      id: 'welcome',
      title: `Bienvenido a BeccaFact, ${firstName}`,
      text: 'Este recorrido ahora cubre los módulos activos de tu plan y las áreas nuevas del ERP. Te mostraremos dónde está cada flujo clave y cómo moverte con más claridad por la aplicación.',
      category: 'Inicio',
      navigateTo: '/dashboard',
    });

    steps.push({
      id: 'dashboard-welcome',
      title: 'Tu panel de inicio',
      text: 'Aquí encuentras el <strong>resumen diario</strong>: saludo personalizado, nombre de tu empresa y el período actual. Es lo primero que verás cada vez que ingreses.',
      category: 'Dashboard',
      attachTo: { element: '#tour-welcome', on: 'bottom' },
    });

    steps.push({
      id: 'dashboard-stats',
      title: 'Métricas clave del negocio',
      text: 'Estas tarjetas muestran en tiempo real: <strong>facturas del mes</strong>, <strong>clientes activos</strong>, productos en catálogo y alertas de stock bajo. Un vistazo completo al estado de tu empresa.',
      category: 'Dashboard',
      attachTo: { element: '#tour-stats', on: 'bottom' },
    });

    steps.push({
      id: 'dashboard-actions',
      title: 'Acciones rápidas',
      text: 'Desde aquí puedes <strong>crear una factura</strong>, añadir un producto, registrar un cliente o ir directo a los reportes — sin navegar por el menú. Es el atajo principal de la plataforma.',
      category: 'Dashboard',
      attachTo: { element: '#tour-quick-actions', on: 'top' },
    });

    steps.push({
      id: 'sidebar-navigation',
      title: 'Menú principal del ERP',
      text: 'Este sidebar agrupa los módulos por operación, inventario, gestión y administración. Desde aquí navegas entre <strong>Factura</strong>, <strong>POS</strong>, <strong>Cotizaciones</strong>, <strong>Compras</strong>, <strong>Contabilidad</strong> y <strong>Nómina</strong> según tu plan y permisos.',
      category: 'Navegación',
      attachTo: { element: '#tour-sidebar', on: 'right' },
      navigateTo: '/dashboard',
    });

    steps.push({
      id: 'sidebar-plan-modules',
      title: 'Módulos activos del plan',
      text: 'Aquí puedes <strong>expandir o contraer</strong> la lista de módulos y capacidades incluidas en tu plan. Es útil para validar rápidamente qué funciones están habilitadas para esta empresa.',
      category: 'Navegación',
      attachTo: { element: '#tour-plan-modules', on: 'right' },
      navigateTo: '/dashboard',
    });

    // ── 2. Facturación Electrónica ─────────────────────────────────────────
    if (this.feat('has_invoices')) {
      steps.push({
        id: 'invoices-header',
        title: 'Facturación Electrónica',
        text: 'Aquí gestionas <strong>todas tus facturas DIAN</strong>. Visualiza el historial completo, el estado de transmisión ante la DIAN y el total facturado del período seleccionado.',
        category: 'Facturación',
        attachTo: { element: '#tour-invoice-header', on: 'bottom' },
        navigateTo: '/invoices',
      });

      steps.push({
        id: 'invoices-new',
        title: 'Crear una nueva factura',
        text: 'Con este botón abres el formulario de <strong>nueva factura electrónica</strong>. Seleccionas el cliente, agregas ítems con precio e IVA, y la envías directamente a la DIAN. También puedes guardarla como borrador.',
        category: 'Facturación',
        attachTo: { element: '#tour-new-invoice', on: 'left' },
      });

      steps.push({
        id: 'invoices-filters',
        title: 'Buscar y filtrar facturas',
        text: 'Filtra por <strong>número de factura</strong>, cliente, estado (borrador, enviada, aceptada, rechazada), tipo (venta, nota crédito, nota débito) o rango de fechas para encontrar cualquier documento al instante.',
        category: 'Facturación',
        attachTo: { element: '#tour-invoice-filters', on: 'bottom' },
      });

      steps.push({
        id: 'invoices-table',
        title: 'Listado de facturas',
        text: 'Cada fila muestra número, cliente, fecha, total y estado DIAN. Con los íconos de acción puedes <strong>ver el detalle</strong>, reenviar a la DIAN, marcar como pagada, o generar una <strong>nota crédito o débito</strong>.',
        category: 'Facturación',
        attachTo: { element: '#tour-invoice-table', on: 'top' },
      });
    }

    steps.push({
      id: 'quotes-header',
      title: 'Cotizaciones comerciales',
      text: 'Este módulo concentra la etapa previa a la facturación. Desde aquí creas propuestas, haces seguimiento comercial y conviertes cotizaciones aprobadas en documentos operativos del ERP.',
      category: 'Cotizaciones',
      attachTo: { element: '#tour-quotes-header', on: 'bottom' },
      navigateTo: '/quotes',
    });

    steps.push({
      id: 'quotes-navigation',
      title: 'Gobierno y creación de propuestas',
      text: 'La navegación del módulo agrupa <strong>aprobaciones</strong>, <strong>maestros comerciales</strong> y <strong>nuevas cotizaciones</strong>, para que el equipo comercial configure reglas y opere desde un solo bloque.',
      category: 'Cotizaciones',
      attachTo: { element: '#tour-quotes-nav', on: 'bottom' },
    });

    // ── 3. Inventario ──────────────────────────────────────────────────────
    if (this.feat('has_inventory')) {
      steps.push({
        id: 'inventory-header',
        title: 'Inventario de productos',
        text: 'Administra tu <strong>catálogo completo</strong>: nombre, SKU, categoría, precio de venta, IVA aplicable y stock disponible. También puedes <strong>importar productos masivamente</strong> desde un archivo CSV.',
        category: 'Inventario',
        attachTo: { element: '#tour-inventory-header', on: 'bottom' },
        navigateTo: '/inventory',
      });

      steps.push({
        id: 'inventory-new',
        title: 'Agregar un producto',
        text: 'Haz clic aquí para <strong>crear un nuevo producto</strong> en el catálogo. Define nombre, código, precio, tipo de IVA, stock mínimo y máximo. Los productos activos quedarán disponibles al crear facturas.',
        category: 'Inventario',
        attachTo: { element: '#tour-new-product', on: 'left' },
      });

      steps.push({
        id: 'inventory-table',
        title: 'Gestión del catálogo',
        text: 'Desde la tabla puedes <strong>editar</strong> cualquier producto, activarlo o desactivarlo, y ver alertas de stock bajo resaltadas en amarillo. Las filas en rojo indican productos agotados.',
        category: 'Inventario',
        attachTo: { element: '#tour-inventory-table', on: 'top' },
      });
    }

    // ── 4. Clientes ────────────────────────────────────────────────────────
    steps.push({
      id: 'customers-header',
      title: 'Base de datos de clientes',
      text: 'Registra y gestiona todos tus <strong>compradores y terceros</strong>. Cada cliente almacena: tipo y número de documento, razón social, datos de contacto, ubicación y condiciones de crédito.',
      category: 'Clientes',
      attachTo: { element: '#tour-customers-header', on: 'bottom' },
      navigateTo: '/customers',
    });

    steps.push({
      id: 'customers-new',
      title: 'Agregar un nuevo cliente',
      text: 'Usa este botón para <strong>registrar un cliente</strong>. Completa sus datos fiscales (NIT o cédula), información de contacto y límite de crédito. Luego podrás seleccionarlo directamente al emitir una factura.',
      category: 'Clientes',
      attachTo: { element: '#tour-new-customer', on: 'left' },
    });

    steps.push({
      id: 'customers-table',
      title: 'Listado de clientes',
      text: 'Desde la tabla puedes <strong>ver el detalle</strong> de cada cliente con su historial de facturas recientes, <strong>editarlo</strong> o desactivarlo. Tienes además vista de cuadrícula si prefieres tarjetas.',
      category: 'Clientes',
      attachTo: { element: '#tour-customers-table', on: 'top' },
    });

    if (this.feat('has_purchasing')) {
      steps.push({
        id: 'purchasing-header',
        title: 'Compras y abastecimiento',
        text: 'Aquí administras solicitudes, órdenes, recepciones, cuentas por pagar y acuerdos con proveedores o terceros de compra, con una vista mucho más alineada al flujo operativo real.',
        category: 'Compras',
        attachTo: { element: '#tour-purchasing-header', on: 'bottom' },
        navigateTo: '/purchasing',
      });

      steps.push({
        id: 'purchasing-navigation',
        title: 'Áreas de compras',
        text: 'La navegación del módulo divide la operación entre <strong>base comercial</strong>, <strong>operación de compra</strong>, <strong>tesorería y ajustes</strong> y <strong>abastecimiento estratégico</strong>.',
        category: 'Compras',
        attachTo: { element: '#tour-purchasing-nav', on: 'bottom' },
      });
    }

    if (this.feat('has_accounting')) {
      steps.push({
        id: 'accounting-header',
        title: 'Contabilidad empresarial',
        text: 'Desde contabilidad controlas el plan de cuentas, comprobantes, bancos, impuestos, integraciones automáticas y la capa enterprise de activos, provisiones y auditoría.',
        category: 'Contabilidad',
        attachTo: { element: '#tour-accounting-header', on: 'bottom' },
        navigateTo: '/accounting',
      });

      steps.push({
        id: 'accounting-navigation',
        title: 'Áreas de contabilidad',
        text: 'Este bloque organiza la operación entre <strong>base contable</strong>, <strong>control y cumplimiento</strong> y <strong>gestión enterprise</strong>, manteniendo visibilidad clara de cada frente.',
        category: 'Contabilidad',
        attachTo: { element: '#tour-accounting-nav', on: 'bottom' },
      });
    }

    // ── 5. Reportes ────────────────────────────────────────────────────────
    if (this.feat('has_reports')) {
      steps.push({
        id: 'reports-header',
        title: 'Reportes y Análisis',
        text: 'Obtén una <strong>visión financiera completa</strong> de tu negocio. Filtra por año y mes para analizar períodos específicos y comparar la evolución de tus ventas.',
        category: 'Reportes',
        attachTo: { element: '#tour-reports-header', on: 'bottom' },
        navigateTo: '/reports',
      });

      steps.push({
        id: 'reports-kpis',
        title: 'Indicadores financieros',
        text: 'Las tarjetas KPI muestran: <strong>ingresos totales</strong>, facturas emitidas, IVA generado y saldo de cartera pendiente — todo calculado en tiempo real para el período seleccionado.',
        category: 'Reportes',
        attachTo: { element: '#tour-kpi-grid', on: 'bottom' },
      });

      steps.push({
        id: 'reports-charts',
        title: 'Gráficos de tendencia',
        text: 'El gráfico de barras muestra la <strong>evolución de ingresos mes a mes</strong>. A la derecha, el análisis de cartera por antigüedad te indica qué facturas llevan más tiempo vencidas.',
        category: 'Reportes',
        attachTo: { element: '#tour-charts', on: 'top' },
      });
    }

    // ── 6. Punto de Venta (POS) ────────────────────────────────────────────
    if (this.feat('has_pos')) {
      steps.push({
        id: 'pos-session-bar',
        title: 'Punto de Venta (POS)',
        text: 'Aquí gestionas tu <strong>caja registradora digital</strong>. La barra superior muestra el efectivo de apertura, el total de ventas del día y el número de transacciones de la sesión activa.',
        category: 'POS',
        attachTo: { element: '#tour-pos-session-bar', on: 'bottom' },
        navigateTo: '/pos',
      });

      steps.push({
        id: 'pos-products',
        title: 'Catálogo de productos',
        text: 'En este panel aparecen todos los <strong>productos disponibles</strong>. Puedes buscarlos por nombre o SKU, y hacer clic en cualquier tarjeta para agregarlo al carrito al instante. Las tarjetas con stock bajo o agotado se marcan en amarillo o gris.',
        category: 'POS',
        attachTo: { element: '#tour-pos-products', on: 'right' },
      });

      steps.push({
        id: 'pos-sku',
        title: 'Búsqueda por SKU / código de barras',
        text: 'Escribe o escanea el <strong>código de barras o SKU</strong> y presiona Enter para agregar el producto al carrito sin buscarlo visualmente. Ideal para cajas con lector de código de barras. Con <strong>"+ Ítem libre"</strong> puedes añadir productos sin SKU o servicios puntuales.',
        category: 'POS',
        attachTo: { element: '#tour-pos-sku', on: 'left' },
      });

      steps.push({
        id: 'pos-customer',
        title: 'Asignar un cliente',
        text: 'Busca y selecciona el <strong>cliente</strong> para esta venta. Si marcas la opción de factura electrónica, el documento DIAN quedará vinculado automáticamente. Para ventas rápidas sin cliente registrado, puedes dejarlo vacío.',
        category: 'POS',
        attachTo: { element: '#tour-pos-customer', on: 'left' },
      });

      steps.push({
        id: 'pos-cart',
        title: 'Carrito de venta',
        text: 'Aquí ves todos los <strong>ítems de la venta actual</strong>: ajusta cantidades con + / −, aplica descuento global por porcentaje y revisa el subtotal, IVA y total. Cuando todo esté listo, pulsa el botón de cobro.',
        category: 'POS',
        attachTo: { element: '#tour-pos-cart', on: 'left' },
      });

      steps.push({
        id: 'pos-charge',
        title: 'Cobrar la venta',
        text: 'Presiona <strong>Cobrar</strong> para registrar el pago. Selecciona el método (efectivo, tarjeta, transferencia, etc.), ingresa el monto recibido si pagas en efectivo y confirma. La venta queda registrada y el stock se descuenta automáticamente.',
        category: 'POS',
        attachTo: { element: '#tour-pos-charge', on: 'top' },
      });

      steps.push({
        id: 'pos-history',
        title: 'Historial de la sesión',
        text: 'Con el botón <strong>Historial</strong> puedes ver todas las ventas de la caja actual: hora, cliente, método de pago, total y estado. Al cerrar caja obtendrás un resumen por método de pago para hacer el cuadre del día.',
        category: 'POS',
        attachTo: { element: '#tour-pos-history', on: 'bottom' },
      });
    }

    if (this.feat('has_payroll')) {
      steps.push({
        id: 'payroll-header',
        title: 'Nómina electrónica',
        text: 'Este módulo ya no solo liquida y transmite: ahora organiza empleados, novedades, autoservicio, analítica, operación DIAN y gobierno enterprise por empresa y sucursal.',
        category: 'Nómina',
        attachTo: { element: '#tour-payroll-header', on: 'bottom' },
        navigateTo: '/payroll',
      });

      steps.push({
        id: 'payroll-navigation',
        title: 'Áreas de nómina',
        text: 'La navegación separa <strong>operación diaria</strong>, <strong>gestión laboral</strong> y <strong>gobierno y cumplimiento</strong>, para que RRHH, nómina y contabilidad compartan el módulo sin perder foco.',
        category: 'Nómina',
        attachTo: { element: '#tour-payroll-nav', on: 'bottom' },
      });

      steps.push({
        id: 'payroll-operations',
        title: 'Operación DIAN de nómina',
        text: 'Desde aquí controlas la <strong>cola técnica</strong>, reprocesos y monitoreo documental de nómina electrónica, algo clave cuando ya operas con volumen empresarial.',
        category: 'Nómina',
        attachTo: { element: '#tour-payroll-operations', on: 'bottom' },
      });
    }

    // ── 7. Configuración ───────────────────────────────────────────────────
    steps.push({
      id: 'settings-menu',
      title: 'Configuración de la cuenta',
      text: 'Desde aquí accedes a: <strong>Mi perfil</strong> (nombre, foto, contraseña), <strong>Mi empresa</strong> (datos fiscales, logo), <strong>Usuarios</strong> (crear y gestionar accesos), <strong>Plan y facturación</strong> e <strong>Integraciones DIAN</strong>.',
      category: 'Configuración',
      attachTo: { element: '#tour-settings-menu', on: 'right' },
      navigateTo: '/settings/profile',
    });

    // ── 8. Finalización ────────────────────────────────────────────────────
    steps.push({
      id: 'done',
      title: '¡Recorrido completado! 🎉',
      text: 'Ya conoces BeccaFact. Ahora puedes explorar cada módulo a tu ritmo. Si tienes alguna duda, nuestro equipo de soporte está listo para ayudarte.',
      category: 'Final',
      isLast: true,
    });

    return steps;
  }

  // ── Register steps in the Shepherd Tour ───────────────────────────────────

  private registerSteps(defs: TourStepDef[]): void {
    const total = defs.length;

    defs.forEach((def, i) => {
      const isFirst = i === 0;
      const isLast  = !!def.isLast;

      const buttons: any[] = [];
      if (!isFirst) buttons.push(this.backBtn());
      if (!isLast)  buttons.push(this.skipBtn());
      buttons.push(this.nextBtn(isLast ? '¡Listo! ✓' : 'Siguiente →'));

      const options: any = {
        id:      def.id,
        title:   def.title,
        text:    this.buildStepContent(def, i + 1, total),
        buttons,
        when: {
          show: () => this.updateProgress(i + 1, total),
        },
      };

      // Attachment with fallback when element is not in DOM
      const attach = def.attachTo;
      if (attach) {
        options.attachTo = {
          element: () => this.resolveAttachElement(attach.element, def.allowCenterFallback !== false),
          on: attach.on,
        };
        options.beforeShowPromise = () => this.waitForElement(attach.element, def.allowCenterFallback !== false);
      }

      // Navigation (prepended before waitForElement when both present)
      if (def.navigateTo) {
        const route = def.navigateTo;
        const existingPromise: (() => Promise<void>) | undefined = options.beforeShowPromise;

        options.beforeShowPromise = () =>
          this.navigateTo(route).then(() =>
            existingPromise ? existingPromise() : Promise.resolve()
          );
      }

      this.tour!.addStep(options);
    });
  }

  // ── Navigation helper ──────────────────────────────────────────────────────

  private navigateTo(path: string): Promise<void> {
    const current = this.router.url.split('?')[0];
    if (current === path || current.startsWith(path + '/')) {
      return sleep(300);
    }
    return this.router.navigate([path]).then(() => sleep(500));
  }

  // Polls the DOM until element appears (max 1.5 s), then resolves
  private waitForElement(selector: string, allowCenterFallback = true): Promise<void> {
    return new Promise<void>(resolve => {
      if (this.findVisibleElement(selector)) { resolve(); return; }
      let tries = 0;
      const interval = setInterval(() => {
        tries++;
        if (this.findVisibleElement(selector) || tries >= 18) {
          clearInterval(interval);
          if (!this.findVisibleElement(selector) && !allowCenterFallback) {
            console.warn(`[Tour] Elemento no visible para el paso: ${selector}`);
          }
          resolve();
        }
      }, 120);
    });
  }

  private resolveAttachElement(selector: string, allowCenterFallback = true): HTMLElement | string {
    const el = this.findVisibleElement(selector);
    if (el) return el;
    return allowCenterFallback ? 'body' : selector;
  }

  private findVisibleElement(selector: string): HTMLElement | null {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const hidden = style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
    if (hidden) return null;
    if (rect.width === 0 || rect.height === 0) return null;
    return el;
  }

  // ── Button factories ───────────────────────────────────────────────────────

  private buildStepContent(def: TourStepDef, current: number, total: number): string {
    const category = def.category ? `<span class="tour-step-chip">${def.category}</span>` : '';
    return `
      <div class="tour-step-body">
        <div class="tour-step-meta">
          ${category}
          <span class="tour-step-count">Paso ${current} de ${total}</span>
        </div>
        <div class="tour-step-copy">${def.text}</div>
      </div>
    `;
  }

  private nextBtn(label: string): any {
    return { text: label, classes: 'tour-btn tour-btn--primary', action: () => this.tour!.next() };
  }

  private backBtn(): any {
    return { text: '← Atrás', classes: 'tour-btn tour-btn--secondary', action: () => this.tour!.back() };
  }

  private skipBtn(): any {
    return { text: 'Omitir tour', classes: 'tour-btn tour-btn--skip', action: () => this.tour!.cancel() };
  }

  // ── Progress indicator ─────────────────────────────────────────────────────

  private updateProgress(current: number, total: number): void {
    const footer = document.querySelector('.shepherd-footer');
    if (!footer) return;
    let prog = footer.querySelector('.tour-progress');
    if (!prog) {
      prog = document.createElement('span');
      prog.className = 'tour-progress';
      footer.insertBefore(prog, footer.firstChild);
    }
    prog.textContent = `${current} / ${total}`;
  }
}
