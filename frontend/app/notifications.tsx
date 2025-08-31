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
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface PriceAlert {
  id: string;
  locationId: string;
  locationName: string;
  targetPrice: number;
  currentPrice: number;
  alertType: 'above' | 'below';
  isActive: boolean;
  createdAt: Date;
}

export default function Notifications() {
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  
  // Create Alert Form State
  const [selectedLocationName, setSelectedLocationName] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [alertType, setAlertType] = useState<'above' | 'below'>('below');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      await loadUser();
      await loadPriceAlerts();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        const response = await fetch(`${EXPO_BACKEND_URL}/api/user/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadPriceAlerts = async () => {
    try {
      const savedAlerts = await AsyncStorage.getItem('price_alerts');
      if (savedAlerts) {
        setPriceAlerts(JSON.parse(savedAlerts));
      }
    } catch (error) {
      console.error('Error loading price alerts:', error);
    }
  };

  const savePriceAlerts = async (alerts: PriceAlert[]) => {
    try {
      await AsyncStorage.setItem('price_alerts', JSON.stringify(alerts));
      setPriceAlerts(alerts);
    } catch (error) {
      console.error('Error saving price alerts:', error);
    }
  };

  const createPriceAlert = async () => {
    if (!selectedLocationName || !targetPrice) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }

    const numericPrice = parseFloat(targetPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      Alert.alert('Hata', 'Geçerli bir fiyat girin.');
      return;
    }

    const newAlert: PriceAlert = {
      id: `alert_${Date.now()}`,
      locationId: `location_${selectedLocationName.replace(/\s/g, '_')}`,
      locationName: selectedLocationName,
      targetPrice: numericPrice,
      currentPrice: 0, // Will be updated from API
      alertType: alertType,
      isActive: true,
      createdAt: new Date(),
    };

    const updatedAlerts = [...priceAlerts, newAlert];
    await savePriceAlerts(updatedAlerts);
    
    setShowCreateAlert(false);
    setSelectedLocationName('');
    setTargetPrice('');
    
    Alert.alert('Başarılı', 'Fiyat alarmı oluşturuldu!');
  };

  const toggleAlert = async (alertId: string) => {
    const updatedAlerts = priceAlerts.map(alert =>
      alert.id === alertId ? { ...alert, isActive: !alert.isActive } : alert
    );
    await savePriceAlerts(updatedAlerts);
  };

  const deleteAlert = async (alertId: string) => {
    Alert.alert(
      'Alarmı Sil',
      'Bu fiyat alarmını silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const updatedAlerts = priceAlerts.filter(alert => alert.id !== alertId);
            await savePriceAlerts(updatedAlerts);
          },
        },
      ]
    );
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getAlertStatusText = (alert: PriceAlert) => {
    if (!alert.isActive) return 'Pasif';
    
    if (alert.currentPrice === 0) return 'Veri bekleniyor...';
    
    if (alert.alertType === 'below') {
      return alert.currentPrice <= alert.targetPrice 
        ? '🔥 Hedef fiyata ulaştı!' 
        : `📈 ${formatPrice(alert.currentPrice)} (${formatPrice(alert.targetPrice)} altını bekliyor)`;
    } else {
      return alert.currentPrice >= alert.targetPrice 
        ? '🚀 Hedef fiyat aşıldı!' 
        : `📊 ${formatPrice(alert.currentPrice)} (${formatPrice(alert.targetPrice)} üstünü bekliyor)`;
    }
  };

  const getAlertColor = (alert: PriceAlert) => {
    if (!alert.isActive) return '#6b7280';
    
    if (alert.currentPrice === 0) return '#8892a0';
    
    if (alert.alertType === 'below') {
      return alert.currentPrice <= alert.targetPrice ? '#22c55e' : '#f97316';
    } else {
      return alert.currentPrice >= alert.targetPrice ? '#22c55e' : '#4f9eff';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.authRequired}>
          <Text style={styles.authTitle}>Giriş Gerekli</Text>
          <Text style={styles.authSubtitle}>
            Fiyat alarmları için lütfen giriş yapın veya hesap oluşturun.
          </Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.authButtonText}>Giriş Yap</Text>
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
        <Text style={styles.title}>Fiyat Alarmları</Text>
        <TouchableOpacity onPress={() => setShowCreateAlert(true)}>
          <Text style={styles.addButton}>+ Ekle</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userTitle}>
            Merhaba {user.first_name}! 👋
          </Text>
          <Text style={styles.userSubtitle}>
            {priceAlerts.length} aktif alarm • {priceAlerts.filter(a => a.isActive).length} çalışıyor
          </Text>
        </View>

        {/* Notification Settings */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>Bildirim Ayarları</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Push Bildirimleri</Text>
            <Switch
              value={true}
              onValueChange={() => {}}
              trackColor={{ false: '#374151', true: '#4f9eff' }}
              thumbColor="#fff"
            />
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>E-posta Bildirimleri</Text>
            <Switch
              value={false}
              onValueChange={() => {}}
              trackColor={{ false: '#374151', true: '#4f9eff' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Price Alerts */}
        <View style={styles.alertsSection}>
          <Text style={styles.sectionTitle}>Fiyat Alarmları</Text>
          
          {priceAlerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>Henüz alarm yok</Text>
              <Text style={styles.emptySubtitle}>
                İlgilendiğiniz bölgeler için fiyat alarmı oluşturun
              </Text>
              <TouchableOpacity
                style={styles.createFirstAlarmButton}
                onPress={() => setShowCreateAlert(true)}
              >
                <Text style={styles.createFirstAlarmText}>İlk Alarmı Oluştur</Text>
              </TouchableOpacity>
            </View>
          ) : (
            priceAlerts.map((alert) => (
              <View key={alert.id} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertLocation}>{alert.locationName}</Text>
                    <Text style={[styles.alertStatus, { color: getAlertColor(alert) }]}>
                      {getAlertStatusText(alert)}
                    </Text>
                  </View>
                  <Switch
                    value={alert.isActive}
                    onValueChange={() => toggleAlert(alert.id)}
                    trackColor={{ false: '#374151', true: '#4f9eff' }}
                    thumbColor="#fff"
                  />
                </View>
                
                <View style={styles.alertDetails}>
                  <Text style={styles.alertTargetPrice}>
                    Hedef: {formatPrice(alert.targetPrice)} 
                    {alert.alertType === 'below' ? ' altı' : ' üstü'}
                  </Text>
                  <Text style={styles.alertDate}>
                    Oluşturulma: {new Date(alert.createdAt).toLocaleDateString('tr-TR')}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteAlert(alert.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️ Sil</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Create Alert Modal */}
        {showCreateAlert && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Yeni Fiyat Alarmı</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Lokasyon</Text>
                <TextInput
                  style={styles.formInput}
                  value={selectedLocationName}
                  onChangeText={setSelectedLocationName}
                  placeholder="Örn: Kadıköy, Moda"
                  placeholderTextColor="#6b7280"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Hedef Fiyat (TL/m²)</Text>
                <TextInput
                  style={styles.formInput}
                  value={targetPrice}
                  onChangeText={setTargetPrice}
                  placeholder="Örn: 25000"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Alarm Türü</Text>
                <View style={styles.alertTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.alertTypeButton,
                      alertType === 'below' && styles.activeAlertType
                    ]}
                    onPress={() => setAlertType('below')}
                  >
                    <Text style={[
                      styles.alertTypeText,
                      alertType === 'below' && styles.activeAlertTypeText
                    ]}>
                      📉 Fiyat Düştüğünde
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.alertTypeButton,
                      alertType === 'above' && styles.activeAlertType
                    ]}
                    onPress={() => setAlertType('above')}
                  >
                    <Text style={[
                      styles.alertTypeText,
                      alertType === 'above' && styles.activeAlertTypeText
                    ]}>
                      📈 Fiyat Yükseldiğinde
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowCreateAlert(false)}
                >
                  <Text style={styles.cancelButtonText}>İptal</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={createPriceAlert}
                >
                  <Text style={styles.createButtonText}>Oluştur</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  authRequired: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  authTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  authSubtitle: {
    color: '#8892a0',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  authButton: {
    backgroundColor: '#4f9eff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a2332',
  },
  backButton: {
    color: '#4f9eff',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addButton: {
    color: '#4f9eff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  userInfo: {
    padding: 16,
    backgroundColor: '#1a2332',
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  userTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userSubtitle: {
    color: '#8892a0',
    fontSize: 14,
  },
  settingsCard: {
    backgroundColor: '#1a2332',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  settingsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabel: {
    color: '#8892a0',
    fontSize: 16,
  },
  alertsSection: {
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8892a0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  createFirstAlarmButton: {
    backgroundColor: '#4f9eff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createFirstAlarmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  alertCard: {
    backgroundColor: '#1a2332',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  alertInfo: {
    flex: 1,
    marginRight: 16,
  },
  alertLocation: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  alertStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  alertDetails: {
    marginBottom: 12,
  },
  alertTargetPrice: {
    color: '#8892a0',
    fontSize: 14,
    marginBottom: 4,
  },
  alertDate: {
    color: '#6b7280',
    fontSize: 12,
  },
  deleteButton: {
    alignSelf: 'flex-start',
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 14,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#1a2332',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#2d3748',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
  },
  alertTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  alertTypeButton: {
    flex: 1,
    backgroundColor: '#2d3748',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeAlertType: {
    backgroundColor: '#4f9eff',
  },
  alertTypeText: {
    color: '#8892a0',
    fontSize: 14,
    fontWeight: '500',
  },
  activeAlertTypeText: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#4f9eff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});