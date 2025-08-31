import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width, height } = Dimensions.get('window');

interface LocationData {
  id: string;
  il: string;
  ilce: string;
  mahalle: string;
  lat?: number;
  lng?: number;
  avg_price?: number;
}

interface PriceData {
  location_code: string;
  avg_price_per_m2: number;
  property_type: string;
}

type PropertyType = 'residential_sale' | 'residential_rent' | 'commercial_sale' | 'commercial_rent' | 'land_sale';

const PROPERTY_TYPE_LABELS = {
  residential_sale: 'Satılık Konut',
  residential_rent: 'Kiralık Konut',
  commercial_sale: 'Satılık İşyeri',
  commercial_rent: 'Kiralık İşyeri',
  land_sale: 'Satılık Arsa',
};

export default function SmartMap() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [priceData, setPriceData] = useState<{ [key: string]: PriceData }>({});
  const [selectedPropertyType, setSelectedPropertyType] = useState<PropertyType>('residential_sale');
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [priceRangeFilter, setPriceRangeFilter] = useState<{min: number, max: number} | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<LocationData[]>([]);

  useEffect(() => {
    loadMapData();
    loadCities();
    loadFavorites();
  }, []);

  useEffect(() => {
    if (locations.length > 0) {
      loadPriceData();
    }
  }, [selectedPropertyType, locations]);

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

  const loadMapData = async () => {
    try {
      setIsLoading(true);
      
      // Veritabanından gerçek lokasyon verilerini al
      const response = await fetch(`${EXPO_BACKEND_URL}/api/map/locations`);
      const data = await response.json();
      
      if (response.ok && data.locations) {
        const mapLocations: LocationData[] = data.locations.map((loc: any) => ({
          id: loc.mahalle_code || `${loc.il}_${loc.ilce}_${loc.mahalle}`,
          il: loc.il,
          ilce: loc.ilce,
          mahalle: loc.mahalle,
          lat: loc.lat,
          lng: loc.lng,
        }));
        
        setLocations(mapLocations);
      } else {
        Alert.alert('Hata', 'Konum verileri yüklenemedi.');
      }
    } catch (error) {
      console.error('Error loading map data:', error);
      Alert.alert('Hata', 'Harita verileri yüklenirken hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPriceData = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const priceDataMap: { [key: string]: PriceData } = {};
      
      // İlk 10 lokasyon için fiyat verisi al
      for (const location of locations.slice(0, 10)) {
        try {
          const queryData = {
            il: location.il,
            ilce: location.ilce,
            mahalle: location.mahalle,
            property_type: selectedPropertyType,
            start_year: 2024,
            end_year: 2025,
          };

          const endpoint = token ? '/api/query/protected' : '/api/query/guest';
          const headers: { [key: string]: string } = {
            'Content-Type': 'application/json',
          };
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch(`${EXPO_BACKEND_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(queryData),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.price_data && data.price_data.length > 0) {
              const latestPrice = data.price_data[data.price_data.length - 1];
              priceDataMap[location.id] = {
                location_code: location.id,
                avg_price_per_m2: latestPrice.avg_price_per_m2,
                property_type: selectedPropertyType,
              };
            }
          }
        } catch (error) {
          console.error(`Error loading price for ${location.mahalle}:`, error);
        }
      }
      
      setPriceData(priceDataMap);
    } catch (error) {
      console.error('Error loading price data:', error);
    }
  };

  const getPriceColor = (locationId: string): string => {
    const price = priceData[locationId]?.avg_price_per_m2;
    if (!price) return '#8892a0'; 
    
    if (price < 10000) return '#22c55e'; 
    if (price < 20000) return '#eab308'; 
    if (price < 30000) return '#f97316'; 
    return '#ef4444'; 
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'Veri yok';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleLocationPress = (location: LocationData) => {
    setSelectedLocation(location);
    setShowLocationModal(true);
  };

  const loadFavorites = async () => {
    try {
      const savedFavorites = await AsyncStorage.getItem('favorite_locations');
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = async (locationId: string) => {
    try {
      let newFavorites;
      if (favorites.includes(locationId)) {
        newFavorites = favorites.filter(id => id !== locationId);
      } else {
        newFavorites = [...favorites, locationId];
      }
      setFavorites(newFavorites);
      await AsyncStorage.setItem('favorite_locations', JSON.stringify(newFavorites));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  const generateHeatmapData = () => {
    if (!showHeatmap) return [];
    
    return locations
      .filter(loc => priceData[loc.id])
      .map(loc => {
        const price = priceData[loc.id].avg_price_per_m2;
        return {
          latitude: loc.lat || 0,
          longitude: loc.lng || 0,
          weight: Math.min(price / 50000, 1), // Normalize to 0-1
          intensity: price > 30000 ? 1.0 : price > 20000 ? 0.7 : price > 10000 ? 0.4 : 0.1
        };
      });
  };

  const applyPriceFilter = (locations: LocationData[]) => {
    if (!priceRangeFilter) return locations;
    
    return locations.filter(loc => {
      const price = priceData[loc.id]?.avg_price_per_m2;
      if (!price) return true;
      return price >= priceRangeFilter.min && price <= priceRangeFilter.max;
    });
  };

  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setSelectedForCompare([]);
  };

  const handleLocationForCompare = (location: LocationData) => {
    if (!compareMode) return;
    
    if (selectedForCompare.find(loc => loc.id === location.id)) {
      setSelectedForCompare(selectedForCompare.filter(loc => loc.id !== location.id));
    } else if (selectedForCompare.length < 2) {
      setSelectedForCompare([...selectedForCompare, location]);
    } else {
      Alert.alert('Limit', 'En fazla 2 lokasyon karşılaştırabilirsiniz.');
    }
  };

  const filterLocationsByCity = (city: string) => {
    setSelectedCity(city);
  };

  const filteredLocations = applyPriceFilter(
    selectedCity 
      ? locations.filter(loc => loc.il === selectedCity)
      : locations
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Akıllı Harita</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity 
            style={[styles.controlButton, selectedCity === '' && styles.activeButton]}
            onPress={() => filterLocationsByCity('')}
          >
            <Text style={styles.controlText}>🇹🇷 Tüm Türkiye</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, showHeatmap && styles.activeButton]}
            onPress={() => setShowHeatmap(!showHeatmap)}
          >
            <Text style={styles.controlText}>🔥 Isı Haritası</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, compareMode && styles.activeButton]}
            onPress={toggleCompareMode}
          >
            <Text style={styles.controlText}>📊 Karşılaştır</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => {
              const favoriteLocs = locations.filter(loc => favorites.includes(loc.id));
              if (favoriteLocs.length > 0) {
                setSelectedCity('');
              } else {
                Alert.alert('Bilgi', 'Henüz favori lokasyonunuz yok.');
              }
            }}
          >
            <Text style={styles.controlText}>⭐ Favoriler ({favorites.length})</Text>
          </TouchableOpacity>
          
          {cities.map((city) => (
            <TouchableOpacity
              key={city}
              style={[styles.controlButton, selectedCity === city && styles.activeButton]}
              onPress={() => filterLocationsByCity(city)}
            >
              <Text style={styles.controlText}>{city}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Price Range Filter */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterButton, !priceRangeFilter && styles.activeFilterButton]}
            onPress={() => setPriceRangeFilter(null)}
          >
            <Text style={styles.filterText}>Tüm Fiyatlar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, priceRangeFilter?.min === 0 && priceRangeFilter?.max === 10000 && styles.activeFilterButton]}
            onPress={() => setPriceRangeFilter({min: 0, max: 10000})}
          >
            <Text style={styles.filterText}>{"< 10K"}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, priceRangeFilter?.min === 10000 && priceRangeFilter?.max === 20000 && styles.activeFilterButton]}
            onPress={() => setPriceRangeFilter({min: 10000, max: 20000})}
          >
            <Text style={styles.filterText}>10K-20K</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, priceRangeFilter?.min === 20000 && priceRangeFilter?.max === 30000 && styles.activeFilterButton]}
            onPress={() => setPriceRangeFilter({min: 20000, max: 30000})}
          >
            <Text style={styles.filterText}>20K-30K</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, priceRangeFilter?.min === 30000 && priceRangeFilter?.max === 100000 && styles.activeFilterButton]}
            onPress={() => setPriceRangeFilter({min: 30000, max: 100000})}
          >
            <Text style={styles.filterText}>{"> 30K"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Property Type Selector */}
      <View style={styles.propertyTypeContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Object.entries(PROPERTY_TYPE_LABELS).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.propertyTypeButton,
                selectedPropertyType === key && styles.activePropertyType
              ]}
              onPress={() => setSelectedPropertyType(key as PropertyType)}
            >
              <Text style={[
                styles.propertyTypeText,
                selectedPropertyType === key && styles.activePropertyTypeText
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map Alternative - Location Grid */}
      <ScrollView style={styles.mapContainer}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>
            {selectedCity ? `${selectedCity} Bölgeleri` : 'Türkiye Emlak Haritası'}
          </Text>
          <Text style={styles.statsSubtitle}>
            {filteredLocations.length} lokasyon • {PROPERTY_TYPE_LABELS[selectedPropertyType]}
          </Text>
        </View>

        <View style={styles.locationGrid}>
          {filteredLocations.map((location) => (
            <TouchableOpacity
              key={location.id}
              style={[
                styles.locationCard,
                { borderLeftColor: getPriceColor(location.id) },
                selectedForCompare.find(loc => loc.id === location.id) && styles.selectedForCompare
              ]}
              onPress={() => {
                if (compareMode) {
                  handleLocationForCompare(location);
                } else {
                  handleLocationPress(location);
                }
              }}
            >
              <View style={styles.locationHeader}>
                <Text style={styles.locationTitle}>{location.mahalle}</Text>
                <View style={styles.locationActions}>
                  <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={() => toggleFavorite(location.id)}
                  >
                    <Text style={styles.favoriteIcon}>
                      {favorites.includes(location.id) ? '⭐' : '☆'}
                    </Text>
                  </TouchableOpacity>
                  <View style={[
                    styles.priceIndicator,
                    { backgroundColor: getPriceColor(location.id) }
                  ]} />
                </View>
              </View>
              
              <Text style={styles.locationSubtitle}>
                {location.ilce} / {location.il}
              </Text>
              
              <Text style={styles.locationPrice}>
                {priceData[location.id] 
                  ? formatPrice(priceData[location.id].avg_price_per_m2) + '/m²'
                  : 'Fiyat verisi yükleniyor...'
                }
              </Text>
              
              {location.lat && location.lng && (
                <Text style={styles.locationCoords}>
                  📍 {location.lat.toFixed(3)}, {location.lng.toFixed(3)}
                </Text>
              )}

              {compareMode && (
                <View style={styles.compareIndicator}>
                  <Text style={styles.compareText}>
                    {selectedForCompare.find(loc => loc.id === location.id) 
                      ? '✅ Seçildi' 
                      : '📊 Karşılaştır'
                    }
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {filteredLocations.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {selectedCity ? `${selectedCity} için veri bulunamadı` : 'Konum verisi bulunamadı'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Karşılaştırma Bilgi Paneli */}
      {compareMode && (
        <View style={styles.comparePanel}>
          <Text style={styles.comparePanelTitle}>
            📊 Karşılaştırma Modu ({selectedForCompare.length}/2)
          </Text>
          {selectedForCompare.length === 2 && (
            <TouchableOpacity
              style={styles.compareButton}
              onPress={() => {
                Alert.alert(
                  'Karşılaştırma Sonucu',
                  `${selectedForCompare[0].mahalle}: ${formatPrice(priceData[selectedForCompare[0].id]?.avg_price_per_m2)}/m²\n\n${selectedForCompare[1].mahalle}: ${formatPrice(priceData[selectedForCompare[1].id]?.avg_price_per_m2)}/m²\n\nFark: ${formatPrice(Math.abs((priceData[selectedForCompare[0].id]?.avg_price_per_m2 || 0) - (priceData[selectedForCompare[1].id]?.avg_price_per_m2 || 0)))}/m²`
                );
              }}
            >
              <Text style={styles.compareButtonText}>Karşılaştır</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Isı Haritası Açıklama */}
      {showHeatmap && (
        <View style={styles.heatmapInfo}>
          <Text style={styles.heatmapInfoText}>
            🔥 Isı Haritası: Kırmızı alanlar yüksek fiyat, mavi alanlar düşük fiyat gösterir
          </Text>
        </View>
      )}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Fiyat Aralığı (TL/m²)</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.legendText}>{"< 10K"}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#eab308' }]} />
            <Text style={styles.legendText}>10K-20K</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#f97316' }]} />
            <Text style={styles.legendText}>20K-30K</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>{"> 30K"}</Text>
          </View>
        </View>
      </View>

      {/* Location Detail Modal */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedLocation && (
              <>
                <Text style={styles.modalTitle}>
                  {selectedLocation.mahalle}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedLocation.ilce} / {selectedLocation.il}
                </Text>
                
                <View style={styles.modalInfo}>
                  <Text style={styles.modalInfoTitle}>Fiyat Bilgisi</Text>
                  <Text style={styles.modalInfoText}>
                    {PROPERTY_TYPE_LABELS[selectedPropertyType]}
                  </Text>
                  <Text style={styles.modalPrice}>
                    {formatPrice(priceData[selectedLocation.id]?.avg_price_per_m2)} / m²
                  </Text>
                  
                  {selectedLocation.lat && selectedLocation.lng && (
                    <>
                      <Text style={styles.modalInfoTitle}>Konum Bilgisi</Text>
                      <Text style={styles.modalInfoText}>
                        Enlem: {selectedLocation.lat.toFixed(6)}
                      </Text>
                      <Text style={styles.modalInfoText}>
                        Boylam: {selectedLocation.lng.toFixed(6)}
                      </Text>
                    </>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => {
                      setShowLocationModal(false);
                      router.push('/query');
                    }}
                  >
                    <Text style={styles.modalButtonText}>Detaylı Analiz</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.closeButton]}
                    onPress={() => setShowLocationModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Kapat</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Harita verileri yükleniyor...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
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
  headerRight: {
    width: 50,
  },
  controls: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a2332',
  },
  controlButton: {
    backgroundColor: '#2d3748',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  activeButton: {
    backgroundColor: '#4f9eff',
  },
  controlText: {
    color: '#fff',
    fontSize: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2d3748',
  },
  filterButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: '#f97316',
  },
  filterText: {
    color: '#fff',
    fontSize: 11,
  },
  propertyTypeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a2332',
  },
  propertyTypeButton: {
    backgroundColor: '#2d3748',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  activePropertyType: {
    backgroundColor: '#4f9eff',
  },
  propertyTypeText: {
    color: '#8892a0',
    fontSize: 12,
  },
  activePropertyTypeText: {
    color: '#fff',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  statsHeader: {
    padding: 16,
    backgroundColor: '#1a2332',
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  statsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsSubtitle: {
    color: '#8892a0',
    fontSize: 14,
  },
  locationGrid: {
    padding: 16,
  },
  locationCard: {
    backgroundColor: '#1a2332',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteButton: {
    marginRight: 8,
    padding: 4,
  },
  favoriteIcon: {
    fontSize: 16,
  },
  selectedForCompare: {
    borderColor: '#4f9eff',
    borderWidth: 2,
    backgroundColor: 'rgba(79, 158, 255, 0.1)',
  },
  compareIndicator: {
    marginTop: 8,
    alignItems: 'center',
  },
  compareText: {
    color: '#4f9eff',
    fontSize: 12,
    fontWeight: '600',
  },
  comparePanel: {
    backgroundColor: '#4f9eff',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comparePanelTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  compareButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  compareButtonText: {
    color: '#4f9eff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  heatmapInfo: {
    backgroundColor: '#f97316',
    padding: 12,
    alignItems: 'center',
  },
  heatmapInfoText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  locationTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  priceIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationSubtitle: {
    color: '#8892a0',
    fontSize: 14,
    marginBottom: 8,
  },
  locationPrice: {
    color: '#4f9eff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationCoords: {
    color: '#6b7280',
    fontSize: 12,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#8892a0',
    fontSize: 16,
    textAlign: 'center',
  },
  legend: {
    backgroundColor: '#1a2332',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
  },
  legendTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    color: '#8892a0',
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a2332',
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#8892a0',
    fontSize: 16,
    marginBottom: 16,
  },
  modalInfo: {
    marginBottom: 20,
  },
  modalInfoTitle: {
    color: '#4f9eff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInfoText: {
    color: '#8892a0',
    fontSize: 14,
    marginBottom: 4,
  },
  modalPrice: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    backgroundColor: '#4f9eff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#6b7280',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 20, 25, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
});