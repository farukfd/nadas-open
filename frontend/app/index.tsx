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
  TextInput,
  FlatList,
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
  phone_verified: boolean;
}

interface SearchResult {
  id: string;
  il: string;
  ilce: string;
  mahalle: string;
  full_address: string;
}

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [guestQueryCount, setGuestQueryCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

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
        try {
          // Add timeout to fetch request
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          const response = await fetch(`${EXPO_BACKEND_URL}/api/user/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            // Token is invalid, remove it
            await AsyncStorage.removeItem('auth_token');
          }
        } catch (fetchError) {
          console.log('Auth check failed:', fetchError);
          // Remove invalid token on network error
          await AsyncStorage.removeItem('auth_token');
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      // Always set loading to false
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      // Bu kısmı gerçek API ile değiştireceğiz
      const mockResults: SearchResult[] = [
        { id: '1', il: 'İstanbul', ilce: 'Arnavutköy', mahalle: 'Hadımköy', full_address: 'İstanbul, Arnavutköy, Hadımköy' },
        { id: '2', il: 'İstanbul', ilce: 'Kadıköy', mahalle: 'Moda', full_address: 'İstanbul, Kadıköy, Moda' },
        { id: '3', il: 'Ankara', ilce: 'Çankaya', mahalle: 'Kavaklıdere', full_address: 'Ankara, Çankaya, Kavaklıdere' },
        { id: '4', il: 'İzmir', ilce: 'Konak', mahalle: 'Alsancak', full_address: 'İzmir, Konak, Alsancak' },
      ].filter(result => 
        result.full_address.toLowerCase().includes(query.toLowerCase())
      );

      setSearchResults(mockResults);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultSelect = (result: SearchResult) => {
    setSearchQuery(result.full_address);
    setShowResults(false);
    // Navigate to detail page
    router.push(`/detail/${result.id}`);
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const handleRegister = () => {
    router.push('/register');
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
          <View style={styles.headerContent}>
            <Text style={styles.logo}>EmlakEkspertizi</Text>
            <Text style={styles.logoSubtitle}>Profesyonel Emlak Değerleme</Text>
          </View>
          
          {user ? (
            <TouchableOpacity 
              style={styles.userMenu}
              onPress={() => router.push('/profile')}
            >
              <Text style={styles.userMenuText}>{user.first_name}</Text>
              <Text style={styles.userMenuSubtext}>Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.authButtons}>
              <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                <Text style={styles.loginButtonText}>Giriş</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
                <Text style={styles.registerButtonText}>Üye Ol</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Hero Section with Background Image */}
        <View style={styles.heroSection}>
          <View style={styles.heroBackgroundImage}>
            {/* Background image will be handled via ImageBackground if needed */}
            <View style={styles.heroOverlay}>
              <View style={styles.heroContent}>
                <Text style={styles.heroStats}>81 <Text style={styles.heroStatsText}>ilde</Text></Text>
                <Text style={styles.heroTitle}>
                  Türkiye'nin Emlak{'\n'}Değerlendirme Merkezi
                </Text>

                {/* Property Type Buttons */}
                <View style={styles.propertyTypeContainer}>
                  <TouchableOpacity style={styles.propertyTypeButton}>
                    <Text style={styles.propertyTypeIcon}>🏗️</Text>
                    <Text style={styles.propertyTypeText}>Arsa</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.propertyTypeButton}>
                    <Text style={styles.propertyTypeIcon}>🏠</Text>
                    <Text style={styles.propertyTypeText}>Konut</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.propertyTypeButton}>
                    <Text style={styles.propertyTypeIcon}>🏢</Text>
                    <Text style={styles.propertyTypeText}>İşyeri</Text>
                  </TouchableOpacity>
                </View>

                {/* Google-style Search */}
                <View style={styles.searchContainer}>
                  <View style={styles.searchInputContainer}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="İl, İlçe veya Mahalle arayın... (Örn: İstanbul Arnavutköy)"
                      placeholderTextColor="rgba(255,255,255,0.7)"
                      value={searchQuery}
                      onChangeText={(text) => {
                        setSearchQuery(text);
                        handleSearch(text);
                      }}
                      autoCapitalize="words"
                    />
                    <TouchableOpacity style={styles.searchButton}>
                      <Text style={styles.searchIcon}>🔍</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Search Results */}
                  {showResults && searchResults.length > 0 && (
                    <View style={styles.searchResults}>
                      <FlatList
                        data={searchResults}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={styles.searchResultItem}
                            onPress={() => handleResultSelect(item)}
                          >
                            <Text style={styles.searchResultText}>📍 {item.full_address}</Text>
                          </TouchableOpacity>
                        )}
                        scrollEnabled={false}
                      />
                    </View>
                  )}
                </View>

                {/* Quick Stats - EmlakEkspertizi.com Style */}
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>81</Text>
                    <Text style={styles.statLabel}>İl</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>963</Text>
                    <Text style={styles.statLabel}>İlçe</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>6,120+</Text>
                    <Text style={styles.statLabel}>Veri Noktası</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>20</Text>
                    <Text style={styles.statLabel}>Yıl Arşiv</Text>
                  </View>
                </View>

                {/* Contact Button */}
                <TouchableOpacity style={styles.contactButton}>
                  <Text style={styles.contactButtonText}>📞 Bize Ulaşın</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Property Type Selection Bar */}
        <View style={styles.propertySelectionBar}>
          <Text style={styles.propertySelectionTitle}>Emlak Türü Seçin</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.propertyScrollView}>
            <TouchableOpacity style={styles.propertySelectButton}>
              <Text style={styles.propertySelectIcon}>🏗️</Text>
              <Text style={styles.propertySelectText}>Arsa</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.propertySelectButton, styles.activePropertySelect]}>
              <Text style={styles.propertySelectIcon}>🏠</Text>
              <Text style={[styles.propertySelectText, styles.activePropertySelectText]}>Konut</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.propertySelectButton}>
              <Text style={styles.propertySelectIcon}>🏢</Text>
              <Text style={styles.propertySelectText}>İşyeri</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.propertySelectButton}>
              <Text style={styles.propertySelectIcon}>🏪</Text>
              <Text style={styles.propertySelectText}>Dükkan</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.propertySelectButton}>
              <Text style={styles.propertySelectIcon}>🏭</Text>
              <Text style={styles.propertySelectText}>Sanayi</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* User Status */}
        {user ? (
          <View style={styles.userStatusCard}>
            <Text style={styles.userStatusTitle}>
              Hoş geldiniz, {user.first_name} {user.last_name}
            </Text>
            <Text style={styles.userStatusType}>
              {user.user_type === 'individual' ? '👤 Bireysel Üye' : 
               user.user_type === 'corporate' ? '🏢 Kurumsal Üye' : '👋 Misafir'}
            </Text>
            <View style={styles.queryStatus}>
              <Text style={styles.queryText}>
                Kalan Sorgulama: {user.query_limit - user.query_count} / {user.query_limit}
              </Text>
              {!user.phone_verified && user.query_count >= 5 && (
                <TouchableOpacity style={styles.verifyButton}>
                  <Text style={styles.verifyButtonText}>📱 Telefon Doğrula (+5 sorgu)</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.guestStatusCard}>
            <Text style={styles.guestStatusTitle}>Misafir Kullanıcı</Text>
            <Text style={styles.guestStatusText}>
              Kalan Ücretsiz Sorgulama: {3 - guestQueryCount} / 3
            </Text>
            <TouchableOpacity style={styles.upgradeButton} onPress={handleRegister}>
              <Text style={styles.upgradeButtonText}>
                Üye Ol - 5 Ücretsiz Sorgulama Kazanın
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Services Section */}
        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>Profesyonel Hizmetlerimiz</Text>
          
          <View style={styles.servicesGrid}>
            <TouchableOpacity 
              style={styles.serviceCard}
              onPress={() => router.push('/map')}
            >
              <Text style={styles.serviceIcon}>🗺️</Text>
              <Text style={styles.serviceTitle}>Akıllı Harita</Text>
              <Text style={styles.serviceDescription}>
                İnteraktif harita ile mahalle bazında fiyat analizi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.serviceCard}
              onPress={() => router.push('/query')}
            >
              <Text style={styles.serviceIcon}>📊</Text>
              <Text style={styles.serviceTitle}>Fiyat Endeksi</Text>
              <Text style={styles.serviceDescription}>
                20 yıllık geçmiş veri ile detaylı trend analizi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.serviceCard}
              onPress={() => router.push('/notifications')}
            >
              <Text style={styles.serviceIcon}>🔔</Text>
              <Text style={styles.serviceTitle}>Fiyat Alarmları</Text>
              <Text style={styles.serviceDescription}>
                Hedef fiyatlarda otomatik bildirim
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.serviceCard}>
              <Text style={styles.serviceIcon}>📈</Text>
              <Text style={styles.serviceTitle}>Yatırım Analizi</Text>
              <Text style={styles.serviceDescription}>
                ROI hesaplama ve risk değerlendirmesi
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Why Choose Us */}
        <View style={styles.whySection}>
          <Text style={styles.sectionTitle}>Neden EmlakEkspertizi?</Text>
          
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>✅</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Profesyonel Analiz</Text>
                <Text style={styles.featureText}>
                  20 yıllık geçmiş veri ile güvenilir emlak değerleme
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🎯</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Mahalle Bazında Detay</Text>
                <Text style={styles.featureText}>
                  Sokak seviyesinde fiyat analizi ve trend takibi
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🚀</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Gerçek Zamanlı Veri</Text>
                <Text style={styles.featureText}>
                  Güncel piyasa verileri ile anlık fiyat güncellemeleri
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🔒</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Güvenilir & Yasal</Text>
                <Text style={styles.featureText}>
                  Nadas.com.tr tarafından yasal olarak desteklenmektedir
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2025 EmlakEkspertizi.com - Nadas.com.tr Güvencesiyle
          </Text>
          <Text style={styles.footerSubtext}>
            Profesyonel Emlak Değerleme ve Analiz Hizmetleri
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
    fontSize: 18,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2563eb',
    borderBottomWidth: 3,
    borderBottomColor: '#1d4ed8',
  },
  headerContent: {
    flex: 1,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  logoSubtitle: {
    fontSize: 12,
    color: '#bfdbfe',
    marginTop: 2,
  },
  userMenu: {
    alignItems: 'flex-end',
  },
  userMenuText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  userMenuSubtext: {
    color: '#bfdbfe',
    fontSize: 12,
  },
  authButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  loginButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  registerButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  registerButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: 'bold',
  },
  heroSection: {
    height: 600,
    position: 'relative',
  },
  heroBackgroundImage: {
    flex: 1,
    backgroundColor: '#1e40af', // Blue background color
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 64, 175, 0.8)', // Blue overlay to match the original
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  heroContent: {
    alignItems: 'center',
    width: '100%',
  },
  heroStats: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fbbf24', // Orange color like in the original
    marginBottom: 8,
  },
  heroStatsText: {
    fontSize: 24,
    fontWeight: 'normal',
    color: '#ffffff',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 32,
  },
  propertyTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  propertyTypeButton: {
    backgroundColor: '#f59e0b', // Orange buttons like in original
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  propertyTypeIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  propertyTypeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  contactButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 24,
  },
  contactButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    width: '100%',
    position: 'relative',
  },
  searchInputContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // Semi-transparent white
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1e293b',
  },
  searchButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  searchIcon: {
    fontSize: 20,
  },
  searchResults: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    maxHeight: 200,
    zIndex: 1000,
  },
  searchResultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchResultText: {
    fontSize: 14,
    color: '#475569',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fbbf24', // Orange color like "81 ilde"
  },
  statLabel: {
    fontSize: 12,
    color: '#ffffff',
    marginTop: 4,
  },
  propertySelectionBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  propertySelectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  propertyScrollView: {
    paddingHorizontal: 16,
  },
  propertySelectButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activePropertySelect: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  propertySelectIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  propertySelectText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  activePropertySelectText: {
    color: '#ffffff',
  },
  userStatusCard: {
    backgroundColor: '#dbeafe',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  userStatusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  userStatusType: {
    fontSize: 14,
    color: '#3730a3',
    marginBottom: 12,
  },
  queryStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queryText: {
    fontSize: 14,
    color: '#1e40af',
    flex: 1,
  },
  verifyButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  guestStatusCard: {
    backgroundColor: '#fef3c7',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    alignItems: 'center',
  },
  guestStatusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
  },
  guestStatusText: {
    fontSize: 14,
    color: '#a16207',
    marginBottom: 16,
  },
  upgradeButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  servicesSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
    textAlign: 'center',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    alignItems: 'center',
  },
  serviceIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  serviceDescription: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
  whySection: {
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  featuresContainer: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  footerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
});