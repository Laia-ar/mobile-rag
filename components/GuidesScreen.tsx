import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {KnowledgeDocument, KnowledgePackageStatus} from '../types/knowledge';

type GuidesScreenProps = {
  documents: KnowledgeDocument[];
  status: KnowledgePackageStatus;
  error?: Error | null;
  savedGuideIds: string[];
  onOpenGuide: (guide: KnowledgeDocument) => void;
  onToggleGuide: (guide: KnowledgeDocument) => void;
};

const searchIcon = require('../assets/guides/search.png');
const openBookIcon = require('../assets/guides/open-book.png');
const bookmarkIcon = require('./bookmark.png');
const bookmarkSavedIcon = require('./bookmark-saved.png');

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es');
}

function formatSize(value?: number): string | null {
  if (!value) return null;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.ceil(value / 1024)} KB`;
}

export function GuidesScreen({
  documents,
  status,
  error,
  savedGuideIds,
  onOpenGuide,
  onToggleGuide,
}: GuidesScreenProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearch(query);
  const visibleGuides = useMemo(
    () =>
      documents.filter(guide =>
        normalizeSearch(
          [guide.title, guide.description, guide.institution].join(' '),
        ).includes(normalizedQuery),
      ),
    [documents, normalizedQuery],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Guías y documentos</Text>
        <Text style={styles.subtitle}>
          Documentos incluidos en el paquete clínico instalado.
        </Text>
        <View style={styles.searchBox}>
          <Image source={searchIcon} style={styles.searchIcon} />
          <TextInput
            accessibilityLabel="Buscar en las guías"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Buscar en las guías"
            placeholderTextColor="#A1A1A1"
            style={styles.searchInput}
            value={query}
          />
        </View>
      </View>

      {status === 'loading' ? (
        <View style={styles.state}>
          <ActivityIndicator color="#F32735" />
          <Text style={styles.stateText}>Leyendo el catálogo offline…</Text>
        </View>
      ) : status === 'missing' || status === 'error' ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>
            {status === 'missing' ? 'Paquete offline pendiente' : 'Paquete no disponible'}
          </Text>
          <Text style={styles.errorText}>{error?.message}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.guidesContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {visibleGuides.map(guide => (
            <GuideCard
              guide={guide}
              isSaved={savedGuideIds.includes(guide.id)}
              key={guide.id}
              onOpen={() => onOpenGuide(guide)}
              onToggle={() => onToggleGuide(guide)}
            />
          ))}
          {visibleGuides.length === 0 ? (
            <View style={styles.state}>
              <Text style={styles.stateText}>
                {query.trim()
                  ? `No se encontraron guías para “${query.trim()}”.`
                  : 'El catálogo instalado no contiene documentos para este país.'}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function GuideCard({
  guide,
  isSaved,
  onOpen,
  onToggle,
}: {
  guide: KnowledgeDocument;
  isSaved: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const metadata = [
    guide.publishedAt?.slice(0, 4),
    guide.pageCount ? `${guide.pageCount} págs.` : null,
    formatSize(guide.fileSize),
  ].filter(Boolean);

  return (
    <View style={styles.guideCard}>
      <Text numberOfLines={2} style={styles.guideTitle}>{guide.title}</Text>
      <Text numberOfLines={1} style={styles.institutionText}>
        {guide.institution || guide.description || 'Guía clínica'}
      </Text>
      {metadata.length ? (
        <Text style={styles.metadata}>{metadata.join(' · ')}</Text>
      ) : null}
      <View style={styles.actionsRow}>
        <Pressable onPress={onOpen} style={styles.openButton}>
          <Image source={openBookIcon} style={styles.openBookIcon} />
          <Text style={styles.openButtonText}>Abrir</Text>
        </Pressable>
        <Pressable
          accessibilityState={{selected: isSaved}}
          onPress={onToggle}
          style={[styles.saveButton, isSaved && styles.savedButton]}>
          <Image
            source={isSaved ? bookmarkSavedIcon : bookmarkIcon}
            style={styles.bookmarkIcon}
          />
          <Text style={styles.saveButtonText}>
            {isSaved ? 'Guardado' : 'Guardar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {paddingTop: 23, paddingHorizontal: 16},
  title: {fontSize: 20, fontWeight: '700', color: '#262626'},
  subtitle: {marginTop: 7, fontSize: 14, lineHeight: 20, color: '#525252'},
  searchBox: {height: 42, flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingHorizontal: 11, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 8},
  searchIcon: {width: 14, height: 14},
  searchInput: {flex: 1, marginLeft: 9, color: '#262626', fontSize: 14},
  guidesContent: {padding: 16, paddingBottom: 88, gap: 12},
  guideCard: {padding: 15, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10, backgroundColor: '#FFFFFF'},
  guideTitle: {fontSize: 16, lineHeight: 21, fontWeight: '700', color: '#171717'},
  institutionText: {marginTop: 5, fontSize: 13, color: '#737373'},
  metadata: {marginTop: 8, fontSize: 12, color: '#A1A1A1'},
  actionsRow: {flexDirection: 'row', gap: 8, marginTop: 14},
  openButton: {height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 7, backgroundColor: '#F32735'},
  openBookIcon: {width: 16, height: 14, marginRight: 6},
  openButtonText: {fontSize: 15, fontWeight: '600', color: '#FFFFFF'},
  saveButton: {height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: '#F32735', borderRadius: 7},
  savedButton: {backgroundColor: '#FEE5E7'},
  bookmarkIcon: {width: 13, height: 14, marginRight: 7},
  saveButtonText: {fontSize: 15, fontWeight: '600', color: '#F32735'},
  state: {alignItems: 'center', justifyContent: 'center', gap: 10, padding: 36},
  stateText: {fontSize: 14, lineHeight: 20, textAlign: 'center', color: '#737373'},
  errorCard: {margin: 16, padding: 16, borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, backgroundColor: '#FEF2F2'},
  errorTitle: {fontSize: 16, fontWeight: '700', color: '#991B1B'},
  errorText: {marginTop: 6, fontSize: 13, lineHeight: 19, color: '#7F1D1D'},
});
