import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import ModernAdminHeader from '../../components/admin/ModernAdminHeader';

interface Lead {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
  created_at: string;
  notes?: string;
  session_id?: string;
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  converted: number;
  today: number;
  this_week: number;
}

export default function LeadsScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [notes, setNotes] = useState('');

  const fetchLeads = useCallback(async () => {
    try {
      const statusFilter = filter === 'all' ? undefined : filter;
      const [leadsRes, statsRes] = await Promise.all([
        api.get('/admin/leads', { params: { status: statusFilter, limit: 100 } }),
        api.get('/admin/leads/stats/summary'),
      ]);
      
      setLeads(leadsRes.data.leads || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching leads:', error);
      Alert.alert('Error', 'No se pudieron cargar los leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return '#22C55E';
      case 'contacted': return '#F59E0B';
      case 'converted': return '#3B82F6';
      case 'lost': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Nuevo';
      case 'contacted': return 'Contactado';
      case 'converted': return 'Convertido';
      case 'lost': return 'Perdido';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string, name: string) => {
    const message = `Hola ${name}, soy de Ross Tax Preparation. Vi tu mensaje en nuestro sitio web. ¿En qué puedo ayudarte?`;
    Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      await api.put(`/admin/leads/${leadId}`, { status: newStatus, notes });
      Alert.alert('Éxito', 'Lead actualizado correctamente');
      setShowModal(false);
      setSelectedLead(null);
      setNotes('');
      fetchLeads();
    } catch (error) {
      console.error('Error updating lead:', error);
      Alert.alert('Error', 'No se pudo actualizar el lead');
    }
  };

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setNotes(lead.notes || '');
    setShowModal(true);
  };

  const renderStatCard = (label: string, value: number, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderLead = ({ item }: { item: Lead }) => (
    <TouchableOpacity style={styles.leadCard} onPress={() => openLeadDetail(item)}>
      <View style={styles.leadHeader}>
        <View style={styles.leadInfo}>
          <Text style={styles.leadName}>{item.name}</Text>
          <Text style={styles.leadDate}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>
      
      <View style={styles.leadContact}>
        {item.email && (
          <TouchableOpacity style={styles.contactItem} onPress={() => handleEmail(item.email!)}>
            <Ionicons name="mail-outline" size={16} color="#6B7280" />
            <Text style={styles.contactText} numberOfLines={1}>{item.email}</Text>
          </TouchableOpacity>
        )}
        {item.phone && (
          <TouchableOpacity style={styles.contactItem} onPress={() => handleCall(item.phone!)}>
            <Ionicons name="call-outline" size={16} color="#6B7280" />
            <Text style={styles.contactText}>{item.phone}</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.leadActions}>
        {item.phone && (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#25D366' }]}
              onPress={() => handleWhatsApp(item.phone!, item.name)}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
              onPress={() => handleCall(item.phone!)}
            >
              <Ionicons name="call" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}
        {item.email && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#6366F1' }]}
            onPress={() => handleEmail(item.email!)}
          >
            <Ionicons name="mail" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ModernAdminHeader 
          title="🎯 Leads Web" 
          subtitle="Contactos del chat"
          showBackButton 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E3A5F" />
          <Text style={styles.loadingText}>Cargando leads...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ModernAdminHeader 
        title="🎯 Leads Web" 
        subtitle="Contactos del chat"
        showBackButton 
        rightAction={{
          icon: 'refresh',
          onPress: onRefresh,
        }}
      />

      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderStatCard('Total', stats.total, '#1E3A5F')}
            {renderStatCard('Nuevos', stats.new, '#22C55E')}
            {renderStatCard('Contactados', stats.contacted, '#F59E0B')}
            {renderStatCard('Convertidos', stats.converted, '#3B82F6')}
            {renderStatCard('Hoy', stats.today, '#8B5CF6')}
            {renderStatCard('Esta Semana', stats.this_week, '#EC4899')}
          </ScrollView>
        </View>
      )}

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'new', 'contacted', 'converted', 'lost'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterButton, filter === f && styles.filterButtonActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'Todos' : getStatusLabel(f)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Leads List */}
      <FlatList
        data={leads}
        renderItem={renderLead}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E3A5F']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No hay leads</Text>
            <Text style={styles.emptySubtext}>
              Los leads aparecerán aquí cuando los visitantes usen el chat web
            </Text>
          </View>
        }
      />

      {/* Lead Detail Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle del Lead</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#1E3A5F" />
              </TouchableOpacity>
            </View>

            {selectedLead && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Nombre</Text>
                  <Text style={styles.detailValue}>{selectedLead.name}</Text>
                </View>

                {selectedLead.email && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailValue}>{selectedLead.email}</Text>
                  </View>
                )}

                {selectedLead.phone && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Teléfono</Text>
                    <Text style={styles.detailValue}>{selectedLead.phone}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Fuente</Text>
                  <Text style={styles.detailValue}>{selectedLead.source}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Fecha</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedLead.created_at)}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Notas</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Agregar notas..."
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <Text style={styles.detailLabel}>Cambiar Estado</Text>
                <View style={styles.statusButtons}>
                  {['new', 'contacted', 'converted', 'lost'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusButton,
                        { backgroundColor: getStatusColor(status) },
                        selectedLead.status === status && styles.statusButtonActive,
                      ]}
                      onPress={() => updateLeadStatus(selectedLead._id, status)}
                    >
                      <Text style={styles.statusButtonText}>{getStatusLabel(status)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                  {selectedLead.phone && (
                    <>
                      <TouchableOpacity
                        style={[styles.quickActionButton, { backgroundColor: '#25D366' }]}
                        onPress={() => handleWhatsApp(selectedLead.phone!, selectedLead.name)}
                      >
                        <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                        <Text style={styles.quickActionText}>WhatsApp</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.quickActionButton, { backgroundColor: '#3B82F6' }]}
                        onPress={() => handleCall(selectedLead.phone!)}
                      >
                        <Ionicons name="call" size={20} color="#fff" />
                        <Text style={styles.quickActionText}>Llamar</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {selectedLead.email && (
                    <TouchableOpacity
                      style={[styles.quickActionButton, { backgroundColor: '#6366F1' }]}
                      onPress={() => handleEmail(selectedLead.email!)}
                    >
                      <Ionicons name="mail" size={20} color="#fff" />
                      <Text style={styles.quickActionText}>Email</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  refreshButton: {
    padding: 4,
  },
  statsContainer: {
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 6,
    minWidth: 90,
    borderLeftWidth: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  filtersContainer: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 4,
  },
  filterButtonActive: {
    backgroundColor: '#1E3A5F',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  leadCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  leadDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  leadContact: {
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  leadActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#D1D5DB',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  modalBody: {
    padding: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
  },
  notesInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusButtonActive: {
    opacity: 0.7,
  },
  statusButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  quickActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
