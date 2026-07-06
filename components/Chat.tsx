import React, {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useLlamaEngine } from '../hooks/useLlamaEngine';
import { SimilarityResult, useSQLiteRAG } from '../hooks/useRagEngine';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------
const { width: SCREEN_W } = Dimensions.get('window');

type Message = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  typing?: boolean;
};
const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: '¡Hola! Soy tu asistente de IA. ¿En qué puedo ayudarte hoy?',
    timestamp: new Date(Date.now() - 60_000),
  },
];

// ---------------------------------------------------------------------------
// Palette – adapts to light / dark
// ---------------------------------------------------------------------------
const light = {
  bg: '#F5F4F0',
  surface: '#FFFFFF',
  surfaceAlt: '#F0EFEB',
  border: 'rgba(0,0,0,0.08)',
  text: '#1A1917',
  textSecondary: '#6B6A66',
  textMuted: '#9E9D99',
  userBubble: '#1A1917',
  userBubbleText: '#FFFFFF',
  aiBubble: '#FFFFFF',
  aiBubbleText: '#1A1917',
  aiBubbleBorder: 'rgba(0,0,0,0.08)',
  inputBg: '#FFFFFF',
  inputBorder: 'rgba(0,0,0,0.12)',
  inputBorderFocus: 'rgba(0,0,0,0.4)',
  sendBtn: '#1A1917',
  sendBtnDisabled: '#D0CFC9',
  iconBtn: '#6B6A66',
  sidebarBg: '#EEEEE9',
  sidebarItem: 'rgba(0,0,0,0.05)',
  sidebarItemActive: 'rgba(0,0,0,0.1)',
  accent: '#D97706',
  codeBlock: '#F0EFEB',
  codeText: '#1A1917',
  shadow: 'rgba(0,0,0,0.06)',
};
type Colors = typeof light;
const dark: Colors = {
  bg: '#1A1917',
  surface: '#242321',
  surfaceAlt: '#2E2D2A',
  border: 'rgba(255,255,255,0.07)',
  text: '#EDECEA',
  textSecondary: '#A09F9A',
  textMuted: '#6B6A66',
  userBubble: '#EDECEA',
  userBubbleText: '#1A1917',
  aiBubble: '#242321',
  aiBubbleText: '#EDECEA',
  aiBubbleBorder: 'rgba(255,255,255,0.07)',
  inputBg: '#2E2D2A',
  inputBorder: 'rgba(255,255,255,0.1)',
  inputBorderFocus: 'rgba(255,255,255,0.35)',
  sendBtn: '#EDECEA',
  sendBtnDisabled: '#484744',
  iconBtn: '#A09F9A',
  sidebarBg: '#141412',
  sidebarItem: 'rgba(255,255,255,0.04)',
  sidebarItemActive: 'rgba(255,255,255,0.1)',
  accent: '#F59E0B',
  codeBlock: '#2E2D2A',
  codeText: '#EDECEA',
  shadow: 'rgba(0,0,0,0.3)',
};
const palette = { light, dark };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function generateId() {
  return Math.random().toString(36).slice(2);
}

// Simple inline-code renderer (no external deps)
function MessageText({ content, colors }: { content: string; colors: Colors }) {
  // Split by code blocks ```...``` and inline `...`
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return (
    <Text style={{ color: colors.text, fontSize: 15.5, lineHeight: 24 }}>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const code = part.slice(3, -3).replace(/^\w+\n/, '');
          return (
            <Text
              key={i}
              style={{
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                backgroundColor: colors.codeBlock,
                color: colors.accent,
                fontSize: 13,
                borderRadius: 6,
              }}
            >
              {'\n'}
              {code}
              {'\n'}
            </Text>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <Text
              key={i}
              style={{
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                backgroundColor: colors.codeBlock,
                color: colors.accent,
                fontSize: 13.5,
              }}
            >
              {part.slice(1, -1)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------
function MessageBubble({
  message,
  colors,
  isLast,
}: {
  message: Message;
  colors: Colors;
  isLast: boolean;
}) {
  const isUser = message.role === 'user';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (message.typing) {
    return (
      <Animated.View
        style={[
          styles.messageRow,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
        <View
          style={[
            styles.typingBubble,
            {
              backgroundColor: colors.aiBubble,
              borderColor: colors.aiBubbleBorder,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <TypingDots colors={colors} />
        </View>
      </Animated.View>
    );
  }

  if (isUser) {
    return (
      <Animated.View
        style={[
          styles.userRow,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View
          style={[styles.userBubble, { backgroundColor: colors.userBubble }]}
        >
          <Text style={[styles.userText, { color: colors.userBubbleText }]}>
            {message.content}
          </Text>
          <Text style={[styles.timestamp, { color: 'rgba(255,255,255,0.45)' }]}>
            {formatTime(message.timestamp)}
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.messageRow,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.aiBadge}>
        <Text style={styles.aiBadgeText}>AI</Text>
      </View>
      <View style={{ flex: 1, maxWidth: SCREEN_W * 0.82 }}>
        <View
          style={[
            styles.aiBubble,
            {
              backgroundColor: colors.aiBubble,
              borderColor: colors.aiBubbleBorder,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <MessageText content={message.content} colors={colors} />
          <Text
            style={[
              styles.timestamp,
              { color: colors.textMuted, marginTop: 6 },
            ]}
          >
            {formatTime(message.timestamp)}
          </Text>
        </View>
        {isLast && <BubbleActions colors={colors} content={message.content} />}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Typing dots animation
// ---------------------------------------------------------------------------
function TypingDots({ colors }: any) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, {
            toValue: -5,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(600 - i * 150),
        ]),
      ),
    );
    Animated.parallel(animations).start();
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 4,
      }}
    >
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: colors.textMuted,
              transform: [{ translateY: dot }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bubble action row (copy / regenerate)
// ---------------------------------------------------------------------------
function BubbleActions({ colors, content }: any) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    // Clipboard.setString(content); // uncomment with expo-clipboard
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [content]);

  return (
    <View style={styles.bubbleActions}>
      <TouchableOpacity
        onPress={handleCopy}
        style={[styles.actionBtn, { borderColor: colors.border }]}
        activeOpacity={0.7}
      >
        <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
          {copied ? '✓ Copiado' : '⎘ Copiar'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Suggestion chips (empty state)
// ---------------------------------------------------------------------------
const SUGGESTIONS = [
  '¿Qué puedes hacer?',
  'Explícame la relatividad',
  'Escribe un poema corto',
  'Ayúdame a programar en Python',
];

function SuggestionChips({ colors, onPress }: any) {
  return (
    <View style={styles.suggestionsWrap}>
      <Text style={[styles.suggestionsTitle, { color: colors.textMuted }]}>
        Algunas sugerencias
      </Text>
      <View style={styles.chipsRow}>
        {SUGGESTIONS.map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => onPress(s)}
            style={[
              styles.chip,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sidebar (conversation history)
// ---------------------------------------------------------------------------
const DUMMY_HISTORY = [
  { id: 'h1', title: 'Corrección de código React', active: false },
  { id: 'h2', title: 'Receta de pasta al pesto', active: false },
  { id: 'h3', title: 'Plan de entrenamiento semanal', active: false },
  { id: 'h4', title: 'Chat actual', active: true },
];

function Sidebar({ visible, colors, onClose, onNewChat }: any) {
  const translateX = useRef(new Animated.Value(-300)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: visible ? 0 : -300,
      useNativeDriver: true,
      tension: 100,
      friction: 14,
    }).start();
  }, [visible]);

  return (
    <>
      {visible && <Pressable style={styles.sidebarOverlay} onPress={onClose} />}
      <Animated.View
        style={[
          styles.sidebar,
          {
            backgroundColor: colors.sidebarBg,
            borderRightColor: colors.border,
            transform: [{ translateX }],
          },
        ]}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.sidebarHeader}>
            <Text style={[styles.sidebarTitle, { color: colors.text }]}>
              Conversaciones
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: colors.textSecondary, fontSize: 20 }}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.newChatBtn, { borderColor: colors.border }]}
            onPress={() => {
              onNewChat();
              onClose();
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.newChatBtnText, { color: colors.text }]}>
              + Nueva conversación
            </Text>
          </TouchableOpacity>
          {DUMMY_HISTORY.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.sidebarItem,
                {
                  backgroundColor: item.active
                    ? colors.sidebarItemActive
                    : 'transparent',
                },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sidebarItemText,
                  {
                    color: item.active ? colors.text : colors.textSecondary,
                    fontWeight: item.active ? '500' : '400',
                  },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </SafeAreaView>
      </Animated.View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Input toolbar
// ---------------------------------------------------------------------------
function InputBar({ colors, onSend, loading }: any) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const canSend = text.trim().length > 0 && !loading;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
    onSend(text.trim());
    setText('');
  }, [canSend, text, onSend]);

  return (
    <View
      style={[
        styles.inputBar,
        {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.inputBg,
            borderColor: focused ? colors.inputBorderFocus : colors.inputBorder,
            shadowColor: colors.shadow,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder="Mensaje..."
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { color: colors.text }]}
          multiline
          maxLength={4000}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={Platform.OS === 'web' ? handleSend : undefined}
          blurOnSubmit={false}
        />
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendBtn,
              {
                backgroundColor: canSend
                  ? colors.sendBtn
                  : colors.sendBtnDisabled,
              },
            ]}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.bg} />
            ) : (
              <Text
                style={{
                  color: canSend ? colors.bg : colors.textMuted,
                  fontSize: 16,
                }}
              >
                ↑
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
      <Text style={[styles.inputHint, { color: colors.textMuted }]}>
        La IA puede cometer errores. Verifica la información importante.
      </Text>
    </View>
  );
}

function Header({ colors, onMenuPress, onNewChat, modelName }: any) {
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      <TouchableOpacity
        onPress={onMenuPress}
        style={styles.headerBtn}
        activeOpacity={0.7}
      >
        <Text style={{ color: colors.iconBtn, fontSize: 20 }}>☰</Text>
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {modelName}
        </Text>
        <View style={[styles.onlineDot, { backgroundColor: '#22C55E' }]} />
      </View>
      <TouchableOpacity
        onPress={onNewChat}
        style={styles.headerBtn}
        activeOpacity={0.7}
      >
        <Text style={{ color: colors.iconBtn, fontSize: 20 }}>⊕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function ChatScreen() {
  const scheme = useColorScheme();
  const colors = palette[scheme === 'dark' ? 'dark' : 'light'];

  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
  }, []);

  const chat_llm = useLlamaEngine({
    contextParams: { n_ctx: 2048 },
    completionParams: { temperature: 0.7, n_predict: 512 },
  });
  const search_llm = useLlamaEngine({
    contextParams: { n_ctx: 2048, embedding: true },
    completionParams: { temperature: 0.7, n_predict: 512 },
  });

  useEffect(() => {
    chat_llm.loadModelFromPath('all-MiniLM-L6-v2-ggml-model-f16.gguf');
    search_llm.loadModelFromPath('embeddinggemma-300m-Q4_0.gguf');
  }, []);

  const rag = useSQLiteRAG({
    assetDbName: 'knowledge.current/corpus.sqlite',
    embeddingTable: 'vec_chunks',
    embeddingDim: 256, // FIXME: from json
  });

  const handleSend = useCallback(
    async (text: string) => {
      setLoading(true);
      // 1. Agregar mensaje del usuario y el spinner
      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages(prev => [
        ...prev,
        userMsg,
        {
          id: 'typing',
          role: 'assistant',
          typing: true,
          content: '',
          timestamp: new Date(),
        },
      ]);

      // 2. Construir historial para el prompt (sin el typing)
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      // 3. Llamar al motor con streaming
      let partial = '';
      const aiMsgId = generateId();

      console.log("vectorizing")
      // const vec = await search_llm.vectorize(text);
      // console.log(`vectorizing: size ${vec.length}`)
      console.log("search")
      // const docs = await rag.similaritySearch(text, vec);
      // console.log(`search: total ${docs.length}`)
      const docs: SimilarityResult[] = []
      await chat_llm.generate(
        history,
        docs,
        text => {
          partial = text;
          setMessages(prev => {
            const withoutTyping = prev.filter(
              m => m.id !== 'typing' && m.id !== aiMsgId,
            );
            return [
              ...withoutTyping,
              {
                id: aiMsgId,
                role: 'assistant',
                content: partial,
                timestamp: new Date(),
              },
            ];
          });
        },
      );
      setLoading(false);
    },
    [messages, chat_llm, search_llm],
  );

  const handleNewChat = useCallback(() => {
    setMessages(INITIAL_MESSAGES);
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'triggerInputText',
      data => {
        handleSend(data.message);
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const showEmpty = messages.length === 1;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      <Sidebar
        visible={sidebarOpen}
        colors={colors}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
      />

      <Header
        colors={colors}
        onMenuPress={() => setSidebarOpen(true)}
        onNewChat={handleNewChat}
        modelName={'Asistente IA'}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={[styles.messageList, showEmpty && { flex: 1 }]}
          ListHeaderComponent={
            showEmpty ? (
              <WelcomeBanner
                colors={colors}
                // onLoad={loadModel}
              />
            ) : null
          }
          ListFooterComponent={
            showEmpty ? (
              <SuggestionChips colors={colors} onPress={handleSend} />
            ) : (
              <View style={{ height: 16 }} />
            )
          }
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item}
              colors={colors}
              isLast={index === messages.length - 1}
            />
          )}
          onContentSizeChange={scrollToBottom}
        />

        <InputBar colors={colors} onSend={handleSend} loading={loading} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Welcome banner (shown before first user message)
// ---------------------------------------------------------------------------
function WelcomeBanner({
  colors,
}: // onLoad,
// selectModel,
{
  colors: Colors;
  // selectModel: boolean;
  // onLoad: (s: 'mistral' | 'llama3' | 'chatml') => void;
}) {
  return (
    <View style={styles.welcomeWrap}>
      <View style={[styles.logoCircle, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={{ fontSize: 28 }}>✦</Text>
      </View>
      <Text style={[styles.welcomeTitle, { color: colors.text }]}>
        {`¿En qué puedo\nayudarte hoy?`}
      </Text>

      {/* <TouchableOpacity
        onPress={() => onLoad('llama3')}
        style={[
          styles.chip,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
        activeOpacity={0.75}
      >
        <Text style={[styles.chipText, { color: colors.textSecondary }]}>
          Llama3
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onLoad('mistral')}
        style={[
          styles.chip,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
        activeOpacity={0.75}
      >
        <Text style={[styles.chipText, { color: colors.textSecondary }]}>
          Chatml
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onLoad('chatml')}
        style={[
          styles.chip,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
        activeOpacity={0.75}
      >
        <Text style={[styles.chipText, { color: colors.textSecondary }]}>
          Mistral
        </Text>
      </TouchableOpacity> */}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Mock response generator
// ---------------------------------------------------------------------------
function simulateResponse(input: string) {
  const lower = input.toLowerCase();
  if (
    lower.includes('python') ||
    lower.includes('código') ||
    lower.includes('programar')
  ) {
    return 'Claro, aquí tienes un ejemplo en Python:\n\n```python\ndef saludar(nombre):\n    return f"Hola, {nombre}!"\n\nprint(saludar("Mundo"))\n```\n\nEste código define una función que devuelve un saludo personalizado. ¿Quieres que profundice en algún concepto específico?';
  }
  if (lower.includes('poem') || lower.includes('poema')) {
    return 'Aquí va un poema breve:\n\n*Entre líneas de código y sueños digitales,*\n*una mente silenciosa piensa sin descansar,*\n*palabras que florecen en pantallas invernales,*\n*la magia del lenguaje listo para comenzar.*\n\n¿Te gustaría otro estilo o temática?';
  }
  if (lower.includes('relatividad')) {
    return 'La relatividad especial de Einstein se basa en dos postulados:\n\n1. Las leyes de la física son las mismas en todos los marcos de referencia inerciales.\n2. La velocidad de la luz en el vacío es constante (~299.792 km/s) independientemente del movimiento del observador.\n\nUna consecuencia clave es que el tiempo transcurre más lento para objetos en movimiento rápido (dilatación temporal). ¿Quieres que explique algún aspecto con más detalle?';
  }
  if (lower.includes('qué puedes')) {
    return 'Puedo ayudarte con muchas cosas:\n\n• **Programación** – debugging, explicar código, sugerir algoritmos\n• **Redacción** – emails, artículos, resúmenes\n• **Aprendizaje** – explicar conceptos complejos\n• **Análisis** – revisar textos, datos, argumentos\n• **Creatividad** – poemas, historias, ideas\n\n¡Solo dime qué necesitas!';
  }
  return `Entiendo tu mensaje: "${
    input.length > 60 ? input.slice(0, 60) + '…' : input
  }".\n\nEs una pregunta interesante. Para darte la mejor respuesta posible, ¿podrías darme un poco más de contexto? Estoy aquí para ayudarte con lo que necesites.`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  // Message list
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },

  // User bubble
  userRow: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  userBubble: {
    maxWidth: SCREEN_W * 0.78,
    borderRadius: 20,
    borderBottomRightRadius: 5,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  userText: {
    fontSize: 15.5,
    lineHeight: 23,
  },

  // AI bubble
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 24,
  },
  aiBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  aiBubble: {
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 0.5,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  typingBubble: {
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 0.5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  timestamp: {
    fontSize: 11,
    letterSpacing: 0.2,
  },

  // Bubble actions
  bubbleActions: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
    paddingLeft: 4,
  },
  actionBtn: {
    borderWidth: 0.5,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  actionBtnText: {
    fontSize: 12,
  },

  // Input bar
  inputBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 15.5,
    maxHeight: 120,
    paddingVertical: 6,
    lineHeight: 22,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.1,
  },

  // Sidebar
  sidebarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    zIndex: 11,
    borderRightWidth: 0.5,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sidebarTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
  },
  newChatBtn: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 0.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  newChatBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sidebarItem: {
    marginHorizontal: 8,
    marginBottom: 2,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  sidebarItemText: {
    fontSize: 14,
  },

  // Welcome
  welcomeWrap: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 24,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.6,
    lineHeight: 34,
  },

  // Suggestions
  suggestionsWrap: {
    marginTop: 12,
    marginBottom: 8,
  },
  suggestionsTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 0.5,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: {
    fontSize: 13.5,
  },
});


