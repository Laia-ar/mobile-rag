import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
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
import {
  clearOpenRouterApiKey,
  getStoredOpenRouterApiKey,
  maskApiKey,
  saveOpenRouterApiKey,
} from '../services/remote/apiKeyStorage';
import {
  fetchOpenRouterKeyInfo,
  formatCreditInfo,
  OpenRouterKeyInfo,
} from '../services/remote/openRouter';

type ApiKeySettingsScreenProps = {
  onBack: () => void;
};

type CreditState =
  | {kind: 'idle'}
  | {kind: 'loading'}
  | {kind: 'loaded'; info: OpenRouterKeyInfo}
  | {kind: 'error'; message: string};

export function ApiKeySettingsScreen({onBack}: ApiKeySettingsScreenProps) {
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [credit, setCredit] = useState<CreditState>({kind: 'idle'});
  const [message, setMessage] = useState('');
  const canSave = input.trim().length > 0;

  const refreshCredit = useCallback(async (apiKey: string) => {
    setCredit({kind: 'loading'});
    try {
      const info = await fetchOpenRouterKeyInfo(apiKey);
      setCredit({kind: 'loaded', info});
    } catch (cause) {
      setCredit({
        kind: 'error',
        message:
          cause instanceof Error
            ? cause.message
            : 'No se pudo consultar el crédito.',
      });
    }
  }, []);

  useEffect(() => {
    getStoredOpenRouterApiKey()
      .then(key => {
        setStoredKey(key);
        if (key) {
          refreshCredit(key).catch(() => undefined);
        }
      })
      .catch(() => setStoredKey(null));
  }, [refreshCredit]);

  const handleSave = async () => {
    const key = input.trim();
    if (!key) return;
    try {
      await saveOpenRouterApiKey(key);
      setStoredKey(key);
      setInput('');
      setMessage('API key guardada.');
      refreshCredit(key).catch(() => undefined);
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'No se pudo guardar la key.',
      );
    }
  };

  const handleClear = async () => {
    try {
      await clearOpenRouterApiKey();
    } catch {
      // Si el storage falla igual limpiamos el estado visible.
    }
    setStoredKey(null);
    setCredit({kind: 'idle'});
    setMessage('API key eliminada.');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Volver"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onBack}
            style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.title}>API key de OpenRouter</Text>
          <Text style={styles.subtitle}>
            La key se guarda solo en este dispositivo y se usa para las
            consultas del chat en la nube.
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {storedKey ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Key guardada</Text>
              <Text style={styles.maskedKey}>{maskApiKey(storedKey)}</Text>

              <View style={styles.creditRow}>
                {credit.kind === 'loading' ? (
                  <ActivityIndicator color="#F32735" />
                ) : null}
                {credit.kind === 'loaded' ? (
                  <Text style={styles.creditText}>
                    {formatCreditInfo(credit.info)}
                  </Text>
                ) : null}
                {credit.kind === 'error' ? (
                  <Text style={styles.creditError}>{credit.message}</Text>
                ) : null}
              </View>

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => refreshCredit(storedKey).catch(() => undefined)}
                  style={[styles.action, styles.primaryAction]}>
                  <Text style={styles.primaryActionText}>
                    Verificar / actualizar
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleClear().catch(() => undefined)}
                  style={[styles.action, styles.secondaryAction]}>
                  <Text style={styles.secondaryActionText}>Borrar key</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No hay ninguna key guardada</Text>
              <Text style={styles.cardBody}>
                Pegá tu API key de OpenRouter (empieza con sk-or-…) para
                habilitar el chat en la nube.
              </Text>
            </View>
          )}

          <Text style={styles.inputLabel}>
            {storedKey ? 'Reemplazar key' : 'Ingresar key'}
          </Text>
          <TextInput
            accessibilityLabel="API key de OpenRouter"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setInput}
            placeholder="sk-or-..."
            placeholderTextColor="#8B8B8B"
            selectionColor="#F32735"
            style={styles.input}
            value={input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{disabled: !canSave}}
            disabled={!canSave}
            onPress={() => handleSave().catch(() => undefined)}
            style={({pressed}) => [
              styles.saveButton,
              canSave ? styles.saveButtonEnabled : styles.saveButtonDisabled,
              pressed && canSave ? styles.saveButtonPressed : null,
            ]}>
            <Text style={styles.saveButtonText}>Guardar key</Text>
          </Pressable>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#FFFFFF'},
  keyboardView: {flex: 1},
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {width: 42, height: 36, justifyContent: 'center'},
  backArrow: {fontSize: 28, color: '#262626'},
  title: {fontSize: 24, fontWeight: '700', color: '#262626'},
  subtitle: {marginTop: 5, fontSize: 14, lineHeight: 20, color: '#606060'},
  content: {flexGrow: 1, padding: 16, gap: 12},
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7E7E7',
    borderRadius: 14,
    backgroundColor: '#F5F6F9',
  },
  cardTitle: {fontSize: 15, fontWeight: '700', color: '#262626'},
  cardBody: {marginTop: 6, fontSize: 13, lineHeight: 19, color: '#525252'},
  maskedKey: {marginTop: 8, fontSize: 16, fontWeight: '600', color: '#404040'},
  creditRow: {marginTop: 10, minHeight: 22, justifyContent: 'center'},
  creditText: {fontSize: 14, fontWeight: '600', color: '#166534'},
  creditError: {fontSize: 13, lineHeight: 18, color: '#991B1B'},
  actions: {flexDirection: 'row', gap: 8, marginTop: 14},
  action: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 7,
  },
  primaryAction: {backgroundColor: '#F32735'},
  secondaryAction: {borderWidth: 1, borderColor: '#D4D4D4'},
  primaryActionText: {fontSize: 13, fontWeight: '600', color: '#FFFFFF'},
  secondaryActionText: {fontSize: 13, fontWeight: '600', color: '#525252'},
  inputLabel: {marginTop: 6, fontSize: 14, fontWeight: '600', color: '#404040'},
  input: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#262626',
    fontSize: 15,
  },
  saveButton: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  saveButtonDisabled: {backgroundColor: 'rgba(243, 39, 53, 0.25)'},
  saveButtonEnabled: {backgroundColor: '#F32735'},
  saveButtonPressed: {opacity: 0.86},
  saveButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '500'},
  message: {fontSize: 13, lineHeight: 18, color: '#525252', textAlign: 'center'},
});
