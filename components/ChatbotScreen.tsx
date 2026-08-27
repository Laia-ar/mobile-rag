import React, {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useOfflineChat} from '../hooks/useOfflineChat';
import {UseSQLiteRAGReturn} from '../hooks/useRagEngine';
import {openPdfAtPage} from '../services/native/offlineKnowledge';
import {SourceReference} from '../types/knowledge';
import {SourcesBottomSheet} from './SourcesBottomSheet';

type ChatbotScreenProps = {
  rag: UseSQLiteRAGReturn;
  onBack: () => void;
  savedSourceIds: string[];
  onSaveSource: (source: SourceReference) => void;
  onRemoveSource?: (chunkId: string) => void;
  onOpenProfile?: () => void;
};

const sendArrow = require('../assets/country-selector/arrow-right.png');

const RESPONSIBLE_USE =
  'Las respuestas se generan localmente a partir de las guías instaladas. Verificá siempre la fuente y aplicá criterio clínico antes de tomar una decisión.';

export function ChatbotScreen({
  rag,
  onBack,
  savedSourceIds,
  onSaveSource,
  onRemoveSource,
  onOpenProfile,
}: ChatbotScreenProps) {
  const chat = useOfflineChat(rag);
  const [input, setInput] = useState('');
  const [areSourcesOpen, setAreSourcesOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const canSend = input.trim().length > 0 && chat.status === 'ready';

  const handleSend = async () => {
    const question = input.trim();
    if (!question || !canSend) return;
    Keyboard.dismiss();
    setInput('');
    try {
      await chat.send(question);
    } catch {
      // El hook expone el error y la pantalla lo presenta sin inventar respuesta.
    }
  };

  const openSource = (source: SourceReference) => {
    setSelectedSourceId(source.chunkId);
    setAreSourcesOpen(true);
  };

  const openDocument = async (source: SourceReference) => {
    await openPdfAtPage(source.absolutePath, source.page ?? 1);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Volver a Consulta"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onBack}
            style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.title}>Chatbot</Text>
          <Text style={styles.subtitle}>
            Información clínica recuperada del paquete offline instalado.
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {!chat.answer ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Uso responsable</Text>
              <Text style={styles.noticeBody}>{RESPONSIBLE_USE}</Text>
            </View>
          ) : (
            <>
              <View style={styles.questionBubble}>
                <Text style={styles.questionText}>{chat.answer.question}</Text>
              </View>
              <View style={styles.answerCard}>
                <Text style={styles.answerText}>
                  {chat.answer.text || 'Generando respuesta…'}
                </Text>
                {chat.answer.sources.length > 0 ? (
                  <View style={styles.sourceActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setSelectedSourceId(null);
                        setAreSourcesOpen(true);
                      }}
                      style={styles.sourcesButton}>
                      <Text style={styles.sourcesButtonText}>
                        Ver {chat.answer.sources.length}{' '}
                        {chat.answer.sources.length === 1 ? 'fuente' : 'fuentes'}
                      </Text>
                    </Pressable>
                    {chat.answer.sources.slice(0, 3).map(source => (
                      <Pressable
                        key={source.chunkId}
                        onPress={() => openSource(source)}
                        style={styles.sourceChip}>
                        <Text numberOfLines={1} style={styles.sourceChipText}>
                          {source.title}
                          {source.page ? ` · pág. ${source.page}` : ''}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          )}

          {chat.status === 'loading' || chat.status === 'generating' ? (
            <View style={styles.runtimeState}>
              <ActivityIndicator color="#F32735" />
              <Text style={styles.runtimeText}>
                {chat.status === 'loading'
                  ? 'Preparando modelos y base offline…'
                  : 'Consultando las guías en el dispositivo…'}
              </Text>
            </View>
          ) : null}

          {rag.status === 'missing' ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Paquete offline pendiente</Text>
              <Text style={styles.errorText}>{rag.error?.message}</Text>
            </View>
          ) : null}

          {rag.status === 'error' || chat.status === 'error' ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>No se pudo iniciar el chat</Text>
              <Text style={styles.errorText}>
                {chat.error?.message ?? rag.error?.message}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Escriba aquí su consulta"
            editable={chat.status !== 'generating'}
            multiline
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            placeholder={
              rag.status === 'missing'
                ? 'Instalá el paquete offline para consultar'
                : 'Escriba aquí su consulta…'
            }
            placeholderTextColor="#8B8B8B"
            style={styles.input}
            value={input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{disabled: !canSend}}
            disabled={!canSend}
            onPress={handleSend}
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}>
            <Image source={sendArrow} style={styles.sendIcon} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <SourcesBottomSheet
        onClose={() => setAreSourcesOpen(false)}
        onOpenDocument={openDocument}
        onOpenProfile={onOpenProfile}
        onRemoveSource={onRemoveSource}
        onSaveSource={onSaveSource}
        onSelectSource={sourceId => setSelectedSourceId(sourceId)}
        savedSourceIds={savedSourceIds}
        selectedSourceId={selectedSourceId}
        sources={chat.answer?.sources ?? []}
        visible={areSourcesOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#FFFFFF'},
  keyboardView: {flex: 1},
  header: {paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#E5E5E5'},
  backButton: {width: 42, height: 36, justifyContent: 'center'},
  backArrow: {fontSize: 28, color: '#262626'},
  title: {fontSize: 24, fontWeight: '700', color: '#262626'},
  subtitle: {marginTop: 5, fontSize: 14, lineHeight: 20, color: '#606060'},
  content: {flexGrow: 1, padding: 16, gap: 16},
  notice: {padding: 18, borderRadius: 14, backgroundColor: '#FFF5F5'},
  noticeTitle: {fontSize: 17, fontWeight: '700', color: '#7F1D1D'},
  noticeBody: {marginTop: 8, fontSize: 14, lineHeight: 21, color: '#525252'},
  questionBubble: {alignSelf: 'flex-end', maxWidth: '88%', padding: 14, borderRadius: 16, backgroundColor: '#F32735'},
  questionText: {fontSize: 15, lineHeight: 21, color: '#FFFFFF'},
  answerCard: {padding: 16, borderWidth: 1, borderColor: '#E7E7E7', borderRadius: 14, backgroundColor: '#FFFFFF'},
  answerText: {fontSize: 15, lineHeight: 23, color: '#303030'},
  sourceActions: {marginTop: 16, gap: 8},
  sourcesButton: {alignSelf: 'flex-start', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 8, backgroundColor: '#F32735'},
  sourcesButtonText: {fontSize: 14, fontWeight: '600', color: '#FFFFFF'},
  sourceChip: {paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: '#F5F6F9'},
  sourceChipText: {fontSize: 13, color: '#404040'},
  runtimeState: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8},
  runtimeText: {fontSize: 13, color: '#606060'},
  errorCard: {padding: 14, borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, backgroundColor: '#FEF2F2'},
  errorTitle: {fontSize: 15, fontWeight: '700', color: '#991B1B'},
  errorText: {marginTop: 5, fontSize: 13, lineHeight: 19, color: '#7F1D1D'},
  composer: {flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: '#E5E5E5', backgroundColor: '#FFFFFF'},
  input: {flex: 1, minHeight: 46, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: '#D4D4D4', borderRadius: 12, color: '#262626', fontSize: 15},
  sendButton: {width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F32735'},
  sendButtonDisabled: {opacity: 0.3},
  sendIcon: {width: 18, height: 18, tintColor: '#FFFFFF'},
});
