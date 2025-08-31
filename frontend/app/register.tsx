import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

type UserType = 'individual' | 'corporate';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [userType, setUserType] = useState<UserType>('individual');
  const [companyName, setCompanyName] = useState('');
  const [taxNumber, setTaxNumber] = useState(''); // Vergi numarası
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    // Validation
    if (!email || !password || !firstName || !lastName || !phone) {
      Alert.alert('Hata', 'Lütfen zorunlu alanları doldurun.');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi girin.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }

    // Phone validation
    const phoneRegex = /^(\+90|0)?[5][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      Alert.alert('Hata', 'Geçerli bir telefon numarası girin. (Örn: 0555 123 4567)');
      return;
    }

    if (userType === 'corporate') {
      if (!companyName || !taxNumber) {
        Alert.alert('Hata', 'Kurumsal üyelik için şirket adı ve vergi numarası zorunludur.');
        return;
      }
      
      // Tax number validation (10 digits)
      if (!/^\d{10}$/.test(taxNumber)) {
        Alert.alert('Hata', 'Vergi numarası 10 haneli olmalıdır.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const registrationData = {
        email: email.toLowerCase().trim(),
        password: password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        user_type: userType,
        phone: phone.trim(),
        company_name: userType === 'corporate' ? companyName.trim() : null,
        tax_number: userType === 'corporate' ? taxNumber.trim() : null,
      };

      const response = await fetch(`${EXPO_BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const data = await response.json();

      if (response.ok) {
        // Save token and user data
        await AsyncStorage.setItem('auth_token', data.token);
        await AsyncStorage.setItem('user_data', JSON.stringify(data.user));
        
        Alert.alert(
          'Hesap Oluşturuldu! 🎉',
          `Hoş geldiniz ${firstName}!\n\n✅ 5 ücretsiz sorgulama hakkınız bulunmaktadır.\n📱 5. sorgulamadan sonra telefon doğrulama ile +5 sorgu daha kazanabilirsiniz.`,
          [
            {
              text: 'Başlayalım',
              onPress: () => router.replace('/'),
            },
          ]
        );
      } else {
        Alert.alert('Hata', data.detail || 'Kayıt oluşturulamadı.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Üyelik Oluştur</Text>
            <Text style={styles.subtitle}>
              EmlakEkspertizi.com'a hoş geldiniz
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* User Type Selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Üyelik Türü</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={userType}
                  onValueChange={(itemValue) => setUserType(itemValue as UserType)}
                  style={styles.picker}
                >
                  <Picker.Item 
                    label="👤 Bireysel Üyelik (5 Ücretsiz Sorgulama)" 
                    value="individual" 
                  />
                  <Picker.Item 
                    label="🏢 Kurumsal Üyelik (5 Ücretsiz Sorgulama)" 
                    value="corporate" 
                  />
                </Picker>
              </View>
            </View>

            {/* Personal Information */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Ad *</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Adınız"
                placeholderTextColor="#8892a0"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Soyad *</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Soyadınız"
                placeholderTextColor="#8892a0"
                autoCapitalize="words"
              />
            </View>

            {/* Corporate Fields */}
            {userType === 'corporate' && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Şirket Adı *</Text>
                  <TextInput
                    style={styles.input}
                    value={companyName}
                    onChangeText={setCompanyName}
                    placeholder="Şirket adınız"
                    placeholderTextColor="#8892a0"
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Vergi Numarası *</Text>
                  <TextInput
                    style={styles.input}
                    value={taxNumber}
                    onChangeText={setTaxNumber}
                    placeholder="10 haneli vergi numarası"
                    placeholderTextColor="#8892a0"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </>
            )}

            {/* Contact Information */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>E-posta *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@email.com"
                placeholderTextColor="#8892a0"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Telefon Numarası *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="0555 123 4567"
                placeholderTextColor="#8892a0"
                keyboardType="phone-pad"
              />
              <Text style={styles.helpText}>
                📱 Telefon doğrulama ile +5 ek sorgulama hakkı kazanabilirsiniz
              </Text>
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Şifre *</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="En az 6 karakter"
                placeholderTextColor="#8892a0"
                secureTextEntry
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Şifre Tekrar *</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Şifrenizi tekrar girin"
                placeholderTextColor="#8892a0"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.registerButton, isLoading && styles.disabledButton]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              <Text style={styles.registerButtonText}>
                {isLoading ? 'Hesap oluşturuluyor...' : 'Hesap Oluştur'}
              </Text>
            </TouchableOpacity>

            {/* Benefit Info */}
            <View style={styles.benefitBox}>
              <Text style={styles.benefitTitle}>🎁 Üyelik Avantajlarınız:</Text>
              <Text style={styles.benefitText}>
                ✅ İlk kayıtta 5 ücretsiz sorgulama{'\n'}
                📱 Telefon doğrulama ile +5 ek sorgulama{'\n'}
                🗺️ Akıllı harita ve detaylı analizler{'\n'}
                🔔 Fiyat alarmları ve bildirimler{'\n'}
                📊 20 yıllık geçmiş veri arşivi{'\n'}
                🔒 Güvenli ve profesyonel hizmet
              </Text>
            </View>

            {/* Legal Notice */}
            <View style={styles.legalBox}>
              <Text style={styles.legalText}>
                Üye olarak{' '}
                <Text style={styles.legalLink}>Kullanım Şartları</Text>
                {' '}ve{' '}
                <Text style={styles.legalLink}>Gizlilik Politikası</Text>
                {'nı kabul etmiş olursunuz.'}
              </Text>
              <Text style={styles.legalSubtext}>
                Bu hizmet Nadas.com.tr güvencesiyle sunulmaktadır.
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Zaten hesabınız var mı?</Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.linkText}>Giriş Yapın</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Ana Sayfaya Dön</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  header: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#2563eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#bfdbfe',
    textAlign: 'center',
  },
  form: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  helpText: {
    fontSize: 12,
    color: '#2563eb',
    marginTop: 4,
  },
  pickerContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  picker: {
    color: '#1e293b',
    backgroundColor: 'transparent',
  },
  registerButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  benefitBox: {
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  legalBox: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  legalText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 8,
  },
  legalLink: {
    color: '#2563eb',
    fontWeight: '600',
  },
  legalSubtext: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  footerText: {
    color: '#64748b',
    fontSize: 16,
    marginRight: 8,
  },
  linkText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: '#64748b',
    fontSize: 16,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
  form: {
    padding: 16,
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
  input: {
    backgroundColor: '#1a2332',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
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
  registerButton: {
    backgroundColor: '#4f9eff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#6b7280',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: '#2d3748',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4f9eff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#8892a0',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  footerText: {
    color: '#8892a0',
    fontSize: 16,
    marginRight: 8,
  },
  linkText: {
    color: '#4f9eff',
    fontSize: 16,
    fontWeight: '600',
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