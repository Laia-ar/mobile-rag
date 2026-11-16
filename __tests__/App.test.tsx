import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { open } from '@op-engineering/op-sqlite';
import { initLlama } from 'llama.rn';
import App from '../App';

const mockInjected = jest.fn();

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/private/test',
  readFileAssets: jest.fn((name: string) =>
    Promise.resolve(
      name.endsWith('.html')
        ? '<html></html>'
        : '{"backendUrl":"https://example.test"}',
    ),
  ),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));
jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));
jest.mock('llama.rn', () => ({ initLlama: jest.fn() }));
jest.mock('react-native-webview', () => {
  const ReactForMock = require('react');
  return {
    WebView: ReactForMock.forwardRef((props: object, ref: unknown) => {
      ReactForMock.useImperativeHandle(ref, () => ({
        injectJavaScript: mockInjected,
      }));
      return ReactForMock.createElement('MockWebView', props);
    }),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaProvider: View, SafeAreaView: View };
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('boots the bundled registration UI without opening the private corpus or loading models', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(RNFS.readFileAssets).toHaveBeenCalledWith(
    'mobile-web/index.html',
    'utf8',
  );
  expect(open).not.toHaveBeenCalled();
  expect(initLlama).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    tree.unmount();
  });
});

test('a profile response arriving after logout cannot restore a former registration', async () => {
  const registration = {
    registration_id: 'fixture-session',
    nombre: 'Persona de prueba',
    mail: 'fixture@example.com',
    pais: 'AR',
    provincia: 'Buenos Aires',
    efector: 'Centro de prueba',
    disciplina: 'Pruebas',
  };
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async key =>
      key.endsWith('/registration') ? JSON.stringify(registration) : null,
    );
  let completeResponse!: (value: Response) => void;
  const http = jest.spyOn(globalThis, 'fetch').mockImplementation(
    () =>
      new Promise<Response>(resolve => {
        completeResponse = resolve;
      }),
  );
  let tree!: ReactTestRenderer.ReactTestRenderer;
  const message = (id: string, action: string, payload: object = {}) => {
    const view = tree.root.find(node => String(node.type) === 'MockWebView');
    view.props.onMessage({
      nativeEvent: {
        data: JSON.stringify({ version: 1, id, action, payload }),
      },
    });
  };
  try {
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<App />);
    });
    await ReactTestRenderer.act(async () => {
      message('edit', 'profile.update', {
        ...registration,
        nombre: 'Nombre editado',
      });
    });
    expect(http).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(async () => {
      message('logout', 'session.logout');
    });
    await ReactTestRenderer.act(async () => {
      completeResponse({
        ok: true,
        json: async () => ({ ...registration, nombre: 'Nombre editado' }),
      } as Response);
    });
    await ReactTestRenderer.act(async () => {
      message('session-after', 'session.get');
    });
    const replies = mockInjected.mock.calls.map(([script]: [string]) =>
      JSON.parse(
        script.slice('window.__palmeraReceive?.('.length, -'); true;'.length),
      ),
    );
    expect(replies.find(reply => reply.id === 'edit')).toMatchObject({
      ok: false,
      error: { status: 409 },
    });
    expect(replies.find(reply => reply.id === 'session-after')).toMatchObject({
      ok: true,
      result: null,
    });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  } finally {
    if (tree) await ReactTestRenderer.act(async () => tree.unmount());
    http.mockRestore();
  }
});
