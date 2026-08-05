import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'office_assistant';
  phone?: string;
}

export default function UsersManagement() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'office_assistant',
    phone: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'office_assistant' as 'admin' | 'office_assistant',
    is_active: true,
  });
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users');
      setUsers(response.data.users || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    if (formData.password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }

    try {
      setCreating(true);
      await api.post('/admin/users', formData);

      Alert.alert('Éxito', 'Usuario creado exitosamente');
      setShowCreateModal(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'office_assistant',
        phone: '',
      });
      loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      const message = error.response?.data?.detail || 'No se pudo crear el usuario';
      Alert.alert('Error', message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de que deseas eliminar a ${user.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/users/${user.id}`);
              Alert.alert('Éxito', 'Usuario eliminado exitosamente');
              loadUsers();
            } catch (error: any) {
              const message = error.response?.data?.detail || 'No se pudo eliminar el usuario';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  };

  const handleResetPassword = async (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const confirmResetPassword = async () => {
    if (!selectedUser) return;
    
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }

    try {
      setUpdating(true);
      await api.post(`/admin/users/${selectedUser.id}/reset-password`, { new_password: newPassword });
      Alert.alert('Éxito', 'Contraseña reseteada exitosamente');
      setShowPasswordModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error: any) {
      const message = error.response?.data?.detail || 'No se pudo resetear la contraseña';
      Alert.alert('Error', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role as 'admin' | 'office_assistant',
      is_active: user.is_active,
    });
    setShowEditModal(true);
  };

  const confirmEditUser = async () => {
    if (!selectedUser) return;
    
    if (!editFormData.name || !editFormData.email) {
      Alert.alert('Error', 'Nombre y email son obligatorios');
      return;
    }

    try {
      setUpdating(true);
      await api.put(`/admin/users/${selectedUser.id}`, editFormData);
      Alert.alert('Éxito', 'Usuario actualizado exitosamente');
      setShowEditModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'No se pudo actualizar el usuario';
      Alert.alert('Error', message);
    } finally {
      setUpdating(false);
    }
  };

  const resetPassword = async (userId: string, newPassword: string) => {
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { new_password: newPassword });
      Alert.alert('Éxito', 'Contraseña reseteada exitosamente');
    } catch (error: any) {
      const message = error.response?.data?.detail || 'No se pudo resetear la contraseña';
      Alert.alert('Error', message);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'office_assistant':
        return 'Asistente de Oficina';
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    return role === 'admin' ? colors.primary : colors.info;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AdminHeader 
          title="Gestión de Usuarios" 
          rightAction={{
            icon: 'person-add',
            onPress: () => setShowCreateModal(true)
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AdminHeader 
        title="Gestión de Usuarios" 
        subtitle={`${users.length} usuario${users.length !== 1 ? 's' : ''}`}
        rightAction={{
          icon: 'person-add',
          onPress: () => setShowCreateModal(true)
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Stats */}
        <View style={styles.statsHeader}>
          <Text style={[styles.statsText, { color: colors.textGray }]}>
            {users.length} usuario{users.length !== 1 ? 's' : ''} en el sistema
          </Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={20} color={colors.textWhite} />
            <Text style={[styles.addButtonText, { color: colors.textWhite }]}>
              Nuevo Usuario
            </Text>
          </TouchableOpacity>
        </View>

        {/* Users List */}
        <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
          {users.map((user, index) => (
            <View
              key={user.id}
              style={[
                styles.userRow,
                { borderBottomColor: colors.border },
                index === users.length - 1 && styles.lastUserRow,
              ]}
            >
              <View style={styles.userInfo}>
                <View style={[styles.avatar, { backgroundColor: getRoleColor(user.role) + '20' }]}>
                  <Ionicons
                    name={user.role === 'admin' ? 'shield-checkmark' : 'person'}
                    size={20}
                    color={getRoleColor(user.role)}
                  />
                </View>
                <View style={styles.userDetails}>
                  <Text style={[styles.userName, { color: colors.text }]}>{user.name}</Text>
                  <Text style={[styles.userEmail, { color: colors.textGray }]}>{user.email}</Text>
                  <View style={styles.roleBadgeContainer}>
                    <View
                      style={[
                        styles.roleBadge,
                        { backgroundColor: getRoleColor(user.role) + '20' },
                      ]}
                    >
                      <Text style={[styles.roleBadgeText, { color: getRoleColor(user.role) }]}>
                        {getRoleLabel(user.role)}
                      </Text>
                    </View>
                    {!user.is_active && (
                      <View style={[styles.inactiveBadge, { backgroundColor: colors.error + '20' }]}>
                        <Text style={[styles.inactiveBadgeText, { color: colors.error }]}>
                          Inactivo
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.userActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.success + '20' }]}
                  onPress={() => handleEditUser(user)}
                >
                  <Ionicons name="create" size={16} color={colors.success} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.info + '20' }]}
                  onPress={() => handleResetPassword(user)}
                >
                  <Ionicons name="key" size={16} color={colors.info} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                  onPress={() => handleDeleteUser(user)}
                >
                  <Ionicons name="trash" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Create User Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Nuevo Usuario</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.textGray} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Nombre *</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Nombre completo"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Email *</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="email@ejemplo.com"
                  placeholderTextColor={colors.textLight}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Contraseña *</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  placeholder={t('admin.minCharsPassword', 'Mínimo 8 caracteres')}
                  placeholderTextColor={colors.textLight}
                  secureTextEntry
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Teléfono</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="(opcional)"
                  placeholderTextColor={colors.textLight}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Rol *</Text>
                <View style={styles.roleButtons}>
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      {
                        backgroundColor:
                          formData.role === 'admin' ? colors.primary : colors.backgroundGray,
                        borderColor: formData.role === 'admin' ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, role: 'admin' })}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={20}
                      color={formData.role === 'admin' ? colors.textWhite : colors.textGray}
                    />
                    <Text
                      style={[
                        styles.roleButtonText,
                        {
                          color: formData.role === 'admin' ? colors.textWhite : colors.textGray,
                        },
                      ]}
                    >
                      Administrador
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      {
                        backgroundColor:
                          formData.role === 'office_assistant' ? colors.info : colors.backgroundGray,
                        borderColor:
                          formData.role === 'office_assistant' ? colors.info : colors.border,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, role: 'office_assistant' })}
                  >
                    <Ionicons
                      name="person"
                      size={20}
                      color={
                        formData.role === 'office_assistant' ? colors.textWhite : colors.textGray
                      }
                    />
                    <Text
                      style={[
                        styles.roleButtonText,
                        {
                          color:
                            formData.role === 'office_assistant'
                              ? colors.textWhite
                              : colors.textGray,
                        },
                      ]}
                    >
                      Asistente
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                  creating && styles.submitButtonDisabled,
                ]}
                onPress={handleCreateUser}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={colors.textWhite} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: colors.textWhite }]}>
                    Crear Usuario
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Editar Usuario</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.textGray} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Nombre *</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={editFormData.name}
                  onChangeText={(text) => setEditFormData({ ...editFormData, name: text })}
                  placeholder="Nombre completo"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Email *</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={editFormData.email}
                  onChangeText={(text) => setEditFormData({ ...editFormData, email: text })}
                  placeholder="email@ejemplo.com"
                  placeholderTextColor={colors.textLight}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Teléfono</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={editFormData.phone}
                  onChangeText={(text) => setEditFormData({ ...editFormData, phone: text })}
                  placeholder="(opcional)"
                  placeholderTextColor={colors.textLight}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Rol *</Text>
                <View style={styles.roleButtons}>
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      {
                        backgroundColor:
                          editFormData.role === 'admin' ? colors.primary : colors.backgroundGray,
                        borderColor: editFormData.role === 'admin' ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setEditFormData({ ...editFormData, role: 'admin' })}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={20}
                      color={editFormData.role === 'admin' ? colors.textWhite : colors.textGray}
                    />
                    <Text
                      style={[
                        styles.roleButtonText,
                        {
                          color: editFormData.role === 'admin' ? colors.textWhite : colors.textGray,
                        },
                      ]}
                    >
                      Admin
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      {
                        backgroundColor:
                          editFormData.role === 'office_assistant' ? colors.info : colors.backgroundGray,
                        borderColor:
                          editFormData.role === 'office_assistant' ? colors.info : colors.border,
                      },
                    ]}
                    onPress={() => setEditFormData({ ...editFormData, role: 'office_assistant' })}
                  >
                    <Ionicons
                      name="person"
                      size={20}
                      color={
                        editFormData.role === 'office_assistant' ? colors.textWhite : colors.textGray
                      }
                    />
                    <Text
                      style={[
                        styles.roleButtonText,
                        {
                          color:
                            editFormData.role === 'office_assistant'
                              ? colors.textWhite
                              : colors.textGray,
                        },
                      ]}
                    >
                      Asistente
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Estado</Text>
                <View style={styles.roleButtons}>
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      {
                        backgroundColor:
                          editFormData.is_active ? colors.success : colors.backgroundGray,
                        borderColor: editFormData.is_active ? colors.success : colors.border,
                      },
                    ]}
                    onPress={() => setEditFormData({ ...editFormData, is_active: true })}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={editFormData.is_active ? colors.textWhite : colors.textGray}
                    />
                    <Text
                      style={[
                        styles.roleButtonText,
                        {
                          color: editFormData.is_active ? colors.textWhite : colors.textGray,
                        },
                      ]}
                    >
                      Activo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      {
                        backgroundColor:
                          !editFormData.is_active ? colors.error : colors.backgroundGray,
                        borderColor: !editFormData.is_active ? colors.error : colors.border,
                      },
                    ]}
                    onPress={() => setEditFormData({ ...editFormData, is_active: false })}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={!editFormData.is_active ? colors.textWhite : colors.textGray}
                    />
                    <Text
                      style={[
                        styles.roleButtonText,
                        {
                          color: !editFormData.is_active ? colors.textWhite : colors.textGray,
                        },
                      ]}
                    >
                      Inactivo
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.success },
                  updating && styles.submitButtonDisabled,
                ]}
                onPress={confirmEditUser}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color={colors.textWhite} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: colors.textWhite }]}>
                    Guardar Cambios
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundCard, maxHeight: 350 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Resetear Contraseña</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Ionicons name="close" size={24} color={colors.textGray} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={[styles.passwordInfo, { color: colors.textGray }]}>
                Nueva contraseña para: {selectedUser?.name}
              </Text>
              
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Nueva Contraseña *</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t('admin.minCharsPassword', 'Mínimo 8 caracteres')}
                  placeholderTextColor={colors.textLight}
                  secureTextEntry
                  autoFocus
                />
              </View>

              <View style={styles.passwordButtons}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textGray }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    { backgroundColor: colors.info },
                    updating && styles.submitButtonDisabled,
                  ]}
                  onPress={confirmResetPassword}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color={colors.textWhite} size="small" />
                  ) : (
                    <Text style={[styles.confirmButtonText, { color: colors.textWhite }]}>
                      Confirmar
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  lastUserRow: {
    borderBottomWidth: 0,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 6,
  },
  roleBadgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  inactiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalForm: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
  roleButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  passwordInfo: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  passwordButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
