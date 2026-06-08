'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Store, Search, CheckCircle2, XCircle, Clock, Eye, X,
  MapPin, User, Phone, Mail, Calendar, Home, DollarSign,
  Image, ChevronDown, ChevronUp, MessageSquare, Filter,
  Users, TrendingUp, Building2, AlertTriangle,
} from 'lucide-react';

interface Listing {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  type: string;
  listing_type: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  description: string;
  photos: string[];
  photo_count: number;
  status: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  created_at: string;
}

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  property_id: string;
  property_title: string;
  status: string;
  created_at: string;
}

interface Stats {
  total_listings: number;
  approved: number;
  pending: number;
  rejected: number;
  total_inquiries: number;
}

export default function MarketplacePage() {
  const { headers } = useAdminAuth();
  const [tab, setTab] = useState<'listings' | 'inquiries'>('listings');
  const [listings, setListings] = useState<Listing[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [photoModal, setPhotoModal] = useState<{ photos: string[]; index: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [listRes, inqRes, statsRes] = await Promise.all([
        fetch(`/api/admin/marketplace-listings?status=${filter}`, { headers: headers() }),
        fetch('/api/admin/property-inquiries', { headers: headers() }),
        fetch('/api/admin/marketplace-stats', { headers: headers() }),
      ]);
      if (listRes.ok) { const d = await listRes.json(); setListings(d.listings || []); }
      if (inqRes.ok) { const d = await inqRes.json(); setInquiries(d.inquiries || []); }
      if (statsRes.ok) { const d = await statsRes.json(); setStats(d.stats || d); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateListing = async (id: string, action: 'approve' | 'reject') => {
    try {
      await fetch(`/api/admin/marketplace-listings/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ action }),
      });
      fetchData();
      if (selectedListing?.id === id) setSelectedListing(null);
    } catch (e) { console.error(e); }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: 'Pendiente', color: 'amber', icon: Clock },
    approved: { label: 'Aprobada', color: 'emerald', icon: CheckCircle2 },
    rejected: { label: 'Rechazada', color: 'red', icon: XCircle },
  };

  const filtered = listings.filter(l =>
    !search || l.title?.toLowerCase().includes(search.toLowerCase()) ||
    l.address?.toLowerCase().includes(search.toLowerCase()) ||
    l.owner_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/20 flex items-center justify-center">
            <Store className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Marketplace</h2>
            <p className="text-sm text-gray-500">Listados, consultas y clientes</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Total Listados" value={stats.total_listings} icon={Building2} color="cyan" />
          <StatCard label="Aprobados" value={stats.approved} icon={CheckCircle2} color="emerald" />
          <StatCard label="Pendientes" value={stats.pending} icon={Clock} color="amber" />
          <StatCard label="Rechazados" value={stats.rejected} icon={XCircle} color="red" />
          <StatCard label="Consultas" value={stats.total_inquiries} icon={MessageSquare} color="purple" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/[0.06]">
        <button
          onClick={() => setTab('listings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 justify-center transition ${
            tab === 'listings' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Building2 className="w-4 h-4" /> Listados ({listings.length})
        </button>
        <button
          onClick={() => setTab('inquiries')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 justify-center transition ${
            tab === 'inquiries' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Consultas ({inquiries.length})
        </button>
      </div>

      {/* ═══════════ LISTINGS TAB ═══════════ */}
      {tab === 'listings' && (
        <div className="space-y-4">
          {/* Search + Filter */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por dirección, título o propietario..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-1">
              {['all', 'pending', 'approved', 'rejected'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    filter === f ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25' : 'bg-white/[0.03] text-gray-400 border border-white/[0.06]'
                  }`}
                >
                  {f === 'all' ? 'Todos' : statusConfig[f]?.label || f}
                </button>
              ))}
            </div>
          </div>

          {/* Listings Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-white/[0.06]">
              <Store className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No hay listados {filter !== 'all' ? statusConfig[filter]?.label.toLowerCase() + 's' : ''}</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(listing => {
                const st = statusConfig[listing.status] || statusConfig.pending;
                return (
                  <div key={listing.id} className="bg-white/[0.03] rounded-2xl border border-white/[0.06] overflow-hidden hover:border-cyan-500/20 transition group">
                    {/* Photo */}
                    <div
                      className="h-44 bg-gradient-to-br from-gray-800 to-gray-900 relative cursor-pointer"
                      onClick={() => listing.photos?.length > 0 && setPhotoModal({ photos: listing.photos, index: 0 })}
                    >
                      {listing.photos && listing.photos.length > 0 ? (
                        <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Image className="w-10 h-10 text-gray-600" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 flex gap-2">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold bg-${st.color}-500/20 text-${st.color}-400 border border-${st.color}-500/30 backdrop-blur-sm`}>
                          {st.label}
                        </span>
                        {listing.photo_count > 1 && (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-black/50 text-white backdrop-blur-sm">
                            <Image className="w-3 h-3 inline mr-1" />{listing.photo_count}
                          </span>
                        )}
                      </div>
                      <div className="absolute top-3 left-3">
                        <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 backdrop-blur-sm uppercase">
                          {listing.listing_type === 'sale' ? 'Venta' : 'Renta'}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-white font-semibold text-sm">{listing.title || listing.address}</h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {listing.address}, {listing.city}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-emerald-400">${(listing.price || 0).toLocaleString()}<span className="text-xs text-gray-500 font-normal">{listing.listing_type !== 'sale' ? '/mes' : ''}</span></span>
                        <span className="text-xs text-gray-500">{listing.bedrooms}bd · {listing.bathrooms}ba · {listing.sqft || '?'} sqft</span>
                      </div>

                      {/* Owner info */}
                      <div className="p-2.5 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                        <p className="text-xs text-gray-500 mb-1">Propietario</p>
                        <p className="text-sm text-white font-medium flex items-center gap-1"><User className="w-3 h-3 text-gray-500" /> {listing.owner_name || 'No especificado'}</p>
                        {listing.owner_email && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {listing.owner_email}</p>}
                        {listing.owner_phone && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {listing.owner_phone}</p>}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {listing.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateListing(listing.id, 'approve')}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold hover:bg-emerald-500/20"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                            </button>
                            <button
                              onClick={() => updateListing(listing.id, 'reject')}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Rechazar
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedListing(listing)}
                          className="flex items-center justify-center gap-1 px-3 py-2 bg-white/[0.04] text-gray-400 border border-white/[0.08] rounded-lg text-xs font-medium hover:bg-white/[0.08]"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ INQUIRIES TAB ═══════════ */}
      {tab === 'inquiries' && (
        <div className="space-y-3">
          {inquiries.length === 0 ? (
            <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-white/[0.06]">
              <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No hay consultas registradas</p>
            </div>
          ) : (
            inquiries.map(inq => (
              <div key={inq.id} className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 hover:border-purple-500/15 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                      <User className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">{inq.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {inq.email && <span className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {inq.email}</span>}
                        {inq.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {inq.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{inq.created_at ? new Date(inq.created_at).toLocaleDateString('es') : ''}</span>
                </div>
                {inq.property_title && (
                  <div className="mt-2 p-2 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                    <p className="text-xs text-gray-500">Propiedad: <span className="text-cyan-400">{inq.property_title}</span></p>
                  </div>
                )}
                <p className="mt-3 text-sm text-gray-300 leading-relaxed">{inq.message}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════════ LISTING DETAIL MODAL ═══════════ */}
      {selectedListing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111827] rounded-2xl border border-white/[0.1] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Photos */}
            {selectedListing.photos && selectedListing.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-1">
                {selectedListing.photos.map((p, i) => (
                  <img
                    key={i}
                    src={p}
                    alt={`Foto ${i + 1}`}
                    className="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition"
                    onClick={() => setPhotoModal({ photos: selectedListing.photos, index: i })}
                  />
                ))}
              </div>
            )}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{selectedListing.title || selectedListing.address}</h3>
                <button onClick={() => setSelectedListing(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Dirección" value={`${selectedListing.address}, ${selectedListing.city}, ${selectedListing.state}`} />
                <Info label="Precio" value={`$${(selectedListing.price || 0).toLocaleString()}${selectedListing.listing_type !== 'sale' ? '/mes' : ''}`} />
                <Info label="Habitaciones" value={`${selectedListing.bedrooms} bd · ${selectedListing.bathrooms} ba`} />
                <Info label="Área" value={`${selectedListing.sqft || '?'} sqft`} />
                <Info label="Tipo" value={selectedListing.listing_type === 'sale' ? 'Venta' : 'Renta'} />
                <Info label="Propietario" value={selectedListing.owner_name || '-'} />
                <Info label="Email" value={selectedListing.owner_email || '-'} />
                <Info label="Teléfono" value={selectedListing.owner_phone || '-'} />
              </div>
              {selectedListing.description && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Descripción</p>
                  <p className="text-sm text-gray-300">{selectedListing.description}</p>
                </div>
              )}
              {selectedListing.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => updateListing(selectedListing.id, 'approve')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-bold hover:bg-emerald-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Aprobar Listado
                  </button>
                  <button
                    onClick={() => updateListing(selectedListing.id, 'reject')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold hover:bg-red-500/20"
                  >
                    <XCircle className="w-4 h-4" /> Rechazar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PHOTO VIEWER MODAL ═══════════ */}
      {photoModal && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center" onClick={() => setPhotoModal(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10"><X className="w-8 h-8" /></button>
          <img
            src={photoModal.photos[photoModal.index]}
            alt="Foto"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          {photoModal.photos.length > 1 && (
            <div className="absolute bottom-6 flex gap-2">
              {photoModal.photos.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setPhotoModal({ ...photoModal, index: i }); }}
                  className={`w-2.5 h-2.5 rounded-full transition ${i === photoModal.index ? 'bg-white' : 'bg-white/30'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 text-${color}-400`} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-gray-300 font-medium">{value}</p>
    </div>
  );
}
