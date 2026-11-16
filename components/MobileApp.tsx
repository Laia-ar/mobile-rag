import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
} from 'react-native';
import RNFS from 'react-native-fs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useOfflineChat } from '../hooks/useOfflineChat';
import { useSQLiteRAG } from '../hooks/useRagEngine';
import { isRegistration, parseBridgeRequest } from '../shared/mobileProtocol';
import type {
  BridgeRequest,
  BridgeResponse,
  Registration,
  Source,
} from '../shared/mobileProtocol';
import { backendRequest, MobileError } from '../services/mobile/backend';
import {
  openPdfAtPage,
} from '../services/native/offlineKnowledge';

const SESSION_KEY = '@infecto-assist/v2/registration';
// Synthetic HTTPS origin for bundled HTML, not an internet endpoint.
const UI_ORIGIN = 'https://appassets.androidplatform.net/';

interface Bootstrap {
  html: string;
  backendUrl: string;
  registration: Registration | null;
}
function sourcesForDisplay(
  sources: {
    documentId: string;
    title: string;
    content: string;
    page?: number;
    citationTitles?: string[];
  }[],
): Source[] {
  const documents = new Map<string, Source>();
  for (const source of sources) {
    const existing = documents.get(source.documentId);
    if (existing) {
      existing.citation_titles = [
        ...new Set([
          ...(existing.citation_titles ?? []),
          ...(source.citationTitles ?? []),
        ]),
      ];
    } else {
      documents.set(source.documentId, {
        document_id: source.documentId,
        title: source.title,
        page: source.page ?? null,
        content_preview: source.content.slice(0, 280),
        pdf_available: true,
        citation_titles: source.citationTitles ?? [],
      });
    }
  }
  return [...documents.values()];
}

export function MobileApp() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    Promise.all([
      RNFS.readFileAssets('mobile-web/index.html', 'utf8'),
      RNFS.readFileAssets('mobile-config.json', 'utf8'),
      AsyncStorage.getItem(SESSION_KEY),
    ])
      .then(([html, rawConfig, rawRegistration]) => {
        const config = JSON.parse(rawConfig) as { backendUrl?: unknown };
        let registration: unknown = null;
        try {
          registration = rawRegistration ? JSON.parse(rawRegistration) : null;
        } catch {
          /* Require registration again. */
        }
        if (active)
          setBootstrap({
            html,
            backendUrl:
              typeof config.backendUrl === 'string' ? config.backendUrl : '',
            registration: isRegistration(registration) ? registration : null,
          });
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (!bootstrap) {
    return (
      <SafeAreaView style={styles.loading}>
        {error ? (
          <>
            <Text>No se pudo abrir la aplicación.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAttempt(value => value + 1)}
            >
              <Text>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator accessibilityLabel="Abriendo aplicación" />
        )}
      </SafeAreaView>
    );
  }
  return <RuntimeShell bootstrap={bootstrap} />;
}

type RuntimeSnapshot = {rag: ReturnType<typeof useSQLiteRAG>; chat: ReturnType<typeof useOfflineChat>};
type Answer = NonNullable<RuntimeSnapshot['chat']['answer']>;

// The original hooks own inference and retrieval, unchanged from 80eb5d3.
function LegacyRuntime({country, onRuntime, onPartial}: {
  country: Registration['pais'];
  onRuntime(value: RuntimeSnapshot | null): void;
  onPartial(answer: Answer): void;
}) {
  const rag = useSQLiteRAG({country});
  const chat = useOfflineChat(rag);
  onRuntime({rag, chat});
  useEffect(() => {
    if (chat.answer?.text) onPartial(chat.answer);
  }, [chat.answer, onPartial]);
  useEffect(() => () => onRuntime(null), [onRuntime]);
  return null;
}

function RuntimeShell({ bootstrap }: { bootstrap: Bootstrap }) {
  const [registration, setRegistration] = useState(bootstrap.registration);
  const runtime = useRef({registration, rag: null as RuntimeSnapshot['rag'] | null, chat: null as RuntimeSnapshot['chat'] | null});
  runtime.current.registration = registration;
  const onRuntime = useCallback((value: RuntimeSnapshot | null) => {
    runtime.current.rag = value?.rag ?? null;
    runtime.current.chat = value?.chat ?? null;
  }, []);
  const web = useRef<WebView<unknown>>(null);
  const busy = useRef(false);
  const sessionEpoch = useRef(0);
  const mounted = useRef(true);
  const pendingIds = useRef(new Set<string>());
  const source = useRef({ html: bootstrap.html, baseUrl: UI_ORIGIN }).current;

  const activeQuery = useRef<{id: string; registrationId: string} | null>(null);
  const onPartial = useCallback((answer: Answer) => {
    const query = activeQuery.current;
    if (!mounted.current || !query || runtime.current.registration?.registration_id !== query.registrationId) return;
    const progress = {version: 1, id: query.id, answer: answer.text, sources: sourcesForDisplay(answer.sources)};
    web.current?.injectJavaScript(`window.__palmeraProgress?.(${JSON.stringify(progress)}); true;`);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const currentRuntime = runtime.current;
    return () => { mounted.current = false; currentRuntime.chat?.stop(); };
  }, []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        web.current?.injectJavaScript(
          `if (!window.__palmeraBack?.()) window.ReactNativeWebView.postMessage(JSON.stringify({version:1,id:'navigation-back',action:'navigation.exit',payload:{}})); true;`,
        );
        return true;
      },
    );
    return () => subscription.remove();
  }, []);

  const assertSessionEpoch = (epoch: number) => {
    if (epoch !== sessionEpoch.current)
      throw new MobileError(409, 'La sesión cambió.');
  };
  const saveRegistration = async (value: unknown, epoch: number) => {
    assertSessionEpoch(epoch);
    if (!isRegistration(value))
      throw new MobileError(502, 'El servidor devolvió un registro inválido.');
    if (runtime.current.registration?.pais !== value.pais) {
      runtime.current.chat?.stop();
      runtime.current.chat?.clear();
    }
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(value));
    assertSessionEpoch(epoch);
    runtime.current.registration = value;
    setRegistration(value);
    return value;
  };

  const dispatch = async (request: BridgeRequest): Promise<unknown> => {
    const p = request.payload;
    if (request.action === 'session.get') return runtime.current.registration;
    if (request.action === 'feedback.sync' || request.action === 'feedback.save')
      throw new MobileError(501, 'El feedback queda pendiente de integración en esta versión de interfaz.');
    if (request.action === 'session.logout') {
      sessionEpoch.current++;
      runtime.current.chat?.stop();
      runtime.current.chat?.clear();
      await AsyncStorage.removeItem(SESSION_KEY);
      runtime.current.registration = null;
      setRegistration(null);
      return null;
    }
    if (request.action === 'registration.create') {
      const epoch = ++sessionEpoch.current;
      const fields = Object.fromEntries(
        ['nombre', 'mail', 'pais', 'provincia', 'efector', 'disciplina'].map(
          key => [key, p[key]],
        ),
      );
      if (p.consent_aceptado !== true)
        throw new MobileError(422, 'Se requiere consentimiento.');
      return saveRegistration(
        await backendRequest(
          bootstrap.backendUrl,
          '/api/v1/consulta/registro',
          { ...fields, consent_aceptado: true },
        ),
        epoch,
      );
    }
    const current = runtime.current.registration;
    if (!current || p.registration_id !== current.registration_id)
      throw new MobileError(403, 'El registro no corresponde a esta sesión.');
    if (request.action === 'profile.update') {
      if (busy.current)
        throw new MobileError(
          409,
          'Esperá a que termine la consulta para editar el perfil.',
        );
      const fields = Object.fromEntries(
        ['nombre', 'mail', 'pais', 'provincia', 'efector', 'disciplina'].map(
          key => [key, p[key]],
        ),
      );
      const epoch = ++sessionEpoch.current;
      return saveRegistration(
        await backendRequest(
          bootstrap.backendUrl,
          `/api/v1/consulta/registro/${encodeURIComponent(
            current.registration_id,
          )}`,
          fields,
          'PUT',
        ),
        epoch,
      );
    }
    // Wait for the bundle and models, without blocking the WebView or starting a server.
    const deadline = Date.now() + 180000;
    while (
      !runtime.current.rag?.error &&
      runtime.current.chat?.status !== 'error' &&
      (!runtime.current.rag?.isReady ||
        (request.action === 'consultation.send' &&
          ['loading', 'unavailable'].includes(runtime.current.chat?.status ?? 'loading')))
    ) {
      if (!mounted.current || runtime.current.registration !== current)
        throw new MobileError(409, 'La sesión cambió.');
      if (Date.now() > deadline)
        throw new MobileError(
          503,
          'No se pudo preparar la consulta. Intentá nuevamente.',
        );
      await new Promise<void>(resolve => setTimeout(resolve, 100));
    }
    const activeRag = runtime.current.rag;
    if (!activeRag || activeRag.status !== 'ready')
      throw new MobileError(503, 'No se pudo abrir el contenido instalado.');
    if (request.action === 'documents.list')
      return activeRag.documents.map(document => ({
        document_id: document.id,
        title: document.title,
        description: document.description,
        document_type: 'pdf',
        file_size: document.fileSize ?? 0,
        pdf_available: true,
      }));
    if (request.action === 'document.open') {
      const document = activeRag.documents.find(
        item => item.id === p.document_id,
      );
      if (!document)
        throw new MobileError(
          404,
          'El PDF de este documento no está disponible.',
        );
      if (typeof p.page !== 'number' || !Number.isInteger(p.page) || p.page < 1)
        throw new MobileError(422, 'Página inválida.');
      await openPdfAtPage(document.absolutePath, p.page);
      return null;
    }
    if (request.action !== 'consultation.send')
      throw new MobileError(400, 'Operación no admitida.');
    if (
      typeof p.question !== 'string' ||
      p.question.trim().length < 1 ||
      p.question.length > 4000 ||
      !Array.isArray(p.history) ||
      p.history.length > 16 ||
      !p.history.every(
        line =>
          line &&
          typeof line === 'object' &&
          ['user', 'assistant'].includes(line.role) &&
          typeof line.content === 'string' &&
          line.content.length <= 8000,
      )
    )
      throw new MobileError(422, 'Consulta inválida.');
    if (busy.current)
      throw new MobileError(409, 'Ya hay una consulta en curso.');
    if (runtime.current.chat?.status !== 'ready')
      throw new MobileError(503, 'No se pudo preparar el modelo local.');
    busy.current = true;
    try {
      const started = Date.now();
      activeQuery.current = {id: request.id, registrationId: current.registration_id};
      const result = await runtime.current.chat!.send(p.question);
      if (!mounted.current || runtime.current.registration !== current)
        throw new MobileError(409, 'La sesión cambió.');
      if (!result.text.trim())
        throw new MobileError(
          502,
          'No se pudo generar la respuesta. Intentá nuevamente.',
        );
      const manifest = activeRag.installedPackage!.manifest;
      const sources = sourcesForDisplay(result.sources);
      const latency = Date.now() - started;
      const model = manifest.llm.id;
      return {
        log_id: request.id,
        answer: result.text,
        sources,
        model_used: model,
        model_name: manifest.llm.id,
        corpus_name: manifest.corpus.countryIds[current.pais],
        prompt_name: null,
        has_context: sources.length > 0,
        latency_ms: latency,
      };
    } finally {
      activeQuery.current = null;
      busy.current = false;
    }
  };

  const onMessage = (event: WebViewMessageEvent) => {
    let request: BridgeRequest;
    try {
      request = parseBridgeRequest(event.nativeEvent.data);
    } catch {
      return;
    }
    if (request.action === 'navigation.exit') {
      BackHandler.exitApp();
      return;
    }
    if (pendingIds.current.has(request.id)) return;
    pendingIds.current.add(request.id);
    const reply = (response: BridgeResponse) => {
      pendingIds.current.delete(request.id);
      if (mounted.current)
        web.current?.injectJavaScript(
          `window.__palmeraReceive?.(${JSON.stringify(response)}); true;`,
        );
    };
    dispatch(request)
      .then(result => reply({ version: 1, id: request.id, ok: true, result }))
      .catch((error: unknown) =>
        reply({
          version: 1,
          id: request.id,
          ok: false,
          error: {
            status: error instanceof MobileError ? error.status : 500,
            message:
              error instanceof Error
                ? error.message
                : 'No se pudo completar la operación.',
          },
        }),
      );
  };
  const openExternal = (url: string) => {
    if (/^https:\/\//.test(url)) Linking.openURL(url).catch(() => undefined);
  };
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {registration && <LegacyRuntime key={`${registration.registration_id}:${registration.pais}`} country={registration.pais} onRuntime={onRuntime} onPartial={onPartial} />}
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <WebView<unknown>
        ref={web}
        source={source}
        style={styles.container}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptCanOpenWindowsAutomatically={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        setSupportMultipleWindows={true}
        onOpenWindow={({ nativeEvent }) => openExternal(nativeEvent.targetUrl)}
        onShouldStartLoadWithRequest={request => {
          if (request.url === 'about:blank' || request.url === UI_ORIGIN)
            return true;
          openExternal(request.url);
          return false;
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
