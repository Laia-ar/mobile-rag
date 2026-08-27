import {NativeModules, Platform} from 'react-native';

type OfflineKnowledgeNativeModule = {
  sha256Text(value: string): Promise<string>;
  openPdf(path: string, page: number): Promise<void>;
};

function requireNativeModule(): OfflineKnowledgeNativeModule {
  const module = NativeModules.OfflineKnowledge as
    | OfflineKnowledgeNativeModule
    | undefined;
  if (!module) {
    throw new Error(
      `El módulo OfflineKnowledge no está disponible en ${Platform.OS}.`,
    );
  }
  return module;
}

export async function sha256Text(value: string): Promise<string> {
  return (await requireNativeModule().sha256Text(value)).toLowerCase();
}

export async function openPdfAtPage(
  absolutePath: string,
  page = 1,
): Promise<void> {
  await requireNativeModule().openPdf(absolutePath, Math.max(1, page));
}
