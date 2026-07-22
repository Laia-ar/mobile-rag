import React, { useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type WelcomeStep = 0 | 1 | 2;

type WelcomeScreenProps = {
  onFinish: () => void | Promise<void>;
};

type NavigationItem = {
  label: string;
  activeIcon: ImageSourcePropType;
  inactiveIcon: ImageSourcePropType;
};

const closeIcon = require('../assets/welcome/close.png');
const arrowRightIcon = require('../assets/welcome/arrow-right.png');
const guidesActiveIcon = require('../assets/welcome/guides-active.png');
const guidesInactiveIcon = require('../assets/welcome/guides-inactive.png');
const consultationActiveIcon = require('../assets/welcome/consultation-active.png');
const consultationInactiveIcon = require('../assets/welcome/consultation-inactive.png');
const profileActiveIcon = require('../assets/welcome/profile-active.png');
const profileInactiveIcon = require('../assets/welcome/profile-inactive.png');

const steps = [
  {
    title: 'Guías y recursos',
    description:
      'Accedé a guías actualizadas y contenido validado para la atención clínica.',
    action: 'Siguiente',
    pointerLeft: 31,
  },
  {
    title: 'Orientación clínica',
    description:
      'Realizá consultas y accedé a recomendaciones basadas en evidencia.',
    action: 'Siguiente',
    pointerLeft: 139,
  },
  {
    title: 'Perfil y configuración',
    description:
      'Gestioná tu cuenta, accesos y contenidos guardados en la aplicación.',
    action: 'Finalizar',
    pointerLeft: 250,
  },
] as const;

const navigationItems: NavigationItem[] = [
  {
    label: 'Guías',
    activeIcon: guidesActiveIcon,
    inactiveIcon: guidesInactiveIcon,
  },
  {
    label: 'Consulta',
    activeIcon: consultationActiveIcon,
    inactiveIcon: consultationInactiveIcon,
  },
  {
    label: 'Perfil',
    activeIcon: profileActiveIcon,
    inactiveIcon: profileInactiveIcon,
  },
];

export function WelcomeScreen({ onFinish }: WelcomeScreenProps) {
  const [step, setStep] = useState<WelcomeStep>(0);
  const currentStep = steps[step];

  const finishTutorial = async () => {
    await onFinish();
  };

  const handleNext = async () => {
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      setStep(2);
    } else {
      await finishTutorial();
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <View style={styles.statusDivider} />

      <View style={styles.content}>
        <Text style={styles.title}>Bienvenidx</Text>
        <Text style={styles.description}>
          Esta plataforma es una herramienta de apoyo a la decisión clínica
          creada exclusivamente para asistir al personal de salud en la
          detección temprana y el abordaje integral de infecciones de transmisión
          sexual. En esta etapa del desarrollo los contenidos abordados son
          específicamente VIH y Sífilis.
        </Text>
      </View>

      <View style={styles.tutorialCard}>
          <View
            style={[
              styles.tutorialPointer,
              { left: currentStep.pointerLeft },
            ]}
          />

          <Text style={styles.tutorialTitle}>{currentStep.title}</Text>
          <Text style={styles.tutorialDescription}>
            {currentStep.description}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Siguiente tarjeta"
            hitSlop={10}
            onPress={handleNext}
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Image source={closeIcon} style={styles.closeIcon} />
          </Pressable>

          <View style={styles.pagination} accessibilityElementsHidden>
            {steps.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === step
                    ? styles.paginationDotActive
                    : styles.paginationDotInactive,
                ]}
              />
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handleNext}
            style={({ pressed }) => [
              styles.nextButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.nextButtonText}>{currentStep.action}</Text>
            <Image
              source={arrowRightIcon}
              style={styles.nextButtonIcon}
              resizeMode="contain"
            />
          </Pressable>
      </View>

      <View style={styles.bottomNavigation}>
        {navigationItems.map((item, index) => {
          const isActive = index === step;
          const color = isActive ? '#F32735' : '#A1A1A1';

          return (
            <View key={item.label} style={styles.navigationItem}>
              <Image
                source={isActive ? item.activeIcon : item.inactiveIcon}
                style={styles.navigationIcon}
                resizeMode="contain"
              />
              <Text style={[styles.navigationLabel, { color }]}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  statusDivider: {
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  content: {
    paddingTop: 23,
    paddingHorizontal: 16,
  },
  title: {
    color: '#262626',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
    letterSpacing: -0.45,
  },
  description: {
    marginTop: 17,
    color: '#525252',
    fontSize: 14.5,
    fontWeight: '400',
    lineHeight: 21.5,
    letterSpacing: -0.15,
  },
  tutorialCard: {
    position: 'absolute',
    right: 32,
    bottom: 80,
    left: 32,
    height: 128,
    paddingTop: 16,
    paddingHorizontal: 19,
    borderRadius: 14,
    backgroundColor: '#F5F6F9',
  },
  tutorialPointer: {
    position: 'absolute',
    bottom: -11,
    width: 0,
    height: 0,
    borderTopWidth: 16,
    borderRightWidth: 10.5,
    borderLeftWidth: 10.5,
    borderTopColor: '#F5F6F9',
    borderRightColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  tutorialTitle: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },
  tutorialDescription: {
    width: 250,
    marginTop: 6,
    color: '#404040',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: -0.15,
  },
  closeButton: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    width: 14,
    height: 14,
  },
  pagination: {
    position: 'absolute',
    bottom: 23,
    left: 19,
    flexDirection: 'row',
    gap: 3,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  paginationDotActive: {
    backgroundColor: '#0A0A0A',
  },
  paginationDotInactive: {
    backgroundColor: '#E5E5E5',
  },
  nextButton: {
    position: 'absolute',
    right: 17,
    bottom: 14,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#F32735',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
    textDecorationLine: 'underline',
  },
  nextButtonIcon: {
    width: 17,
    height: 17,
    marginLeft: 3,
  },
  pressed: {
    opacity: 0.62,
  },
  bottomNavigation: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 56,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  navigationItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 7,
  },
  navigationIcon: {
    width: 24,
    height: 24,
  },
  navigationLabel: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center',
  },
});
