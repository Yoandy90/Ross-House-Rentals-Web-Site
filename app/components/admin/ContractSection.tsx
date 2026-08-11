'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Loader2, Download, Settings2, Mail as MailIcon } from 'lucide-react';
import TitleCompaniesModal, { TitleCompany } from './TitleCompaniesModal';

type ContractMeta = {
  price: number; seller_name: string; earnest_money: number; closing_days: number;
  title_company_name: string; generated_at: string;
  emailed_to?: string; emailed_at?: string;
} | null;

export default function ContractSection({ leadId, ownerName, address, suggestedPrice, contract, headers, setToast, onGenerated }: {
  leadId: string;
  ownerName: string;
  address: string;
  suggestedPrice: number;      // precio pre-llenado (respuesta del dueño u oferta enviada)
  contract: ContractMeta;
  headers: () => Record<string, string>;
  setToast: (t: { msg: string; ok: boolean }) => void;
  onGenerated: (contract: NonNullable<ContractMeta>) => void;
}) {
  const [companies, setCompanies] = useState<TitleCompany[]>([]);
  const [showManager, setShowManager] = useState(false);
  const [busy, setBusy] = useState(false);

  const [price, setPrice] = useState(suggestedPrice > 0 ? String(suggestedPrice) : (contract?.price ? String(contract.price) : ''));
  const [sellerName, setSellerName] = useState(contract?.seller_name || ownerName || '');
  const [earnest, setEarnest] = useState(contract?.earnest_money ? String(contract.earnest_money) : '500');
  const [closingDays, setClosingDays] = useState(contract?.closing_days ? String(contract.closing_days) : '30');
  const [titleCoId, setTitleCoId] = useState('');
  const [paidBy, setPaidBy] = useState<'Buyer' | 'Seller'>('Buyer');
  const [terms, setTerms] = useState('');
  const [sellerEmail, setSellerEmail] = useState(contract?.emailed_to || '');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);

  const loadCompanies = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/title-companies', { headers: headers() });
      const d = await r.json();
      if (r.ok) {
        setCompanies(d.items || []);
        setTitleCoId(prev => prev || (d.items || []).find((c: TitleCompany) => c.is_default)?.id || d.items?.[0]?.id || '');
      }
    } catch { /* noop */ }
  }, [headers]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const generate = async () => {
    if (!(Number(price) > 0)) { setToast({ msg: 'Indica el precio de compra', ok: false }); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${leadId}/contract.pdf`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: Number(price),
          seller_name: sellerName,
          earnest_money: Number(earnest) || 500,
          closing_days: Number(closingDays) || 30,
          title_company_id: titleCoId,
          title_policy_paid_by: paidBy,
          special_terms: terms,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setToast({ msg: d.detail || 'No se pudo generar el contrato', ok: false });
        setBusy(false);
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contrato_${(address || leadId).split(',')[0].replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      const tc = companies.find(c => c.id === titleCoId);
      onGenerated({
        price: Number(price), seller_name: sellerName, earnest_money: Number(earnest) || 500,
        closing_days: Number(closingDays) || 30, title_company_name: tc?.name || '',
        generated_at: new Date().toISOString(),
      });
      setToast({ msg: '📄 Contrato generado y descargado', ok: true });
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setBusy(false);
  };

  const downloadStored = async () => {
    setDlBusy(true);
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${leadId}/contract-download.pdf`, { headers: headers() });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setToast({ msg: d.detail || 'No hay contrato guardado', ok: false });
        setDlBusy(false);
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contrato_${(address || leadId).split(',')[0].replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setDlBusy(false);
  };

  const emailToSeller = async () => {
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(sellerEmail.trim())) {
      setToast({ msg: 'Indica un email válido del vendedor', ok: false });
      return;
    }
    setEmailBusy(true);
    try {
      const r = await fetch(`/api/admin/deal-finder/leads/${leadId}/contract-email`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: sellerEmail.trim(), message: emailMsg }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setToast({ msg: `📧 Contrato enviado a ${d.sent_to}`, ok: true });
      else setToast({ msg: d.detail || 'No se pudo enviar', ok: false });
    } catch { setToast({ msg: 'Error de conexión', ok: false }); }
    setEmailBusy(false);
  };

  return (
    <div className="bg-white/[0.03] border border-amber-500/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Contrato de compra (cash)
        </div>
        <button onClick={() => setShowManager(true)}
          className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-white/[0.1] text-gray-400 hover:text-amber-300 hover:border-amber-500/30 transition flex items-center gap-1">
          <Settings2 className="w-3 h-3" /> Casas de título
        </button>
      </div>

      {contract && (
        <div className="space-y-2">
          <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            ✓ Contrato guardado: ${Number(contract.price).toLocaleString('en-US')} · {contract.title_company_name}
            {contract.generated_at && ` · ${new Date(contract.generated_at).toLocaleDateString('es-US')}`}
            {contract.emailed_to && <span className="block text-emerald-300/90 mt-0.5">📧 Enviado a {contract.emailed_to}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={downloadStored} disabled={dlBusy}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-white/[0.05] text-gray-300 border border-white/[0.1] hover:text-white transition disabled:opacity-50 flex items-center justify-center gap-1.5">
              {dlBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Descargar guardado
            </button>
          </div>
          <div className="flex gap-2">
            <input value={sellerEmail} onChange={e => setSellerEmail(e.target.value)}
              placeholder="email del vendedor..." type="email"
              className="flex-1 min-w-0 px-3 py-2 bg-black/30 border border-white/[0.08] rounded-lg text-xs text-white focus:border-emerald-500/50 focus:outline-none placeholder:text-gray-600" />
            <button onClick={emailToSeller} disabled={emailBusy}
              className="px-3 py-2 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition disabled:opacity-50 flex items-center gap-1.5 shrink-0">
              {emailBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MailIcon className="w-3.5 h-3.5" />}
              Enviar al vendedor
            </button>
          </div>
          <input value={emailMsg} onChange={e => setEmailMsg(e.target.value)}
            placeholder="Mensaje opcional para el vendedor (va en el email)..."
            className="w-full px-3 py-2 bg-black/30 border border-white/[0.08] rounded-lg text-[11px] text-white focus:border-emerald-500/50 focus:outline-none placeholder:text-gray-600" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Vendedor (dueño)</label>
          <input value={sellerName} onChange={e => setSellerName(e.target.value)}
            className="w-full px-3 py-2 bg-black/30 border border-white/[0.08] rounded-lg text-xs text-white focus:border-amber-500/50 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Precio (cash) *</label>
          <div className="flex items-center gap-1 bg-black/30 border border-white/[0.08] rounded-lg px-3">
            <span className="text-gray-500 text-xs font-bold">$</span>
            <input value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))} inputMode="numeric"
              className="flex-1 min-w-0 bg-transparent py-2 text-xs text-white font-bold focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Earnest money</label>
          <div className="flex items-center gap-1 bg-black/30 border border-white/[0.08] rounded-lg px-3">
            <span className="text-gray-500 text-xs font-bold">$</span>
            <input value={earnest} onChange={e => setEarnest(e.target.value.replace(/[^\d.]/g, ''))} inputMode="numeric"
              className="flex-1 min-w-0 bg-transparent py-2 text-xs text-white focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cierre (días)</label>
          <input value={closingDays} onChange={e => setClosingDays(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric"
            className="w-full px-3 py-2 bg-black/30 border border-white/[0.08] rounded-lg text-xs text-white focus:border-amber-500/50 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Póliza de título la paga</label>
          <select value={paidBy} onChange={e => setPaidBy(e.target.value as 'Buyer' | 'Seller')}
            className="w-full px-3 py-2 bg-black/30 border border-white/[0.08] rounded-lg text-xs text-white focus:border-amber-500/50 focus:outline-none">
            <option value="Buyer">Comprador (tú)</option>
            <option value="Seller">Vendedor</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Casa de título</label>
          <select value={titleCoId} onChange={e => setTitleCoId(e.target.value)}
            className="w-full px-3 py-2 bg-black/30 border border-white/[0.08] rounded-lg text-xs text-white focus:border-amber-500/50 focus:outline-none">
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' ⭐' : ''}{c.escrow_officer ? ` — ${c.escrow_officer}` : ''}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Términos especiales (opcional)</label>
          <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={2}
            placeholder="Ej: el vendedor deja los electrodomésticos; el comprador paga hasta $X de impuestos atrasados..."
            className="w-full px-3 py-2 bg-black/30 border border-white/[0.08] rounded-lg text-xs text-white focus:border-amber-500/50 focus:outline-none resize-none placeholder:text-gray-600" />
        </div>
      </div>

      <button onClick={generate} disabled={busy}
        className="w-full py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 text-white disabled:opacity-50 transition flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {busy ? 'Generando…' : 'Generar y descargar contrato (PDF)'}
      </button>
      <p className="text-[10px] text-gray-600">
        Contrato cash AS-IS pre-llenado (comprador: tu LLC, General Warranty Deed, impuestos atrasados pagados del vendedor al cierre). Si el dueño <b>acepta</b> tu oferta desde el link QR, el contrato se genera y guarda automáticamente y te llega por email. Revísalo con la casa de título antes de firmar.
      </p>

      {showManager && (
        <TitleCompaniesModal headers={headers} onClose={() => setShowManager(false)} onChanged={setCompanies} />
      )}
    </div>
  );
}
