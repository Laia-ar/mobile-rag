import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
type TermsAndConditionsScreenProps = { onAccept?: () => void };
const arrowRight = require('../assets/country-selector/arrow-right.png');
export function TermsAndConditionsScreen({
  onAccept,
}: TermsAndConditionsScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <View style={styles.statusDivider} />
      <View style={styles.header}>
        <Text style={styles.title}>Cómo usar esta plataforma</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Importante</Text>
        </View>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.paragraph}>
          Al utilizar esta herramienta, declaro que soy personal de salud y que
          emplearé el sistema exclusivamente como apoyo a mi práctica clínica.
        </Text>
        <Text style={styles.paragraph}>
          Entiendo que las recomendaciones proporcionadas se basan en guías
          médicas y modelos de apoyo a la decisión, pero no constituyen un
          diagnóstico definitivo ni reemplazan el juicio clínico profesional. La
          responsabilidad final sobre la evaluación, diagnóstico y tratamiento
          del paciente recae en quien realiza la consulta.
        </Text>
        <Text style={styles.paragraph}>
          Me comprometo a utilizar la información de manera ética, respetando la
          confidencialidad, privacidad y derechos de las personas atendidas,
          evitando el ingreso de datos sensibles innecesarios o identificables
          cuando no sea requerido.
        </Text>
        <Text style={styles.paragraphLast}>
          Reconozco que el sistema puede funcionar en condiciones de información
          incompleta o recursos limitados, por lo que debo interpretar sus
          sugerencias considerando el contexto clínico y las posibilidades
          locales.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={onAccept}
          style={({ pressed }) => [
            styles.acceptButton,
            pressed ? styles.acceptButtonPressed : null,
          ]}
        >
          <Text style={styles.acceptButtonText}>Aceptar y continuar</Text>
          <Image
            source={arrowRight}
            style={styles.arrowIcon}
            resizeMode="contain"
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
const bodyText = {
  color: '#525252',
  fontSize: 14.5,
  fontWeight: '400' as const,
  lineHeight: 21.5,
  letterSpacing: -0.15,
};
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  statusDivider: { height: 1, backgroundColor: '#E5E5E5' },
  header: { paddingTop: 30, paddingHorizontal: 16 },
  title: {
    color: '#262626',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
    letterSpacing: -0.45,
  },
  badge: {
    width: 88,
    height: 24,
    marginTop: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    backgroundColor: '#FFE2E4',
  },
  badgeText: {
    color: '#F32735',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
  scrollView: { flex: 1 },
  content: { paddingTop: 27, paddingHorizontal: 16 },
  paragraph: { ...bodyText, marginBottom: 21.5 },
  paragraphLast: { ...bodyText },
  footer: { height: 64, paddingTop: 16, paddingHorizontal: 16 },
  acceptButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: '#F32735',
  },
  acceptButtonPressed: { opacity: 0.86 },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -0.31,
    textAlign: 'center',
  },
  arrowIcon: { position: 'absolute', right: 16, width: 20, height: 20 },
});
