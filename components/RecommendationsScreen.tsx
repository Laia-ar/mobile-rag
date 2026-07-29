import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type RecommendationsScreenProps = {
  onBack: () => void;
};

type Recommendation = {
  id: string;
  title: string;
  body: string;
  icon: ImageSourcePropType;
  minHeight: number;
};

const backIcon = require('../assets/recommendations/back.png');
const personIcon = require('../assets/recommendations/person.png');
const practicesIcon = require('../assets/recommendations/practices.png');
const reasonIcon = require('../assets/recommendations/reason.png');
const privacyIcon = require('../assets/recommendations/privacy.png');

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'name-and-pronoun',
    title: 'Nombre y pronombre',
    body:
      'Preguntá el nombre o pronombre con el que la persona se identifica y, si ocurre una equivocación, disculpate. Ante dudas, es preferible nombrarla por el apellido y luego, en privado, preguntar y aclarar. Evitá asumir o presuponer.',
    icon: personIcon,
    minHeight: 225,
  },
  {
    id: 'practices-not-identity',
    title: 'Prácticas, no identidad',
    body:
      'Para evaluar ITS, centrate en las prácticas sexuales y no en la identidad de género u orientación sexual. Intervení de forma libre de prejuicios, favoreciendo un ámbito de confianza. Preguntá y no asumas.',
    icon: practicesIcon,
    minHeight: 225,
  },
  {
    id: 'explain-why',
    title: 'Explicá el porqué',
    body:
      'Al preguntar sobre determinados aspectos —por ejemplo, el inicio o el tipo de relaciones sexuales— es importante aclarar el fundamento que origina esa pregunta.',
    icon: reasonIcon,
    minHeight: 204,
  },
  {
    id: 'respect-privacy',
    title: 'Respetá la intimidad',
    body:
      'Abordá sólo lo relevante para la consulta, evitando indagar sobre cuestiones que invadan la intimidad sin necesidad (como el nombre de nacimiento o intervenciones sobre el cuerpo sin motivo). Respetá si la persona no desea responder o profundizar.',
    icon: privacyIcon,
    minHeight: 250,
  },
];

export function RecommendationsScreen({
  onBack,
}: RecommendationsScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <View style={styles.statusDivider} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Pressable
            accessibilityLabel="Volver a Consulta"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Image source={backIcon} style={styles.backIcon} />
          </Pressable>
          <Text style={styles.title}>Recomendaciones</Text>
        </View>
        <Text style={styles.subtitle}>
          Algunas recomendaciones para el abordaje integral en las consultas en
          salud.
        </Text>

        <View style={styles.cards}>
          {RECOMMENDATIONS.map(recommendation => (
            <View
              key={recommendation.id}
              style={[
                styles.card,
                { minHeight: recommendation.minHeight },
              ]}
            >
              <Image source={recommendation.icon} style={styles.cardIcon} />
              <Text style={styles.cardTitle}>{recommendation.title}</Text>
              <Text style={styles.cardBody}>{recommendation.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  statusDivider: { height: 1, backgroundColor: '#E5E5E5' },
  content: {
    paddingTop: 23,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  titleRow: {
    height: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 20,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { width: 20, height: 20, resizeMode: 'contain' },
  title: {
    marginLeft: 3,
    color: '#262626',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
    letterSpacing: -0.45,
  },
  subtitle: {
    width: 328,
    marginTop: 8,
    color: '#A1A1A1',
    fontSize: 14.5,
    lineHeight: 21.5,
    letterSpacing: -0.15,
  },
  cards: { gap: 16, marginTop: 18 },
  card: {
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  cardIcon: { width: 24, height: 24, resizeMode: 'contain' },
  cardTitle: {
    marginTop: 16,
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 17,
    letterSpacing: -0.15,
  },
  cardBody: {
    marginTop: 6,
    color: '#525252',
    fontSize: 14.5,
    lineHeight: 21.5,
    letterSpacing: -0.15,
  },
  pressed: { opacity: 0.62 },
});
