import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type: 'individual' | 'corporate';
  phone: string;
  company_name?: string;
  tax_number?: string;
  query_count: number;
  query_limit: number;
  phone_verified: boolean;
  created_at: string;
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    company_name: '',
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setEditForm({
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone || '',
          company_name: userData.company_name || '',
        });
      } else {
        Alert.alert('Hata', 'Profil bilgileri yüklenemedi.');
        router.replace('/login');
      }
    } catch (error) {
      console.error('Profile load error:', error);
      Alert.alert('Hata', 'Bağlantı hatası oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/user/update-profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        setIsEditing(false);
        Alert.alert('Başarılı! ✅', 'Profil bilgileriniz güncellendi.');
      } else {
        Alert.alert('Hata', 'Profil güncellenemedi.');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Hata', 'Güncelleme sırasında hata oluştu.');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['auth_token', 'user_data']);
            router.replace('/');
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRemainingQueries = () => {
    if (!user) return 0;
    return user.query_limit - user.query_count;
  };

  const getQueryPercentage = () => {
    if (!user) return 0;
    return (user.query_count / user.query_limit) * 100;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Profil yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profil bulunamadı</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.loginButtonText}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profilim</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutButton}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.userHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {user.first_name.charAt(0)}{user.last_name.charAt(0)}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {user.first_name} {user.last_name}
              </Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              <Text style={styles.userType}>
                {user.user_type === 'individual' ? '👤 Bireysel Üye' : '🏢 Kurumsal Üye'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Text style={styles.editButtonText}>
              {isEditing ? 'İptal' : '✏️ Düzenle'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Query Status */}
        <View style={styles.queryStatusCard}>
          <Text style={styles.cardTitle}>📊 Sorgulama Durumu</Text>
          
          <View style={styles.queryStats}>
            <View style={styles.queryStat}>
              <Text style={styles.queryNumber}>{getRemainingQueries()}</Text>
              <Text style={styles.queryLabel}>Kalan Sorgu</Text>
            </View>
            <View style={styles.queryStat}>
              <Text style={styles.queryNumber}>{user.query_count}</Text>
              <Text style={styles.queryLabel}>Kullanılan</Text>
            </View>
            <View style={styles.queryStat}>
              <Text style={styles.queryNumber}>{user.query_limit}</Text>
              <Text style={styles.queryLabel}>Toplam</Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${getQueryPercentage()}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              %{getQueryPercentage().toFixed(0)} kullanıldı
            </Text>
          </View>

          {!user.phone_verified && getRemainingQueries() === 0 && (
            <TouchableOpacity 
              style={styles.verifyPhoneButton}
              onPress={() => router.push('/phone-verification')}
            >
              <Text style={styles.verifyPhoneText}>
                📱 Telefon Doğrula (+5 ek sorgu)
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Edit Form */}
        {isEditing && (
          <View style={styles.editCard}>
            <Text style={styles.cardTitle}>✏️ Profil Düzenle</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Ad</Text>
              <TextInput
                style={styles.input}
                value={editForm.first_name}
                onChangeText={(text) => setEditForm({...editForm, first_name: text})}
                placeholder="Adınız"
                placeholderTextColor="#8892a0"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Soyad</Text>
              <TextInput
                style={styles.input}
                value={editForm.last_name}
                onChangeText={(text) => setEditForm({...editForm, last_name: text})}
                placeholder="Soyadınız"
                placeholderTextColor="#8892a0"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Telefon</Text>
              <TextInput
                style={styles.input}
                value={editForm.phone}
                onChangeText={(text) => setEditForm({...editForm, phone: text})}
                placeholder="0555 123 4567"
                placeholderTextColor="#8892a0"
                keyboardType="phone-pad"
              />
            </View>

            {user.user_type === 'corporate' && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Şirket Adı</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.company_name}
                  onChangeText={(text) => setEditForm({...editForm, company_name: text})}
                  placeholder="Şirket adınız"
                  placeholderTextColor="#8892a0"
                />
              </View>
            )}

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
              <Text style={styles.saveButtonText}>💾 Kaydet</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Account Info */}
        <View style={styles.accountCard}>
          <Text style={styles.cardTitle}>ℹ️ Hesap Bilgileri</Text>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>E-posta</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Telefon</Text>
            <View style={styles.phoneContainer}>
              <Text style={styles.infoValue}>{user.phone || 'Belirtilmemiş'}</Text>
              {user.phone_verified ? (
                <Text style={styles.verifiedBadge}>✅ Doğrulandı</Text>
              ) : (
                <Text style={styles.unverifiedBadge}>❌ Doğrulanmadı</Text>
              )}
            </View>
          </View>

          {user.company_name && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Şirket</Text>
              <Text style={styles.infoValue}>{user.company_name}</Text>
            </View>
          )}

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Üyelik Tarihi</Text>
            <Text style={styles.infoValue}>{formatDate(user.created_at)}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.cardTitle}>🚀 Hızlı İşlemler</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/query-history')}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionText}>Sorgulama Geçmişi</Text>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/phone-verification')}
          >
            <Text style={styles.actionIcon}>📱</Text>
            <Text style={styles.actionText}>Telefon Doğrulama</Text>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/notifications')}
          >
            <Text style={styles.actionIcon}>🔔</Text>
            <Text style={styles.actionText}>Fiyat Alarmları</Text>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/packages')}
          >
            <Text style={styles.actionIcon}>💎</Text>
            <Text style={styles.actionText}>Paket Satın Al</Text>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            EmlakEkspertizi.com • Nadas.com.tr güvencesiyle
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#2563eb',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2563eb',
  },
  backButton: {
    color: '#ffffff',
    fontSize: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutButton: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userCard: {
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  userType: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  queryStatusCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  queryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  queryStat: {
    alignItems: 'center',
  },
  queryNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  queryLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
  },
  verifyPhoneButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  verifyPhoneText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  editCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  saveButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  accountCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedBadge: {
    marginLeft: 8,
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  unverifiedBadge: {
    marginLeft: 8,
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  actionsCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  actionArrow: {
    fontSize: 16,
    color: '#64748b',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
});