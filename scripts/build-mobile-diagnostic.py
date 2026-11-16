"""Build an isolated measurement APK; restore source, private manifest and visual APK.

Run --check first. This script never installs an APK or accesses an Android device.
The knowledge package and backend configuration must already exist locally.
"""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import os
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def instrument(original: bytes) -> str:
    text = original.decode('utf-8')
    text = text.replace('  initLlama,', '  initLlama,\n  toggleNativeLog,\n  addNativeLogListener,', 1)
    marker = 'const DEFAULT_CONTEXT_PARAMS: Partial<ContextParams> = {'
    text = text.replace(marker, "let diagnosticInitializations = 0;\nlet diagnosticSetup: Promise<void> | undefined;\naddNativeLogListener((_level, message) => {\n  if (/^llama_context:\\s+n_(ctx|ctx_seq|seq_max)\\s*=/.test(message.trim())) {\n    console.log('[RAG_TOKEN_DIAGNOSTIC native-limit]', message.trim());\n  }\n});\n\n" + marker, 1)
    text = text.replace('    contextRef.current = await initLlama(params);', "    diagnosticInitializations++;\n    if (diagnosticInitializations === 1) diagnosticSetup = toggleNativeLog(true);\n    console.log('[RAG_TOKEN_DIAGNOSTIC requested]', JSON.stringify({kind: params.embedding ? 'embedding' : 'generation', n_ctx: params.n_ctx ?? 'native-default', n_threads: params.n_threads}));\n    try {\n      await diagnosticSetup;\n      contextRef.current = await initLlama(params);\n      const metadata = contextRef.current.model.metadata as Record<string, unknown>;\n      const architecture = String(metadata['general.architecture']);\n      console.log('[RAG_TOKEN_DIAGNOSTIC loaded]', JSON.stringify({kind: params.embedding ? 'embedding' : 'generation', id: contextRef.current.id, architecture, trainingContext: metadata[architecture + '.context_length'], addBosToken: metadata['tokenizer.ggml.add_bos_token']}));\n    } finally {\n      diagnosticInitializations--;\n      if (diagnosticInitializations === 0) await toggleNativeLog(false);\n    }", 1)
    old = '      try {\n        const result = await contextRef.current.completion(params, data => {'
    new = "      try {\n        const formatted = await contextRef.current.getFormattedChat(\n          params.messages!, params.chat_template || params.chatTemplate,\n          {jinja: params.jinja, tools: params.tools, parallel_tool_calls: params.parallel_tool_calls, tool_choice: params.tool_choice, response_format: params.response_format, enable_thinking: params.enable_thinking, reasoning_format: params.reasoning_format, add_generation_prompt: params.add_generation_prompt, now: params.now, chat_template_kwargs: params.chat_template_kwargs, force_pure_content: params.force_pure_content},\n        );\n        const tokenized = await contextRef.current.tokenize(formatted.prompt);\n        const systemTokenized = await contextRef.current.tokenize(system_prompt);\n        const metadata = contextRef.current.model.metadata as Record<string, unknown>;\n        console.log('[RAG_TOKEN_DIAGNOSTIC full-prompt]', JSON.stringify({id: contextRef.current.id, formattedTokens: tokenized.tokens.length, systemAndSourcesTokens: systemTokenized.tokens.length, contextRequested: contextParams.n_ctx ?? 'native-default', maxOutputTokens: params.n_predict, sources: docs.length, historyAndQuestionMessages: messages.length, format: formatted.type, addBosToken: metadata['tokenizer.ggml.add_bos_token']}));\n        const result = await contextRef.current.completion(params, data => {"
    assert old in text
    text = text.replace(old, new, 1)
    old = '      } catch (err) {\n        if (!abortRef.current) {'
    assert text.count(old) == 1
    text = text.replace(old, "      } catch (err) {\n        console.log('[RAG_TOKEN_DIAGNOSTIC generation-error]', toError(err).message);\n        if (!abortRef.current) {", 1)
    return text


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(8 * 1024 * 1024):
            value.update(block)
    return value.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--context', type=int, choices=[4096, 8192], default=8192)
    parser.add_argument('--check', action='store_true', help='Validate prerequisites without writing or building.')
    args = parser.parse_args()
    source = ROOT / 'hooks/useLlamaEngine.ts'
    original = subprocess.check_output(['git', 'show', 'HEAD:hooks/useLlamaEngine.ts'], cwd=ROOT)
    if source.read_bytes() != original or b'RAG_TOKEN_DIAGNOSTIC' in original:
        raise RuntimeError('The original engine hook must be unchanged before building diagnostics.')
    measured_source = instrument(original)
    manifest_file = ROOT / 'android/app/src/main/assets/knowledge.current/manifest.json'
    original_manifest = manifest_file.read_bytes()
    manifest = json.loads(original_manifest)
    canonical = ROOT / 'android/app/build/outputs/apk/local/debug/app-local-debug.apk'
    if not canonical.is_file():
        raise RuntimeError('Build the visual localDebug APK first.')
    with zipfile.ZipFile(canonical) as archive:
        if json.loads(archive.read('assets/knowledge.current/manifest.json')) != manifest:
            raise RuntimeError('The canonical APK must match the current visual package manifest.')
    diagnostic = ROOT / f'android/app/build/diagnostics/app-local-debug-context-{args.context}-diagnostic.apk'
    print(json.dumps({'context': args.context, 'checkOnly': args.check, 'output': str(diagnostic)}), flush=True)
    if args.check:
        return
    diagnostic.parent.mkdir(parents=True, exist_ok=True)
    lock = diagnostic.parent / '.diagnostic-build.lock'
    descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.close(descriptor)
    backup = diagnostic.parent / ('visual-before-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.apk')
    canonical_hash = digest(canonical)
    try:
        shutil.copy2(canonical, backup)
        manifest['llm']['contextParams']['n_ctx'] = args.context
        manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        source.write_text(measured_source, encoding='utf-8', newline='\n')
        pnpm = ['cmd', '/c', 'pnpm'] if os.name == 'nt' else ['pnpm']
        subprocess.run(pnpm + ['type-check'], cwd=ROOT, check=True)
        gradle = ['cmd', '/c', 'gradlew.bat'] if os.name == 'nt' else ['./gradlew']
        subprocess.run(gradle + ['assembleLocalDebug', '-PreactNativeArchitectures=arm64-v8a', '--console=plain'], cwd=ROOT / 'android', check=True)
        with zipfile.ZipFile(canonical) as archive:
            built = json.loads(archive.read('assets/knowledge.current/manifest.json'))
        expected = json.loads(original_manifest)
        expected['llm']['contextParams']['n_ctx'] = args.context
        if built != expected:
            raise RuntimeError('Unexpected package configuration changes.')
        shutil.copy2(canonical, diagnostic)
        print(json.dumps({'diagnostic': str(diagnostic), 'sha256': digest(diagnostic)}), flush=True)
    finally:
        source.write_bytes(original)
        manifest_file.write_bytes(original_manifest)
        if backup.is_file():
            shutil.copy2(backup, canonical)
            if digest(canonical) != canonical_hash:
                raise RuntimeError('The visual APK restoration needs attention; its backup is preserved.')
        lock.unlink()


if __name__ == '__main__':
    main()
