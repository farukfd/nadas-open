import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

interface LocationDetail {
  id: string;
  il: string;
  ilce: string;
  mahalle: string;
  lat?: number;
  lng?: number;
  currentPrice: number;
  priceChange: number;
  yearlyGrowth: number;
  demographics: {
    population: number;
    avgIncome: number;
    educationLevel: { [key: string]: number };
    ageDistribution: { [key: string]: number };
  };
  priceHistory: Array<{
    year: number;
    month: number;
    price: number;
  }>;
}

type PropertyType = 'residential_sale' | 'residential_rent' | 'commercial_sale' | 'commercial_rent' | 'land_sale';

const PROPERTY_TYPES = [
  { key: 'residential_sale', label: '🏠 Satılık Konut', color: '#2563eb' },
  { key: 'residential_rent', label: '🏠 Kiralık Konut', color: '#059669' },
  { key: 'commercial_sale', label: '🏢 Satılık İşyeri', color: '#dc2626' },
  { key: 'commercial_rent', label: '🏢 Kiralık İşyeri', color: '#ea580c' },
  { key: 'land_sale', label: '🏗️ Satılık Arsa', color: '#7c3aed' },
];

export default function LocationDetail() {
  const { id } = useLocalSearchParams();
  const [locationData, setLocationData] = useState<LocationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPropertyType, setSelectedPropertyType] = useState<PropertyType>('residential_sale');
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    loadLocationDetail();
    checkFavoriteStatus();
  }, [id]);

  const loadLocationDetail = async () => {
    try {
      setIsLoading(true);
      // Mock data - gerçek API ile değiştirilecek
      const mockData: LocationDetail = {
        id: id as string,
        il: 'İstanbul',
        ilce: 'Arnavutköy',
        mahalle: 'Hadımköy',
        lat: 41.153,
        lng: 28.623,
        currentPrice: 8500,
        priceChange: 12.5,
        yearlyGrowth: 15.2,
        demographics: {
          population: 25000,
          avgIncome: 8500,
          educationLevel: {
            'İlkokul': 25.5,
            'Ortaokul': 28.3,
            'Lise': 32.1,
            'Üniversite': 14.1
          },
          ageDistribution: {
            '0-18': 22.5,
            '18-35': 35.2,
            '35-55': 28.8,
            '55+': 13.5
          }
        },
        priceHistory: [
          { year: 2020, month: 1, price: 6200 },
          { year: 2020, month: 6, price: 6400 },
          { year: 2021, month: 1, price: 6800 },
          { year: 2021, month: 6, price: 7200 },
          { year: 2022, month: 1, price: 7600 },
          { year: 2022, month: 6, price: 7900 },
          { year: 2023, month: 1, price: 8100 },
          { year: 2023, month: 6, price: 8300 },
          { year: 2024, month: 1, price: 8400 },
          { year: 2024, month: 6, price: 8500 },
        ]
      };
      
      setLocationData(mockData);
    } catch (error) {
      console.error('Error loading location detail:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkFavoriteStatus = async () => {
    try {
      const favorites = await AsyncStorage.getItem('favorite_locations');
      if (favorites) {
        const favoriteList = JSON.parse(favorites);
        setIsFavorite(favoriteList.includes(id));
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const toggleFavorite = async () => {
    try {
      const favorites = await AsyncStorage.getItem('favorite_locations');
      let favoriteList = favorites ? JSON.parse(favorites) : [];
      
      if (isFavorite) {
        favoriteList = favoriteList.filter((fav: string) => fav !== id);
        setIsFavorite(false);
        Alert.alert('✅', 'Favorilerden çıkarıldı');
      } else {
        favoriteList.push(id);
        setIsFavorite(true);
        Alert.alert('⭐', 'Favorilere eklendi');
      }
      
      await AsyncStorage.setItem('favorite_locations', JSON.stringify(favoriteList));
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const generateChartData = () => {
    if (!locationData?.priceHistory) return null;

    const labels = locationData.priceHistory.map(item => 
      `${item.year.toString().slice(-2)}/${item.month.toString().padStart(2, '0')}`
    );
    
    const prices = locationData.priceHistory.map(item => item.price);
    const selectedColor = PROPERTY_TYPES.find(p => p.key === selectedPropertyType)?.color || '#2563eb';

    return {
      labels: labels.filter((_, index) => index % 2 === 0), // Show every 2nd label
      datasets: [
        {
          data: prices,
          strokeWidth: 3,
          color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
        },
      ],
    };
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Emlak endeksi yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!locationData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Veri bulunamadı</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Ana Sayfaya Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const chartData = generateChartData();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header - EmlakEkspertizi Style */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emlak Endeksi Detayı</Text>
        <TouchableOpacity onPress={toggleFavorite}>
          <Text style={[styles.favoriteButton, { color: isFavorite ? '#fbbf24' : '#ffffff' }]}>
            {isFavorite ? '⭐' : '☆'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Location Header */}
        <View style={styles.locationHeader}>
          <Text style={styles.locationTitle}>
            {locationData.mahalle}, {locationData.ilce}
          </Text>
          <Text style={styles.locationSubtitle}>
            {locationData.il}
          </Text>
          
          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>
              {formatPrice(locationData.currentPrice)}/m²
            </Text>
            <View style={[
              styles.changeIndicator,
              { backgroundColor: locationData.priceChange >= 0 ? '#10b981' : '#ef4444' }
            ]}>
              <Text style={styles.changeText}>
                {locationData.priceChange >= 0 ? '+' : ''}
                {locationData.priceChange.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Property Type Selection */}
        <View style={styles.propertyTypeSection}>
          <Text style={styles.sectionTitle}>Emlak Türü</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {PROPERTY_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.propertyTypeButton,
                  selectedPropertyType === type.key && styles.activePropertyType,
                  { borderColor: type.color }
                ]}
                onPress={() => setSelectedPropertyType(type.key as PropertyType)}
              >
                <Text style={[
                  styles.propertyTypeText,
                  selectedPropertyType === type.key && { color: type.color }
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {locationData.yearlyGrowth.toFixed(1)}%
            </Text>
            <Text style={styles.metricLabel}>Yıllık Büyüme</Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {locationData.demographics.population.toLocaleString('tr-TR')}
            </Text>
            <Text style={styles.metricLabel}>Nüfus</Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {formatPrice(locationData.demographics.avgIncome)}
            </Text>
            <Text style={styles.metricLabel}>Ort. Gelir</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>A+</Text>
            <Text style={styles.metricLabel}>Yatırım Notu</Text>
          </View>
        </View>

        {/* Price Chart */}
        {chartData && (
          <View style={styles.chartContainer}>
            <Text style={styles.sectionTitle}>
              Fiyat Trendi - {PROPERTY_TYPES.find(p => p.key === selectedPropertyType)?.label}
            </Text>
            <LineChart
              data={chartData}
              width={width - 32}
              height={220}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(30, 41, 59, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: '#2563eb',
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>
        )}

        {/* Demographics */}
        <View style={styles.demographicsContainer}>
          <Text style={styles.sectionTitle}>Demografik Veriler</Text>
          
          {/* Education Level */}
          <View style={styles.demographicCard}>
            <Text style={styles.subsectionTitle}>📚 Eğitim Düzeyi Dağılımı</Text>
            {Object.entries(locationData.demographics.educationLevel).map(([level, percentage]) => (
              <View key={level} style={styles.educationItem}>
                <Text style={styles.educationLevel}>{level}</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[styles.progressFill, { width: `${percentage}%` }]} 
                  />
                </View>
                <Text style={styles.educationPercentage}>%{percentage}</Text>
              </View>
            ))}
          </View>

          {/* Age Distribution */}
          <View style={styles.demographicCard}>
            <Text style={styles.subsectionTitle}>👥 Yaş Dağılımı</Text>
            {Object.entries(locationData.demographics.ageDistribution).map(([age, percentage]) => (
              <View key={age} style={styles.educationItem}>
                <Text style={styles.educationLevel}>{age} yaş</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: '#10b981' }]} 
                  />
                </View>
                <Text style={styles.educationPercentage}>%{percentage}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={() => router.push('/map')}
          >
            <Text style={styles.mapButtonText}>🗺️ Akıllı Haritada Görüntüle</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.alarmButton}
            onPress={() => router.push('/notifications')}
          >
            <Text style={styles.alarmButtonText}>🔔 Fiyat Alarmı Kur</Text>
          </TouchableOpacity>
        </View>

        {/* Professional Analysis */}
        <View style={styles.analysisContainer}>
          <Text style={styles.sectionTitle}>🎯 Profesyonel Analiz</Text>
          
          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>📈 Yatırım Değerlendirmesi</Text>
            <Text style={styles.analysisText}>
              {locationData.mahalle} bölgesi son 4 yılda %{locationData.yearlyGrowth} 
              büyüme göstermiştir. Nüfus yoğunluğu ve gelişim potansiyeli dikkate 
              alındığında orta vadeli yatırım için uygun bir bölgedir.
            </Text>
          </View>
          
          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>🏘️ Bölge Karakteristiği</Text>
            <Text style={styles.analysisText}>
              Gelişmekte olan bir yerleşim alanı olan {locationData.mahalle}, 
              İstanbul'un kuzey koridorunda yer almaktadır. Ulaşım imkanları 
              ve altyapı yatırımları ile değer artış potansiyeli yüksektir.
            </Text>
          </View>

          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>💰 Fiyat Analizi</Text>
            <Text style={styles.analysisText}>
              Mevcut m² fiyatı {formatPrice(locationData.currentPrice)} olan bölge, 
              benzer karakteristiklere sahip diğer İstanbul ilçeleri ile karşılaştırıldığında 
              rekabetçi konumdadır. Yıllık %{locationData.yearlyGrowth} büyüme oranı ile 
              istikrarlı bir değer artışı göstermektedir.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Bu analiz EmlakEkspertizi.com tarafından hazırlanmıştır.
          </Text>
          <Text style={styles.footerSubtext}>
            Nadas.com.tr güvencesiyle profesyonel emlak değerleme hizmeti.
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
  favoriteButton: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  propertyTypeSection: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  propertyTypeButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activePropertyType: {
    backgroundColor: '#dbeafe',
  },
  propertyTypeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  demographicCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  content: {
    flex: 1,
  },
  locationHeader: {
    padding: 20,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  locationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  locationSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  changeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  chartContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 16,
  },
  demographicsContainer: {
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  educationContainer: {
    gap: 12,
  },
  educationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  educationLevel: {
    fontSize: 14,
    color: '#374151',
    width: 80,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  educationPercentage: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  actionContainer: {
    padding: 20,
    gap: 12,
  },
  mapButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  mapButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  alarmButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  alarmButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: 'bold',
  },
  analysisContainer: {
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  analysisCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  analysisText: {
    fontSize: 14,
    color: '#475569',
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
  backButtonText: {
    color: '#2563eb',
    fontSize: 16,
  },
});