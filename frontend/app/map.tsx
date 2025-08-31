import React, { useState, useEffect, useRef } from 'react';
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
  lat: number;
  lng: number;
  avg_price?: number;
  property_count?: number;
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
  const mapRef = useRef<MapView>(null);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [priceData, setPriceData] = useState<{ [key: string]: PriceData }>({});
  const [selectedPropertyType, setSelectedPropertyType] = useState<PropertyType>('residential_sale');
  const [mapType, setMapType] = useState<'standard' | 'hybrid' | 'satellite'>('standard');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<Region | null>(null);

  // Türkiye'nin merkez koordinatları
  const [region, setRegion] = useState<Region>({
    latitude: 39.9334,  // Türkiye merkezi
    longitude: 32.8597,
    latitudeDelta: 8.0,
    longitudeDelta: 8.0,
  });

  useEffect(() => {
    loadMapData();
  }, []);

  useEffect(() => {
    if (locations.length > 0) {
      loadPriceData();
    }
  }, [selectedPropertyType, locations]);

  const loadMapData = async () => {
    try {
      setIsLoading(true);
      
      // Get all locations with coordinates from the map API
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

  const getCityBaseCoordinates = (city: string) => {
    const cityCoords: { [key: string]: { lat: number; lng: number } } = {
      'İstanbul': { lat: 41.0082, lng: 28.9784 },
      'Ankara': { lat: 39.9334, lng: 32.8597 },
      'İzmir': { lat: 38.4237, lng: 27.1428 },
      'Bursa': { lat: 40.1826, lng: 29.0665 },
      'Antalya': { lat: 36.8841, lng: 30.7056 },
    };
    return cityCoords[city] || cityCoords['Ankara'];
  };

  const loadPriceData = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const priceDataMap: { [key: string]: PriceData } = {};
      
      for (const location of locations.slice(0, 10)) { // İlk 10 lokasyon için fiyat verisi
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

  const getMarkerColor = (locationId: string): string => {
    const price = priceData[locationId]?.avg_price_per_m2;
    if (!price) return '#8892a0'; // Gri - veri yok
    
    // Fiyat aralıklarına göre renk
    if (price < 10000) return '#22c55e'; // Yeşil - Düşük
    if (price < 20000) return '#eab308'; // Sarı - Orta
    if (price < 30000) return '#f97316'; // Turuncu - Yüksek
    return '#ef4444'; // Kırmızı - Çok yüksek
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'Veri yok';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleMarkerPress = (location: LocationData) => {
    setSelectedLocation(location);
    setShowLocationModal(true);
  };

  const zoomToTurkey = () => {
    setRegion({
      latitude: 39.9334,
      longitude: 32.8597,
      latitudeDelta: 8.0,
      longitudeDelta: 8.0,
    });
  };

  const zoomToCity = (city: string) => {
    const coords = getCityBaseCoordinates(city);
    setRegion({
      latitude: coords.lat,
      longitude: coords.lng,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    });
  };

  const generateHeatmapData = () => {
    return locations
      .filter(loc => priceData[loc.id])
      .map(loc => ({
        latitude: loc.lat,
        longitude: loc.lng,
        weight: Math.min(priceData[loc.id].avg_price_per_m2 / 50000, 1), // Normalize to 0-1
      }));
  };

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

      {/* Map Controls */}
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity 
            style={[styles.controlButton, { backgroundColor: showHeatmap ? '#4f9eff' : '#2d3748' }]}
            onPress={() => setShowHeatmap(!showHeatmap)}
          >
            <Text style={styles.controlText}>🔥 Isı Haritası</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={zoomToTurkey}
          >
            <Text style={styles.controlText}>🇹🇷 Türkiye</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => zoomToCity('İstanbul')}
          >
            <Text style={styles.controlText}>🏙️ İstanbul</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => zoomToCity('Ankara')}
          >
            <Text style={styles.controlText}>🏛️ Ankara</Text>
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

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        mapType={mapType}
        showsUserLocation={true}
        showsMyLocationButton={true}
        toolbarEnabled={false}
      >
        {/* Markers */}
        {locations.map((location) => (
          <Marker
            key={location.id}
            coordinate={{
              latitude: location.lat,
              longitude: location.lng,
            }}
            onPress={() => handleMarkerPress(location)}
            pinColor={getMarkerColor(location.id)}
          >
            <View style={[
              styles.customMarker,
              { backgroundColor: getMarkerColor(location.id) }
            ]}>
              <Text style={styles.markerPrice}>
                {priceData[location.id] 
                  ? `${Math.round(priceData[location.id].avg_price_per_m2 / 1000)}K`
                  : '?'
                }
              </Text>
            </View>
          </Marker>
        ))}

        {/* Heatmap */}
        {showHeatmap && priceData && (
          <Heatmap
            points={generateHeatmapData()}
            opacity={0.7}
            radius={50}
          />
        )}
      </MapView>

      {/* Price Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Fiyat Aralığı (m²)</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.legendText}>< 10K</Text>
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
            <Text style={styles.legendText}>> 30K</Text>
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
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => {
                      setShowLocationModal(false);
                      // Navigate to detailed query for this location
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
          <Text style={styles.loadingText}>Harita yükleniyor...</Text>
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
  controlText: {
    color: '#fff',
    fontSize: 12,
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
  map: {
    flex: 1,
  },
  customMarker: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  markerPrice: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  legend: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    backgroundColor: 'rgba(26, 35, 50, 0.9)',
    padding: 12,
    borderRadius: 8,
  },
  legendTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
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