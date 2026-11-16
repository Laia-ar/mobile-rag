import React from 'react';
import Renderer from 'react-test-renderer';
import App from '../App';
import {useOfflineChat} from '../hooks/useOfflineChat';

const mockInjected = jest.fn();
const mockRegistration = {registration_id: 'test-session', nombre: 'Prueba', mail: 'test@example.com', pais: 'AR', provincia: 'Buenos Aires', efector: 'Prueba', disciplina: 'Prueba'};
const mockRag = {status: 'ready', isReady: true, error: null, documents: [], installedPackage: {manifest: {llm: {id: 'fixture'}, corpus: {countryIds: {AR: 'fixture'}}}}};
const mockChat = {status: 'ready', answer: null as null | {text: string; sources: never[]}, send: jest.fn(), stop: jest.fn(), clear: jest.fn()};
jest.mock('../hooks/useRagEngine', () => ({useSQLiteRAG: jest.fn(() => mockRag)}));
jest.mock('../hooks/useOfflineChat', () => ({useOfflineChat: jest.fn(() => mockChat)}));
jest.mock('react-native-fs', () => ({readFileAssets: jest.fn(async (name: string) => name.endsWith('.html') ? '<html></html>' : '{"backendUrl":"https://example.test"}')}));
jest.mock('@react-native-async-storage/async-storage', () => ({getItem: jest.fn(async () => JSON.stringify(mockRegistration)), setItem: jest.fn(), removeItem: jest.fn()}));
jest.mock('react-native-safe-area-context', () => {
  const {View} = require('react-native'); return {SafeAreaProvider: View, SafeAreaView: View};
});
jest.mock('react-native-webview', () => {
  const ReactForMock = require('react');
  return {WebView: ReactForMock.forwardRef((props: object, ref: unknown) => {
    ReactForMock.useImperativeHandle(ref, () => ({injectJavaScript: mockInjected}));
    return ReactForMock.createElement('MockWebView', props);
  })};
});

test('uses the original hook contract and forwards partial text before the native answer completes', async () => {
  let finish!: (value: unknown) => void;
  mockChat.send.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => {tree = Renderer.create(<App />);});
  expect(useOfflineChat).toHaveBeenCalledWith(mockRag);
  const view = tree.root.find(node => String(node.type) === 'MockWebView');
  await Renderer.act(async () => view.props.onMessage({nativeEvent: {data: JSON.stringify({version: 1, id: 'query-1', action: 'consultation.send', payload: {registration_id: 'test-session', question: 'Pregunta sintética', history: []}})}}));
  expect(mockChat.send).toHaveBeenCalledWith('Pregunta sintética');
  mockChat.answer = {text: 'Texto parcial', sources: []};
  await Renderer.act(async () => tree.update(<App />));
  expect(mockInjected.mock.calls.some(([script]) => script.startsWith('window.__palmeraProgress?.(') && script.includes('Texto parcial'))).toBe(true);
  expect(mockInjected.mock.calls.some(([script]) => script.startsWith('window.__palmeraReceive?.('))).toBe(false);
  await Renderer.act(async () => finish({text: 'Respuesta final', sources: []}));
  const final = mockInjected.mock.calls.find(([script]) => script.startsWith('window.__palmeraReceive?.('));
  expect(final?.[0]).toContain('Respuesta final');
  await Renderer.act(async () => tree.unmount());
});
