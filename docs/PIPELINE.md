# ⚙️ PIPELINE — RingDeck CI/CD & Release System

> Technical specification: branching model, automated release workflow,
> build matrix, version detection, and deployment flows.

**Versao**: 1.0.0
**Data**: 2026-03-13
**Status**: ATIVO

---

## Indice

1. [System Architecture](#1-system-architecture)
2. [Branching Model](#2-branching-model)
3. [Version Detection — Step-by-Step](#3-version-detection)
4. [GitHub Actions Workflow — Full Spec](#4-github-actions-workflow)
5. [Build Matrix — Platform Targets](#5-build-matrix)
6. [Artifact Management](#6-artifact-management)
7. [Release Creation](#7-release-creation)
8. [Branch Protection — Rulesets](#8-branch-protection)
9. [Error Handling & Edge Cases](#9-error-handling)
10. [Execution Flows by Use Case](#10-execution-flows)
11. [Security & Permissions](#11-security)
12. [Technical Glossary](#12-glossary)

---

## 1. System Architecture

### Pipeline Diagram (3 Jobs)

```
┌──────────────────────────────────────────────────────────────────────┐
│                   JOB 1 — CHECK-VERSION                             │
│                                                                      │
│   [Trigger: push to main]                                            │
│   ├── checkout (fetch-depth: 0, precisa do historico de tags)        │
│   ├── le versao do package.json                                      │
│   ├── compara com tags existentes (git rev-parse vX.Y.Z)            │
│   ├── versao ja tem tag? → PARA AQUI (should_release=false)         │
│   └── versao nova? → cria tag vX.Y.Z + push tag                    │
│                                                                      │
│   Outputs: version, tag, should_release                              │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                   JOB 2 — BUILD (matrix: 3 plataformas)             │
│                                                                      │
│   [Depende: check-version, so roda se should_release=true]           │
│   ├── macos-latest   → electron-builder --mac  → .dmg               │
│   ├── ubuntu-latest  → electron-builder --linux → .AppImage, .deb   │
│   └── windows-latest → electron-builder --win  → .exe (NSIS+portable)│
│                                                                      │
│   Cada runner:                                                       │
│   ├── checkout                                                       │
│   ├── setup-bun (oven-sh/setup-bun@v2)                               │
│   ├── bun install --frozen-lockfile                                  │
│   ├── bunx electron-builder $build_args                              │
│   └── upload-artifact (out/*.dmg, *.exe, *.AppImage, *.deb)         │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                   JOB 3 — RELEASE                                    │
│                                                                      │
│   [Depende: check-version + build]                                   │
│   ├── download de TODOS os artifacts (merge-multiple)               │
│   ├── cria GitHub Release com tag vX.Y.Z                            │
│   ├── upload de todos os binarios                                    │
│   └── release notes automaticas (baseadas nos commits)              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
INPUT                    PROCESSAMENTO                    OUTPUT
─────                    ──────────────                    ──────

                     ┌──────────────────┐
[push to main]   ──→ │                  │
[package.json]   ──→ │  GitHub Actions  │ ──→ [Tag vX.Y.Z]
[source code]    ──→ │  (3 runners)     │ ──→ [.dmg (macOS)]
[electron cfg]   ──→ │                  │ ──→ [.exe (Windows)]
                     └──────────────────┘ ──→ [.AppImage/.deb (Linux)]
                                          ──→ [GitHub Release]
```

---

## 2. Branching Model

> O projeto usa um modelo de 3 camadas: feature branches → develop → main.
> Nenhuma branch protegida aceita push direto.

### Diagrama de Fluxo

```
feature-branch (desenvolvimento livre)
   │
   ↓ Pull Request
   │
develop (branch de integracao, protegida)
   │  ├── recebe PRs de feature branches
   │  ├── bump de versao no package.json acontece AQUI
   │  └── testes e validacao antes de ir pra main
   │
   ↓ Pull Request
   │
main (branch de producao, protegida)
   │  ├── recebe APENAS PRs de develop
   │  └── merge dispara o workflow de release
   │
   ↓ push event (apos merge do PR)
   │
GitHub Actions (release.yml)
   │  ├── versao mudou? (compara package.json vs tags)
   │  ├── SIM → cria tag → build 3 plataformas → GitHub Release
   │  └── NAO → nada acontece (workflow termina no job 1)
```

### Regras de Branch

| Branch | Push direto | Requer PR | Quem faz PR pra ca |
|--------|-------------|-----------|---------------------|
| `main` | Bloqueado | Sim | Apenas `develop` |
| `develop` | Bloqueado | Sim | Feature branches |
| `feat/*`, `fix/*`, `ci/*` | Livre | — | — |

### Convencao de Nomes para Branches

```
feat/nome-da-feature    → nova funcionalidade
fix/descricao-do-bug    → correcao de bug
ci/descricao            → mudancas em CI/CD
docs/descricao          → documentacao
refactor/descricao      → refatoracao sem mudanca funcional
```

---

## 3. Version Detection

> O mecanismo que decide se um release deve ser criado ou nao.
> E a parte mais critica do pipeline — se falhar, nao tem release.

### Algoritmo (Pseudocodigo)

```bash
# Etapa 1 — Extrair versao do package.json
VERSION=$(node -p "require('./package.json').version")
# Exemplo: "0.2.0"

# Etapa 2 — Construir nome da tag
TAG="v${VERSION}"
# Exemplo: "v0.2.0"

# Etapa 3 — Verificar se tag ja existe
if git rev-parse "${TAG}" >/dev/null 2>&1; then
    # Tag existe → ja foi feito release desta versao
    should_release=false
else
    # Tag NAO existe → versao nova detectada
    should_release=true
fi

# Etapa 4 — Se versao nova, criar e pushar a tag
if [ "$should_release" = "true" ]; then
    git tag "${TAG}"
    git push origin "${TAG}"
fi
```

### Casos

| Cenario | package.json | Tags existentes | Resultado |
|---------|-------------|-----------------|-----------|
| Primeira release | `0.2.0` | (nenhuma) | Cria `v0.2.0` + release |
| Bump de versao | `0.3.0` | `v0.2.0` | Cria `v0.3.0` + release |
| PR sem bump | `0.3.0` | `v0.3.0` | Nada acontece |
| Hotfix sem bump | `0.3.0` | `v0.3.0` | Nada acontece |

### Por que NAO usar tags manuais?

- Tags manuais sao frageis (esquece, erra formato, duplica)
- O package.json ja e a fonte de verdade da versao
- Automatizar elimina erro humano
- O workflow CRIA a tag — voce so precisa bumpar o `version` no package.json

---

## 4. GitHub Actions Workflow

### Arquivo: `.github/workflows/release.yml`

### Trigger

```yaml
on:
  push:
    branches: [main]
```

> Dispara em QUALQUER push na main — ou seja, quando um PR e mergeado.
> Isso inclui merge commits e squash merges.

### Permissoes

```yaml
permissions:
  contents: write  # necessario para: criar tags, criar releases, upload de assets
```

### Job 1: `check-version`

```
Runner:    ubuntu-latest
Proposito: Decidir se deve ou nao criar release
Outputs:   version, tag, should_release

Steps:
├── actions/checkout@v4 (fetch-depth: 0 — precisa das tags)
├── Ler versao do package.json via Node
├── Comparar com tags git existentes
├── Se versao nova:
│   ├── should_release = true
│   ├── Criar tag localmente
│   └── Push tag para origin
└── Se versao ja existe:
    └── should_release = false (pipeline para aqui)
```

### Job 2: `build`

```
Runner:    Matrix [macos-latest, ubuntu-latest, windows-latest]
Depende:   check-version (so roda se should_release=true)
Proposito: Compilar o app para as 3 plataformas

Steps:
├── actions/checkout@v4
├── oven-sh/setup-bun@v2 (instala bun)
├── bun install --frozen-lockfile (instalacao limpa via lockfile)
├── bunx electron-builder $build_args
│   ├── macOS:   --mac  → gera .dmg
│   ├── Linux:   --linux → gera .AppImage + .deb
│   └── Windows: --win  → gera .exe (NSIS installer + portable)
└── actions/upload-artifact@v4
    ├── name: build-${{ matrix.os }}
    └── path: out/*.dmg, out/*.exe, out/*.AppImage, out/*.deb
```

### Job 3: `release`

```
Runner:    ubuntu-latest
Depende:   check-version + build
Proposito: Criar GitHub Release e anexar binarios

Steps:
├── actions/checkout@v4 (fetch-depth: 0, para release notes)
├── actions/download-artifact@v4 (merge-multiple: true)
│   └── Baixa artifacts de TODOS os runners para ./artifacts/
├── softprops/action-gh-release@v2
│   ├── tag_name: vX.Y.Z (da output do check-version)
│   ├── name: "RingDeck vX.Y.Z"
│   ├── generate_release_notes: true (baseado nos commits)
│   └── files: artifacts/*.dmg, *.exe, *.AppImage, *.deb
└── GITHUB_TOKEN: automatico (secrets.GITHUB_TOKEN)
```

---

## 5. Build Matrix

### Configuracao da Matrix

```yaml
strategy:
  matrix:
    include:
      - os: macos-latest
        build_args: --mac
      - os: ubuntu-latest
        build_args: --linux
      - os: windows-latest
        build_args: --win
```

### Targets por Plataforma (electron-builder config)

| Plataforma | Runner | Build Args | Targets | Outputs |
|-----------|--------|------------|---------|---------|
| macOS | `macos-latest` | `--mac` | `dmg` | `RingDeck-X.Y.Z.dmg` |
| Windows | `windows-latest` | `--win` | `nsis`, `portable` | `RingDeck Setup X.Y.Z.exe`, `RingDeck X.Y.Z.exe` |
| Linux | `ubuntu-latest` | `--linux` | `AppImage`, `deb` | `RingDeck-X.Y.Z.AppImage`, `ringdeck_X.Y.Z_amd64.deb` |

### Configuracao electron-builder (package.json)

```json
{
  "build": {
    "appId": "com.ringdeck.app",
    "productName": "RingDeck",
    "mac": {
      "category": "public.app-category.utilities",
      "target": "dmg",
      "icon": "build/icon.icns"
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "build/icon.ico"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Utility"
    },
    "files": ["dist/**/*", "electron/**/*"],
    "directories": { "output": "out" }
  }
}
```

---

## 6. Artifact Management

### Upload (durante o build)

```
Cada runner faz upload dos seus artefatos com nome unico:
├── build-macos-latest/   → *.dmg
├── build-ubuntu-latest/  → *.AppImage, *.deb
└── build-windows-latest/ → *.exe
```

### Download (durante o release)

```
O job de release baixa TODOS os artifacts em uma pasta unica:
artifacts/
├── RingDeck-0.3.0.dmg
├── RingDeck Setup 0.3.0.exe
├── RingDeck 0.3.0.exe
├── RingDeck-0.3.0.AppImage
└── ringdeck_0.3.0_amd64.deb
```

> `merge-multiple: true` junta todos os artifacts numa pasta so,
> sem subpastas por runner.

### Retencao

- Artifacts do GitHub Actions: 90 dias (padrao)
- Binarios no GitHub Release: permanentes (enquanto o release existir)

---

## 7. Release Creation

### Formato do Release

```
Tag:    v0.3.0
Titulo: RingDeck v0.3.0
Body:   Release notes automaticas (commits desde a tag anterior)

Assets:
├── RingDeck-0.3.0.dmg            (macOS — disk image)
├── RingDeck Setup 0.3.0.exe      (Windows — installer NSIS)
├── RingDeck 0.3.0.exe            (Windows — portable)
├── RingDeck-0.3.0.AppImage       (Linux — AppImage)
└── ringdeck_0.3.0_amd64.deb      (Linux — Debian package)
```

### Release Notes

Geradas automaticamente pelo GitHub (`generate_release_notes: true`):
- Lista todos os commits entre a tag anterior e a nova
- Agrupa por autor
- Inclui links para PRs mergeados
- Inclui novos contribuidores

### Action Usada

```
softprops/action-gh-release@v2
├── Cria release a partir de uma tag existente
├── Faz upload de multiplos arquivos via glob pattern
├── Suporta release notes automaticas
└── Usa GITHUB_TOKEN (sem necessidade de PAT)
```

---

## 8. Branch Protection

### Rulesets via GitHub CLI

```bash
# Proteger main — requer PR, sem push direto
gh api repos/{owner}/{repo}/rulesets --method POST \
  --field name="main-protection" \
  --field target="branch" \
  --field enforcement="active" \
  --field 'conditions[ref_name][include][]=refs/heads/main' \
  --field 'rules[][type]=pull_request' \
  --field 'rules[-1][parameters][required_approving_review_count]=0'

# Proteger develop — mesma config
gh api repos/{owner}/{repo}/rulesets --method POST \
  --field name="develop-protection" \
  --field target="branch" \
  --field enforcement="active" \
  --field 'conditions[ref_name][include][]=refs/heads/develop' \
  --field 'rules[][type]=pull_request' \
  --field 'rules[-1][parameters][required_approving_review_count]=0'
```

### O que a protecao garante

| Regra | Efeito |
|-------|--------|
| Require PR before merge | `git push origin main` → REJEITADO |
| Require PR before merge | `git push origin develop` → REJEITADO |
| Sem required reviewers | Dono do repo pode aprovar e mergear sozinho |

---

## 9. Error Handling & Edge Cases

### Erro 1 — Build Falha em Uma Plataforma

```
Sintoma:   macOS builda ok, Windows falha (ex: falta icone .ico)
Causa:     Recurso especifico de plataforma ausente ou incompativel
Impacto:   Job de release NAO roda (depende de TODOS os builds)
Correcao:  Verificar logs do runner que falhou, corrigir, e fazer novo PR
Prevencao: Manter build/icon.icns e build/icon.ico no repositorio
```

### Erro 2 — Tag Ja Existe

```
Sintoma:   Workflow roda mas nao cria release
Causa:     package.json nao foi bumpado (versao ainda e a mesma)
Impacto:   Nenhum — workflow termina graciosamente no job 1
Correcao:  Bumpar versao em package.json e fazer novo PR
Prevencao: Sempre bumpar versao antes de PR develop → main
```

### Erro 3 — Push de Tag Falha

```
Sintoma:   check-version cria tag local mas git push falha
Causa:     Permissoes insuficientes do GITHUB_TOKEN
Impacto:   Tag nao existe no remote, build nao roda
Correcao:  Verificar permissions.contents: write no workflow
Prevencao: Declarar permissions explicitamente no YAML
```

### Erro 4 — Artifacts Vazios

```
Sintoma:   Release e criado mas sem binarios anexados
Causa:     electron-builder gerou output em path diferente do esperado
Impacto:   Release existe mas usuarios nao conseguem baixar
Correcao:  Verificar directories.output no package.json (deve ser "out")
Prevencao: if-no-files-found: warn no upload-artifact (gera warning no log)
```

### Erro 5 — bun install Falha

```
Sintoma:   Build falha na etapa de install
Causa:     bun.lock desatualizado ou ausente
Impacto:   Nenhum build roda
Correcao:  Rodar bun install localmente e commitar bun.lock
Prevencao: Sempre commitar bun.lock junto com mudancas no package.json
```

---

## 10. Execution Flows by Use Case

### 10.1 Dev — Nova Feature

```
FLUXO:
├── git checkout -b feat/minha-feature develop
├── (desenvolvimento...)
├── git push origin feat/minha-feature
├── Abrir PR: feat/minha-feature → develop
├── Merge PR
└── Feature integrada na develop (nenhum release acontece)
```

### 10.2 Release — Nova Versao

```
FLUXO:
├── Na branch develop, criar branch para bump:
│   └── git checkout -b feat/bump-version develop
├── Editar package.json: "version": "0.3.0"
├── Commit + push + PR para develop
├── Merge na develop
├── Abrir PR: develop → main
├── Merge na main
│   └── Trigger: push event na main
├── GitHub Actions roda:
│   ├── check-version: detecta 0.3.0 (tag v0.3.0 nao existe)
│   ├── Cria tag v0.3.0
│   ├── build: compila macOS + Windows + Linux
│   └── release: cria GitHub Release com todos os binarios
└── Release disponivel em github.com/{owner}/ringdeck/releases
```

### 10.3 Hotfix — Correcao Urgente

```
FLUXO:
├── git checkout -b fix/bug-critico develop
├── Corrigir bug
├── Bumpar versao: "0.3.1" (patch version)
├── PR para develop → merge
├── PR develop → main → merge
└── Release automatico v0.3.1
```

### 10.4 PR sem Bump de Versao (ex: docs, refactor)

```
FLUXO:
├── PR mergeado na main
├── GitHub Actions roda:
│   └── check-version: versao 0.3.0, tag v0.3.0 ja existe
├── should_release = false
└── Nada acontece (comportamento esperado)
```

---

## 11. Security & Permissions

### GITHUB_TOKEN

```
O token automatico do GitHub Actions. NAO precisa de PAT (Personal Access Token).

Permissoes usadas:
├── contents: write    → criar tags, criar releases, upload assets
├── actions: read      → ler status dos workflows (implicito)
└── metadata: read     → ler info do repo (implicito)

Escopo:
├── Valido APENAS para o repositorio onde o workflow roda
├── Expira ao final do workflow
└── NAO pode ser usado para acessar outros repos
```

### Segredos

```
secrets.GITHUB_TOKEN → automatico, nao precisa configurar
GH_TOKEN             → passado como env var para electron-builder
                       (usado para download de dependencias como electron)
```

### O que NAO faz

- NAO publica em registros de pacotes
- NAO faz deploy em servidor
- NAO envia notificacoes
- NAO modifica protecao de branches
- NAO acessa repositorios externos

---

## 12. Glossario Tecnico

| Termo | Definicao |
|-------|-----------|
| **GitHub Actions** | Plataforma de CI/CD integrada ao GitHub, executa workflows em runners |
| **Workflow** | Arquivo YAML que define jobs e steps a serem executados |
| **Job** | Unidade de trabalho que roda em um runner (maquina virtual) |
| **Runner** | Maquina virtual que executa os jobs (ubuntu, macos, windows) |
| **Matrix** | Estrategia que roda o mesmo job em multiplas configuracoes em paralelo |
| **Artifact** | Arquivo gerado por um job que pode ser passado para outros jobs |
| **Tag** | Referencia git imutavel apontando para um commit especifico (ex: v0.2.0) |
| **Release** | Pagina no GitHub com binarios para download, vinculada a uma tag |
| **electron-builder** | Ferramenta que empacota apps Electron em instaladores nativos |
| **NSIS** | Nullsoft Scriptable Install System — formato de installer pra Windows |
| **AppImage** | Formato de distribuicao de apps Linux (executavel, sem install) |
| **DMG** | Disk Image — formato padrao de distribuicao de apps macOS |
| **bun install --frozen-lockfile** | Instalacao limpa de dependencias baseada no bun.lock |
| **fetch-depth: 0** | Clona todo o historico git (necessario para ler tags) |
| **should_release** | Flag booleana que controla se o pipeline continua ou para |
| **merge-multiple** | Opcao do download-artifact que junta todos os artifacts numa pasta |
| **PAT** | Personal Access Token — token manual do GitHub (NAO usado aqui) |
| **Ruleset** | Conjunto de regras de protecao de branch no GitHub |

---

## Dependencias do Workflow

```
Pacotes do projeto:
├── electron ^35        → runtime desktop
├── electron-builder ^26 → empacotamento multi-plataforma
├── vite ^6             → bundler do frontend
└── heroicons ^2.2.0    → icones SVG

GitHub Actions usadas:
├── actions/checkout@v4         → clonar repositorio
├── oven-sh/setup-bun@v2        → instalar Bun
├── actions/upload-artifact@v4  → salvar binarios entre jobs
├── actions/download-artifact@v4 → recuperar binarios
└── softprops/action-gh-release@v2 → criar GitHub Release
```

---

## Versionamento Semantico

```
O projeto segue SemVer: MAJOR.MINOR.PATCH

MAJOR (X.0.0) → mudancas que quebram compatibilidade
MINOR (0.X.0) → novas features sem quebrar API
PATCH (0.0.X) → correcoes de bugs

Exemplos:
├── 0.2.0 → 0.3.0  (nova feature: ex. drag & drop)
├── 0.3.0 → 0.3.1  (bugfix: ex. icone nao carregava)
└── 0.3.1 → 1.0.0  (release estavel com breaking changes)

Onde bumpar: campo "version" no package.json
Quem cria tag: o workflow (automatico, NAO fazer manual)
```

---

> Este documento descreve o pipeline CI/CD completo do RingDeck.
> Para contribuir com o projeto, veja o [README](../README.md).
> Para o workflow em si, veja [`.github/workflows/release.yml`](../.github/workflows/release.yml).
