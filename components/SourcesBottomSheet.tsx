import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChatbotMockDocument } from './chatbotMock';

type SourcesBottomSheetProps = {
  visible: boolean;
  sources: ChatbotMockDocument[];
  selectedSourceId: string | null;
  savedSourceIds: string[];
  showSavedConfirmation: boolean;
  onClose: () => void;
  onSelectSource: (sourceId: string) => void;
  onShowList: () => void;
  onSaveSource: (sourceId: string) => void;
  onOpenProfile: () => void;
  onOpenDocument?: (source: ChatbotMockDocument) => void;
};

const sourceIcon = require('./source.png');
const arrowRightIcon = require('./arrow-right.png');
const bookmarkIcon = require('./bookmark.png');
const bookmarkSavedIcon = require('./bookmark-saved.png');
const savedCheckIcon = require('./saved-check.png');
const externalLinkIcon = require('./external-link.png');

export function SourcesBottomSheet({
  visible,
  sources,
  selectedSourceId,
  savedSourceIds,
  showSavedConfirmation,
  onClose,
  onSelectSource,
  onShowList,
  onSaveSource,
  onOpenProfile,
  onOpenDocument,
}: SourcesBottomSheetProps) {
  const selectedSource =
    sources.find(source => source.id === selectedSourceId) ?? null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Cerrar fuentes"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.sheet,
            selectedSource ? styles.detailSheet : styles.listSheet,
          ]}
        >
          <View style={styles.handle} />
          {selectedSource ? (
            <SourceDetail
              isSaved={savedSourceIds.includes(selectedSource.id)}
              onOpenDocument={onOpenDocument}
              onSave={() => onSaveSource(selectedSource.id)}
              onShowList={onShowList}
              source={selectedSource}
            />
          ) : (
            <SourcesList sources={sources} onSelectSource={onSelectSource} />
          )}

          {selectedSource && showSavedConfirmation ? (
            <View style={styles.savedConfirmation}>
              <Image source={savedCheckIcon} style={styles.savedCheckIcon} />
              <Text style={styles.savedConfirmationText}>
                Guardado en tu perfil
              </Text>
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
      </View>
    </Modal>
  );
}

function SourcesList({
  sources,
  onSelectSource,
}: {
  sources: ChatbotMockDocument[];
  onSelectSource: (sourceId: string) => void;
}) {
  return (
    <View style={styles.listContent}>
      <Text style={styles.listTitle}>Fuentes de esta respuesta</Text>
      <Text style={styles.listSubtitle}>{sources.length} documentos citados</Text>
      <View style={styles.sourceList}>
        {sources.map((source, index) => (
          <Pressable
            accessibilityLabel={`Abrir fuente ${index + 1}: ${source.title}`}
            accessibilityRole="button"
            key={source.id}
            onPress={() => onSelectSource(source.id)}
            style={({ pressed }) => [
              styles.sourceListItem,
              index < sources.length - 1 ? styles.sourceListItemDivider : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.sourceNumber}>
              <Text style={styles.sourceNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.sourceListText}>
              <Text style={styles.sourceTitle}>{source.title}</Text>
              <SourceMetadata source={source} />
            </View>
            <Image source={arrowRightIcon} style={styles.arrowRightIcon} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SourceDetail({
  source,
  isSaved,
  onSave,
  onShowList,
  onOpenDocument,
}: {
  source: ChatbotMockDocument;
  isSaved: boolean;
  onSave: () => void;
  onShowList: () => void;
  onOpenDocument?: (source: ChatbotMockDocument) => void;
}) {
  return (
    <View style={styles.detailContent}>
      <Text style={styles.detailTitle}>{source.title}</Text>
      <SourceMetadata source={source} />

      <ScrollView
        contentContainerStyle={styles.quoteCardContent}
        showsVerticalScrollIndicator={false}
        style={styles.quoteCard}
      >
        <Text style={styles.quoteMark}>“</Text>
        <Text style={styles.quoteText}>{source.excerpt}</Text>
      </ScrollView>

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenDocument?.(source)}
          style={({ pressed }) => [
            styles.actionButton,
            styles.viewSourceButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Image source={externalLinkIcon} style={styles.externalLinkIcon} />
          <Text style={styles.viewSourceText}>Ver fuente</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: isSaved }}
          disabled={isSaved}
          onPress={onSave}
          style={({ pressed }) => [
            styles.actionButton,
            isSaved ? styles.savedButton : styles.saveButton,
            pressed ? styles.pressed : null,
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

      <Pressable
        accessibilityRole="button"
        onPress={onShowList}
        style={({ pressed }) => [
          styles.allSourcesButton,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.allSourcesText}>Ver todas las fuentes</Text>
        <Image source={arrowRightIcon} style={styles.allSourcesArrow} />
      </Pressable>
    </View>
  );
}

function SourceMetadata({ source }: { source: ChatbotMockDocument }) {
  return (
    <View style={styles.metadataRow}>
      <Image source={sourceIcon} style={styles.sourceIcon} />
      <Text numberOfLines={1} style={styles.metadataText}>
        {source.institution} · {source.year} · {source.page}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29, 27, 32, 0.39)',
  },
  sheet: {
    overflow: 'hidden',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  listSheet: { height: 424 },
  detailSheet: { height: 624 },
  handle: {
    width: 50,
    height: 5,
    alignSelf: 'center',
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#D9D9D9',
  },
  listContent: { flex: 1, paddingHorizontal: 24 },
  listTitle: {
    marginTop: 27,
    color: '#404040',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  listSubtitle: {
    marginTop: 4,
    color: '#A1A1A1',
    fontSize: 12.5,
    lineHeight: 17.5,
    letterSpacing: -0.3,
  },
  sourceList: { marginTop: 25, paddingHorizontal: 6 },
  sourceListItem: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 1,
  },
  sourceListItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  sourceNumber: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: 'rgba(243, 39, 53, 0.07)',
  },
  sourceNumberText: {
    color: '#F32735',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  sourceListText: { flex: 1, marginLeft: 16, paddingRight: 8 },
  sourceTitle: {
    color: '#525252',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 17,
    letterSpacing: -0.15,
  },
  metadataRow: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },
  sourceIcon: { width: 14, height: 12, marginRight: 6, resizeMode: 'contain' },
  metadataText: {
    flex: 1,
    color: '#A1A1A1',
    fontSize: 11,
    lineHeight: 16,
  },
  arrowRightIcon: {
    width: 14,
    height: 14,
    marginTop: 1,
    resizeMode: 'contain',
  },
  detailContent: { flex: 1, paddingHorizontal: 24 },
  detailTitle: {
    marginTop: 23,
    color: '#404040',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  quoteCard: {
    flex: 1,
    marginTop: 18,
    borderRadius: 17,
    backgroundColor: '#F5F6F9',
  },
  quoteCardContent: {
    minHeight: 350,
    paddingTop: 16,
    paddingRight: 21,
    paddingBottom: 18,
    paddingLeft: 21,
  },
  quoteMark: {
    height: 24,
    color: '#F32735',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
  quoteText: {
    marginTop: 2,
    color: '#525252',
    fontSize: 14.5,
    lineHeight: 21.5,
    letterSpacing: -0.15,
  },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionButton: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  viewSourceButton: { backgroundColor: '#F32735' },
  saveButton: { borderWidth: 1.2, borderColor: '#F32735' },
  savedButton: { backgroundColor: '#FEE5E7' },
  externalLinkIcon: {
    width: 14,
    height: 14,
    marginRight: 8,
    resizeMode: 'contain',
  },
  bookmarkIcon: {
    width: 13,
    height: 14,
    marginRight: 7,
    resizeMode: 'contain',
  },
  viewSourceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16,
  },
  saveButtonText: {
    color: '#F32735',
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -0.31,
  },
  allSourcesButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allSourcesText: {
    color: '#525252',
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 17.5,
    letterSpacing: -0.3,
    textDecorationLine: 'underline',
  },
  allSourcesArrow: {
    width: 14,
    height: 14,
    marginLeft: 5,
    resizeMode: 'contain',
  },
  savedConfirmation: {
    position: 'absolute',
    right: 12,
    bottom: 104,
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
