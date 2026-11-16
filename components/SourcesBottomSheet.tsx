import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SourceReference} from '../types/knowledge';

type SourcesBottomSheetProps = {
  visible: boolean;
  sources: SourceReference[];
  selectedSourceId: string | null;
  savedSourceIds: string[];
  onClose: () => void;
  onSelectSource: (sourceId: string | null) => void;
  onSaveSource: (source: SourceReference) => void;
  onRemoveSource?: (chunkId: string) => void;
  onOpenDocument: (source: SourceReference) => void | Promise<void>;
  onOpenProfile?: () => void;
};

export function SourcesBottomSheet({
  visible,
  sources,
  selectedSourceId,
  savedSourceIds,
  onClose,
  onSelectSource,
  onSaveSource,
  onRemoveSource,
  onOpenDocument,
  onOpenProfile,
}: SourcesBottomSheetProps) {
  const selectedSource = sources.find(
    source => source.chunkId === selectedSourceId,
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Cerrar fuentes"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            {selectedSource ? (
              <Pressable onPress={() => onSelectSource(null)} hitSlop={12}>
                <Text style={styles.headerAction}>← Fuentes</Text>
              </Pressable>
            ) : (
              <Text style={styles.title}>Fuentes recuperadas</Text>
            )}
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.headerAction}>Cerrar</Text>
            </Pressable>
          </View>

          {selectedSource ? (
            <SourceDetail
              isSaved={savedSourceIds.includes(selectedSource.chunkId)}
              onOpenDocument={onOpenDocument}
              onOpenProfile={onOpenProfile}
              onRemoveSource={onRemoveSource}
              onSaveSource={onSaveSource}
              source={selectedSource}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {sources.map(source => (
                <Pressable
                  key={source.chunkId}
                  onPress={() => onSelectSource(source.chunkId)}
                  style={({pressed}) => [
                    styles.sourceCard,
                    pressed && styles.pressed,
                  ]}>
                  <Text numberOfLines={2} style={styles.sourceTitle}>
                    {source.title}
                  </Text>
                  <Text style={styles.sourceMeta}>
                    {source.institution || 'Guía clínica'}
                    {source.page ? ` · pág. ${source.page}` : ''}
                  </Text>
                  <Text numberOfLines={3} style={styles.excerpt}>
                    {source.content}
                  </Text>
                </Pressable>
              ))}
              {sources.length === 0 ? (
                <Text style={styles.empty}>No hay fuentes para esta respuesta.</Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SourceDetail({
  source,
  isSaved,
  onSaveSource,
  onRemoveSource,
  onOpenDocument,
  onOpenProfile,
}: {
  source: SourceReference;
  isSaved: boolean;
  onSaveSource: (source: SourceReference) => void;
  onRemoveSource?: (chunkId: string) => void;
  onOpenDocument: (source: SourceReference) => void | Promise<void>;
  onOpenProfile?: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.detail}>
      <Text style={styles.detailTitle}>{source.title}</Text>
      <Text style={styles.sourceMeta}>
        {source.institution || 'Guía clínica'}
        {source.page ? ` · pág. ${source.page}` : ''}
        {source.pageEnd && source.pageEnd !== source.page
          ? `–${source.pageEnd}`
          : ''}
      </Text>
      {source.sectionPath?.length ? (
        <Text style={styles.section}>{source.sectionPath.join(' › ')}</Text>
      ) : null}
      <Text selectable style={styles.detailContent}>
        {source.content}
      </Text>
      <Pressable
        onPress={() => Promise.resolve(onOpenDocument(source)).catch(() => undefined)}
        style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>
          Abrir PDF{source.page ? ` en página ${source.page}` : ''}
        </Text>
      </Pressable>
      <Pressable
        onPress={() =>
          isSaved ? onRemoveSource?.(source.chunkId) : onSaveSource(source)
        }
        style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>
          {isSaved ? 'Quitar de guardados' : 'Guardar fragmento'}
        </Text>
      </Pressable>
      {isSaved && onOpenProfile ? (
        <Pressable onPress={onOpenProfile} style={styles.profileLink}>
          <Text style={styles.profileLinkText}>Revisar guardados en Perfil</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)'},
  sheet: {height: '82%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFFFFF', overflow: 'hidden'},
  handle: {alignSelf: 'center', width: 42, height: 4, marginTop: 10, borderRadius: 2, backgroundColor: '#D4D4D4'},
  header: {minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#E5E5E5'},
  title: {fontSize: 18, fontWeight: '700', color: '#262626'},
  headerAction: {fontSize: 15, fontWeight: '600', color: '#F32735'},
  list: {padding: 16, gap: 12},
  sourceCard: {padding: 14, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12},
  pressed: {opacity: 0.65},
  sourceTitle: {fontSize: 16, fontWeight: '700', color: '#303030'},
  sourceMeta: {marginTop: 5, fontSize: 13, color: '#737373'},
  excerpt: {marginTop: 9, fontSize: 14, lineHeight: 20, color: '#525252'},
  empty: {paddingTop: 30, textAlign: 'center', color: '#737373'},
  detail: {padding: 18, paddingBottom: 36},
  detailTitle: {fontSize: 21, lineHeight: 27, fontWeight: '700', color: '#262626'},
  section: {marginTop: 10, fontSize: 13, color: '#F32735'},
  detailContent: {marginTop: 18, fontSize: 15, lineHeight: 23, color: '#404040'},
  primaryButton: {marginTop: 22, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#F32735'},
  primaryButtonText: {fontSize: 15, fontWeight: '600', color: '#FFFFFF'},
  secondaryButton: {marginTop: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F32735', borderRadius: 9},
  secondaryButtonText: {fontSize: 15, fontWeight: '600', color: '#F32735'},
  profileLink: {alignItems: 'center', padding: 16},
  profileLinkText: {fontSize: 14, color: '#525252', textDecorationLine: 'underline'},
});
