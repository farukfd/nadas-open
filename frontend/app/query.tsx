import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { LineChart } from 'react-native-chart-kit';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const screenWidth = Dimensions.get('window').width;

interface PriceData {
  id: string;
  year: number;
  month: number;
  avg_price_per_m2: number;
  transaction_count: number;
}

interface DemographicData {
  population: number;
  avg_income: number;
  education_level: { [key: string]: number };
  age_distribution: { [key: string]: number };
}

interface QueryResult {
  location: {
    il: string;
    ilce: string;
    mahalle: string;
    lat?: number;
    lng?: number;
  };
  price_data: PriceData[];
  demographic_data?: DemographicData;
  query_count_remaining: number;
}

type PropertyType = 
  | 'residential_sale' 
  | 'residential_rent' 
  | 'commercial_sale' 
  | 'commercial_rent' 
  | 'land_sale';

const PROPERTY_TYPE_LABELS = {
  residential_sale: 'Satılık Konut',
  residential_rent: 'Kiralık Konut',
  commercial_sale: 'Satılık İşyeri',
  commercial_rent: 'Kiralık İşyeri',
  land_sale: 'Satılık Arsa',
};

export default function Query() {
  const [isGuest, setIsGuest] = useState(true);
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [selectedPropertyType, setSelectedPropertyType] = useState<PropertyType>('residential_sale');
  
  const [isLoading, setIsLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [guestQueryCount, setGuestQueryCount] = useState(0);

  useEffect(() => {
    checkAuthStatus();
    loadCities();
  }, []);

  useEffect(() => {
    if (selectedCity) {
      loadDistricts();
    }
  }, [selectedCity]);

  useEffect(() => {
    if (selectedCity && selectedDistrict) {
      loadNeighborhoods();
    }
  }, [selectedCity, selectedDistrict]);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const guestCount = await AsyncStorage.getItem('guest_query_count');
      
      setIsGuest(!token);
      if (guestCount) {
        setGuestQueryCount(parseInt(guestCount, 10));
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  const loadCities = async () => {
    try {
      const response = await fetch(`${EXPO_BACKEND_URL}/api/locations/cities`);
      const data = await response.json();
      if (response.ok) {
        setCities(data.cities);
      }
    } catch (error) {
      console.error('Error loading cities:', error);
    }
  };

  const loadDistricts = async () => {
    if (!selectedCity) return;
    
    try {
      const response = await fetch(`${EXPO_BACKEND_URL}/api/locations/districts/${encodeURIComponent(selectedCity)}`);
      const data = await response.json();
      if (response.ok) {
        setDistricts(data.districts);
        setSelectedDistrict('');
        setNeighborhoods([]);
        setSelectedNeighborhood('');
      }
    } catch (error) {
      console.error('Error loading districts:', error);
    }
  };

  const loadNeighborhoods = async () => {
    if (!selectedCity || !selectedDistrict) return;
    
    try {
      const response = await fetch(
        `${EXPO_BACKEND_URL}/api/locations/neighborhoods/${encodeURIComponent(selectedCity)}/${encodeURIComponent(selectedDistrict)}`
      );
      const data = await response.json();
      if (response.ok) {
        setNeighborhoods(data.neighborhoods);
        setSelectedNeighborhood('');
      }
    } catch (error) {
      console.error('Error loading neighborhoods:', error);
    }
  };

  const handleQuery = async () => {
    if (!selectedCity || !selectedDistrict || !selectedNeighborhood) {
      Alert.alert('Hata', 'Lütfen tüm konum bilgilerini seçin.');
      return;
    }

    setIsLoading(true);

    try {
      const queryData = {
        il: selectedCity,
        ilce: selectedDistrict,
        mahalle: selectedNeighborhood,
        property_type: selectedPropertyType,
        start_year: 2020,
        end_year: 2025,
      };

      let endpoint = '/api/query/guest';
      let headers: { [key: string]: string } = {
        'Content-Type': 'application/json',
      };

      if (!isGuest) {
        endpoint = '/api/query/protected';
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`${EXPO_BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(queryData),
      });

      const data = await response.json();

      if (response.ok) {
        setQueryResult(data);
        
        // Update guest query count
        if (isGuest) {
          const newCount = guestQueryCount + 1;
          setGuestQueryCount(newCount);
          await AsyncStorage.setItem('guest_query_count', newCount.toString());
        }
      } else {
        Alert.alert('Hata', data.detail || 'Sorgulama yapılamadı.');
      }
    } catch (error) {
      console.error('Query error:', error);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateChartData = () => {
    if (!queryResult?.price_data) return null;

    const sortedData = queryResult.price_data.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    const labels = sortedData.map(item => `${item.year.toString().slice(-2)}/${item.month.toString().padStart(2, '0')}`);
    const prices = sortedData.map(item => item.avg_price_per_m2);

    return {
      labels: labels.filter((_, index) => index % Math.ceil(labels.length / 6) === 0), // Show 6 labels max
      datasets: [
        {
          data: prices,
          strokeWidth: 3,
          color: (opacity = 1) => `rgba(79, 158, 255, ${opacity})`,
        },
      ],
    };
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const chartData = generateChartData();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Emlak Endeksi Sorgulama</Text>
          <Text style={styles.subtitle}>
            {isGuest 
              ? `Kalan Ücretsiz Sorgulama: ${3 - guestQueryCount}/3`
              : `Kalan Sorgulama: ${queryResult?.query_count_remaining ?? '∞'}`
            }
          </Text>
        </View>

        {/* Query Form */}
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Konum Seçimi</Text>
          
          {/* City Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>İl</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedCity}
                onValueChange={setSelectedCity}
                style={styles.picker}
                dropdownIconColor="#fff"
              >
                <Picker.Item label="İl seçin..." value="" />
                {cities.map((city) => (
                  <Picker.Item key={city} label={city} value={city} />
                ))}
              </Picker>
            </View>
          </View>

          {/* District Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>İlçe</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedDistrict}
                onValueChange={setSelectedDistrict}
                style={styles.picker}
                dropdownIconColor="#fff"
                enabled={districts.length > 0}
              >
                <Picker.Item label="İlçe seçin..." value="" />
                {districts.map((district) => (
                  <Picker.Item key={district} label={district} value={district} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Neighborhood Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mahalle</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedNeighborhood}
                onValueChange={setSelectedNeighborhood}
                style={styles.picker}
                dropdownIconColor="#fff"
                enabled={neighborhoods.length > 0}
              >
                <Picker.Item label="Mahalle seçin..." value="" />
                {neighborhoods.map((neighborhood) => (
                  <Picker.Item key={neighborhood} label={neighborhood} value={neighborhood} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Property Type Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Emlak Türü</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedPropertyType}
                onValueChange={(value) => setSelectedPropertyType(value as PropertyType)}
                style={styles.picker}
                dropdownIconColor="#fff"
              >
                {Object.entries(PROPERTY_TYPE_LABELS).map(([key, label]) => (
                  <Picker.Item key={key} label={label} value={key} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Query Button */}
          <TouchableOpacity
            style={[styles.queryButton, isLoading && styles.disabledButton]}
            onPress={handleQuery}
            disabled={isLoading}
          >
            <Text style={styles.queryButtonText}>
              {isLoading ? 'Sorgulanıyor...' : 'Sorgula'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        {queryResult && (
          <View style={styles.resultsContainer}>
            <Text style={styles.sectionTitle}>Sonuçlar</Text>
            
            {/* Location Info */}
            <View style={styles.locationCard}>
              <Text style={styles.locationTitle}>
                {queryResult.location.mahalle}, {queryResult.location.ilce} / {queryResult.location.il}
              </Text>
              <Text style={styles.propertyTypeText}>
                {PROPERTY_TYPE_LABELS[selectedPropertyType]}
              </Text>
            </View>

            {/* Price Chart */}
            {chartData && (
              <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>Fiyat Trendi (2020-2025)</Text>
                <LineChart
                  data={chartData}
                  width={screenWidth - 32}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#1a2332',
                    backgroundGradientFrom: '#1a2332',
                    backgroundGradientTo: '#1a2332',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(79, 158, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                    propsForDots: {
                      r: '4',
                      strokeWidth: '2',
                      stroke: '#4f9eff',
                    },
                  }}
                  bezier
                  style={styles.chart}
                />
              </View>
            )}

            {/* Price Statistics */}
            {queryResult.price_data.length > 0 && (
              <View style={styles.statsContainer}>
                <Text style={styles.statsTitle}>Fiyat İstatistikleri</Text>
                
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                      {formatPrice(Math.max(...queryResult.price_data.map(p => p.avg_price_per_m2)))}
                    </Text>
                    <Text style={styles.statLabel}>En Yüksek</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                      {formatPrice(Math.min(...queryResult.price_data.map(p => p.avg_price_per_m2)))}
                    </Text>
                    <Text style={styles.statLabel}>En Düşük</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                      {formatPrice(queryResult.price_data.reduce((sum, p) => sum + p.avg_price_per_m2, 0) / queryResult.price_data.length)}
                    </Text>
                    <Text style={styles.statLabel}>Ortalama</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                      {queryResult.price_data[queryResult.price_data.length - 1]?.avg_price_per_m2 
                        ? formatPrice(queryResult.price_data[queryResult.price_data.length - 1].avg_price_per_m2)
                        : 'N/A'}
                    </Text>
                    <Text style={styles.statLabel}>Güncel</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Demographic Data */}
            {queryResult.demographic_data && (
              <View style={styles.demographicContainer}>
                <Text style={styles.sectionTitle}>Demografik Veriler</Text>
                
                <View style={styles.demographicCard}>
                  <Text style={styles.demographicTitle}>Genel Bilgiler</Text>
                  <Text style={styles.demographicText}>
                    Nüfus: {queryResult.demographic_data.population?.toLocaleString('tr-TR') || 'N/A'}
                  </Text>
                  <Text style={styles.demographicText}>
                    Ortalama Gelir: {queryResult.demographic_data.avg_income 
                      ? formatPrice(queryResult.demographic_data.avg_income) + '/ay' 
                      : 'N/A'}
                  </Text>
                </View>

                {queryResult.demographic_data.education_level && (
                  <View style={styles.demographicCard}>
                    <Text style={styles.demographicTitle}>Eğitim Seviyeleri</Text>
                    {Object.entries(queryResult.demographic_data.education_level).map(([level, percentage]) => (
                      <Text key={level} style={styles.demographicText}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}: %{percentage}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Ana Sayfaya Dön</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8892a0',
    textAlign: 'center',
  },
  form: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#1a2332',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  picker: {
    color: '#fff',
    backgroundColor: 'transparent',
  },
  queryButton: {
    backgroundColor: '#4f9eff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#6b7280',
  },
  queryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultsContainer: {
    padding: 16,
  },
  locationCard: {
    backgroundColor: '#1a2332',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  propertyTypeText: {
    fontSize: 14,
    color: '#4f9eff',
  },
  chartContainer: {
    backgroundColor: '#1a2332',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  chart: {
    borderRadius: 16,
  },
  statsContainer: {
    backgroundColor: '#1a2332',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#2d3748',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4f9eff',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#8892a0',
  },
  demographicContainer: {
    marginBottom: 16,
  },
  demographicCard: {
    backgroundColor: '#1a2332',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  demographicTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4f9eff',
    marginBottom: 8,
  },
  demographicText: {
    fontSize: 14,
    color: '#8892a0',
    marginBottom: 4,
  },
  backButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: '#8892a0',
    fontSize: 16,
  },
});