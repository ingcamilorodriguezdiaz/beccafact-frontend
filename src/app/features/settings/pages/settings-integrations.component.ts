import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-settings-integrations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h3 style="font-size:16px;font-weight:600;margin:0 0 16px">Integraciones</h3>
    <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e2e8f0;text-align:center;color:#64748b">
      <p style="font-size:32px;margin-bottom:12px">🔌</p>
      <p>Conecta BeccaFact con tus herramientas: contabilidad, bancos, e-commerce y más.</p>
      <p style="font-size:13px;color:#94a3b8;margin-top:8px">Disponible en plan Empresarial y Corporativo</p>
    </div>
  `,
})
export class SettingsIntegrationsComponent {}
