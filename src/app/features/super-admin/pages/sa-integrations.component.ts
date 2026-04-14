import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

interface Company { id: string; name: string; nit: string; razonSocial: string; }

interface DianResolutionBlock {
  resolucion: string;
  prefijo: string;
  rangoDesde: number | null;
  rangoHasta: number | null;
  vigenciaDesde: string;
  vigenciaHasta: string;
}

interface DianFacturacionConfig {
  enabled: boolean;
  ambiente: 'habilitacion' | 'produccion';
  softwareId: string;
  softwarePin: string;
  testSetId: string;
  claveTecnica: string;
  venta: DianResolutionBlock;
  pos: DianResolutionBlock;
  resolucion: string;
  prefijo: string;
  rangoDesde: number | null;
  rangoHasta: number | null;
  vigenciaDesde: string;
  vigenciaHasta: string;
  hasCertificate: boolean;
}

interface DianNumberingRangeItem {
  resolutionNumber: string;
  resolutionDate: string;
  prefix: string;
  fromNumber: number;
  toNumber: number;
  validDateFrom: string;
  validDateTo: string;
  technicalKey: string;
}

interface DianNumberingRangeResponse {
  operationCode: string;
  operationDescription: string;
  selected: DianNumberingRangeItem | null;
  ranges: DianNumberingRangeItem[];
}

interface DianCertificateConfig {
  hasCertificate: boolean;
  certificate: string;
  certificateKey: string;
}

interface DianNominaConfig {
  enabled: boolean;
  softwareId: string;
  softwarePin: string;
  testSetId: string;
}

const EMPTY_FACT = (): DianFacturacionConfig => ({
  enabled: false, ambiente: 'habilitacion',
  softwareId: '', softwarePin: '', testSetId: '', claveTecnica: '',
  venta: { resolucion: '', prefijo: '', rangoDesde: null, rangoHasta: null, vigenciaDesde: '', vigenciaHasta: '' },
  pos: { resolucion: '', prefijo: '', rangoDesde: null, rangoHasta: null, vigenciaDesde: '', vigenciaHasta: '' },
  resolucion: '', prefijo: '', rangoDesde: null, rangoHasta: null,
  vigenciaDesde: '', vigenciaHasta: '', hasCertificate: false,
});

const EMPTY_NOM = (): DianNominaConfig => ({
  enabled: false, softwareId: '', softwarePin: '', testSetId: '',
});

const EMPTY_CERT = (): DianCertificateConfig => ({
  hasCertificate: false, certificate: '', certificateKey: '',
});

@Component({
  selector: 'app-sa-integrations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Integraciones DIAN</h2>
          <p class="page-subtitle">Configura las credenciales DIAN de facturación y nómina por empresa</p>
        </div>
      </div>

      <!-- Selector de empresa -->
      <div class="company-selector">
        <label class="selector-label">Empresa</label>
        <div class="selector-row">
          <div class="search-wrap">
            <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="15">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
            </svg>
            <input type="text" [(ngModel)]="companySearch" (ngModelChange)="filterCompanies()"
                   placeholder="Buscar empresa…" class="form-control search-input"/>
          </div>
          <select [(ngModel)]="selectedCompanyId" (ngModelChange)="onCompanyChange()" class="form-control company-select">
            <option value="">— Selecciona una empresa —</option>
            @for (c of filteredCompanies(); track c.id) {
              <option [value]="c.id">{{ c.name }} ({{ c.nit }})</option>
            }
          </select>
        </div>
      </div>

      @if (!selectedCompanyId) {
        <div class="empty-state">
          <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
            <rect width="48" height="48" rx="12" fill="#f0f4f8"/>
            <path d="M24 14v10M24 30v2" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <p>Selecciona una empresa para ver y editar su configuración DIAN</p>
        </div>
      } @else {

        <div class="intg-list">

          <!-- ══ DIAN Facturación ══════════════════════════════════ -->
          <div class="intg-row">
            <div class="intg-logo">
              <svg viewBox="0 0 48 48" fill="none" width="36" height="36">
                <rect width="48" height="48" rx="10" fill="#003366"/>
                <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
                      fill="#FFD700" font-size="13" font-weight="800" font-family="Arial,sans-serif">DIAN</text>
              </svg>
            </div>
            <div class="intg-info">
              <div class="intg-name">
                DIAN — Facturación Electrónica
                @if (facturacion().enabled) {
                  <span class="connected-badge">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="10">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                    </svg>
                    Activa
                  </span>
                  <span class="env-badge env-{{ facturacion().ambiente }}">
                    {{ facturacion().ambiente === 'produccion' ? 'Producción' : 'Habilitación' }}
                  </span>
                } @else {
                  <span class="inactive-badge">Inactiva</span>
                }
                @if (facturacion().hasCertificate) {
                  <span class="cert-badge">🔐 Cert.</span>
                }
              </div>
              <div class="intg-desc">Configura software DIAN y dos resoluciones independientes: Factura Electrónica de Venta y Documento Equivalente POS Electrónico</div>
            </div>
            <div class="intg-actions">
              <button class="btn" [class.btn-primary]="!facturacion().enabled" [class.btn-secondary]="facturacion().enabled"
                      (click)="togglePanel('facturacion')">
                {{ panelOpen() === 'facturacion' ? 'Cerrar' : 'Configurar' }}
              </button>
            </div>
          </div>

          <!-- Panel Facturación -->
          @if (panelOpen() === 'facturacion') {
            <div class="config-panel">
              @if (loadingFact()) {
                @for (i of [1,2,3,4]; track i) {
                  <div class="sk" style="height:38px;border-radius:8px;margin-bottom:12px"></div>
                }
              } @else {
                <!-- Toggle -->
                <div class="toggle-row">
                  <div>
                    <div class="toggle-label">Facturación electrónica habilitada</div>
                    <div class="toggle-sub">{{ draftFact.enabled ? 'Activa para esta empresa' : 'Inactiva — la empresa no puede emitir facturas DIAN' }}</div>
                  </div>
                  <button class="toggle-btn" [class.toggle-btn--on]="draftFact.enabled" (click)="draftFact.enabled = !draftFact.enabled">
                    <span class="toggle-knob"></span>
                  </button>
                </div>
                <div class="divider"></div>

                <!-- Ambiente -->
                <div class="form-row">
                  <div class="form-group form-group--full">
                    <label>Ambiente</label>
                    <div class="radio-group">
                      <label class="radio-option" [class.radio-option--active]="draftFact.ambiente === 'habilitacion'">
                        <input type="radio" [(ngModel)]="draftFact.ambiente" value="habilitacion"/>
                        <div>
                          <div class="radio-label">Habilitación</div>
                          <div class="radio-sub">Pruebas y certificación ante la DIAN</div>
                        </div>
                      </label>
                      <label class="radio-option" [class.radio-option--active]="draftFact.ambiente === 'produccion'">
                        <input type="radio" [(ngModel)]="draftFact.ambiente" value="produccion"/>
                        <div>
                          <div class="radio-label">Producción</div>
                          <div class="radio-sub">Facturas con validez legal</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Software DIAN -->
                <div class="form-row">
                  <div class="form-group">
                    <label>Software ID</label>
                    <input type="text" [(ngModel)]="draftFact.softwareId" class="form-control" placeholder="UUID del software registrado en DIAN"/>
                  </div>
                  <div class="form-group">
                    <label>PIN del software</label>
                    <input type="password" [(ngModel)]="draftFact.softwarePin" class="form-control" placeholder="••••••"/>
                  </div>
                </div>

                <!-- TestSet y Clave Técnica -->
                <div class="form-row">
                  <div class="form-group">
                    <label>TestSet ID (habilitación)</label>
                    <input type="text" [(ngModel)]="draftFact.testSetId" class="form-control" placeholder="UUID del set de pruebas"/>
                  </div>
                  <div class="form-group">
                    <label>Clave técnica</label>
                    <div class="input-action-row">
                      <input type="text" [(ngModel)]="draftFact.claveTecnica" class="form-control" placeholder="Clave técnica del set"/>
                      @if (draftFact.ambiente === 'produccion') {
                        <button
                          type="button"
                          class="btn btn-secondary btn-inline"
                          [disabled]="loadingNumberingRange()"
                          (click)="consultNumberingRange()">
                          {{ loadingNumberingRange() ? 'Consultando...' : 'Consultar DIAN' }}
                        </button>
                      }
                    </div>
                  </div>
                </div>

                <div class="dual-resolution-grid">
                  <section class="resolution-card">
                    <div class="resolution-card__head">
                      <div>
                        <h4>Factura Electrónica de Venta</h4>
                        <p>Usa su propio prefijo y rango autorizado por la DIAN.</p>
                      </div>
                      <span class="resolution-chip">Venta</span>
                    </div>
                    <div class="form-row">
                      <div class="form-group">
                        <label>Número de resolución *</label>
                        <input type="text" [(ngModel)]="draftFact.venta.resolucion" class="form-control" placeholder="Ej: 18760000001"/>
                      </div>
                      <div class="form-group">
                        <label>Prefijo</label>
                        <input type="text" [(ngModel)]="draftFact.venta.prefijo" class="form-control" placeholder="Ej: FEV"/>
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-group">
                        <label>Rango desde *</label>
                        <input type="number" [(ngModel)]="draftFact.venta.rangoDesde" class="form-control" placeholder="1"/>
                      </div>
                      <div class="form-group">
                        <label>Rango hasta *</label>
                        <input type="number" [(ngModel)]="draftFact.venta.rangoHasta" class="form-control" placeholder="1000"/>
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-group">
                        <label>Vigencia desde *</label>
                        <input type="date" [(ngModel)]="draftFact.venta.vigenciaDesde" class="form-control"/>
                      </div>
                      <div class="form-group">
                        <label>Vigencia hasta *</label>
                        <input type="date" [(ngModel)]="draftFact.venta.vigenciaHasta" class="form-control"/>
                      </div>
                    </div>
                  </section>

                  <section class="resolution-card resolution-card--pos">
                    <div class="resolution-card__head">
                      <div>
                        <h4>Documento Equivalente POS Electrónico</h4>
                        <p>Mantén un prefijo y consecutivo independiente al de venta.</p>
                      </div>
                      <span class="resolution-chip resolution-chip--pos">POS</span>
                    </div>
                    <div class="form-row">
                      <div class="form-group">
                        <label>Número de resolución *</label>
                        <input type="text" [(ngModel)]="draftFact.pos.resolucion" class="form-control" placeholder="Ej: 18760000002"/>
                      </div>
                      <div class="form-group">
                        <label>Prefijo</label>
                        <input type="text" [(ngModel)]="draftFact.pos.prefijo" class="form-control" placeholder="Ej: POS"/>
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-group">
                        <label>Rango desde *</label>
                        <input type="number" [(ngModel)]="draftFact.pos.rangoDesde" class="form-control" placeholder="1"/>
                      </div>
                      <div class="form-group">
                        <label>Rango hasta *</label>
                        <input type="number" [(ngModel)]="draftFact.pos.rangoHasta" class="form-control" placeholder="1000"/>
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="form-group">
                        <label>Vigencia desde *</label>
                        <input type="date" [(ngModel)]="draftFact.pos.vigenciaDesde" class="form-control"/>
                      </div>
                      <div class="form-group">
                        <label>Vigencia hasta *</label>
                        <input type="date" [(ngModel)]="draftFact.pos.vigenciaHasta" class="form-control"/>
                      </div>
                    </div>
                  </section>
                </div>

                <div class="panel-footer">
                  <div></div>
                  <div class="panel-btns">
                    <button class="btn btn-secondary" (click)="cancelFact()">Cancelar</button>
                    <button class="btn btn-primary" [disabled]="savingFact()" (click)="saveFact()">
                      {{ savingFact() ? 'Guardando...' : 'Guardar configuración' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- ══ DIAN Nómina ════════════════════════════════════════ -->
          <div class="intg-divider"></div>
          <div class="intg-row">
            <div class="intg-logo">
              <svg viewBox="0 0 48 48" fill="none" width="36" height="36">
                <rect width="48" height="48" rx="10" fill="#1a407e"/>
                <text x="50%" y="42%" dominant-baseline="middle" text-anchor="middle"
                      fill="#FFD700" font-size="9" font-weight="800" font-family="Arial,sans-serif">DIAN</text>
                <text x="50%" y="68%" dominant-baseline="middle" text-anchor="middle"
                      fill="#ffffff" font-size="8" font-weight="700" font-family="Arial,sans-serif">NÓM</text>
              </svg>
            </div>
            <div class="intg-info">
              <div class="intg-name">
                DIAN — Nómina Electrónica
                @if (nomina().enabled) {
                  <span class="connected-badge">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="10">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                    </svg>
                    Activa
                  </span>
                } @else {
                  <span class="inactive-badge">Inactiva</span>
                }
              </div>
              <div class="intg-desc">Configuración del software DIAN para nómina electrónica</div>
            </div>
            <div class="intg-actions">
              <button class="btn" [class.btn-primary]="!nomina().enabled" [class.btn-secondary]="nomina().enabled"
                      (click)="togglePanel('nomina')">
                {{ panelOpen() === 'nomina' ? 'Cerrar' : 'Configurar' }}
              </button>
            </div>
          </div>

          <!-- Panel Nómina -->
          @if (panelOpen() === 'nomina') {
            <div class="config-panel">
              @if (loadingNom()) {
                @for (i of [1,2,3]; track i) {
                  <div class="sk" style="height:38px;border-radius:8px;margin-bottom:12px"></div>
                }
              } @else {
                <!-- Toggle -->
                <div class="toggle-row">
                  <div>
                    <div class="toggle-label">Nómina electrónica habilitada</div>
                    <div class="toggle-sub">{{ draftNom.enabled ? 'Activa para esta empresa' : 'Inactiva' }}</div>
                  </div>
                  <button class="toggle-btn" [class.toggle-btn--on]="draftNom.enabled" (click)="draftNom.enabled = !draftNom.enabled">
                    <span class="toggle-knob"></span>
                  </button>
                </div>
                <div class="divider"></div>

                <div class="form-row">
                  <div class="form-group">
                    <label>Software ID (nómina)</label>
                    <input type="text" [(ngModel)]="draftNom.softwareId" class="form-control" placeholder="UUID del software de nómina"/>
                  </div>
                  <div class="form-group">
                    <label>PIN del software (nómina)</label>
                    <input type="password" [(ngModel)]="draftNom.softwarePin" class="form-control" placeholder="••••••"/>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label>TestSet ID (habilitación nómina)</label>
                    <input type="text" [(ngModel)]="draftNom.testSetId" class="form-control" placeholder="UUID del set de pruebas nómina"/>
                  </div>
                </div>

                <div class="panel-footer">
                  <div></div>
                  <div class="panel-btns">
                    <button class="btn btn-secondary" (click)="cancelNom()">Cancelar</button>
                    <button class="btn btn-primary" [disabled]="savingNom()" (click)="saveNom()">
                      {{ savingNom() ? 'Guardando...' : 'Guardar configuración' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- ══ Certificado Digital DIAN ════════════════════════════════ -->
          <div class="intg-divider"></div>
          <div class="intg-row">
            <div class="intg-logo">
              <svg viewBox="0 0 48 48" fill="none" width="36" height="36">
                <rect width="48" height="48" rx="10" fill="#0f5132"/>
                <text x="50%" y="42%" dominant-baseline="middle" text-anchor="middle"
                      fill="#ffffff" font-size="8" font-weight="800" font-family="Arial,sans-serif">CERT</text>
                <text x="50%" y="68%" dominant-baseline="middle" text-anchor="middle"
                      fill="#a3e6b8" font-size="7" font-weight="700" font-family="Arial,sans-serif">DIAN</text>
              </svg>
            </div>
            <div class="intg-info">
              <div class="intg-name">
                Certificado Digital DIAN
                @if (certificate().hasCertificate) {
                  <span class="connected-badge">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="10">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                    </svg>
                    Configurado
                  </span>
                } @else {
                  <span class="inactive-badge">Sin certificado</span>
                }
              </div>
              <div class="intg-desc">Certificado .p12 compartido por Facturación y Nómina electrónica</div>
            </div>
            <div class="intg-actions">
              <button class="btn" [class.btn-primary]="!certificate().hasCertificate" [class.btn-secondary]="certificate().hasCertificate"
                      (click)="togglePanel('certificate')">
                {{ panelOpen() === 'certificate' ? 'Cerrar' : 'Configurar' }}
              </button>
            </div>
          </div>

          <!-- Panel Certificado -->
          @if (panelOpen() === 'certificate') {
            <div class="config-panel">
              @if (loadingCert()) {
                @for (i of [1,2]; track i) {
                  <div class="sk" style="height:38px;border-radius:8px;margin-bottom:12px"></div>
                }
              } @else {
                <div class="form-row">
                  <div class="form-group">
                    <label>llave publica</label>
                    <input type="text" [(ngModel)]="draftCert.certificate" class="form-control" placeholder="Contenido Base64 del certificado"/>
                  </div>
                  <div class="form-group">
                    <label>Llave privada</label>
                    <input type="text" [(ngModel)]="draftCert.certificateKey" class="form-control" placeholder="••••••"/>
                  </div>
                </div>
                <div class="info-note">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
                  </svg>
                  Este certificado es compartido por Facturación Electrónica y Nómina Electrónica.
                </div>
                <div class="panel-footer">
                  <div></div>
                  <div class="panel-btns">
                    <button class="btn btn-secondary" (click)="cancelCert()">Cancelar</button>
                    <button class="btn btn-primary" [disabled]="savingCert()" (click)="saveCert()">
                      {{ savingCert() ? 'Guardando...' : 'Guardar certificado' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }

        </div>
      }

    </div>
  `,
  styles: [`
    .page { max-width:1100px; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#7ea3cc; margin:0; }

    /* Company selector */
    .company-selector { background:#fff; border:1px solid #dce6f0; border-radius:12px; padding:18px 20px; margin-bottom:20px; }
    .selector-label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:8px; }
    .selector-row { display:flex; gap:12px; align-items:center; }
    .search-wrap { position:relative; flex:0 0 240px; }
    .search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#9ca3af; pointer-events:none; }
    .search-input { padding-left:32px !important; }
    .company-select { flex:1; }

    /* Integration list */
    .intg-list { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .intg-divider { border:none; border-top:1px solid #f0f4f8; margin:0; }
    .intg-row { display:flex; align-items:center; gap:14px; padding:16px 20px; }
    .intg-logo { flex-shrink:0; }
    .intg-info { flex:1; min-width:0; }
    .intg-name { font-size:14px; font-weight:700; color:#0c1c35; display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
    .intg-desc { font-size:12px; color:#9ca3af; margin-top:3px; }
    .intg-actions { flex-shrink:0; }

    .connected-badge { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; background:#dcfce7; color:#166534; padding:2px 8px; border-radius:99px; }
    .inactive-badge { font-size:10px; font-weight:700; background:#f1f5f9; color:#94a3b8; padding:2px 8px; border-radius:99px; }
    .env-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; }
    .env-produccion  { background:#dbeafe; color:#1d4ed8; }
    .env-habilitacion { background:#fef3c7; color:#92400e; }

    /* Config panel */
    .config-panel { border-top:1px solid #f0f4f8; padding:20px 24px; background:#fafbfc; animation:slideDown .2s ease; }
    @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

    .toggle-row { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:16px; }
    .toggle-label { font-size:14px; font-weight:600; color:#0c1c35; }
    .toggle-sub { font-size:12px; color:#9ca3af; margin-top:2px; }
    .toggle-btn { width:44px; height:24px; border-radius:99px; border:none; cursor:pointer; background:#dce6f0; position:relative; transition:background .2s; flex-shrink:0; padding:0; }
    .toggle-btn--on { background:#1a407e; }
    .toggle-knob { display:block; width:18px; height:18px; border-radius:50%; background:#fff; position:absolute; top:3px; left:3px; transition:left .2s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
    .toggle-btn--on .toggle-knob { left:23px; }

    .divider { border:none; border-top:1px solid #e2e8f0; margin:0 0 16px; }

    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:4px; }
    .form-group { margin-bottom:14px; }
    .form-group--full { grid-column:span 2; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }
    .input-action-row { display:flex; align-items:center; gap:10px; }
    .input-action-row .form-control { flex:1; }
    .form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; box-sizing:border-box; color:#0c1c35; background:#fff; transition:border-color .15s; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }

    .radio-group { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .radio-option { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border:1.5px solid #dce6f0; border-radius:10px; cursor:pointer; transition:border-color .15s, background .15s; }
    .radio-option input[type=radio] { margin-top:2px; accent-color:#1a407e; flex-shrink:0; }
    .radio-option--active { border-color:#1a407e; background:#f0f4ff; }
    .radio-label { font-size:13px; font-weight:600; color:#0c1c35; }
    .radio-sub { font-size:11.5px; color:#9ca3af; margin-top:2px; }

    .panel-footer { display:flex; align-items:center; justify-content:space-between; margin-top:8px; }
    .panel-btns { display:flex; gap:10px; }
    .dual-resolution-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:8px; }
    .resolution-card {
      padding:16px;
      border:1px solid #dce6f0;
      border-radius:14px;
      background:#fff;
      box-shadow:0 10px 24px rgba(12,28,53,.04);
    }
    .resolution-card--pos { background:linear-gradient(180deg, #fbfdff 0%, #f7fbff 100%); }
    .resolution-card__head {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }
    .resolution-card__head h4 {
      margin:0;
      font-size:14px;
      font-weight:700;
      color:#0c1c35;
    }
    .resolution-card__head p {
      margin:5px 0 0;
      font-size:11.5px;
      color:#8aa0b8;
      line-height:1.5;
    }
    .resolution-chip {
      display:inline-flex;
      align-items:center;
      padding:4px 9px;
      border-radius:999px;
      background:#e8fff8;
      color:#0f8a74;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
      white-space:nowrap;
    }
    .resolution-chip--pos {
      background:#eff6ff;
      color:#1d4ed8;
    }

    .btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:8px; font-size:13.5px; font-weight:600; cursor:pointer; border:none; transition:background .15s; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
    .btn-inline { white-space:nowrap; }

    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px 20px; text-align:center; background:#fff; border:1px solid #dce6f0; border-radius:12px; gap:10px; }
    .empty-state p { font-size:14px; color:#374151; margin:0; }

    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; display:block; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    .cert-badge { font-size:10px; font-weight:700; background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; padding:2px 8px; border-radius:99px; }
    .info-note { display:flex; align-items:center; gap:8px; padding:9px 13px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; font-size:12.5px; color:#166534; margin-bottom:12px; }

    @media (max-width: 700px) {
      .selector-row { flex-direction: column; align-items: stretch; }
      .search-wrap { flex: none; }
      .form-row { grid-template-columns: 1fr; }
      .form-group--full { grid-column: span 1; }
      .input-action-row { flex-direction: column; align-items: stretch; }
      .radio-group { grid-template-columns: 1fr; }
      .dual-resolution-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class SaIntegrationsComponent implements OnInit {
  private readonly SA_API = `${environment.apiUrl}/super-admin/companies`;

  private http   = inject(HttpClient);
  private notify = inject(NotificationService);

  // Companies
  allCompanies      = signal<Company[]>([]);
  filteredCompanies = signal<Company[]>([]);
  companySearch     = '';
  selectedCompanyId = '';

  // Panel
  panelOpen = signal<'facturacion' | 'nomina' | 'certificate' | null>(null);

  // Facturación
  loadingFact = signal(false);
  savingFact  = signal(false);
  loadingNumberingRange = signal(false);
  facturacion = signal<DianFacturacionConfig>(EMPTY_FACT());
  draftFact: DianFacturacionConfig = EMPTY_FACT();

  // Nómina
  loadingNom = signal(false);
  savingNom  = signal(false);
  nomina     = signal<DianNominaConfig>(EMPTY_NOM());
  draftNom: DianNominaConfig = EMPTY_NOM();

  // Certificate (shared)
  loadingCert = signal(false);
  savingCert  = signal(false);
  certificate = signal<DianCertificateConfig>(EMPTY_CERT());
  draftCert: DianCertificateConfig = EMPTY_CERT();

  ngOnInit() {
    this.http.get<any>(`${this.SA_API}?limit=500`).subscribe({
      next: res => {
        const list: Company[] = res.data ?? res;
        this.allCompanies.set(list);
        this.filteredCompanies.set(list);
      },
    });
  }

  filterCompanies() {
    const q = this.companySearch.toLowerCase();
    this.filteredCompanies.set(
      this.allCompanies().filter(c =>
        c.name.toLowerCase().includes(q) || c.nit.includes(q)
      )
    );
  }

  onCompanyChange() {
    this.panelOpen.set(null);
    if (!this.selectedCompanyId) return;
    this.loadFact();
    this.loadNom();
    this.loadCert();
  }

  loadFact() {
    this.loadingFact.set(true);
    this.http.get<DianFacturacionConfig>(`${this.SA_API}/${this.selectedCompanyId}/integrations/dian`).subscribe({
      next: r => { this.facturacion.set(r); this.draftFact = { ...r }; this.loadingFact.set(false); },
      error: () => this.loadingFact.set(false),
    });
  }

  loadNom() {
    this.loadingNom.set(true);
    this.http.get<DianNominaConfig>(`${this.SA_API}/${this.selectedCompanyId}/integrations/dian/nomina`).subscribe({
      next: r => { this.nomina.set(r); this.draftNom = { ...r }; this.loadingNom.set(false); },
      error: () => this.loadingNom.set(false),
    });
  }

  loadCert() {
    this.loadingCert.set(true);
    this.http.get<DianCertificateConfig>(`${this.SA_API}/${this.selectedCompanyId}/integrations/dian/certificate`).subscribe({
      next: r => { this.certificate.set(r); this.draftCert = { ...r }; this.loadingCert.set(false); },
      error: () => this.loadingCert.set(false),
    });
  }

  togglePanel(panel: 'facturacion' | 'nomina' | 'certificate') {
    if (this.panelOpen() === panel) {
      this.panelOpen.set(null);
    } else {
      if (panel === 'facturacion') this.draftFact = { ...this.facturacion() };
      else if (panel === 'nomina') this.draftNom = { ...this.nomina() };
      else this.draftCert = { ...this.certificate() };
      this.panelOpen.set(panel);
    }
  }

  cancelFact() { this.draftFact = { ...this.facturacion() }; this.panelOpen.set(null); }

  saveFact() {
    this.savingFact.set(true);
    this.http.put<DianFacturacionConfig>(`${this.SA_API}/${this.selectedCompanyId}/integrations/dian`, this.draftFact).subscribe({
      next: r => { this.facturacion.set(r); this.notify.success('Configuración DIAN Facturación guardada'); this.savingFact.set(false); this.panelOpen.set(null); },
      error: e => { this.notify.error(e?.error?.message ?? 'Error al guardar'); this.savingFact.set(false); },
    });
  }

  consultNumberingRange() {
    if (!this.selectedCompanyId) return;
    if (this.draftFact.ambiente !== 'produccion') {
      this.notify.error('La consulta de numeración DIAN solo aplica para producción');
      return;
    }
    if (!this.draftFact.softwareId?.trim()) {
      this.notify.error('Configura primero el Software ID');
      return;
    }

    this.loadingNumberingRange.set(true);
    this.http.post<DianNumberingRangeResponse>(
      `${this.SA_API}/${this.selectedCompanyId}/integrations/dian/numbering-range`,
      {
        softwareCode: this.draftFact.softwareId,
        prefijo: this.draftFact.venta?.prefijo,
        resolucion: this.draftFact.venta?.resolucion,
      },
    ).subscribe({
      next: (response) => {
        const selected = response.selected;
        if (!selected) {
          this.notify.error('DIAN no devolvió rangos de numeración para esta empresa');
          this.loadingNumberingRange.set(false);
          return;
        }

        this.draftFact.claveTecnica = selected.technicalKey || this.draftFact.claveTecnica;
        this.draftFact.venta = {
          resolucion: selected.resolutionNumber || this.draftFact.venta.resolucion,
          prefijo: selected.prefix || this.draftFact.venta.prefijo,
          rangoDesde: selected.fromNumber ?? this.draftFact.venta.rangoDesde,
          rangoHasta: selected.toNumber ?? this.draftFact.venta.rangoHasta,
          vigenciaDesde: selected.validDateFrom || this.draftFact.venta.vigenciaDesde,
          vigenciaHasta: selected.validDateTo || this.draftFact.venta.vigenciaHasta,
        };
        this.draftFact.resolucion = this.draftFact.venta.resolucion;
        this.draftFact.prefijo = this.draftFact.venta.prefijo;
        this.draftFact.rangoDesde = this.draftFact.venta.rangoDesde;
        this.draftFact.rangoHasta = this.draftFact.venta.rangoHasta;
        this.draftFact.vigenciaDesde = this.draftFact.venta.vigenciaDesde;
        this.draftFact.vigenciaHasta = this.draftFact.venta.vigenciaHasta;

        this.notify.success(response.operationDescription || 'Numeración DIAN consultada correctamente');
        this.loadingNumberingRange.set(false);
      },
      error: (e) => {
        this.notify.error(e?.error?.message ?? 'No fue posible consultar la numeración DIAN');
        this.loadingNumberingRange.set(false);
      },
    });
  }

  cancelNom() { this.draftNom = { ...this.nomina() }; this.panelOpen.set(null); }

  saveNom() {
    this.savingNom.set(true);
    this.http.put<DianNominaConfig>(`${this.SA_API}/${this.selectedCompanyId}/integrations/dian/nomina`, this.draftNom).subscribe({
      next: r => { this.nomina.set(r); this.notify.success('Configuración DIAN Nómina guardada'); this.savingNom.set(false); this.panelOpen.set(null); },
      error: e => { this.notify.error(e?.error?.message ?? 'Error al guardar'); this.savingNom.set(false); },
    });
  }

  cancelCert() { this.draftCert = { ...this.certificate() }; this.panelOpen.set(null); }

  saveCert() {
    this.savingCert.set(true);
    this.http.put<DianCertificateConfig>(`${this.SA_API}/${this.selectedCompanyId}/integrations/dian/certificate`, this.draftCert).subscribe({
      next: r => { this.certificate.set(r); this.notify.success('Certificado digital DIAN guardado'); this.savingCert.set(false); this.panelOpen.set(null); },
      error: e => { this.notify.error(e?.error?.message ?? 'Error al guardar'); this.savingCert.set(false); },
    });
  }
}
