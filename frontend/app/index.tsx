import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
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
  user_type: 'guest' | 'individual' | 'corporate';
  query_limit: number;
  query_count: number;
}

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [guestQueryCount, setGuestQueryCount] = useState(0);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const guestCount = await AsyncStorage.getItem('guest_query_count');
      
      if (guestCount) {
        setGuestQueryCount(parseInt(guestCount, 10));
      }

      if (token) {
        // Verify token and get user profile
        const response = await fetch(`${EXPO_BACKEND_URL}/api/user/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          // Token is invalid, remove it
          await AsyncStorage.removeItem('auth_token');
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestQuery = () => {
    if (guestQueryCount >= 3) {
      Alert.alert(
        'Sorgulama Limiti',
        'Misafir kullanıcılar en fazla 3 sorgulama yapabilir. Lütfen üye olun veya giriş yapın.',
        [
          { text: 'Tamam', style: 'default' },
          { text: 'Üye Ol', onPress: handleRegister },
        ]
      );
      return;
    }
    // Navigate to query screen
    router.push('/query');
  };

  const handleLogin = () => {
    // Navigate to login screen
    router.push('/login');
  };

  const handleRegister = () => {
    // Navigate to register screen
    router.push('/register');
  };

  const handleQuery = () => {
    if (!user) return;
    
    if (user.query_count >= user.query_limit) {
      Alert.alert(
        'Sorgulama Limiti',
        'Ücretsiz sorgulama hakkınız doldu. Paket satın alarak devam edebilirsiniz.',
        [
          { text: 'Tamam', style: 'default' },
          { text: 'Paket Satın Al', onPress: () => console.log('Navigate to packages') },
        ]
      );
      return;
    }
    
    // Navigate to protected query screen
    router.push('/query');
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('auth_token');
    setUser(null);
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Emlak Endeksi</Text>
          <Text style={styles.subtitle}>
            Türkiye'nin En Kapsamlı Emlak Fiyat Endeksi
          </Text>
        </View>

        {/* User Info */}
        {user ? (
          <View style={styles.userCard}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {user.first_name} {user.last_name}
              </Text>
              <Text style={styles.userType}>
                {user.user_type === 'individual' ? 'Bireysel Üye' : 
                 user.user_type === 'corporate' ? 'Kurumsal Üye' : 'Misafir'}
              </Text>
              <Text style={styles.queryInfo}>
                Kalan Sorgulama: {user.query_limit - user.query_count}/{user.query_limit}
              </Text>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Çıkış</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.guestCard}>
            <Text style={styles.guestText}>Misafir Kullanıcı</Text>
            <Text style={styles.guestQueryInfo}>
              Kalan Ücretsiz Sorgulama: {3 - guestQueryCount}/3
            </Text>
          </View>
        )}

        {/* Main Features */}
        <View style={styles.featuresContainer}>
          <Text style={styles.sectionTitle}>Özellikler</Text>
          
          <View style={styles.featureGrid}>
            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>🗺️</Text>
              <Text style={styles.featureTitle}>Akıllı Harita</Text>
              <Text style={styles.featureDescription}>
                Türkiye özel harita sistemi ile fiyat görselleştirme
              </Text>
              <TouchableOpacity 
                style={styles.featureButton}
                onPress={() => router.push('/map')}
              >
                <Text style={styles.featureButtonText}>Haritayı Aç</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>📊</Text>
              <Text style={styles.featureTitle}>Fiyat Endeksi</Text>
              <Text style={styles.featureDescription}>
                2005-2025 arası mahalle bazında aylık fiyat trendleri
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>👥</Text>
              <Text style={styles.featureTitle}>Demografik Analiz</Text>
              <Text style={styles.featureDescription}>
                Mahalle bazında nüfus ve sosyo-ekonomik veriler
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>📈</Text>
              <Text style={styles.featureTitle}>Karşılaştırma</Text>
              <Text style={styles.featureDescription}>
                Farklı bölgeleri karşılaştırın
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {user ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handleQuery}>
              <Text style={styles.primaryButtonText}>Sorgulama Yap</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={handleGuestQuery}>
                <Text style={styles.primaryButtonText}>Misafir Sorgulama</Text>
              </TouchableOpacity>
              
              <View style={styles.authButtons}>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleLogin}>
                  <Text style={styles.secondaryButtonText}>Giriş Yap</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.secondaryButton} onPress={handleRegister}>
                  <Text style={styles.secondaryButtonText}>Üye Ol</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Neden Emlak Endeksi?</Text>
          <Text style={styles.infoText}>
            • 20 yıllık kapsamlı veri arşivi{'\n'}
            • Türkiye'nin tüm il, ilçe ve mahallelerini kapsayan analiz{'\n'}
            • Gerçek zamanlı piyasa verileri{'\n'}
            • Profesyonel demografik analiz araçları{'\n'}
            • Yatırım kararlarınız için güvenilir kaynak
          </Text>
        </View>
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
    fontSize: 18,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#1a2332',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8892a0',
    textAlign: 'center',
  },
  userCard: {
    backgroundColor: '#1a2332',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userType: {
    fontSize: 14,
    color: '#4f9eff',
    marginBottom: 4,
  },
  queryInfo: {
    fontSize: 12,
    color: '#8892a0',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  guestCard: {
    backgroundColor: '#1a2332',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  guestText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 8,
  },
  guestQueryInfo: {
    fontSize: 14,
    color: '#8892a0',
  },
  featuresContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    backgroundColor: '#1a2332',
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    color: '#8892a0',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 8,
  },
  featureButton: {
    backgroundColor: '#4f9eff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  featureButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  actionContainer: {
    padding: 16,
  },
  primaryButton: {
    backgroundColor: '#4f9eff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  authButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButton: {
    backgroundColor: '#2d3748',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    padding: 16,
    backgroundColor: '#1a2332',
    margin: 16,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#8892a0',
    lineHeight: 20,
  },
});