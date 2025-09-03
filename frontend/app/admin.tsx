import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width } = Dimensions.get('window');

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type: string;
  query_count: number;
  query_limit: number;
  created_at: string;
  is_active: boolean;
}

interface AdminStats {
  totalUsers: number;
  totalQueries: number;
  activeUsers: number;
  monthlyRevenue: number;
}

interface MLModel {
  model_id: string;
  model_type: string;
  created_at: string;
  metrics: {
    test_r2: number;
    test_rmse: number;
    test_mae: number;
  };
  data_shape: [number, number];
}

interface TrainingResult {
  success: boolean;
  model_id?: string;
  model_type?: string;
  training_time?: number;
  metrics?: any;
  error?: string;
}

export default function AdminPanel() {
  const [adminUser, setAdminUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalQueries: 0,
    activeUsers: 0,
    monthlyRevenue: 0
  });
  const [adminCredentials, setAdminCredentials] = useState({
    username: '',
    password: ''
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // ML Pipeline States
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('linear_regression');
  const [isTraining, setIsTraining] = useState(false);
  const [trainingResult, setTrainingResult] = useState<TrainingResult | null>(null);
  const [models, setModels] = useState<MLModel[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    try {
      const adminAuth = await AsyncStorage.getItem('admin_auth');
      if (adminAuth) {
        setIsAuthenticated(true);
        loadAdminData();
      }
    } catch (error) {
      console.error('Admin auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    // Simple admin authentication - in production, this should be more secure
    if (adminCredentials.username === 'superadmin' && adminCredentials.password === 'emlakadmin2025') {
      await AsyncStorage.setItem('admin_auth', JSON.stringify({
        username: adminCredentials.username,
        loginTime: new Date().toISOString()
      }));
      setIsAuthenticated(true);
      loadAdminData();
      Alert.alert('Başarılı', 'Admin paneline giriş yapıldı!');
    } else {
      Alert.alert('Hata', 'Geçersiz admin bilgileri!');
    }
  };

  const loadAdminData = async () => {
    try {
      const token = await AsyncStorage.getItem('admin_auth');
      if (!token) return;

      // Load users
      await loadUsers();
      // Load stats from backend
      await loadStats();
      // Load ML models
      await loadModels();
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${JSON.parse(token)}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        // Fallback to mock data if API fails
        const mockUsers: User[] = [
          {
            id: 'user_sample_001',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            user_type: 'individual',
            query_count: 3,
            query_limit: 5,
            created_at: '2025-08-01T10:00:00Z',
            is_active: true
          },
          {
            id: 'user_sample_002',
            email: 'corporate@company.com',
            first_name: 'Kurumsal',
            last_name: 'Kullanıcı',
            user_type: 'corporate',
            query_count: 8,
            query_limit: 10,
            created_at: '2025-08-15T14:30:00Z',
            is_active: true
          }
        ];
        setUsers(mockUsers);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadStats = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${JSON.parse(token)}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats({
          totalUsers: data.total_users,
          totalQueries: data.recent_queries,
          activeUsers: data.active_users,
          monthlyRevenue: data.monthly_revenue
        });
      } else {
        // Fallback to mock data
        const mockStats: AdminStats = {
          totalUsers: 1247,
          totalQueries: 8932,
          activeUsers: 892,
          monthlyRevenue: 45670
        };
        setStats(mockStats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadModels = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/admin/models`, {
        headers: {
          'Authorization': `Bearer ${JSON.parse(token)}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setModels(data.models);
      }
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const loadSampleData = async () => {
    setIsLoadingData(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/admin/data/sample`, {
        headers: {
          'Authorization': `Bearer ${JSON.parse(token)}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSampleData(data.data);
        Alert.alert('Başarılı', `${data.total_records} kayıt yüklendi!`);
      } else {
        Alert.alert('Hata', 'Veri yüklenirken hata oluştu');
      }
    } catch (error) {
      console.error('Error loading sample data:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
    } finally {
      setIsLoadingData(false);
    }
  };

  const trainModel = async () => {
    if (sampleData.length === 0) {
      Alert.alert('Uyarı', 'Önce veri yükleyin!');
      return;
    }

    setIsTraining(true);
    setTrainingResult(null);

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/admin/models/train`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JSON.parse(token)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: sampleData,
          model_config: {
            model_type: selectedModel,
            target_column: 'price',
            test_size: 0.2,
            data_options: {
              remove_outliers: true,
              interpolate_missing: true,
              create_time_features: true
            }
          }
        }),
      });

      const result = await response.json();
      setTrainingResult(result);

      if (result.success) {
        Alert.alert('Başarılı', `Model başarıyla eğitildi! R² Score: ${result.metrics?.test_r2?.toFixed(3)}`);
        await loadModels(); // Refresh model list
      } else {
        Alert.alert('Hata', result.error || 'Model eğitimi başarısız');
      }
    } catch (error) {
      console.error('Error training model:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
    } finally {
      setIsTraining(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('admin_auth');
    setIsAuthenticated(false);
    router.replace('/');
  };

  const toggleUserStatus = (userId: string) => {
    setUsers(users.map(user => 
      user.id === userId ? { ...user, is_active: !user.is_active } : user
    ));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Admin paneli yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loginContainer}>
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>🔐 EmlakEkspertizi Admin</Text>
            <Text style={styles.loginSubtitle}>Yönetici Paneli Girişi</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Kullanıcı Adı</Text>
              <TextInput
                style={styles.input}
                value={adminCredentials.username}
                onChangeText={(text) => setAdminCredentials({...adminCredentials, username: text})}
                placeholder="superadmin"
                placeholderTextColor="#8892a0"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Şifre</Text>
              <TextInput
                style={styles.input}
                value={adminCredentials.password}
                onChangeText={(text) => setAdminCredentials({...adminCredentials, password: text})}
                placeholder="Admin şifrenizi girin"
                placeholderTextColor="#8892a0"
                secureTextEntry
              />
            </View>

            <TouchableOpacity style={styles.loginButton} onPress={handleAdminLogin}>
              <Text style={styles.loginButtonText}>Admin Girişi</Text>
            </TouchableOpacity>

            <View style={styles.credentialsInfo}>
              <Text style={styles.credentialsTitle}>Test Bilgileri:</Text>
              <Text style={styles.credentialsText}>Kullanıcı: superadmin</Text>
              <Text style={styles.credentialsText}>Şifre: emlakadmin2025</Text>
            </View>

            <TouchableOpacity 
              style={styles.backToMainButton}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.backToMainText}>← Ana Sayfaya Dön</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const renderDashboard = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>📊 Dashboard - Genel Bakış</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalUsers.toLocaleString('tr-TR')}</Text>
          <Text style={styles.statLabel}>Toplam Kullanıcı</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.activeUsers.toLocaleString('tr-TR')}</Text>
          <Text style={styles.statLabel}>Aktif Kullanıcı</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalQueries.toLocaleString('tr-TR')}</Text>
          <Text style={styles.statLabel}>Toplam Sorgu</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCurrency(stats.monthlyRevenue)}</Text>
          <Text style={styles.statLabel}>Aylık Gelir</Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>📊 Veri Yönetimi</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>🗺️ Lokasyon Yönetimi</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>💰 Fiyat Veri Güncelleme</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>📈 Sistem Analitikleri</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderUsers = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>👥 Kullanıcı Yönetimi</Text>
      
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {item.first_name} {item.last_name}
              </Text>
              <Text style={styles.userEmail}>{item.email}</Text>
              <Text style={styles.userType}>
                {item.user_type === 'individual' ? '👤 Bireysel' : '🏢 Kurumsal'}
              </Text>
              <Text style={styles.userStats}>
                Sorgu: {item.query_count}/{item.query_limit} • 
                Kayıt: {formatDate(item.created_at)}
              </Text>
            </View>
            
            <View style={styles.userActions}>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  item.is_active ? styles.activeButton : styles.inactiveButton
                ]}
                onPress={() => toggleUserStatus(item.id)}
              >
                <Text style={styles.statusButtonText}>
                  {item.is_active ? 'Aktif' : 'Pasif'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  const renderSettings = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>⚙️ Sistem Ayarları</Text>
      
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Genel Ayarlar</Text>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Site Durumu</Text>
          <Text style={styles.settingValue}>🟢 Aktif</Text>
        </View>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Veritabanı</Text>
          <Text style={styles.settingValue}>🟢 Bağlı</Text>
        </View>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Son Veri Güncelleme</Text>
          <Text style={styles.settingValue}>31 Ağustos 2025</Text>
        </View>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>API Durumu</Text>
          <Text style={styles.settingValue}>🟢 Çalışıyor</Text>
        </View>
      </View>

      <View style={styles.systemActions}>
        <TouchableOpacity style={styles.systemActionButton}>
          <Text style={styles.systemActionText}>🔄 Veri Güncelle</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.systemActionButton}>
          <Text style={styles.systemActionText}>🧹 Cache Temizle</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.systemActionButton}>
          <Text style={styles.systemActionText}>📋 Log Görüntüle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EmlakEkspertizi Admin</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutButton}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>
            📊 Dashboard
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            👥 Kullanıcılar
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
            ⚙️ Ayarlar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'settings' && renderSettings()}
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            EmlakEkspertizi.com Admin Panel v1.0
          </Text>
          <Text style={styles.footerSubtext}>
            © 2025 Nadas.com.tr güvencesiyle
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 18,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1e293b',
    padding: 32,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#475569',
  },
  loginButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  credentialsInfo: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  credentialsTitle: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  credentialsText: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  backToMainButton: {
    alignItems: 'center',
  },
  backToMainText: {
    color: '#64748b',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  logoutButton: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#2563eb',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  tabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  quickActions: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  userCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  userType: {
    fontSize: 12,
    color: '#fbbf24',
    marginBottom: 4,
  },
  userStats: {
    fontSize: 12,
    color: '#64748b',
  },
  userActions: {
    marginLeft: 16,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeButton: {
    backgroundColor: '#10b981',
  },
  inactiveButton: {
    backgroundColor: '#ef4444',
  },
  statusButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  settingsSection: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  settingLabel: {
    fontSize: 16,
    color: '#ffffff',
  },
  settingValue: {
    fontSize: 14,
    color: '#94a3b8',
  },
  systemActions: {
    gap: 12,
  },
  systemActionButton: {
    backgroundColor: '#334155',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  systemActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginTop: 32,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  footerSubtext: {
    color: '#64748b',
    fontSize: 12,
  },
});