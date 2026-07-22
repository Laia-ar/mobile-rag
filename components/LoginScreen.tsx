import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatbotScreen } from './ChatbotScreen';
import { ConsultationScreen, MainSection } from './ConsultationScreen';
import { TermsAndConditionsScreen } from './TermsAndConditionsScreen';
import { WelcomeScreen } from './WelcomeScreen';

type LoginScreenProps = {
  onLogin?: (accessId: string) => void;
  onRequestAccess?: () => void;
};

const brandTail = require('../assets/login/infectoassist-tail.png');
const fundacionHuespedLogo = require('../assets/country-selector/fundacion-huesped.png');
const ONBOARDING_COMPLETED_KEY = '@infecto-assist/onboarding-completed';

export function LoginScreen({ onLogin, onRequestAccess }: LoginScreenProps) {
  const [accessId, setAccessId] = useState('');
  const [hasLoggedIn, setHasLoggedIn] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [savedSourceIds, setSavedSourceIds] = useState<string[]>([]);
  const [activeMainSection, setActiveMainSection] =
    useState<MainSection>('consultation');
  const normalizedAccessId = accessId.trim();
  const canLogin = normalizedAccessId.length > 0;

  const handleLogin = () => {
    if (canLogin) {
      onLogin?.(normalizedAccessId);
      setHasLoggedIn(true);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)
      .then(value => setHasCompletedOnboarding(value === 'true'))
      .catch(() => setHasCompletedOnboarding(false));
  }, []);

  const handleFinishOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch {
      // La navegación no debe bloquearse si la app instalada todavía no
      // incluye el módulo nativo de AsyncStorage.
    } finally {
      setActiveMainSection('consultation');
      setHasCompletedOnboarding(true);
    }
  };

  const handleOpenProfile = () => {
    setIsChatbotOpen(false);
    setActiveMainSection('profile');
  };

  if (hasAcceptedTerms) {
    if (hasCompletedOnboarding) {
      if (isChatbotOpen) {
        return (
          <ChatbotScreen
            onBack={() => setIsChatbotOpen(false)}
            onOpenProfile={handleOpenProfile}
            onSavedSourceIdsChange={setSavedSourceIds}
            savedSourceIds={savedSourceIds}
          />
        );
      }

      return (
        <ConsultationScreen
          activeSection={activeMainSection}
          onOpenChatbot={() => setIsChatbotOpen(true)}
          onSelectSection={setActiveMainSection}
        />
      );
    }

    return <WelcomeScreen onFinish={handleFinishOnboarding} />;
  }

  if (hasLoggedIn) {
    return (
      <TermsAndConditionsScreen
        onAccept={() => setHasAcceptedTerms(true)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.brandMark} accessibilityElementsHidden>
          <Image
            source={brandTail}
            style={styles.brandTail}
            resizeMode="contain"
          />
          <View style={styles.brandBubble} />
        </View>
        <Text style={styles.brandName}>InfectoAssist</Text>
        <Text style={styles.description}>
          Información actualizada y basada en evidencia para la atención en
          enfermedades infecciosas orientada a personal de salud
        </Text>
        <View style={styles.accessPanel}>
          <Text style={styles.accessTitle}>ID de acceso</Text>
          <TextInput
            accessibilityLabel="ID de acceso"
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setAccessId}
            onSubmitEditing={handleLogin}
            returnKeyType="done"
            selectionColor="#F32735"
            style={styles.accessInput}
            value={accessId}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canLogin }}
            disabled={!canLogin}
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.loginButton,
              canLogin ? styles.loginButtonEnabled : styles.loginButtonDisabled,
              pressed && canLogin ? styles.loginButtonPressed : null,
            ]}
          >
            <Text style={styles.loginButtonText}>Ingresar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Solicitar un número de ID"
            onPress={onRequestAccess}
            hitSlop={12}
            style={({ pressed }) => [
              styles.requestAccess,
              pressed ? styles.requestAccessPressed : null,
            ]}
          >
            <Text style={styles.requestAccessText}>
              ¿No tenés un número de ID?
            </Text>
          </Pressable>
          <Image
            source={fundacionHuespedLogo}
            style={styles.footerLogo}
            resizeMode="contain"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { flex: 1 },
  brandMark: {
    position: 'absolute',
    top: 115,
    left: '50%',
    width: 91.978,
    height: 93,
    marginLeft: -45.989,
  },
  brandTail: {
    position: 'absolute',
    left: 6.13,
    top: 44.97,
    width: 44.153,
    height: 48.033,
  },
  brandBubble: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 91.978,
    height: 70.516,
    borderRadius: 20,
    backgroundColor: '#F32735',
  },
  brandName: {
    position: 'absolute',
    top: 227,
    alignSelf: 'center',
    color: '#F32735',
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 34,
    letterSpacing: -0.45,
    textAlign: 'center',
  },
  description: {
    position: 'absolute',
    top: 280,
    width: 312,
    alignSelf: 'center',
    color: '#525252',
    fontSize: 14.5,
    fontWeight: '400',
    lineHeight: 21.5,
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  accessPanel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 352,
    paddingHorizontal: 32,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    backgroundColor: '#F5F6F9',
  },
  accessTitle: {
    marginTop: 33,
    color: '#404040',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  accessInput: {
    height: 46,
    marginTop: 19,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#F3F3F3',
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    color: '#000000',
    fontSize: 16,
    lineHeight: 20,
  },
  loginButton: {
    height: 46,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  loginButtonDisabled: { backgroundColor: 'rgba(243, 39, 53, 0.25)' },
  loginButtonEnabled: { backgroundColor: '#F32735' },
  loginButtonPressed: { opacity: 0.86 },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -0.31,
    textAlign: 'center',
  },
  requestAccess: { alignSelf: 'center', marginTop: 30 },
  requestAccessPressed: { opacity: 0.62 },
  requestAccessText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  footerLogo: {
    position: 'absolute',
    top: 272,
    left: '50%',
    width: 54.3,
    height: 51,
    marginLeft: -27.15,
  },
});
