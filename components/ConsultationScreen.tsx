import React from 'react';
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
import {
  KnowledgeDocument,
  KnowledgePackageStatus,
  SavedGuide,
  SavedSource,
} from '../types/knowledge';
import { GuidesScreen } from './GuidesScreen';
import {ProfileScreen} from './ProfileScreen';

export type MainSection = 'guides' | 'consultation' | 'profile';

type ConsultationScreenProps = {
  activeSection?: MainSection;
  onSelectSection?: (section: MainSection) => void;
  onOpenChatbot?: () => void;
  onOpenRecommendations?: () => void;
  onOpenInteractionGuide?: () => void;
  onOpenHelp?: () => void;
  documents: KnowledgeDocument[];
  knowledgeStatus: KnowledgePackageStatus;
  knowledgeError?: Error | null;
  savedGuideIds?: string[];
  onToggleGuide: (guide: KnowledgeDocument) => void;
  onOpenGuide: (guide: KnowledgeDocument) => void;
  savedGuides: SavedGuide[];
  savedSources: SavedSource[];
  onOpenSavedSource: (source: SavedSource) => void;
  onRemoveSource: (chunkId: string) => void;
};

type NavigationItem = {
  id: MainSection;
  label: string;
  activeIcon: ImageSourcePropType;
  inactiveIcon: ImageSourcePropType;
};

const chatbotIcon = require('../assets/consultation/chatbot.png');
const recommendationsIcon = require('../assets/consultation/recommendations.png');
const externalLinkIcon = require('../assets/consultation/external-link.png');
const wifiIcon = require('../assets/consultation/wifi.png');
const guidesActiveIcon = require('../assets/welcome/guides-active.png');
const guidesInactiveIcon = require('../assets/welcome/guides-inactive.png');
const consultationActiveIcon = require('../assets/welcome/consultation-active.png');
const consultationInactiveIcon = require('../assets/welcome/consultation-inactive.png');
const profileActiveIcon = require('../assets/welcome/profile-active.png');
const profileInactiveIcon = require('../assets/welcome/profile-inactive.png');

const navigationItems: NavigationItem[] = [
  {
    id: 'guides',
    label: 'Guías',
    activeIcon: guidesActiveIcon,
    inactiveIcon: guidesInactiveIcon,
  },
  {
    id: 'consultation',
    label: 'Consulta',
    activeIcon: consultationActiveIcon,
    inactiveIcon: consultationInactiveIcon,
  },
  {
    id: 'profile',
    label: 'Perfil',
    activeIcon: profileActiveIcon,
    inactiveIcon: profileInactiveIcon,
  },
];

export function ConsultationScreen({
  activeSection = 'consultation',
  onSelectSection,
  onOpenChatbot,
  onOpenRecommendations,
  onOpenInteractionGuide,
  onOpenHelp,
  documents,
  knowledgeStatus,
  knowledgeError,
  savedGuideIds = [],
  onToggleGuide,
  onOpenGuide,
  savedGuides,
  savedSources,
  onOpenSavedSource,
  onRemoveSource,
}: ConsultationScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <View style={styles.statusDivider} />

      {activeSection === 'consultation' ? (
        <View style={styles.content}>
          <Text style={styles.title}>Consulta</Text>
          <Text style={styles.subtitle}>Herramientas para uso del personal:</Text>

          <Pressable
            accessibilityRole="button"
            onPress={onOpenChatbot}
            style={({ pressed }) => [
              styles.chatbotCard,
              pressed && onOpenChatbot ? styles.pressed : null,
            ]}
          >
            <Image source={chatbotIcon} style={styles.chatbotIcon} />
            <Text style={styles.cardTitle}>Chatbot</Text>
            <Text style={styles.cardDescription}>Consulta directa al RAG</Text>
          </Pressable>

          <View style={styles.secondaryCards}>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenRecommendations}
              style={({ pressed }) => [
                styles.secondaryCard,
                pressed && onOpenRecommendations ? styles.pressed : null,
              ]}
            >
              <Image source={recommendationsIcon} style={styles.cardIcon} />
              <Text style={styles.cardTitle}>Recomendaciones</Text>
              <Text style={styles.secondaryDescription}>
                Buenas prácticas para una consulta integral
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onOpenInteractionGuide}
              style={({ pressed }) => [
                styles.secondaryCard,
                pressed && onOpenInteractionGuide ? styles.pressed : null,
              ]}
            >
              <Image source={externalLinkIcon} style={styles.cardIcon} />
              <Text style={styles.interactionTitle}>
                Guía: interacciones{`\n`}entre medicación
              </Text>
              <View style={styles.connectionRequirement}>
                <Image source={wifiIcon} style={styles.wifiIcon} />
                <Text style={styles.connectionText}>Requiere conexión</Text>
              </View>
            </Pressable>
          </View>
        </View>
      ) : activeSection === 'guides' ? (
        <GuidesScreen
          documents={documents}
          error={knowledgeError}
          onOpenGuide={onOpenGuide}
          onToggleGuide={onToggleGuide}
          savedGuideIds={savedGuideIds}
          status={knowledgeStatus}
        />
      ) : (
        <ProfileScreen
          guides={savedGuides}
          onOpenGuide={onOpenGuide}
          onOpenSource={onOpenSavedSource}
          onRemoveGuide={onToggleGuide}
          onRemoveSource={onRemoveSource}
          sources={savedSources}
        />
      )}

      {activeSection === 'consultation' ? (
        <Pressable
          accessibilityRole="link"
          onPress={onOpenHelp}
          hitSlop={12}
          style={({ pressed }) => [
            styles.helpButton,
            pressed && onOpenHelp ? styles.pressed : null,
          ]}
        >
          <Text style={styles.helpText}>Ayuda</Text>
        </Pressable>
      ) : null}

      <View style={styles.bottomNavigation}>
        {navigationItems.map(item => {
          const isActive = item.id === activeSection;
          const color = isActive ? '#F32735' : '#A1A1A1';

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelectSection?.(item.id)}
              style={({ pressed }) => [
                styles.navigationItem,
                pressed ? styles.pressed : null,
              ]}
            >
              <Image
                source={isActive ? item.activeIcon : item.inactiveIcon}
                style={styles.navigationIcon}
                resizeMode="contain"
              />
              <Text style={[styles.navigationLabel, { color }]}>
                {item.label}
              </Text>
            </Pressable>
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
  subtitle: {
    marginTop: 8,
    color: '#A1A1A1',
    fontSize: 14.5,
    fontWeight: '400',
    lineHeight: 21.5,
    letterSpacing: -0.15,
  },
  chatbotCard: {
    height: 120,
    marginTop: 25,
    paddingHorizontal: 17,
    borderRadius: 11,
    backgroundColor: '#F5F6F9',
  },
  chatbotIcon: {
    width: 28,
    height: 28,
    marginTop: 18,
  },
  cardIcon: {
    width: 24,
    height: 24,
    marginTop: 10,
  },
  cardTitle: {
    marginTop: 14,
    color: '#000000',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 17,
    letterSpacing: -0.15,
  },
  cardDescription: {
    marginTop: 1,
    color: '#525252',
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 17.5,
    letterSpacing: -0.3,
  },
  secondaryCards: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  secondaryCard: {
    flex: 1,
    height: 120,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  secondaryDescription: {
    marginTop: 1,
    color: '#525252',
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 17.5,
    letterSpacing: -0.3,
  },
  interactionTitle: {
    marginTop: 14,
    color: '#171717',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 17,
    letterSpacing: -0.15,
  },
  connectionRequirement: {
    position: 'absolute',
    bottom: 12,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wifiIcon: {
    width: 11,
    height: 9,
  },
  connectionText: {
    marginLeft: 5,
    color: '#525252',
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 17.5,
    letterSpacing: -0.3,
  },
  helpButton: {
    position: 'absolute',
    bottom: 72,
    alignSelf: 'center',
    minHeight: 32,
    justifyContent: 'center',
  },
  helpText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16,
    textDecorationLine: 'underline',
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
