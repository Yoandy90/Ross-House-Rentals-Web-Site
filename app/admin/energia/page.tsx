'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import { Zap, Plug, RefreshCw, Trash2, ExternalLink, TrendingUp, TrendingDown, AlertCircle, Activity, ShieldCheck, Copy, Send } from 'lucide-react';

interface Property {
  id: string;
  address?: string;
  name?: string;
}

interface Connection {
  id: string;
  property_id: string;
  property_address?: string;
  status?: string;
  last_sync?: string;
  last_error?: string;
}

interface UsageData {
  connected: boolean;
  status?: string;
  last_sync?: string;
  monthly: { month: string; kwh: number }[];
  current_month_kwh: number;
  prev_month_kwh: number;
  delta_pct: number | null;
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function EnergiaPage() {
  const { token } = useAdminAuth();
  const headers = useCallback(
    () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    [token]
  );

  const [properties, setProperties] = useState<Property[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [usageByProperty, setUsageByProperty] = useState<Record<string, UsageData>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [genInputs, setGenInputs] = useState<Record<string, { period: string; rate: string }>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [diagBusy, setDiagBusy] = useState<string | null>(null);
  const [diagResult, setDiagResult] = useState<{ kind: string; ok: boolean; status_code?: number; body_preview?: string; detail?: string } | null>(null);
  const [lastAuthUrl, setLastAuthUrl] = useState<string | null>(null);

  const runDiag = async (kind: 'app-info' | 'service-status') => {
    setDiagBusy(kind);
    setDiagResult(null);
    try {
      const path = kind === 'app-info'
        ? '/api/admin/xcel/application-information'
        : '/api/admin/xcel/read-service-status';
      const res = await fetch(path, { headers: headers() });
      const data = await res.json();
      setDiagResult({
        kind,
        ok: data.ok === true || res.status === 200,
        status_code: data.status_code ?? res.status,
        body_preview: data.body_preview,
        detail: data.detail,
      });
    } catch (e: any) {
      setDiagResult({ kind, ok: false, detail: e?.message || 'Network error' });
    } finally {
      setDiagBusy(null);
    }
  };

  const prevMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  };

  const notify = (text: string, ok = true) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 6000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [propsRes, connsRes] = await Promise.all([
        fetch('/api/admin/properties', { headers: headers() }),
        fetch('/api/admin/xcel/connections', { headers: headers() }),
      ]);
      const propsData = await propsRes.json();
      const connsData = await connsRes.json();
      const props: Property[] = (propsData.properties || propsData || []).map((p: any) => ({
        id: p.id || p._id,
        address: p.address,
        name: p.name,
      }));
      setProperties(props);
      const conns: Connection[] = connsData.connections || [];
      setConnections(conns);

      const usageEntries = await Promise.all(
        conns.map(async (c) => {
          const r = await fetch(`/api/admin/xcel/usage/${c.property_id}?months=12`, { headers: headers() });
          return [c.property_id, await r.json()] as [string, UsageData];
        })
      );
      setUsageByProperty(Object.fromEntries(usageEntries));
    } catch (e) {
      console.error('Error loading energy data', e);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (token) fetchAll();
  }, [token, fetchAll]);

  const handleConnect = async () => {
    if (!selectedProperty) return;
    setConnecting(selectedProperty);
    try {
      const res = await fetch(`/api/admin/xcel/connect-url?property_id=${selectedProperty}`, { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error');
      const authUrl = data.authorization_url as string;
      if (!authUrl) throw new Error('Respuesta sin authorization_url');

      // Save the URL so the admin can copy/share it (the OAuth has to be
      // completed by the customer who owns the Xcel account — usually NOT
      // the admin viewing this page).
      setLastAuthUrl(authUrl);

      // Try to open in a new tab. If the browser blocks the popup (common
      // on iOS Safari for non-user-gesture context after fetch), the admin
      // can use the visible "Abrir" / "Copiar" buttons below.
      const opened = window.open(authUrl, '_blank', 'noopener,noreferrer');
      if (opened) {
        notify('Se abrió la página de Xcel Energy. Autoriza el acceso y luego presiona "Actualizar".');
      } else {
        notify('El navegador bloqueó la ventana. Usa el botón "Abrir Xcel" abajo o copia el enlace para enviarlo al inquilino.', false);
      }
    } catch (e: any) {
      notify(e.message || 'No se pudo generar el enlace', false);
    } finally {
      setConnecting(null);
    }
  };

  const copyAuthUrl = async () => {
    if (!lastAuthUrl) return;
    try {
      await navigator.clipboard.writeText(lastAuthUrl);
      notify('Enlace copiado. Pégalo en un SMS/Email para enviar al inquilino.');
    } catch {
      notify('No se pudo copiar — selecciona y copia el enlace manualmente.', false);
    }
  };

  const handleSync = async (conn: Connection) => {
    setSyncing(conn.id);
    try {
      const res = await fetch(`/api/admin/xcel/connections/${conn.id}/sync`, {
        method: 'POST',
        headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al sincronizar');
      notify(`Sincronizado: ${data.days_updated} días de consumo actualizados`);
      fetchAll();
    } catch (e: any) {
      notify(e.message, false);
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (conn: Connection) => {
    if (!confirm('¿Desconectar esta propiedad de Xcel Energy?')) return;
    await fetch(`/api/admin/xcel/connections/${conn.id}`, { method: 'DELETE', headers: headers() });
    notify('Conexión eliminada');
    fetchAll();
  };

  const handleGenerateBill = async (conn: Connection) => {
    const inputs = genInputs[conn.property_id] || { period: prevMonth(), rate: '' };
    if (!inputs.rate || parseFloat(inputs.rate) <= 0) {
      notify('Ingresa la tarifa $/kWh para generar la factura', false);
      return;
    }
    setGenerating(conn.property_id);
    try {
      const res = await fetch('/api/admin/utility-bills/generate', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          property_id: conn.property_id,
          period: inputs.period || prevMonth(),
          rate_per_kwh: parseFloat(inputs.rate),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al generar');
      notify(
        `Factura generada: ${data.bill.kwh} kWh × $${data.bill.rate_per_kwh} = $${data.bill.amount}` +
          (data.tenant_assigned ? ' — asignada al inquilino activo' : ' — ⚠️ sin inquilino activo') +
          (data.sms_sent ? ' · 📲 SMS enviado' : '')
      );
    } catch (e: any) {
      notify(e.message, false);
    } finally {
      setGenerating(null);
    }
  };

  const connectedIds = new Set(connections.map((c) => c.property_id));
  const availableProps = properties.filter((p) => !connectedIds.has(p.id));

  return (
    <div className="p-6 max-w-6xl mx-auto" data-testid="energia-page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center">
          <Zap className="w-5 h-5 text-yellow-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Energía</h1>
          <p className="text-sm text-slate-400">Consumo eléctrico por propiedad · Xcel Energy Green Button</p>
        </div>
        <button
          data-testid="energia-refresh-btn"
          onClick={fetchAll}
          className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {message && (
        <div
          data-testid="energia-message"
          className={`mt-4 px-4 py-3 rounded-lg text-sm ${
            message.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Xcel credentials diagnostic */}
      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Diagnóstico de credenciales Xcel
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Verifica que las credenciales (Client ID/Secret, Registration Token, Application ID) configuradas en Railway funcionan contra los endpoints reales de Xcel Energy.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            data-testid="diag-app-info-btn"
            onClick={() => runDiag('app-info')}
            disabled={diagBusy !== null}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            <Activity className="w-4 h-4" />
            {diagBusy === 'app-info' ? 'Probando…' : 'Test ApplicationInformation'}
          </button>
          <button
            data-testid="diag-service-status-btn"
            onClick={() => runDiag('service-status')}
            disabled={diagBusy !== null}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            <Activity className="w-4 h-4" />
            {diagBusy === 'service-status' ? 'Probando…' : 'Test ReadServiceStatus'}
          </button>
        </div>
        {diagResult && (
          <div
            data-testid="diag-result"
            className={`mt-4 rounded-lg p-3 border text-xs ${
              diagResult.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <div className="font-semibold mb-1 flex items-center gap-2">
              {diagResult.ok ? '✓ Funcionando' : '✕ Falló'}
              {diagResult.status_code != null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  HTTP {diagResult.status_code}
                </span>
              )}
              <span className="text-[10px] text-slate-500 ml-auto">
                {diagResult.kind === 'app-info' ? '/ApplicationInformation/{app_id}' : '/ReadServiceStatus'}
              </span>
            </div>
            {diagResult.detail && (
              <div className="text-slate-300 mb-1">{diagResult.detail}</div>
            )}
            {diagResult.body_preview && (
              <pre className="mt-2 whitespace-pre-wrap break-all text-[10px] text-slate-400 max-h-40 overflow-y-auto">
                {diagResult.body_preview}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* ✅ FLUJO CORRECTO según respuesta de Xcel Support (jul 2026) */}
      <div className="mt-6 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5" data-testid="xcel-correct-flow-card">
        <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Cómo autorizar (flujo oficial de Xcel)
        </h2>
        <p className="text-xs text-emerald-200/70 mb-3">
          Según Xcel Support: la autorización la inicia <strong>el titular de la cuenta de luz desde SU cuenta de Xcel</strong> — no desde nuestra app. Comparte estos pasos con el cliente (o hazlo tú si la cuenta está a tu nombre):
        </p>
        <ol className="text-xs text-slate-300 space-y-1.5 list-decimal ml-5 mb-3">
          <li>Entrar a <span className="text-emerald-300 font-semibold">xcelenergy.com</span> → iniciar sesión en <strong>My Account</strong></li>
          <li>Ir a <strong>Usage &amp; Cost</strong> (Uso y Costo)</li>
          <li>Clic en el botón <strong className="text-emerald-300">&quot;GREEN BUTTON CONNECT&quot;</strong></li>
          <li>Seleccionar el medidor (Electric Meter) → <strong>Next</strong></li>
          <li>Elegir <strong className="text-emerald-300">&quot;Ross House Rent&quot;</strong> de la lista de proveedores</li>
          <li>Elegir rango de fechas (recomendado: 2 años hacia adelante) → marcar el consentimiento → <strong>Review and Submit</strong></li>
        </ol>
        <p className="text-[11px] text-slate-500 mb-3">
          Al completarlo, el cliente aparece en nuestro Vendor Portal de Xcel (pestaña &quot;GBC Customers&quot;), donde se genera el token de acceso. Regístralo abajo.
        </p>
        <ManualConnectForm properties={properties} headers={headers} notify={notify} onDone={fetchAll} />
      </div>

      {/* Connect new property */}
      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <Plug className="w-4 h-4 text-yellow-500" /> Conectar propiedad (flujo OAuth — legado)
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Selecciona una propiedad y autoriza el acceso al consumo en la página de Xcel Energy (lo hace el titular de la cuenta de luz).
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            data-testid="energia-property-select"
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white"
          >
            <option value="">Selecciona una propiedad…</option>
            {availableProps.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address || p.name || p.id}
              </option>
            ))}
          </select>
          <button
            data-testid="energia-connect-btn"
            onClick={handleConnect}
            disabled={!selectedProperty || connecting !== null}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-slate-950 text-sm font-semibold transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {connecting ? 'Generando…' : 'Conectar con Xcel'}
          </button>
        </div>
        {lastAuthUrl && (
          <div
            data-testid="auth-url-panel"
            className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3"
          >
            <p className="text-xs text-yellow-300 mb-2">
              Enlace generado. <strong>El inquilino</strong> debe abrirlo en su teléfono y loguearse con la cuenta de Xcel del cliente.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <a
                data-testid="auth-url-open-here"
                href={lastAuthUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-950 text-xs font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir Xcel ahora
              </a>
              <button
                data-testid="auth-url-copy"
                onClick={copyAuthUrl}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar enlace
              </button>
              <a
                data-testid="auth-url-sms"
                href={`sms:?&body=${encodeURIComponent('Para conectar tu cuenta de Xcel Energy a Ross House Rentals, abre este enlace y autoriza el acceso: ' + lastAuthUrl)}`}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar por SMS
              </a>
            </div>
            <p className="break-all text-[10px] text-slate-500 font-mono">{lastAuthUrl}</p>
          </div>
        )}
      </div>

      {/* Connections list */}
      {loading ? (
        <div className="mt-8 text-center text-slate-500 text-sm">Cargando…</div>
      ) : connections.length === 0 ? (
        <div className="mt-8 text-center py-12 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl">
          <Zap className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Ninguna propiedad conectada todavía</p>
          <p className="text-slate-600 text-xs mt-1">Conecta la primera propiedad arriba para ver su consumo</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5">
          {connections.map((conn) => {
            const usage = usageByProperty[conn.property_id];
            const maxKwh = usage?.monthly?.length ? Math.max(...usage.monthly.map((m) => m.kwh), 1) : 1;
            return (
              <div
                key={conn.id}
                data-testid={`energia-card-${conn.property_id}`}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-white font-semibold">{conn.property_address || conn.property_id}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          conn.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {conn.status === 'active' ? 'Conectada' : 'Requiere reautorización'}
                      </span>
                      {conn.last_sync && (
                        <span className="text-[11px] text-slate-500">
                          Últ. sync: {new Date(conn.last_sync).toLocaleString('es-MX')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      data-testid={`energia-sync-${conn.property_id}`}
                      onClick={() => handleSync(conn)}
                      disabled={syncing === conn.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing === conn.id ? 'animate-spin' : ''}`} />
                      {syncing === conn.id ? 'Sincronizando…' : 'Sincronizar'}
                    </button>
                    <button
                      data-testid={`energia-delete-${conn.property_id}`}
                      onClick={() => handleDelete(conn)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {conn.last_error && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {conn.last_error}
                  </div>
                )}

                {usage && usage.monthly.length > 0 ? (
                  <>
                    {/* KPIs */}
                    <div className="mt-4 flex gap-6 flex-wrap">
                      <div>
                        <p className="text-[11px] text-slate-500 uppercase tracking-wide">Este mes</p>
                        <p className="text-xl font-bold text-white">
                          {usage.current_month_kwh.toLocaleString()} <span className="text-xs font-normal text-slate-500">kWh</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 uppercase tracking-wide">Mes anterior</p>
                        <p className="text-xl font-bold text-slate-300">
                          {usage.prev_month_kwh.toLocaleString()} <span className="text-xs font-normal text-slate-500">kWh</span>
                        </p>
                      </div>
                      {usage.delta_pct !== null && (
                        <div>
                          <p className="text-[11px] text-slate-500 uppercase tracking-wide">Variación</p>
                          <p
                            className={`text-xl font-bold flex items-center gap-1 ${
                              usage.delta_pct > 0 ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {usage.delta_pct > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {Math.abs(usage.delta_pct)}%
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bar chart */}
                    <div className="mt-5 flex items-end gap-1.5 h-32" data-testid={`energia-chart-${conn.property_id}`}>
                      {usage.monthly.map((m) => (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                          <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            {m.kwh.toLocaleString()}
                          </span>
                          <div
                            className="w-full rounded-t-md bg-gradient-to-t from-yellow-600 to-yellow-400 transition-all"
                            style={{ height: `${Math.max((m.kwh / maxKwh) * 100, 3)}%` }}
                          />
                          <span className="text-[9px] text-slate-600">{monthLabel(m.month)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-xs text-slate-500">
                    Sin datos de consumo todavía — presiona &quot;Sincronizar&quot; para traerlos de Xcel Energy.
                  </p>
                )}

                {/* Generar factura al inquilino */}
                <div className="mt-5 pt-4 border-t border-slate-800">
                  <p className="text-xs font-semibold text-slate-400 mb-2">
                    Facturar al inquilino (kWh × tarifa)
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      data-testid={`gen-period-${conn.property_id}`}
                      type="month"
                      value={genInputs[conn.property_id]?.period ?? prevMonth()}
                      onChange={(e) =>
                        setGenInputs((g) => ({
                          ...g,
                          [conn.property_id]: { period: e.target.value, rate: g[conn.property_id]?.rate || '' },
                        }))
                      }
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    />
                    <input
                      data-testid={`gen-rate-${conn.property_id}`}
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="Tarifa $/kWh (ej. 0.14)"
                      value={genInputs[conn.property_id]?.rate ?? ''}
                      onChange={(e) =>
                        setGenInputs((g) => ({
                          ...g,
                          [conn.property_id]: { period: g[conn.property_id]?.period || prevMonth(), rate: e.target.value },
                        }))
                      }
                      className="w-40 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    />
                    <button
                      data-testid={`gen-bill-${conn.property_id}`}
                      onClick={() => handleGenerateBill(conn)}
                      disabled={generating === conn.property_id}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                    >
                      {generating === conn.property_id ? 'Generando…' : 'Generar factura'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-2">
                    La factura aparecerá en &quot;Mis Servicios&quot; del inquilino activo con botón de pago (Stripe).
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ManualConnectForm({
  properties,
  headers,
  notify,
  onDone,
}: {
  properties: Property[];
  headers: () => Record<string, string>;
  notify: (text: string, ok?: boolean) => void;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    property_id: '',
    subscription_id: '',
    access_token: '',
    refresh_token: '',
    customer_email: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.property_id || !form.access_token) {
      notify('Selecciona la propiedad y pega el access token', false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/xcel/connections/manual', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(data.message || 'Conexión registrada');
        setOpen(false);
        setForm({ property_id: '', subscription_id: '', access_token: '', refresh_token: '', customer_email: '' });
        onDone();
      } else {
        notify(data.detail || 'No se pudo registrar la conexión', false);
      }
    } catch (e: any) {
      notify(e?.message || 'Error de red', false);
    }
    setSaving(false);
  };

  if (!open) {
    return (
      <button
        data-testid="xcel-manual-connect-btn"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
      >
        <Plug className="w-4 h-4" /> Registrar conexión (token del Vendor Portal)
      </button>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-emerald-500/20 rounded-xl p-4 space-y-3" data-testid="xcel-manual-connect-form">
      <div className="grid sm:grid-cols-2 gap-3">
        <select
          value={form.property_id}
          onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="">Propiedad…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.address || p.name || p.id}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Subscription ID (del Vendor Portal)"
          value={form.subscription_id}
          onChange={(e) => setForm((f) => ({ ...f, subscription_id: e.target.value }))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none placeholder:text-slate-600"
        />
      </div>
      <input
        type="text"
        placeholder="Access Token (generado en el Vendor Portal tras la autorización del cliente) *"
        value={form.access_token}
        onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none placeholder:text-slate-600"
      />
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Refresh Token (opcional)"
          value={form.refresh_token}
          onChange={(e) => setForm((f) => ({ ...f, refresh_token: e.target.value }))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none placeholder:text-slate-600"
        />
        <input
          type="email"
          placeholder="Email del cliente Xcel (opcional)"
          value={form.customer_email}
          onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none placeholder:text-slate-600"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm hover:bg-slate-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          data-testid="xcel-manual-connect-save"
          onClick={submit}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
        >
          {saving ? 'Guardando…' : 'Registrar conexión'}
        </button>
      </div>
    </div>
  );
}
