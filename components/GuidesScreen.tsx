
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  GUIDE_MOCK_DOCUMENTS,
  GUIDE_QUICK_SUGGESTIONS,
  GuideMockDocument,
} from '../data/guidesMock';

type GuidesScreenProps = {
  savedGuideIds: string[];
  onSavedGuideIdsChange: (guideIds: string[]) => void;
  onOpenProfile: () => void;
  onOpenGuide?: (guide: GuideMockDocument) => void;
};

const searchIcon = require('../assets/guides/search.png');
const metadataImage = require('../assets/guides/metadata.png');
const openBookIcon = require('../assets/guides/open-book.png');
const clearIcon = require('../assets/guides/clear.png');
const bookmarkIcon = require('./bookmark.png');
const bookmarkSavedIcon = require('./bookmark-saved.png');
const savedCheckIcon = require('./saved-check.png');

const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es');

const GUIDE_TYPING_SUGGESTIONS = [
  'PEP',
  'PrEP',
  'Diagnóstico VIH',
  'Diagnóstico Sífilis',
  'Tratamiento VIH',
  'Tratamiento Sífilis',
  'Derechos',
  'Información general',
] as const;

export function GuidesScreen({
  savedGuideIds,
  onSavedGuideIdsChange,
  onOpenProfile,
  onOpenGuide,
}: GuidesScreenProps) {
  const [query, setQuery] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(
    null,
  );
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const savedConfirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(
    () => () => {
      if (savedConfirmationTimer.current) {
        clearTimeout(savedConfirmationTimer.current);
      }
    },
    [],
  );

  const normalizedQuery = normalizeSearch(query);
  const activeSearch = selectedSuggestion
    ? normalizeSearch(selectedSuggestion)
    : '';
  const visibleGuides = activeSearch
    ? GUIDE_MOCK_DOCUMENTS.filter(guide => {
        const searchableText = normalizeSearch(
          [guide.title, guide.institution, ...guide.searchTerms].join(' '),
        );

        return searchableText.includes(activeSearch);
      })
    : normalizedQuery
      ? []
      : GUIDE_MOCK_DOCUMENTS.filter(guide => guide.featured);
  const showSuggestions = isSearchFocused;
  const suggestionsToShow = normalizedQuery
    ? GUIDE_TYPING_SUGGESTIONS
    : GUIDE_QUICK_SUGGESTIONS;

  const selectSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    setSelectedSuggestion(suggestion);
    setIsSearchFocused(false);
    Keyboard.dismiss();
  };

  const clearSearch = () => {
    setQuery('');
    setSelectedSuggestion(null);
    setIsSearchFocused(true);
    searchInputRef.current?.focus();
  };

  const saveGuide = (guideId: string) => {
    if (savedGuideIds.includes(guideId)) {
      return;
    }

    onSavedGuideIdsChange([...savedGuideIds, guideId]);
    setShowSavedConfirmation(true);

    if (savedConfirmationTimer.current) {
      clearTimeout(savedConfirmationTimer.current);
    }

    savedConfirmationTimer.current = setTimeout(
      () => setShowSavedConfirmation(false),
      3000,
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Guías y documentos</Text>
        <Text style={styles.subtitle}>
          Consultá materiales clínicos y recursos técnicos basados en evidencia.
        </Text>

        <View
          style={[
            styles.searchBox,
            isSearchFocused ? styles.searchBoxFocused : null,
          ]}
        >
          <Image source={searchIcon} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            accessibilityLabel="Buscar en las guías"
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={() => setIsSearchFocused(false)}
            onChangeText={value => {
              setQuery(value);
              setSelectedSuggestion(null);
            }}
            onFocus={() => setIsSearchFocused(true)}
            onSubmitEditing={() => {
              setSelectedSuggestion(query.trim());
              setIsSearchFocused(false);
              Keyboard.dismiss();
            }}
            placeholder="Buscar en las guías"
            placeholderTextColor="#A1A1A1"
            returnKeyType="search"
            selectionColor="#F32735"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable
              accessibilityLabel="Limpiar búsqueda"
              accessibilityRole="button"
              hitSlop={9}
              onPress={clearSearch}
              style={({ pressed }) => [
                styles.clearButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.clearCircle}>
                <Image source={clearIcon} style={styles.clearIcon} />
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.guidesContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.guidesList}
      >
        {visibleGuides.length ? (
          visibleGuides.map(guide => (
            <GuideCard
              guide={guide}
              isSaved={savedGuideIds.includes(guide.id)}
              key={guide.id}
              onOpen={() => onOpenGuide?.(guide)}
              onSave={() => saveGuide(guide.id)}
            />
          ))
        ) : normalizedQuery ? (
          <View
            style={[
              styles.emptyState,
              showSuggestions ? styles.emptyStateWithSuggestions : null,
            ]}
          >
            <Text style={styles.emptyTitle}>
              No se encontraron guías para "{query.trim()}".
            </Text>
            <Text style={styles.emptyDescription}>
              Intentá repetir la búsqueda con otras palabras clave
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {showSuggestions ? (
        <View style={styles.suggestionsPanel}>
          <Text style={styles.suggestionsTitle}>SUGERENCIAS RÁPIDAS</Text>
          <View style={styles.suggestionsList}>
            {suggestionsToShow.map(suggestion => {
              const isMatch =
                Boolean(normalizedQuery) &&
                normalizeSearch(suggestion) === normalizedQuery;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={suggestion}
                  onPress={() => selectSuggestion(suggestion)}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    normalizedQuery ? styles.suggestionChipTyping : null,
                    isMatch ? styles.suggestionChipSelected : null,
                    pressed ? styles.suggestionChipPressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.suggestionText,
                      isMatch ? styles.suggestionTextSelected : null,
                    ]}
                  >
                    {suggestion}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {showSavedConfirmation ? (
        <View style={styles.savedConfirmation}>
          <Image source={savedCheckIcon} style={styles.savedCheckIcon} />
          <Text style={styles.savedConfirmationText}>Guardado en tu perfil</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenProfile}
            style={({ pressed }) => [
              styles.profileButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.profileButtonText}>Ir a mi perfil</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function GuideCard({
  guide,
  isSaved,
  onOpen,
  onSave,
}: {
  guide: GuideMockDocument;
  isSaved: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.guideCard}>
      <View style={styles.categoryTag}>
        <Text style={styles.categoryText}>{guide.category}</Text>
      </View>
      <Text numberOfLines={1} style={styles.guideTitle}>
        {guide.title}
      </Text>
      <Text numberOfLines={1} style={styles.institutionText}>
        {guide.institution}
      </Text>
      <Image
        accessibilityLabel={`${guide.year}, ${guide.pages}, ${guide.size}`}
        source={metadataImage}
        style={styles.metadataImage}
      />

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => [
            styles.openButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Image source={openBookIcon} style={styles.openBookIcon} />
          <Text style={styles.openButtonText}>Abrir</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: isSaved }}
          disabled={isSaved}
          onPress={onSave}
          style={({ pressed }) => [
            styles.saveButton,
            isSaved ? styles.savedButton : styles.unsavedButton,
            pressed && !isSaved ? styles.pressed : null,
          ]}
        >
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
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { zIndex: 2, paddingTop: 23, paddingHorizontal: 16 },
  title: {
    color: '#262626',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
    letterSpacing: -0.45,
  },
  subtitle: {
    width: 317,
    marginTop: 8,
    color: '#525252',
    fontSize: 14.5,
    lineHeight: 21.5,
    letterSpacing: -0.15,
  },
  searchBox: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  searchBoxFocused: { borderColor: '#525252' },
  searchIcon: { width: 13, height: 13, resizeMode: 'contain' },
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: 8,
    padding: 0,
    color: '#000000',
    fontSize: 14.5,
    lineHeight: 19,
    letterSpacing: -0.15,
  },
  clearButton: {
    width: 25,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearCircle: {
    width: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8.5,
    backgroundColor: '#F5F6F9',
  },
  clearIcon: { width: 9, height: 9, resizeMode: 'contain' },
  guidesList: { flex: 1, marginTop: 16 },
  guidesContent: {
    paddingHorizontal: 14,
    paddingBottom: 76,
    gap: 12,
  },
  guideCard: {
    height: 184,
    paddingTop: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  categoryTag: {
    width: 77,
    height: 24,
    justifyContent: 'center',
    paddingLeft: 10,
    borderRadius: 5,
    backgroundColor: '#F5F6F9',
  },
  categoryText: {
    color: '#A1A1A1',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  guideTitle: {
    marginTop: 12,
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 17,
    letterSpacing: -0.15,
  },
  institutionText: {
    marginTop: 1,
    color: '#A1A1A1',
    fontSize: 12,
    lineHeight: 16,
  },
  metadataImage: {
    width: 183,
    height: 16,
    marginTop: 9,
    resizeMode: 'contain',
  },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  openButton: {
    width: 96,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#F32735',
  },
  openBookIcon: { width: 16, height: 14, marginRight: 5, resizeMode: 'contain' },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -0.31,
  },
  saveButton: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  unsavedButton: {
    width: 120,
    borderWidth: 1.2,
    borderColor: '#F32735',
  },
  savedButton: { width: 135, backgroundColor: '#FEE5E7' },
  bookmarkIcon: { width: 13, height: 14, marginRight: 7, resizeMode: 'contain' },
  saveButtonText: {
    color: '#F32735',
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -0.31,
  },
  suggestionsPanel: {
    position: 'absolute',
    zIndex: 3,
    top: 167,
    right: 14,
    left: 14,
    minHeight: 222,
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  suggestionsTitle: {
    color: '#404040',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 14,
  },
  suggestionChip: {
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: '#FEE5E7',
  },
  suggestionChipTyping: { backgroundColor: '#F5F5F5' },
  suggestionChipSelected: { backgroundColor: '#171717' },
  suggestionChipPressed: { opacity: 0.72 },
  suggestionText: {
    color: '#525252',
    fontSize: 12.5,
    lineHeight: 17.5,
    letterSpacing: -0.3,
  },
  suggestionTextSelected: { color: '#FFFFFF' },
  emptyState: {
    alignItems: 'center',
    paddingTop: 105,
    paddingHorizontal: 24,
  },
  emptyStateWithSuggestions: { paddingTop: 232 },
  emptyTitle: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 17,
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  emptyDescription: {
    width: 280,
    marginTop: 8,
    color: '#A1A1A1',
    fontSize: 14.5,
    lineHeight: 21.5,
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  savedConfirmation: {
    position: 'absolute',
    zIndex: 4,
    right: 12,
    bottom: 72,
    left: 13,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 13,
    borderWidth: 1,
    borderColor: 'rgba(33, 152, 116, 0.06)',
    borderRadius: 11,
    backgroundColor: '#D6F5E3',
  },
  savedCheckIcon: { width: 21, height: 21, resizeMode: 'contain' },
  savedConfirmationText: {
    flex: 1,
    marginLeft: 7,
    color: '#424242',
    fontSize: 14.5,
    lineHeight: 21.5,
    letterSpacing: -0.15,
  },
  profileButton: {
    width: 96,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#219874',
  },
  profileButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 17.5,
    letterSpacing: -0.3,
  },
  pressed: { opacity: 0.62 },
});
