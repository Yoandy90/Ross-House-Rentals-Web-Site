'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Key, Save, Eye, EyeOff, RefreshCw, CheckCircle2, AlertTriangle,
  Trash2, Shield, Database, FileCode, Loader2, Copy
} from 'lucide-react';

interface KeyItem {
  key: string;
  label: string;
  secret: boolean;
  placeholder: string;
  source: 'db' | 'env' | 'missing' | 'error';
  has_value: boolean;
  masked: string;
  updated_at?: string;
  updated_by?: string;
}

interface KeyGroup {
  category: string;
  keys: KeyItem[];
}

export default function ApiKeys({ headers }: { headers: () => Record<string, string> }) {
  const [groups, setGroups] = useState<KeyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/api-keys', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setGroups(d.groups || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const saveKey = async (k: string) => {
    const value = (editing[k] || '').trim();
    if (!value) return;
    setSaving(k);
    setError('');
    try {
      const res = await fetch(`/api/admin/api-keys/${k}`, {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      const d = await res.json();
      if (res.ok) {
        setSavedMsg(prev => ({ ...prev, [k]: d.message || 'Guardada' }));
        setEditing(prev => { const n = { ...prev }; delete n[k]; return n; });
        setRevealed(prev => { const n = { ...prev }; delete n[k]; return n; });
        setTimeout(() => setSavedMsg(prev => { const n = { ...prev }; delete n[k]; return n; }), 5000);
        fetchKeys();
      } else {
        setError(d.detail || 'Error al guardar');
      }
    } catch { setError('Error de conexión'); }
    setSaving(null);
  };

  const revealKey = async (k: string) => {
    if (revealed[k]) {
      setRevealed(prev => { const n = { ...prev }; delete n[k]; return n; });
      return;
    }
    setRevealing(k);
    try {
      const res = await fetch(`/api/admin/api-keys/${k}/reveal`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setRevealed(prev => ({ ...prev, [k]: d.value }));
      }
    } catch (e) { console.error(e); }
    setRevealing(null);
  };

  const deleteKey = async (k: string, label: string) => {
    if (!confirm(`¿Eliminar el override de "${label}"? Se restaurará el valor original del .env (si existe).`)) return;
    try {
      const res = await fetch(`/api/admin/api-keys/${k}`, { method: 'DELETE', headers: headers() });
      if (res.ok) fetchKeys();
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="p-4 bg-violet-500/5 rounded-2xl border border-violet-500/15 flex items-start gap-3">
        <Shield className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-white">Gestión de API Keys en vivo</p>
          <p className="text-xs text-gray-400 mt-1">
            Las keys guardadas aquí se encriptan (Fernet AES-128) en la base de datos y se aplican
            <span className="text-violet-300 font-semibold"> inmediatamente sin necesidad de rebuild ni redeploy</span>.
            Si eliminas un override, el sistema vuelve a usar el valor del archivo <code className="bg-white/10 px-1 rounded">.env</code>.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {groups.map(group => (
        <div key={group.category} className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Key className="w-4 h-4 text-violet-400" /> {group.category}
          </h3>
          <div className="space-y-4">
            {group.keys.map(item => (
              <div key={item.key} className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-200">{item.label}</span>
                    <code className="text-[10px] text-gray-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{item.key}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.source === 'db' && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <Database className="w-3 h-3" /> Base de Datos
                      </span>
                    )}
                    {item.source === 'env' && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <FileCode className="w-3 h-3" /> .env (archivo)
                      </span>
                    )}
                    {item.source === 'missing' && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-500/10 text-gray-500 border border-gray-500/20">
                        <AlertTriangle className="w-3 h-3" /> No configurada
                      </span>
                    )}
                  </div>
                </div>

                {/* Current value */}
                {item.has_value && (
                  <div className="flex items-center gap-2 mb-2">
                    <code className="flex-1 text-xs text-gray-400 bg-[#0a1020]/60 border border-white/[0.06] rounded-lg px-3 py-2 truncate font-mono">
                      {revealed[item.key] || item.masked}
                    </code>
                    {item.secret && (
                      <button
                        onClick={() => revealKey(item.key)}
                        className="p-2 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04]"
                        title={revealed[item.key] ? 'Ocultar' : 'Revelar (auditado)'}
                      >
                        {revealing === item.key ? <Loader2 className="w-4 h-4 animate-spin" /> : revealed[item.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                    {revealed[item.key] && (
                      <button
                        onClick={() => navigator.clipboard.writeText(revealed[item.key])}
                        className="p-2 border border-white/[0.08] rounded-lg text-gray-400 hover:bg-white/[0.04]"
                        title="Copiar"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    {item.source === 'db' && (
                      <button
                        onClick={() => deleteKey(item.key, item.label)}
                        className="p-2 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500/10"
                        title="Eliminar override (volver al .env)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                {/* New value input */}
                <div className="flex items-center gap-2">
                  <input
                    type={item.secret ? 'password' : 'text'}
                    value={editing[item.key] || ''}
                    onChange={e => setEditing(prev => ({ ...prev, [item.key]: e.target.value }))}
                    placeholder={item.has_value ? `Nuevo valor para rotar... (${item.placeholder})` : item.placeholder}
                    className="flex-1 px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-violet-500 focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => saveKey(item.key)}
                    disabled={saving === item.key || !(editing[item.key] || '').trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-violet-500 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-30 transition"
                  >
                    {saving === item.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                  </button>
                </div>

                {savedMsg[item.key] && (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {savedMsg[item.key]}
                  </p>
                )}
                {item.updated_at && (
                  <p className="text-[10px] text-gray-500 mt-2">
                    Última rotación: {new Date(item.updated_at).toLocaleString('es-US')} {item.updated_by ? `— ${item.updated_by}` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={fetchKeys}
          className="flex items-center gap-2 px-4 py-2 border border-white/[0.08] rounded-lg text-gray-400 text-sm hover:bg-white/[0.04]"
        >
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>
    </div>
  );
}
