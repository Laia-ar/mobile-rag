param(
    [Parameter(Mandatory = $true)]
    [string]$DatabasePath,

    [Parameter(Mandatory = $true)]
    [string]$CorpusRoot,

    [Parameter(Mandatory = $true)]
    [string]$EmbeddingModelPath,

    [Parameter(Mandatory = $true)]
    [string]$LlmModelPath,

    [Parameter(Mandatory = $true)]
    [string]$ArgentinaCorpusId,

    [Parameter(Mandatory = $true)]
    [string]$BoliviaCorpusId,

    [string]$PackageVersion = (Get-Date -Format 'yyyy.MM.dd-HHmm'),

    [string]$PackageRoot,

    [string]$SqlitePath = 'sqlite3'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($PackageRoot)) {
    $PackageRoot = Join-Path $PSScriptRoot '..\android\app\src\main\assets\knowledge.current'
}

function Resolve-RequiredFile([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "No se encontro ${Label}: ${Path}"
    }
    return (Resolve-Path -LiteralPath $Path).Path
}

function Resolve-RequiredDirectory([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "No se encontro ${Label}: ${Path}"
    }
    return (Resolve-Path -LiteralPath $Path).Path
}

function Normalize-DocumentName([string]$Value) {
    $stem = [IO.Path]::GetFileNameWithoutExtension($Value)
    $stem = $stem -replace '^[0-9a-fA-F]{8}_', ''
    $stem = $stem -replace '_(diagramas|digramas)$', ''
    $decomposed = $stem.Normalize([Text.NormalizationForm]::FormD)
    $builder = New-Object Text.StringBuilder
    foreach ($character in $decomposed.ToCharArray()) {
        $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($character)
        if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$builder.Append($character)
        }
    }
    return ($builder.ToString().ToLowerInvariant() -replace '[^a-z0-9]', '')
}

function Copy-IfDifferent([string]$Source, [string]$Destination) {
    $resolvedSource = [IO.Path]::GetFullPath($Source)
    $resolvedDestination = [IO.Path]::GetFullPath($Destination)
    if ($resolvedSource -ne $resolvedDestination) {
        Copy-Item -LiteralPath $resolvedSource -Destination $resolvedDestination -Force
    }
}

$DatabasePath = Resolve-RequiredFile $DatabasePath 'la base indexada'
$CorpusRoot = Resolve-RequiredDirectory $CorpusRoot 'el directorio Corpus'
$EmbeddingModelPath = Resolve-RequiredFile $EmbeddingModelPath 'el modelo de embeddings'
$LlmModelPath = Resolve-RequiredFile $LlmModelPath 'el modelo generativo'
$promptPath = Resolve-RequiredFile (Join-Path $PSScriptRoot '..\config\clinical-system-prompt.txt') 'el system prompt'

$sqliteCommand = Get-Command $SqlitePath -ErrorAction Stop
$SqlitePath = $sqliteCommand.Source
$PackageRoot = [IO.Path]::GetFullPath($PackageRoot)

$databaseDirectory = Join-Path $PackageRoot 'database'
$documentsDirectory = Join-Path $PackageRoot 'documents'
$modelsDirectory = Join-Path $PackageRoot 'models'
$promptsDirectory = Join-Path $PackageRoot 'prompts'
New-Item -ItemType Directory -Path $databaseDirectory, $documentsDirectory, $modelsDirectory, $promptsDirectory -Force | Out-Null

$packagedDatabase = Join-Path $databaseDirectory 'corpus.sqlite'
$packagedEmbedding = Join-Path $modelsDirectory 'all-MiniLM-L6-v2-ggml-model-f16.gguf'
$packagedLlm = Join-Path $modelsDirectory 'Qwen3.5-0.8B-Q4_K_M.gguf'
$packagedPrompt = Join-Path $promptsDirectory 'clinical-system.txt'
Copy-Item -LiteralPath $DatabasePath -Destination $packagedDatabase
Copy-IfDifferent $EmbeddingModelPath $packagedEmbedding
Copy-IfDifferent $LlmModelPath $packagedLlm
Copy-Item -LiteralPath $promptPath -Destination $packagedPrompt

$query = @"
SELECT corpus_id, id, title, file_path
FROM documents
WHERE corpus_id IN ('$ArgentinaCorpusId', '$BoliviaCorpusId');
"@
$documents = & $SqlitePath -header -csv $packagedDatabase $query | ConvertFrom-Csv
if ($LASTEXITCODE -ne 0 -or -not $documents) {
    throw 'No se pudieron leer los documentos de los corpus seleccionados.'
}

$pdfFiles = Get-ChildItem -LiteralPath $CorpusRoot -Recurse -File -Filter '*.pdf'
$updates = New-Object Text.StringBuilder
[void]$updates.AppendLine('BEGIN;')

foreach ($document in $documents) {
    if ($document.corpus_id -eq $ArgentinaCorpusId) {
        $countryCode = 'AR'
        $countryDirectoryName = 'Argentina'
    } elseif ($document.corpus_id -eq $BoliviaCorpusId) {
        $countryCode = 'BO'
        $countryDirectoryName = 'Bolivia'
    } else {
        throw "Corpus inesperado: $($document.corpus_id)"
    }

    $documentKey = Normalize-DocumentName $document.file_path
    $matches = @($pdfFiles | Where-Object {
        $_.Directory.Name -eq $countryDirectoryName -and
        (Normalize-DocumentName $_.Name) -eq $documentKey
    })
    if ($matches.Count -ne 1) {
        throw "No se encontro un unico PDF para '$($document.title)'. Coincidencias: $($matches.Count)."
    }

    $countryDestination = Join-Path $documentsDirectory $countryCode
    New-Item -ItemType Directory -Path $countryDestination -Force | Out-Null
    $destination = Join-Path $countryDestination $matches[0].Name
    if (-not (Test-Path -LiteralPath $destination)) {
        Copy-Item -LiteralPath $matches[0].FullName -Destination $destination
    }

    $relativePath = "documents/$countryCode/$($matches[0].Name)"
    $escapedPath = $relativePath.Replace("'", "''")
    $escapedId = $document.id.Replace("'", "''")
    $countryName = if ($countryCode -eq 'AR') { 'Argentina' } else { 'Bolivia' }
    [void]$updates.AppendLine("UPDATE documents SET file_path = '$escapedPath', country = '$countryName' WHERE id = '$escapedId';")
}

[void]$updates.AppendLine('COMMIT;')
[void]$updates.AppendLine('PRAGMA journal_mode=DELETE;')
& $SqlitePath $packagedDatabase $updates.ToString() | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'No se pudieron adaptar las rutas de documentos en la copia mobile.'
}

$integrity = (& $SqlitePath $packagedDatabase 'PRAGMA integrity_check;').Trim()
if ($integrity -ne 'ok') {
    throw "La copia mobile no supero integrity_check: $integrity"
}

$files = Get-ChildItem -LiteralPath $PackageRoot -Recurse -File |
    Where-Object { $_.Name -ne 'manifest.json' } |
    Sort-Object FullName |
    ForEach-Object {
        $relativePath = $_.FullName.Substring($PackageRoot.Length).TrimStart([char[]]@('\', '/')).Replace('\', '/')
        [ordered]@{
            path = $relativePath
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            sizeBytes = $_.Length
        }
    }

$manifest = [ordered]@{
    schemaVersion = 1
    packageVersion = $PackageVersion
    countries = @('AR', 'BO')
    corpus = [ordered]@{
        countryIds = [ordered]@{
            AR = $ArgentinaCorpusId
            BO = $BoliviaCorpusId
        }
        databasePath = 'database/corpus.sqlite'
        documentsDirectory = 'documents'
    }
    embedding = [ordered]@{
        id = 'second-state/All-MiniLM-L6-v2-Embedding-GGUF'
        modelPath = 'models/all-MiniLM-L6-v2-ggml-model-f16.gguf'
        dimensions = 256
        retrievalDimensions = 256
        queryPrefix = ''
        normalize = $true
    }
    llm = [ordered]@{
        id = 'unsloth/Qwen3.5-0.8B-GGUF'
        modelPath = 'models/Qwen3.5-0.8B-Q4_K_M.gguf'
        systemPromptPath = 'prompts/clinical-system.txt'
        contextParams = [ordered]@{
            n_ctx = 4096
            n_gpu_layers = 99
            use_mmap = $true
            use_mlock = $false
        }
        completionParams = [ordered]@{
            temperature = 0.2
            top_p = 0.9
            top_k = 40
            n_predict = 512
        }
    }
    access = [ordered]@{
        strategy = 'disabled-for-development'
    }
    files = @($files)
}

$manifestJson = $manifest | ConvertTo-Json -Depth 10
$manifestPath = Join-Path $PackageRoot 'manifest.json'
[IO.File]::WriteAllText($manifestPath, $manifestJson, (New-Object Text.UTF8Encoding($false)))
Write-Host "Paquete offline listo: $PackageRoot"
Write-Host "Documentos DB: $($documents.Count); PDF unicos: $((Get-ChildItem -LiteralPath $documentsDirectory -Recurse -File -Filter '*.pdf').Count)"
Write-Host "Acceso: disabled-for-development (cualquier ID no vacio)."
