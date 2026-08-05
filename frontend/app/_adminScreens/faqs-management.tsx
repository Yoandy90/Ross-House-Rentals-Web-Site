import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface FAQ {
  id: string;
  category_id: string;
  question: string;
  question_es: string;
  answer: string;
  answer_es: string;
  tags: string[];
  views: number;
  helpful_count: number;
  not_helpful_count: number;
  active: boolean;
}

interface Category {
  id: string;
  name: string;
  name_es: string;
  icon: string;
  active: boolean;
}

export default function FAQsManagementScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form states for FAQ
  const [question, setQuestion] = useState('');
  const [questionEs, setQuestionEs] = useState('');
  const [answer, setAnswer] = useState('');
  const [answerEs, setAnswerEs] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Form states for Category
  const [categoryName, setCategoryName] = useState('');
  const [categoryNameEs, setCategoryNameEs] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('❓');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('session_token');
      
      // Load categories
      const catResponse = await fetch(`${BACKEND_URL}/api/faqs/admin/categories`, {
        headers: { 'Authorization': token || '' },
      });
      const catData = await catResponse.json();
      setCategories(catData);

      // Load FAQs
      const faqResponse = await fetch(`${BACKEND_URL}/api/faqs/admin/all`, {
        headers: { 'Authorization': token || '' },
      });
      const faqData = await faqResponse.json();
      setFaqs(faqData);
    } catch (error) {
      console.error('Error loading FAQs:', error);
      Alert.alert('Error', 'Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFAQ = async () => {
    if (!question || !answer || !categoryId) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${BACKEND_URL}/api/faqs/admin/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token || '',
        },
        body: JSON.stringify({
          category_id: categoryId,
          question,
          question_es: questionEs || question,
          answer,
          answer_es: answerEs || answer,
          tags: [],
          active: true,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'FAQ created successfully');
        setShowModal(false);
        resetForm();
        loadData();
      } else {
        Alert.alert('Error', 'Failed to create FAQ');
      }
    } catch (error) {
      console.error('Error creating FAQ:', error);
      Alert.alert('Error', 'Failed to create FAQ');
    }
  };

  const handleUpdateFAQ = async () => {
    if (!editingFAQ) return;

    try {
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${BACKEND_URL}/api/faqs/admin/${editingFAQ.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token || '',
        },
        body: JSON.stringify({
          question,
          question_es: questionEs,
          answer,
          answer_es: answerEs,
          category_id: categoryId,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'FAQ updated successfully');
        setShowModal(false);
        setEditingFAQ(null);
        resetForm();
        loadData();
      } else {
        Alert.alert('Error', 'Failed to update FAQ');
      }
    } catch (error) {
      console.error('Error updating FAQ:', error);
      Alert.alert('Error', 'Failed to update FAQ');
    }
  };

  const handleDeleteFAQ = async (faqId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this FAQ?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('session_token');
              const response = await fetch(`${BACKEND_URL}/api/faqs/admin/${faqId}`, {
                method: 'DELETE',
                headers: { 'Authorization': token || '' },
              });

              if (response.ok) {
                Alert.alert('Success', 'FAQ deleted successfully');
                loadData();
              } else {
                Alert.alert('Error', 'Failed to delete FAQ');
              }
            } catch (error) {
              console.error('Error deleting FAQ:', error);
              Alert.alert('Error', 'Failed to delete FAQ');
            }
          },
        },
      ]
    );
  };

  const handleCreateCategory = async () => {
    if (!categoryName) {
      Alert.alert('Error', 'Please enter category name');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${BACKEND_URL}/api/faqs/admin/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token || '',
        },
        body: JSON.stringify({
          name: categoryName,
          name_es: categoryNameEs || categoryName,
          icon: categoryIcon,
          active: true,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Category created successfully');
        setShowCategoryModal(false);
        resetCategoryForm();
        loadData();
      } else {
        Alert.alert('Error', 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      Alert.alert('Error', 'Failed to create category');
    }
  };

  const openEditFAQ = (faq: FAQ) => {
    setEditingFAQ(faq);
    setQuestion(faq.question);
    setQuestionEs(faq.question_es);
    setAnswer(faq.answer);
    setAnswerEs(faq.answer_es);
    setCategoryId(faq.category_id);
    setShowModal(true);
  };

  const resetForm = () => {
    setQuestion('');
    setQuestionEs('');
    setAnswer('');
    setAnswerEs('');
    setCategoryId('');
  };

  const resetCategoryForm = () => {
    setCategoryName('');
    setCategoryNameEs('');
    setCategoryIcon('❓');
  };

  const filteredFAQs = selectedCategory === 'all' 
    ? faqs 
    : faqs.filter(faq => faq.category_id === selectedCategory);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQs Management</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{faqs.length}</Text>
          <Text style={styles.statLabel}>Total FAQs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{categories.length}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{faqs.filter(f => f.active).length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            resetForm();
            setEditingFAQ(null);
            setShowModal(true);
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.buttonText}>New FAQ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            resetCategoryForm();
            setShowCategoryModal(true);
          }}
        >
          <Ionicons name="folder" size={20} color="#dc2626" />
          <Text style={styles.secondaryButtonText}>New Category</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal style={styles.categoryFilter}>
        <TouchableOpacity
          style={[
            styles.categoryChip,
            selectedCategory === 'all' && styles.categoryChipActive,
          ]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text
            style={[
              styles.categoryChipText,
              selectedCategory === 'all' && styles.categoryChipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat.id && styles.categoryChipTextActive,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.faqList}>
        {filteredFAQs.map(faq => (
          <View key={faq.id} style={[styles.faqCard, !faq.active && styles.inactiveFaqCard]}>
            <View style={styles.faqHeader}>
              <View style={styles.faqInfo}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <View style={styles.faqMeta}>
                  <Text style={styles.faqMetaText}>👁 {faq.views}</Text>
                  <Text style={styles.faqMetaText}>👍 {faq.helpful_count}</Text>
                  <Text style={styles.faqMetaText}>👎 {faq.not_helpful_count}</Text>
                  {!faq.active && <Text style={styles.inactiveLabel}>Inactive</Text>}
                </View>
              </View>
              <View style={styles.faqActions}>
                <TouchableOpacity onPress={() => openEditFAQ(faq)} style={styles.iconButton}>
                  <Ionicons name="pencil" size={20} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteFAQ(faq.id)} style={styles.iconButton}>
                  <Ionicons name="trash" size={20} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.faqAnswer} numberOfLines={2}>{faq.answer}</Text>
          </View>
        ))}
      </ScrollView>

      {/* FAQ Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingFAQ ? 'Edit FAQ' : 'New FAQ'}</Text>
              <TouchableOpacity onPress={() => {
                setShowModal(false);
                setEditingFAQ(null);
                resetForm();
              }}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.label}>Category *</Text>
              <View style={styles.pickerContainer}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryOption,
                      categoryId === cat.id && styles.categoryOptionSelected,
                    ]}
                    onPress={() => setCategoryId(cat.id)}
                  >
                    <Text style={styles.categoryOptionIcon}>{cat.icon}</Text>
                    <Text style={styles.categoryOptionText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Question (English) *</Text>
              <TextInput
                style={styles.input}
                value={question}
                onChangeText={setQuestion}
                placeholder="Enter question in English"
                multiline
              />

              <Text style={styles.label}>Question (Spanish)</Text>
              <TextInput
                style={styles.input}
                value={questionEs}
                onChangeText={setQuestionEs}
                placeholder="Enter question in Spanish"
                multiline
              />

              <Text style={styles.label}>Answer (English) *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={answer}
                onChangeText={setAnswer}
                placeholder="Enter answer in English"
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Answer (Spanish)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={answerEs}
                onChangeText={setAnswerEs}
                placeholder="Enter answer in Spanish"
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={editingFAQ ? handleUpdateFAQ : handleCreateFAQ}
              >
                <Text style={styles.submitButtonText}>
                  {editingFAQ ? 'Update FAQ' : 'Create FAQ'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Category</Text>
              <TouchableOpacity onPress={() => {
                setShowCategoryModal(false);
                resetCategoryForm();
              }}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.label}>Category Name (English) *</Text>
              <TextInput
                style={styles.input}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="Enter category name"
              />

              <Text style={styles.label}>Category Name (Spanish)</Text>
              <TextInput
                style={styles.input}
                value={categoryNameEs}
                onChangeText={setCategoryNameEs}
                placeholder="Enter category name in Spanish"
              />

              <Text style={styles.label}>Icon (Emoji)</Text>
              <TextInput
                style={styles.input}
                value={categoryIcon}
                onChangeText={setCategoryIcon}
                placeholder="Enter emoji icon"
                maxLength={2}
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleCreateCategory}>
                <Text style={styles.submitButtonText}>Create Category</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#dc2626',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  stats: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#dc2626',
    fontWeight: '600',
  },
  categoryFilter: {
    paddingHorizontal: 16,
    marginBottom: 16,
    maxHeight: 50,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryChipActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  categoryChipIcon: {
    fontSize: 16,
  },
  categoryChipText: {
    color: '#666',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  faqList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  faqCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  inactiveFaqCard: {
    opacity: 0.6,
    borderColor: '#fca5a5',
    borderWidth: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  faqInfo: {
    flex: 1,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  faqMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  faqMetaText: {
    fontSize: 12,
    color: '#666',
  },
  inactiveLabel: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600',
  },
  faqActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
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
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  categoryOptionSelected: {
    backgroundColor: '#fee2e2',
    borderColor: '#dc2626',
  },
  categoryOptionIcon: {
    fontSize: 18,
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  submitButton: {
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});