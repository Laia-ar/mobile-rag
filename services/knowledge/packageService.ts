import RNFS from 'react-native-fs';
import {
  InstalledKnowledgePackage,
  KnowledgeFileDefinition,
  KnowledgeManifest,
} from '../../types/knowledge';
import {assertSafeRelativePath, parseKnowledgeManifest} from './manifest';

const ASSET_ROOT = 'knowledge.current';
const INSTALL_ROOT = `${RNFS.DocumentDirectoryPath}/knowledge`;

export class KnowledgePackageMissingError extends Error {
  constructor() {
    super(
      'No se encontró el paquete offline. Agregá android/app/src/main/assets/knowledge.current/manifest.json antes de compilar.',
    );
    this.name = 'KnowledgePackageMissingError';
  }
}

function joinPath(root: string, relativePath: string): string {
  assertSafeRelativePath(relativePath);
  return `${root}/${relativePath.replace(/\\/g, '/')}`;
}

function parentDirectory(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

async function validateFile(
  absolutePath: string,
  file: KnowledgeFileDefinition,
): Promise<boolean> {
  if (!(await RNFS.exists(absolutePath))) {
    return false;
  }
  const stat = await RNFS.stat(absolutePath);
  if (file.sizeBytes !== undefined && Number(stat.size) !== file.sizeBytes) {
    return false;
  }
  if (file.sha256) {
    const digest = await RNFS.hash(absolutePath, 'sha256');
    if (digest.toLowerCase() !== file.sha256) {
      return false;
    }
  }
  return true;
}

async function validateInstalledPackage(
  rootPath: string,
  manifest: KnowledgeManifest,
): Promise<boolean> {
  for (const file of manifest.files) {
    if (!(await validateFile(joinPath(rootPath, file.path), file))) {
      return false;
    }
  }
  return true;
}

async function copyPackage(
  rootPath: string,
  manifest: KnowledgeManifest,
  manifestRaw: string,
): Promise<void> {
  await RNFS.mkdir(rootPath);
  for (const file of manifest.files) {
    const source = `${ASSET_ROOT}/${file.path}`;
    const destination = joinPath(rootPath, file.path);
    if (!(await RNFS.existsAssets(source))) {
      throw new Error(`Falta un archivo declarado en el paquete: ${source}`);
    }
    await RNFS.mkdir(parentDirectory(destination));
    await RNFS.copyFileAssets(source, destination);
    if (!(await validateFile(destination, file))) {
      throw new Error(`Falló la validación de integridad: ${file.path}`);
    }
  }
  await RNFS.writeFile(`${rootPath}/manifest.json`, manifestRaw, 'utf8');
}

async function removeInstallDirectory(path: string): Promise<void> {
  const normalizedRoot = `${INSTALL_ROOT.replace(/\\/g, '/')}/`;
  const normalizedPath = path.replace(/\\/g, '/');
  if (!normalizedPath.startsWith(normalizedRoot)) {
    throw new Error('Se rechazó una limpieza fuera del directorio de conocimiento.');
  }
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

export async function installBundledKnowledgePackage(): Promise<InstalledKnowledgePackage> {
  const manifestAssetPath = `${ASSET_ROOT}/manifest.json`;
  if (!(await RNFS.existsAssets(manifestAssetPath))) {
    throw new KnowledgePackageMissingError();
  }

  const manifestRaw = await RNFS.readFileAssets(manifestAssetPath, 'utf8');
  const manifest = parseKnowledgeManifest(manifestRaw);
  const rootPath = `${INSTALL_ROOT}/versions/${manifest.packageVersion}`;

  if (!(await validateInstalledPackage(rootPath, manifest))) {
    const stagingPath = `${INSTALL_ROOT}/staging/${manifest.packageVersion}`;
    await removeInstallDirectory(stagingPath);
    await copyPackage(stagingPath, manifest, manifestRaw);
    if (!(await validateInstalledPackage(stagingPath, manifest))) {
      throw new Error('El paquete copiado no superó la validación.');
    }
    await removeInstallDirectory(rootPath);
    await RNFS.mkdir(`${INSTALL_ROOT}/versions`);
    await RNFS.moveFile(stagingPath, rootPath);
  }

  if (!(await validateInstalledPackage(rootPath, manifest))) {
    throw new Error('El paquete offline instalado no superó la validación.');
  }

  return {
    manifest,
    rootPath,
    resolvePath: relativePath => joinPath(rootPath, relativePath),
  };
}
