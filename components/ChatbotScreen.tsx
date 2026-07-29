import React, { useEffect, useRef, useState } from 'react';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CHATBOT_MOCK_CONTENT,
  CHATBOT_MOCK_SOURCES,
} from '../data/chatbotMock';
import { RatingOverlay } from './RatingOverlay';
import { SourcesBottomSheet } from './SourcesBottomSheet';

type ChatbotScreenProps = {
  onBack: () => void;
  savedSourceIds: string[];
  onSavedSourceIdsChange: (sourceIds: string[]) => void;
  onOpenHelp?: () => void;
  onOpenProfile?: () => void;
};

const sendArrow = require('../assets/country-selector/arrow-right.png');
const sourceIcon = require('../assets/chatbot/source.png');
const thumbsDownIcon = require('../assets/chatbot/thumbs-down.png');
const thumbsUpIcon = require('../assets/chatbot/thumbs-up.png');

export function ChatbotScreen({
  onBack,
  savedSourceIds,
  onSavedSourceIdsChange,
  onOpenHelp,
  onOpenProfile,
}: ChatbotScreenProps) {
  const [input, setInput] = useState('');
  const [sentQuestion, setSentQuestion] = useState<string | null>(null);
  const [showResponsibleUse, setShowResponsibleUse] = useState(true);
  const [areSourcesOpen, setAreSourcesOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const savedConfirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const canSend = input.trim().length > 0;

  useEffect(
    () => () => {
      if (savedConfirmationTimer.current) {
        clearTimeout(savedConfirmationTimer.current);
      }
    },
    [],
  );

  const handleSend = () => {
    const question = input.trim();

    if (!question) {
      return;
    }

    Keyboard.dismiss();
    setSentQuestion(question);
    setInput('');
    setShowResponsibleUse(false);
  };

  const openSourcesList = () => {
    setSelectedSourceId(null);
    setShowSavedConfirmation(false);
    setAreSourcesOpen(true);
  };

  const openSourceDetail = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    setShowSavedConfirmation(false);
    setAreSourcesOpen(true);
  };

  const closeSources = () => {
    setAreSourcesOpen(false);
    setShowSavedConfirmation(false);
  };

  const saveSource = (sourceId: string) => {
    if (savedSourceIds.includes(sourceId)) {
      return;
    }

    onSavedSourceIdsChange([...savedSourceIds, sourceId]);
    setShowSavedConfirmation(true);

    if (savedConfirmationTimer.current) {
      clearTimeout(savedConfirmationTimer.current);
    }

    savedConfirmationTimer.current = setTimeout(
      () => setShowSavedConfirmation(false),
      3000,
    );
  };

  const openProfile = () => {
    closeSources();
    onOpenProfile?.();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.statusDivider} />
        <View style={styles.header}>
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
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.title}>Chatbot</Text>
          <Text style={styles.subtitle}>
            Encontrá información para acompañar tu práctica clínica.
          </Text>
        </View>

        {sentQuestion ? (
          <SentConversation
            onOpenHelp={onOpenHelp}
            onOpenSource={openSourceDetail}
            onOpenSources={openSourcesList}
            question={sentQuestion}
          />
        ) : (
          <View style={styles.emptyContent}>
            {showResponsibleUse ? (
              <View style={styles.responsibleUseCard}>
                <Text style={styles.responsibleUseTitle}>
                  {CHATBOT_MOCK_CONTENT.responsibleUseTitle}
                </Text>
                <Text style={styles.responsibleUseBody}>
                  {CHATBOT_MOCK_CONTENT.responsibleUseBody}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setShowResponsibleUse(false)}
                  style={({ pressed }) => [
                    styles.understoodButton,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.understoodText}>Entendido</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.emptyMessageContainer} pointerEvents="none">
              <Text style={styles.emptyMessage}>
                {CHATBOT_MOCK_CONTENT.emptyStateMessage}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Escriba aquí su consulta"
            autoCorrect
            onChangeText={setInput}
            onFocus={() => setShowResponsibleUse(false)}
            onSubmitEditing={handleSend}
            placeholder="Escriba aquí su consulta..."
            placeholderTextColor="#A1A1A1"
            returnKeyType="send"
            selectionColor="#F32735"
            style={[styles.input, input ? styles.inputWithText : null]}
            value={input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && canSend ? styles.sendButtonPressed : null,
            ]}
          >
            <Image source={sendArrow} style={styles.sendIcon} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <SourcesBottomSheet
        onClose={closeSources}
        onOpenProfile={openProfile}
        onSaveSource={saveSource}
        onSelectSource={openSourceDetail}
        onShowList={openSourcesList}
        savedSourceIds={savedSourceIds}
        selectedSourceId={selectedSourceId}
        showSavedConfirmation={showSavedConfirmation}
        sources={CHATBOT_MOCK_SOURCES}
        visible={areSourcesOpen}
      />
    </SafeAreaView>
  );
}

function SentConversation({
  question,
  onOpenHelp,
  onOpenSource,
  onOpenSources,
}: {
  question: string;
  onOpenHelp?: () => void;
  onOpenSource: (sourceId: string) => void;
  onOpenSources: () => void;
}) {
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [submittedRating, setSubmittedRating] = useState(0);
  const [submittedComment, setSubmittedComment] = useState('');

  const submitRating = (rating: number, comment: string) => {
    setSubmittedRating(rating);
    setSubmittedComment(comment);
    setIsRatingOpen(false);
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.conversationContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.conversation}
      >
        <View style={styles.consultationHeader}>
          <Text style={styles.consultationMeta}>
            CONSULTA {CHATBOT_MOCK_CONTENT.consultationId} •{' '}
            {CHATBOT_MOCK_CONTENT.consultationDate}
          </Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={10}
            onPress={onOpenHelp}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Text style={styles.helpText}>Ayuda</Text>
          </Pressable>
        </View>

        <View style={styles.userMessageRow}>
          <View style={styles.userBubble}>
            <Text style={styles.userMessage}>{question}</Text>
          </View>
          <View style={styles.userBadge}>
            <Text style={styles.userBadgeText}>TÚ</Text>
          </View>
        </View>

        <View style={styles.assistantMessageRow}>
          <View style={styles.assistantBadge}>
            <Text style={styles.assistantBadgeText}>IA</Text>
          </View>
          <View style={styles.assistantBubble}>
            <Text style={styles.answerText}>{CHATBOT_MOCK_CONTENT.answer}</Text>
            {CHATBOT_MOCK_CONTENT.answerSources.map(source => (
              <SourceChip
                key={source.id}
                label={source.label}
                onPress={() => onOpenSource(source.id)}
              />
            ))}

            <Text style={styles.stepsTitle}>{CHATBOT_MOCK_CONTENT.stepsTitle}</Text>
            {CHATBOT_MOCK_CONTENT.steps.map((step, index) => (
              <View key={step.id} style={styles.step}>
                <Text style={styles.stepText}>
                  {index + 1}. {step.text}
                </Text>
                <View style={styles.sourceRow}>
                  {step.sources.map(source => (
                    <SourceChip
                      key={source.id}
                      label={source.label}
                      onPress={() => onOpenSource(source.id)}
                    />
                  ))}
                </View>
              </View>
            ))}

            <View style={styles.sourceSummaryRow}>
              <Text style={styles.sourceSummaryText}>
                {CHATBOT_MOCK_CONTENT.sourceSummary}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={onOpenSources}
                style={({ pressed }) => (pressed ? styles.pressed : null)}
              >
                <Text style={styles.sourceSummaryLink}>Ver</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.feedbackRow}>
          <Pressable
            accessibilityLabel="Valorar respuesta"
            accessibilityRole="button"
            onPress={() => setIsRatingOpen(true)}
            style={({ pressed }) => [
              styles.feedbackBox,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.feedbackPrompt}>
              {submittedRating
                ? `Valoración ${submittedRating}/5`
                : CHATBOT_MOCK_CONTENT.feedbackPrompt}
            </Text>
            <View style={styles.feedbackButton}>
              <Image source={thumbsUpIcon} style={styles.feedbackIcon} />
            </View>
            <View style={styles.feedbackButton}>
              <Image source={thumbsDownIcon} style={styles.feedbackIcon} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsRatingOpen(true)}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Text style={styles.commentsText}>
              {submittedRating || submittedComment
                ? 'Editar valoración'
                : CHATBOT_MOCK_CONTENT.commentsLabel}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <RatingOverlay
        initialComment={submittedComment}
        initialRating={submittedRating}
        onCancel={() => setIsRatingOpen(false)}
        onSubmit={submitRating}
        visible={isRatingOpen}
      />
    </>
  );
}

function SourceChip({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Abrir fuente ${label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.sourceChip,
        pressed ? styles.pressed : null,
      ]}
    >
      <Image source={sourceIcon} style={styles.sourceIcon} />
      <Text style={styles.sourceText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  statusDivider: { height: 1, backgroundColor: '#E5E5E5' },
  header: { minHeight: 117, paddingTop: 23, paddingHorizontal: 16 },
  backButton: {
    position: 'absolute',
    top: 23,
    left: 13,
    width: 24,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { color: '#262626', fontSize: 23, lineHeight: 24 },
  title: {
    marginLeft: 25,
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
    lineHeight: 21.5,
    letterSpacing: -0.15,
  },
  emptyContent: { flex: 1, paddingHorizontal: 17 },
  responsibleUseCard: {
    minHeight: 184,
    paddingTop: 14,
    paddingRight: 18,
    paddingBottom: 14,
    paddingLeft: 18,
    borderRadius: 14,
    backgroundColor: '#F5F6F9',
  },
  responsibleUseTitle: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },
  responsibleUseBody: {
    marginTop: 7,
    color: '#525252',
    fontSize: 12.5,
    lineHeight: 17.5,
    letterSpacing: -0.3,
  },
  understoodButton: { alignSelf: 'flex-end', marginTop: 5 },
  understoodText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16,
    textDecorationLine: 'underline',
  },
  emptyMessageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  emptyMessage: {
    width: 267,
    color: '#525252',
    fontSize: 12.5,
    lineHeight: 17.5,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  conversation: { flex: 1, borderTopWidth: 1, borderTopColor: '#EFEFEF' },
  conversationContent: { paddingHorizontal: 16, paddingBottom: 16 },
  consultationHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  consultationMeta: { color: '#404040', fontSize: 12, lineHeight: 16 },
  helpText: {
    color: '#F32735',
    fontSize: 12.5,
    lineHeight: 16,
    textDecorationLine: 'underline',
  },
  userMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 12,
    marginBottom: 24,
  },
  userBubble: {
    maxWidth: '78%',
    minHeight: 35,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 8,
    backgroundColor: '#F5F6F9',
  },
  userMessage: { color: '#525252', fontSize: 12.5, lineHeight: 17.5 },
  userBadge: {
    width: 32,
    height: 32,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#FFE2E4',
  },
  userBadgeText: { color: '#F58B93', fontSize: 9, fontWeight: '500' },
  assistantMessageRow: { flexDirection: 'row', alignItems: 'flex-start' },
  assistantBadge: {
    width: 32,
    height: 32,
    marginTop: 3,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#F32735',
  },
  assistantBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' },
  assistantBubble: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderRadius: 14,
    backgroundColor: '#F5F6F9',
  },
  answerText: {
    color: '#525252',
    fontSize: 12.5,
    lineHeight: 17.5,
    letterSpacing: -0.3,
  },
  stepsTitle: {
    marginTop: 24,
    color: '#262626',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17.5,
  },
  step: { marginTop: 3 },
  stepText: {
    color: '#525252',
    fontSize: 12.5,
    lineHeight: 17.5,
    letterSpacing: -0.3,
  },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  sourceChip: {
    alignSelf: 'flex-start',
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  sourceIcon: { width: 14, height: 12, marginRight: 5, resizeMode: 'contain' },
  sourceText: { color: '#525252', fontSize: 11, lineHeight: 16 },
  sourceSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingHorizontal: 10,
  },
  sourceSummaryText: { color: '#A1A1A1', fontSize: 11, lineHeight: 16 },
  sourceSummaryLink: {
    color: '#F32735',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textDecorationLine: 'underline',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  feedbackBox: {
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 5,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 6,
  },
  feedbackPrompt: {
    marginRight: 8,
    color: '#A1A1A1',
    fontSize: 11,
    lineHeight: 16,
  },
  feedbackButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  feedbackIcon: { width: 13, height: 13, resizeMode: 'contain' },
  commentsText: {
    color: '#525252',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
    textDecorationLine: 'underline',
  },
  composer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    height: 46,
    paddingHorizontal: 13,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    color: '#262626',
    fontSize: 14.5,
    fontStyle: 'italic',
    lineHeight: 19,
    letterSpacing: -0.15,
  },
  inputWithText: { fontStyle: 'normal' },
  sendButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: '#F32735',
  },
  sendButtonPressed: { opacity: 0.82 },
  sendIcon: { width: 21, height: 21, resizeMode: 'contain' },
  pressed: { opacity: 0.62 },
});
