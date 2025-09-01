import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function PhoneVerification() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: phone input, 2: code verification
  const [timer, setTimer] = useState(0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer(timer - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setPhoneNumber(userData.phone || '');
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const sendVerificationCode = async () => {
    if (!phoneNumber) {
      Alert.alert('Hata', 'Telefon numaranızı girin.');
      return;
    }

    // Phone validation
    const phoneRegex = /^(\+90|0)?[5][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      Alert.alert('Hata', 'Geçerli bir telefon numarası girin. (Örn: 0555 123 4567)');
      return;
    }

    setIsLoading(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${EXPO_BACKEND_URL}/api/user/send-verification-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep(2);
        setTimer(60); // 60 seconds countdown
        Alert.alert('Kod Gönderildi! 📱', 'Telefon numaranıza doğrulama kodu gönderildi.');
      } else {
        Alert.alert('Hata', data.detail || 'Kod gönderilemedi.');
      }
    } catch (error) {
      console.error('Send code error:', error);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPhoneCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Hata', '6 haneli doğrulama kodunu girin.');
      return;
    }

    setIsLoading(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${EXPO_BACKEND_URL}/api/user/verify-phone`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber.trim(),
          verification_code: verificationCode.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Telefon Doğrulandı! 🎉',
          `Tebrikler! +5 ek sorgulama hakkınız hesabınıza eklendi.\n\nToplam sorgulama hakkınız: ${data.new_query_limit}`,
          [
            {
              text: 'Harika!',
              onPress: () => router.replace('/profile'),
            },
          ]
        );
      } else {
        Alert.alert('Hata', data.detail || 'Doğrulama kodu yanlış.');
      }
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  const resendCode = async () => {
    if (timer > 0) return;
    
    setTimer(60);
    setVerificationCode('');
    sendVerificationCode();
  };

  if (!user) {
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Telefon Doğrulama</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.content}>
          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressStep, step >= 1 && styles.activeStep]}>
              <Text style={[styles.stepNumber, step >= 1 && styles.activeStepNumber]}>1</Text>
            </View>
            <View style={[styles.progressLine, step >= 2 && styles.activeLine]} />
            <View style={[styles.progressStep, step >= 2 && styles.activeStep]}>
              <Text style={[styles.stepNumber, step >= 2 && styles.activeStepNumber]}>2</Text>
            </View>
          </View>

          <View style={styles.stepLabels}>
            <Text style={[styles.stepLabel, step >= 1 && styles.activeStepLabel]}>
              Telefon
            </Text>
            <Text style={[styles.stepLabel, step >= 2 && styles.activeStepLabel]}>
              Doğrulama
            </Text>
          </View>

          {step === 1 ? (
            /* Step 1: Phone Number Input */
            <View style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <Text style={styles.stepIcon}>📱</Text>
              </View>
              
              <Text style={styles.stepTitle}>Telefon Numaranızı Girin</Text>
              <Text style={styles.stepDescription}>
                Telefon numaranızı doğrulayarak +5 ek sorgulama hakkı kazanın
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Telefon Numarası</Text>
                <TextInput
                  style={styles.input}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="0555 123 4567"
                  placeholderTextColor="#8892a0"
                  keyboardType="phone-pad"
                  maxLength={14}
                />
                <Text style={styles.helpText}>
                  Türkiye cep telefonu numaranızı girin
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.disabledButton]}
                onPress={sendVerificationCode}
                disabled={isLoading}
              >
                <Text style={styles.primaryButtonText}>
                  {isLoading ? 'Kod Gönderiliyor...' : '📤 Doğrulama Kodu Gönder'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Step 2: Code Verification */
            <View style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <Text style={styles.stepIcon}>🔐</Text>
              </View>
              
              <Text style={styles.stepTitle}>Doğrulama Kodu</Text>
              <Text style={styles.stepDescription}>
                {phoneNumber} numarasına gönderilen 6 haneli kodu girin
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Doğrulama Kodu</Text>
                <TextInput
                  style={styles.codeInput}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  placeholder="123456"
                  placeholderTextColor="#8892a0"
                  keyboardType="numeric"
                  maxLength={6}
                  textAlign="center"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.disabledButton]}
                onPress={verifyPhoneCode}
                disabled={isLoading}
              >
                <Text style={styles.primaryButtonText}>
                  {isLoading ? 'Doğrulanıyor...' : '✅ Telefonu Doğrula'}
                </Text>
              </TouchableOpacity>

              <View style={styles.resendContainer}>
                {timer > 0 ? (
                  <Text style={styles.timerText}>
                    Yeniden gönder: {timer} saniye
                  </Text>
                ) : (
                  <TouchableOpacity onPress={resendCode}>
                    <Text style={styles.resendText}>🔄 Kodu Yeniden Gönder</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Benefits Info */}
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>🎁 Telefon Doğrulama Avantajları</Text>
            <Text style={styles.benefitsText}>
              ✅ +5 ek ücretsiz sorgulama hakkı{'\n'}
              ✅ Hesap güvenliği artırma{'\n'}
              ✅ Özel fırsat bildirimlerini alma{'\n'}
              ✅ Öncelikli müşteri desteği{'\n'}
              ✅ Premium özelliklere erişim
            </Text>
          </View>
        </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#2563eb',
    fontSize: 16,
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
  headerRight: {
    width: 50,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  progressStep: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeStep: {
    backgroundColor: '#2563eb',
  },
  stepNumber: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeStepNumber: {
    color: '#ffffff',
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
  },
  activeLine: {
    backgroundColor: '#2563eb',
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
  },
  stepLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  activeStepLabel: {
    color: '#2563eb',
    fontWeight: '600',
  },
  stepContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepIcon: {
    fontSize: 40,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
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
    fontSize: 18,
    color: '#1e293b',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 24,
    color: '#1e293b',
    borderWidth: 2,
    borderColor: '#2563eb',
    textAlign: 'center',
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  timerText: {
    color: '#64748b',
    fontSize: 14,
  },
  resendText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  benefitsCard: {
    backgroundColor: '#dbeafe',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 12,
  },
  benefitsText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
});