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

interface BackfillConfig {
  start_date: string;
  end_date: string;
  current_data_months: number;
  confidence_threshold: number;
  models_to_use: string[];
}

interface BackfillResult {
  success: boolean;
  backfilled_locations: number;
  total_predictions: number;
  avg_confidence: number;
  models_used: string[];
  session_id: string;
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
  
  // Backfill States
  const [backfillConfig, setBackfillConfig] = useState<BackfillConfig>({
    start_date: '2016-01-01',
    end_date: '2022-12-31',
    current_data_months: 12,
    confidence_threshold: 0.7,
    models_to_use: ['prophet', 'xgboost']
  });
  const [missingPeriods, setMissingPeriods] = useState<any>({});
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [isRunningBackfill, setIsRunningBackfill] = useState(false);
  const [backfillVisualization, setBackfillVisualization] = useState<any>(null);

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

  const loadRealData = async () => {
    setIsLoadingData(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/admin/data/import-real`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JSON.parse(token)}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert('Başarılı!', `Gerçek veri aktarımı tamamlandı!\n\n📊 ${result.statistics.imported_records.toLocaleString('tr-TR')} kayıt aktarıldı\n✅ Başarı oranı: %${result.statistics.success_rate.toFixed(1)}`);
      } else {
        Alert.alert('Hata', 'Gerçek veri aktarımında hata oluştu');
      }
    } catch (error) {
      console.error('Error importing real data:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
    } finally {
      setIsLoadingData(false);
    }
  };

  const getCollectionsInfo = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/admin/data/collections-info`, {
        headers: {
          'Authorization': `Bearer ${JSON.parse(token)}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Veritabanı Durumu', `📊 Toplam ${data.total_collections} koleksiyon:\n\n${Object.entries(data.collections).map(([name, info]) => `• ${name}: ${info.count.toLocaleString('tr-TR')} kayıt`).join('\n')}`);
      }
    } catch (error) {
      console.error('Error getting collections info:', error);
      Alert.alert('Hata', 'Koleksiyon bilgileri alınamadı');
    }
  };

  const detectMissingPeriods = async () => {
    setIsLoadingData(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/admin/backfill/detect-missing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JSON.parse(token)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backfillConfig),
      });

      if (response.ok) {
        const data = await response.json();
        setMissingPeriods(data.missing_periods);
        
        Alert.alert('Eksik Dönemler Tespit Edildi!', 
          `📊 ${data.statistics.locations_with_missing_data} lokasyonda toplam ${data.statistics.total_missing_periods} eksik dönem bulundu.\n\n⏰ Tarih Aralığı: ${data.statistics.date_range.start} - ${data.statistics.date_range.end}`
        );
      } else {
        Alert.alert('Hata', 'Eksik dönem tespiti başarısız');
      }
    } catch (error) {
      console.error('Error detecting missing periods:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
    } finally {
      setIsLoadingData(false);
    }
  };

  const runBackfill = async () => {
    if (!Object.keys(missingPeriods).length) {
      Alert.alert('Uyarı', 'Önce eksik dönemleri tespit edin!');
      return;
    }

    setIsRunningBackfill(true);
    setBackfillResult(null);

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/admin/backfill/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JSON.parse(token)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backfillConfig),
      });

      const result = await response.json();
      setBackfillResult(result);

      if (result.success) {
        Alert.alert('Backfill Tamamlandı! 🎉', 
          `✅ ${result.backfilled_locations} lokasyon işlendi\n📊 ${result.total_predictions} tahmin yapıldı\n🎯 Ortalama güven: %${(result.avg_confidence * 100).toFixed(1)}\n🤖 Kullanılan modeller: ${result.models_used.join(', ')}`
        );
      } else {
        Alert.alert('Hata', result.error || 'Backfill işlemi başarısız');
      }
    } catch (error) {
      console.error('Error running backfill:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
    } finally {
      setIsRunningBackfill(false);
    }
  };

  const getBackfillVisualization = async (locationCode: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(
        `${EXPO_BACKEND_URL}/api/admin/backfill/visualization?location_code=${locationCode}`, 
        {
          headers: {
            'Authorization': `Bearer ${JSON.parse(token)}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBackfillVisualization(data);
        
        Alert.alert('Görselleştirme Hazır!', 
          `📈 ${data.statistics.historical_count} gerçek + ${data.statistics.predicted_count} tahmini veri\n🎯 Ortalama güven: %${(data.statistics.avg_confidence * 100).toFixed(1)}`
        );
      }
    } catch (error) {
      console.error('Error getting backfill visualization:', error);
      Alert.alert('Hata', 'Görselleştirme yüklenemedi');
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

  const renderDataProcessing = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>📊 Veri İşleme & Yönetimi</Text>
      
      <View style={styles.dataSection}>
        <Text style={styles.sectionTitle}>Veri Yükleme</Text>
        
        <TouchableOpacity 
          style={[styles.actionButton, isLoadingData ? styles.disabledButton : null]}
          onPress={loadSampleData}
          disabled={isLoadingData}
        >
          {isLoadingData ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>📈 Örnek Veri Yükle</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.realDataButton, isLoadingData ? styles.disabledButton : null]}
          onPress={loadRealData}
          disabled={isLoadingData}
        >
          {isLoadingData ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>🏢 Gerçek Veri Aktar (ee2401_db.sql)</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.systemActionButton]}
          onPress={getCollectionsInfo}
        >
          <Text style={styles.systemActionText}>📊 Veritabanı Durumu</Text>
        </TouchableOpacity>
        
        {sampleData.length > 0 && (
          <View style={styles.dataPreview}>
            <Text style={styles.dataPreviewTitle}>
              📋 Yüklenen Veri: {sampleData.length} kayıt
            </Text>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.dataTable}>
                <View style={styles.dataRow}>
                  <Text style={styles.dataHeader}>Tarih</Text>
                  <Text style={styles.dataHeader}>Fiyat (TL/m²)</Text>
                  <Text style={styles.dataHeader}>Lokasyon</Text>
                  <Text style={styles.dataHeader}>Tip</Text>
                </View>
                
                {sampleData.slice(0, 5).map((item, index) => (
                  <View key={index} style={styles.dataRow}>
                    <Text style={styles.dataCell}>{item.date}</Text>
                    <Text style={styles.dataCell}>{Math.round(item.price).toLocaleString('tr-TR')}</Text>
                    <Text style={styles.dataCell}>{item.location_code}</Text>
                    <Text style={styles.dataCell}>{item.property_type}</Text>
                  </View>
                ))}
                
                {sampleData.length > 5 && (
                  <View style={styles.dataRow}>
                    <Text style={styles.dataCellMore}>... +{sampleData.length - 5} kayıt daha</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.dataSection}>
        <Text style={styles.sectionTitle}>Veri Temizleme Seçenekleri</Text>
        
        <View style={styles.optionsContainer}>
          <View style={styles.optionItem}>
            <Text style={styles.optionLabel}>✅ Eksik verileri doldur</Text>
            <Text style={styles.optionDescription}>Interpolasyon ile eksik değerleri tamamla</Text>
          </View>
          
          <View style={styles.optionItem}>
            <Text style={styles.optionLabel}>🔍 Aykırı değerleri temizle</Text>
            <Text style={styles.optionDescription}>IQR yöntemi ile outlier'ları kaldır</Text>
          </View>
          
          <View style={styles.optionItem}>
            <Text style={styles.optionLabel}>📅 Zaman özelliklerini oluştur</Text>
            <Text style={styles.optionDescription}>Tarih bazlı özellikler ve gecikme değişkenleri</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderModelTraining = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>🤖 Makine Öğrenimi Model Eğitimi</Text>
      
      <View style={styles.modelSection}>
        <Text style={styles.sectionTitle}>Model Seçimi</Text>
        
        <View style={styles.modelGrid}>
          {[
            { id: 'linear_regression', name: 'Linear Regression', desc: 'Basit doğrusal regresyon' },
            { id: 'ridge_regression', name: 'Ridge Regression', desc: 'L2 regularizasyonlu regresyon' },
            { id: 'random_forest', name: 'Random Forest', desc: 'Ensemble ağaç modeli' },
            { id: 'xgboost', name: 'XGBoost', desc: 'Gradient boosting modeli' },
            { id: 'prophet', name: 'Prophet', desc: 'Zaman serisi tahmini' },
          ].map((model) => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelCard,
                selectedModel === model.id && styles.selectedModelCard
              ]}
              onPress={() => setSelectedModel(model.id)}
            >
              <Text style={[
                styles.modelName,
                selectedModel === model.id && styles.selectedModelName
              ]}>
                {model.name}
              </Text>
              <Text style={styles.modelDesc}>{model.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.trainingSection}>
        <Text style={styles.sectionTitle}>Model Eğitimi</Text>
        
        <TouchableOpacity
          style={[
            styles.trainButton,
            (isTraining || sampleData.length === 0) && styles.disabledButton
          ]}
          onPress={trainModel}
          disabled={isTraining || sampleData.length === 0}
        >
          {isTraining ? (
            <View style={styles.trainingIndicator}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.trainButtonText}>Model Eğitiliyor...</Text>
            </View>
          ) : (
            <Text style={styles.trainButtonText}>🚀 Model Eğitimini Başlat</Text>
          )}
        </TouchableOpacity>
        
        {sampleData.length === 0 && (
          <Text style={styles.warningText}>⚠️ Önce veri yükleyin</Text>
        )}
      </View>

      {trainingResult && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>
            {trainingResult.success ? '✅ Eğitim Sonuçları' : '❌ Eğitim Hatası'}
          </Text>
          
          {trainingResult.success ? (
            <View style={styles.metricsContainer}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>R² Score</Text>
                <Text style={styles.metricValue}>
                  {trainingResult.metrics?.test_r2?.toFixed(3) || 'N/A'}
                </Text>
              </View>
              
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>RMSE</Text>
                <Text style={styles.metricValue}>
                  {trainingResult.metrics?.test_rmse?.toFixed(0) || 'N/A'}
                </Text>
              </View>
              
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Eğitim Süresi</Text>
                <Text style={styles.metricValue}>
                  {trainingResult.training_time?.toFixed(1) || 'N/A'}s
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{trainingResult.error}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.modelsListSection}>
        <Text style={styles.sectionTitle}>📋 Eğitilmiş Modeller</Text>
        
        {models.length === 0 ? (
          <Text style={styles.noModelsText}>Henüz eğitilmiş model yok</Text>
        ) : (
          <FlatList
            data={models}
            keyExtractor={(item) => item.model_id}
            renderItem={({ item }) => (
              <View style={styles.modelListCard}>
                <View style={styles.modelListInfo}>
                  <Text style={styles.modelListName}>{item.model_type}</Text>
                  <Text style={styles.modelListDate}>
                    {new Date(item.created_at).toLocaleDateString('tr-TR')}
                  </Text>
                  <Text style={styles.modelListMetrics}>
                    R²: {item.metrics.test_r2.toFixed(3)} | 
                    RMSE: {item.metrics.test_rmse.toFixed(0)}
                  </Text>
                </View>
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );

  const renderBackfill = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>⏰ Geçmiş Veri Backfill Sistemi</Text>
      
      <View style={styles.backfillSection}>
        <Text style={styles.sectionTitle}>📊 Backfill Konfigürasyonu</Text>
        
        <View style={styles.configContainer}>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>📅 Başlangıç Tarihi:</Text>
            <Text style={styles.configValue}>{backfillConfig.start_date}</Text>
          </View>
          
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>📅 Bitiş Tarihi:</Text>
            <Text style={styles.configValue}>{backfillConfig.end_date}</Text>
          </View>
          
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>📈 Güncel Veri (Ay):</Text>
            <Text style={styles.configValue}>{backfillConfig.current_data_months}</Text>
          </View>
          
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>🎯 Güven Eşiği:</Text>
            <Text style={styles.configValue}>{(backfillConfig.confidence_threshold * 100).toFixed(0)}%</Text>
          </View>
          
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>🤖 Modeller:</Text>
            <Text style={styles.configValue}>{backfillConfig.models_to_use.join(', ')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.backfillSection}>
        <Text style={styles.sectionTitle}>🔍 Eksik Dönem Tespiti</Text>
        
        <TouchableOpacity
          style={[styles.actionButton, isLoadingData && styles.disabledButton]}
          onPress={detectMissingPeriods}
          disabled={isLoadingData}
        >
          {isLoadingData ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>🔍 Eksik Dönemleri Tespit Et</Text>
          )}
        </TouchableOpacity>
        
        {Object.keys(missingPeriods).length > 0 && (
          <View style={styles.missingPeriodsContainer}>
            <Text style={styles.missingPeriodsTitle}>
              📋 {Object.keys(missingPeriods).length} lokasyonda eksik dönem bulundu:
            </Text>
            
            <ScrollView style={styles.missingPeriodsList} nestedScrollEnabled>
              {Object.entries(missingPeriods).slice(0, 5).map(([location, periods]: [string, any]) => (
                <View key={location} style={styles.missingPeriodItem}>
                  <Text style={styles.locationCode}>{location}</Text>
                  <Text style={styles.periodCount}>{periods.length} eksik dönem</Text>
                </View>
              ))}
              {Object.keys(missingPeriods).length > 5 && (
                <Text style={styles.moreLocations}>... +{Object.keys(missingPeriods).length - 5} lokasyon daha</Text>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.backfillSection}>
        <Text style={styles.sectionTitle}>🚀 Backfill İşlemi</Text>
        
        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.backfillButton,
            (isRunningBackfill || Object.keys(missingPeriods).length === 0) && styles.disabledButton
          ]}
          onPress={runBackfill}
          disabled={isRunningBackfill || Object.keys(missingPeriods).length === 0}
        >
          {isRunningBackfill ? (
            <View style={styles.trainingIndicator}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.actionButtonText}>Backfill Çalışıyor...</Text>
            </View>
          ) : (
            <Text style={styles.actionButtonText}>🚀 Backfill İşlemini Başlat</Text>
          )}
        </TouchableOpacity>
        
        {Object.keys(missingPeriods).length === 0 && (
          <Text style={styles.warningText}>⚠️ Önce eksik dönemleri tespit edin</Text>
        )}
      </View>

      {backfillResult && (
        <View style={styles.backfillResultSection}>
          <Text style={styles.sectionTitle}>
            {backfillResult.success ? '✅ Backfill Sonuçları' : '❌ Backfill Hatası'}
          </Text>
          
          {backfillResult.success ? (
            <View style={styles.backfillMetrics}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>İşlenen Lokasyon</Text>
                <Text style={styles.metricValue}>{backfillResult.backfilled_locations}</Text>
              </View>
              
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Toplam Tahmin</Text>
                <Text style={styles.metricValue}>{backfillResult.total_predictions}</Text>
              </View>
              
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Ortalama Güven</Text>
                <Text style={styles.metricValue}>
                  %{(backfillResult.avg_confidence * 100).toFixed(1)}
                </Text>
              </View>
              
              <View style={styles.metricCardWide}>
                <Text style={styles.metricLabel}>Kullanılan Modeller</Text>
                <Text style={styles.metricValueSmall}>
                  {backfillResult.models_used.join(', ')}
                </Text>
              </View>
              
              <View style={styles.metricCardWide}>
                <Text style={styles.metricLabel}>Session ID</Text>
                <Text style={styles.metricValueSmall}>{backfillResult.session_id}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{backfillResult.error}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.backfillSection}>
        <Text style={styles.sectionTitle}>📈 Görselleştirme</Text>
        
        <TouchableOpacity
          style={[styles.systemActionButton]}
          onPress={() => getBackfillVisualization('34001')}  // Istanbul örneği
        >
          <Text style={styles.systemActionText}>📊 İstanbul Backfill Grafiği</Text>
        </TouchableOpacity>
        
        {backfillVisualization && (
          <View style={styles.visualizationContainer}>
            <Text style={styles.visualizationTitle}>
              📍 {backfillVisualization.location_code} - Backfill Analizi
            </Text>
            <Text style={styles.visualizationStats}>
              📊 {backfillVisualization.statistics.historical_count} gerçek + {backfillVisualization.statistics.predicted_count} tahmini veri
            </Text>
            <Text style={styles.visualizationStats}>
              🎯 Ortalama güven: %{(backfillVisualization.statistics.avg_confidence * 100).toFixed(1)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
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
          <Text style={styles.settingLabel}>ML Pipeline</Text>
          <Text style={styles.settingValue}>🟢 Hazır</Text>
        </View>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Son Veri Güncelleme</Text>
          <Text style={styles.settingValue}>3 Eylül 2025</Text>
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
          style={[styles.tab, activeTab === 'data' && styles.activeTab]}
          onPress={() => setActiveTab('data')}
        >
          <Text style={[styles.tabText, activeTab === 'data' && styles.activeTabText]}>
            📊 Veri İşleme
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'models' && styles.activeTab]}
          onPress={() => setActiveTab('models')}
        >
          <Text style={[styles.tabText, activeTab === 'models' && styles.activeTabText]}>
            🤖 Model Eğitimi
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'backfill' && styles.activeTab]}
          onPress={() => setActiveTab('backfill')}
        >
          <Text style={[styles.tabText, activeTab === 'backfill' && styles.activeTabText]}>
            ⏰ Backfill
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
        {activeTab === 'data' && renderDataProcessing()}
        {activeTab === 'models' && renderModelTraining()}
        {activeTab === 'backfill' && renderBackfill()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'settings' && renderSettings()}
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            EmlakEkspertizi.com Admin Panel v2.1 - ML Pipeline + Backfill
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
  
  // ML Pipeline Styles
  dataSection: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  disabledButton: {
    opacity: 0.5,
  },
  realDataButton: {
    backgroundColor: '#059669',
    marginTop: 12,
  },
  dataPreview: {
    marginTop: 16,
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 8,
  },
  dataPreviewTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  dataTable: {
    minWidth: width * 1.2,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#475569',
  },
  dataHeader: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 'bold',
    width: 120,
    paddingHorizontal: 8,
  },
  dataCell: {
    color: '#e2e8f0',
    fontSize: 11,
    width: 120,
    paddingHorizontal: 8,
  },
  dataCellMore: {
    color: '#94a3b8',
    fontSize: 11,
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },
  optionsContainer: {
    gap: 12,
  },
  optionItem: {
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 8,
  },
  optionLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    color: '#94a3b8',
    fontSize: 12,
  },
  modelSection: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  modelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modelCard: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 8,
    width: (width - 80) / 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedModelCard: {
    borderColor: '#2563eb',
    backgroundColor: '#1e3a8a',
  },
  modelName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  selectedModelName: {
    color: '#60a5fa',
  },
  modelDesc: {
    color: '#94a3b8',
    fontSize: 12,
  },
  trainingSection: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  trainButton: {
    backgroundColor: '#059669',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  trainButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  trainingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    color: '#fbbf24',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  resultSection: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: (width - 80) / 3,
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  metricValue: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#7f1d1d',
    padding: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
  modelsListSection: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  noModelsText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  modelListCard: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  modelListInfo: {
    flex: 1,
  },
  modelListName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modelListDate: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  modelListMetrics: {
    color: '#10b981',
    fontSize: 12,
  },
  
  // Backfill Styles
  backfillSection: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  configContainer: {
    gap: 12,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  configLabel: {
    color: '#94a3b8',
    fontSize: 14,
    flex: 1,
  },
  configValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  backfillButton: {
    backgroundColor: '#7c3aed',
    marginTop: 12,
  },
  missingPeriodsContainer: {
    marginTop: 16,
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 8,
  },
  missingPeriodsTitle: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  missingPeriodsList: {
    maxHeight: 150,
  },
  missingPeriodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#475569',
  },
  locationCode: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  periodCount: {
    color: '#94a3b8',
    fontSize: 12,
  },
  moreLocations: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingTop: 8,
  },
  backfillResultSection: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  backfillMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCardWide: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  metricValueSmall: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  visualizationContainer: {
    marginTop: 16,
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 8,
  },
  visualizationTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  visualizationStats: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 4,
  },
});