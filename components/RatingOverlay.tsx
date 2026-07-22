import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type RatingOverlayProps = {
  visible: boolean;
  initialRating?: number;
  initialComment?: string;
  onCancel: () => void;
  onSubmit: (rating: number, comment: string) => void;
};

const emptyStarsImage = require('./rating-stars-empty.png');
const selectedStarsImage = require('./rating-stars-selected.png');
const closeIcon = require('./rating-close.png');
const STAR_SLOT_WIDTH = 39.4;

export function RatingOverlay({
  visible,
  initialRating = 0,
  initialComment = '',
  onCancel,
  onSubmit,
}: RatingOverlayProps) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);

  useEffect(() => {
    if (visible) {
      setRating(initialRating);
      setComment(initialComment);
    }
  }, [initialComment, initialRating, visible]);

  const handleSubmit = () => {
    onSubmit(rating, comment.trim());
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalRoot}
      >
        <Pressable
          accessibilityLabel="Cerrar valoración"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.backdrop}
        />

        <View style={styles.card}>
          <Pressable
            accessibilityLabel="Cerrar valoración"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Image source={closeIcon} style={styles.closeIcon} />
          </Pressable>

          <Text style={styles.title}>Valora esta respuesta</Text>
          <Text style={styles.subtitle}>
            Tu opinión es anónima y nos ayuda a entrenar mejor el sistema.
          </Text>

          <View
            accessibilityLabel={`${rating} de 5 estrellas`}
            accessibilityRole="adjustable"
            style={styles.starsRow}
          >
            <Image source={emptyStarsImage} style={styles.starsImage} />
            {Array.from({ length: rating }).map((_, index) => (
              <View
                key={`selected-${index + 1}`}
                pointerEvents="none"
                style={[styles.selectedStarClip, { left: index * 40 }]}
              >
                <Image
                  source={selectedStarsImage}
                  style={styles.selectedStarsSource}
                />
              </View>
            ))}
            {[1, 2, 3, 4, 5].map(value => (
              <Pressable
                accessibilityLabel={`${value} estrella${value === 1 ? '' : 's'}`}
                accessibilityRole="button"
                accessibilityState={{ selected: rating === value }}
                hitSlop={4}
                key={value}
                onPress={() => setRating(value)}
                style={[styles.starHitArea, { left: (value - 1) * STAR_SLOT_WIDTH }]}
              />
            ))}
          </View>

          <TextInput
            accessibilityLabel="Comentarios opcionales"
            multiline
            onChangeText={setComment}
            placeholder="Comentarios (opcional)"
            placeholderTextColor="#A1A1A1"
            selectionColor="#F32735"
            style={[styles.commentInput, comment ? styles.commentInputWithText : null]}
            textAlignVertical="top"
            value={comment}
          />

          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.actionButton,
                styles.cancelButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.actionButton,
                styles.submitButton,
                pressed ? styles.submitPressed : null,
              ]}
            >
              <Text style={styles.submitText}>Enviar</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29, 27, 32, 0.39)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    height: 407,
    paddingTop: 32,
    paddingHorizontal: 23,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    position: 'absolute',
    top: 17,
    right: 20,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeIcon: { width: 18, height: 18, resizeMode: 'contain' },
  title: {
    color: '#404040',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  subtitle: {
    width: 296,
    marginTop: 4,
    color: '#A1A1A1',
    fontSize: 14.5,
    lineHeight: 21.5,
    letterSpacing: -0.15,
  },
  starsRow: {
    width: 197,
    height: 37,
    alignSelf: 'center',
    marginTop: 24,
  },
  starsImage: {
    position: 'absolute',
    width: 197,
    height: 37,
    resizeMode: 'contain',
  },
  selectedStarClip: {
    position: 'absolute',
    top: 0,
    width: 37,
    height: 37,
    overflow: 'hidden',
  },
  selectedStarsSource: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 197,
    height: 37,
    resizeMode: 'stretch',
  },
  starHitArea: {
    position: 'absolute',
    top: 0,
    width: STAR_SLOT_WIDTH,
    height: 37,
  },
  commentInput: {
    height: 150,
    marginTop: 16,
    paddingTop: 13,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 9,
    color: '#525252',
    fontSize: 14.5,
    fontStyle: 'italic',
    lineHeight: 21.5,
    letterSpacing: -0.15,
  },
  commentInputWithText: { fontStyle: 'normal' },
  actionsRow: { flexDirection: 'row', gap: 14, marginTop: 16 },
  actionButton: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  cancelButton: { borderWidth: 1, borderColor: '#EFEFEF' },
  submitButton: { backgroundColor: '#F32735' },
  cancelText: {
    color: '#525252',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16,
  },
  submitPressed: { opacity: 0.82 },
  pressed: { opacity: 0.62 },
});
