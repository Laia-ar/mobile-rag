import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SavedGuide, SavedSource} from '../types/knowledge';

type ProfileScreenProps = {
  guides: SavedGuide[];
  sources: SavedSource[];
  onOpenGuide: (guide: SavedGuide) => void;
  onOpenSource: (source: SavedSource) => void;
  onRemoveGuide: (guide: SavedGuide) => void;
  onRemoveSource: (chunkId: string) => void;
};

export function ProfileScreen({
  guides,
  sources,
  onOpenGuide,
  onOpenSource,
  onRemoveGuide,
  onRemoveSource,
}: ProfileScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Guardados</Text>
      <Text style={styles.subtitle}>
        Guías completas y fragmentos que guardaste en este dispositivo.
      </Text>

      <Text style={styles.sectionTitle}>Guías ({guides.length})</Text>
      {guides.map(guide => (
        <View key={guide.id} style={styles.card}>
          <Text style={styles.cardTitle}>{guide.title}</Text>
          <Text style={styles.meta}>{guide.institution || 'Guía clínica'}</Text>
          <View style={styles.actions}>
            <Action label="Abrir PDF" onPress={() => onOpenGuide(guide)} primary />
            <Action label="Quitar" onPress={() => onRemoveGuide(guide)} />
          </View>
        </View>
      ))}
      {guides.length === 0 ? (
        <Text style={styles.empty}>Todavía no guardaste guías completas.</Text>
      ) : null}

      <Text style={styles.sectionTitle}>Fragmentos ({sources.length})</Text>
      {sources.map(source => (
        <View key={source.chunkId} style={styles.card}>
          <Text style={styles.cardTitle}>{source.title}</Text>
          <Text style={styles.meta}>
            {source.page ? `Página ${source.page}` : 'Ubicación no informada'}
          </Text>
          <Text numberOfLines={4} style={styles.excerpt}>{source.content}</Text>
          <View style={styles.actions}>
            <Action label="Abrir origen" onPress={() => onOpenSource(source)} primary />
            <Action label="Quitar" onPress={() => onRemoveSource(source.chunkId)} />
          </View>
        </View>
      ))}
      {sources.length === 0 ? (
        <Text style={styles.empty}>Todavía no guardaste fragmentos.</Text>
      ) : null}
    </ScrollView>
  );
}

function Action({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.action, primary ? styles.primary : styles.secondary]}>
      <Text style={primary ? styles.primaryText : styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {padding: 16, paddingTop: 23, paddingBottom: 90},
  title: {fontSize: 20, fontWeight: '700', color: '#262626'},
  subtitle: {marginTop: 7, fontSize: 14, lineHeight: 20, color: '#525252'},
  sectionTitle: {marginTop: 24, marginBottom: 10, fontSize: 16, fontWeight: '700', color: '#404040'},
  card: {marginBottom: 10, padding: 14, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10, backgroundColor: '#FFFFFF'},
  cardTitle: {fontSize: 15, lineHeight: 20, fontWeight: '700', color: '#262626'},
  meta: {marginTop: 4, fontSize: 12, color: '#737373'},
  excerpt: {marginTop: 9, fontSize: 13, lineHeight: 19, color: '#525252'},
  actions: {flexDirection: 'row', gap: 8, marginTop: 12},
  action: {minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 7},
  primary: {backgroundColor: '#F32735'},
  secondary: {borderWidth: 1, borderColor: '#D4D4D4'},
  primaryText: {fontSize: 13, fontWeight: '600', color: '#FFFFFF'},
  secondaryText: {fontSize: 13, fontWeight: '600', color: '#525252'},
  empty: {paddingVertical: 12, fontSize: 13, color: '#8A8A8A'},
});
