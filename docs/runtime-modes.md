# Runtime Modes, Trust Tiers, and Feature Flags

## 1. Runtime Modes

Three mutually exclusive execution modes control the operational envelope of the application.

### 1.1 Mode Definitions

| Mode | Env Variable | Description |
|------|--------------|-------------|
| **server-managed** | `RUNTIME_MODE=server-managed` | Full API server; frontend is built static assets served by the API |
| **browser-only** | `RUNTIME_MODE=browser-only` | No API server; frontend runs standalone with browser-only providers |
| **local-workspace-enabled** | `RUNTIME_MODE=local-workspace-enabled` | Full API + local workspace daemon for file system operations |

**Default:** `server-managed`.

### 1.2 Feature Availability by Mode

| Feature | server-managed | browser-only | local-workspace-enabled |
|---------|---------------|--------------|-------------------------|
| OpenAI-compatible API (`/v1/chat/completions`) | Yes | No | Yes |
| Gemini webapi (`gemini-webapi` path) | Yes | Yes | Yes |
| Gemini API key (`google-genai` path) | Yes | No | Yes |
| Cookie profile auth | Yes | No | Yes |
| Composio tools (`/tools/composio/*`) | Yes | No | Yes |
| GitHub integration (`/github/*`) | Yes | No | Yes |
| Local file editing | No | No | Yes |
| Profile management (`/profiles/*`) | Yes | No | Yes |
| Streaming SSE responses | Yes | No | Yes |
| PWA installability | Yes | Yes | Yes |

### 1.3 Mode Switching

Mode is determined at startup via `RUNTIME_MODE` environment variable. There is no runtime switching.

```python
# apps/api/config.py
from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    runtime_mode: Literal["server-managed", "browser-only", "local-workspace-enabled"] = "server-managed"
    
    class Config:
        env_file = ".env"
        env_file_config = {"RUNTIME_MODE": "runtime_mode"}
```

### 1.4 Browser-Only Providers

When `RUNTIME_MODE=browser-only`, only providers that work without server-side credentials are available:

| Provider | Available in browser-only |
|----------|--------------------------|
| `gemini-webapi` (cookie auth) | Yes |
| WebLLM / browser-side inference | Yes (future) |
| `google-genai` (API key) | No |
| `anthropic` | No |
| `copilot` | No |
| `bifrost` | No |

---

## 2. Trust Tiers

Four trust tiers control what operations are permitted based on the provenance of code and data.

### 2.1 Tier Definitions

| Tier | Env Variable | Name | Description |
|------|--------------|------|-------------|
| **safe** | `TRUST_TIER=safe` | Safe | No execution of untrusted content; read-only operations only |
| **trusted-local** | `TRUST_TIER=trusted-local` | Trusted Local | Local code only, no network access for plugins |
| **trusted-remote** | `TRUST_TIER=trusted-remote` | Trusted Remote | Local + verified remote tools |
| **experimental** | `TRUST_TIER=experimental` | Experimental | All features enabled; no restrictions |

**Default:** `trusted-local`.

### 2.2 Capability Matrix by Trust Tier

| Capability | safe | trusted-local | trusted-remote | experimental |
|------------|------|---------------|---------------|--------------|
| Shell command execution | No | Yes | Yes | Yes |
| Local file read/write | No | Yes | Yes | Yes |
| Git operations (local) | No | Yes | Yes | Yes |
| HTTP requests (local) | No | Yes | Yes | Yes |
| Remote MCP plugins | No | No | Yes (verified) | Yes (any) |
| Plugin code execution | No | No | Yes | Yes |
| Arbitrary code eval | No | No | No | Yes |
| Network file access | No | No | Yes | Yes |
| GitHub API (remote) | No | Yes | Yes | Yes |

### 2.3 Trust Tier Enforcement

Trust tier is checked at the **agent-runtime** layer before any privileged operation:

```python
# packages/agent-runtime/src/affine/agent_runtime/trust.py
from enum import Enum

class TrustTier(Enum):
    SAFE = "safe"
    TRUSTED_LOCAL = "trusted-local"
    TRUSTED_REMOTE = "trusted-remote"
    EXPERIMENTAL = "experimental"

TRUST_TIER = TrustTier(os.getenv("TRUST_TIER", "trusted-local"))

def require_shell_exec():
    if TRUST_TIER not in (TrustTier.TRUSTED_LOCAL, TrustTier.TRUSTED_REMOTE, TrustTier.EXPERIMENTAL):
        raise PermissionError("Shell execution requires TRUST_TIER >= trusted-local")

def require_remote_plugins():
    if TRUST_TIER != TrustTier.EXPERIMENTAL:
        raise PermissionError("Remote plugins require TRUST_TIER = experimental")
```

---

## 3. Feature Flags

Feature flags gate experimental or heavyweight capabilities that may be rolled out incrementally.

### 3.1 Flag Definitions

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `localWorkspace` | `bool` | `false` | Enable local workspace daemon (implies `local-workspace-enabled` mode) |
| `browserOnlyProviders` | `bool` | `false` | Only allow browser-based LLM providers |
| `vision` | `bool` | `true` | Enable vision/multimodal input (image upload, etc.) |
| `shellExec` | `bool` | `false` | Enable shell command execution |
| `remotePlugins` | `bool` | `false` | Allow loading MCP plugins from remote sources |
| `experimentalMcp` | `bool` | `false` | Enable experimental MCP protocol features |

### 3.2 Flag Dependencies

```
localWorkspace=true → RUNTIME_MODE must be local-workspace-enabled
remotePlugins=true   → TRUST_TIER must be experimental
experimentalMcp=true → remotePlugins must be true
```

### 3.3 Implementation

Feature flags are implemented as typed boolean fields in `packages/config`:

```python
# packages/config/src/affine/config/features.py
from pydantic import BaseModel, Field

class FeatureFlags(BaseModel):
    local_workspace: bool = Field(default=False, description="Enable local workspace daemon")
    browser_only_providers: bool = Field(default=False, description="Only allow browser-based providers")
    vision: bool = Field(default=True, description="Enable vision/multimodal input")
    shell_exec: bool = Field(default=False, description="Enable shell command execution")
    remote_plugins: bool = Field(default=False, description="Allow loading MCP plugins from remote sources")
    experimental_mcp: bool = Field(default=False, description="Enable experimental MCP protocol features")

    def validate_flags(self) -> list[str]:
        """Return list of validation errors; empty if valid."""
        errors = []
        if self.local_workspace:
            # localWorkspace requires local-workspace-enabled mode
            pass  # Checked at config level
        if self.remote_plugins and os.getenv("TRUST_TIER") != "experimental":
            errors.append("remotePlugins requires TRUST_TIER=experimental")
        if self.experimental_mcp and not self.remote_plugins:
            errors.append("experimentalMcp requires remotePlugins=true")
        return errors
```

---

## 4. Configuration Priority

Settings are resolved in this order (later overrides earlier):

1. **Defaults** — Hardcoded in `packages/config`
2. **Environment variables** — `.env` file or shell environment
3. **Runtime overrides** — Programmatic overrides (e.g., feature flags set by admin)

---

## 5. Environment Variable Reference

### Runtime Mode

```bash
RUNTIME_MODE=server-managed   # Default; full API + frontend
RUNTIME_MODE=browser-only     # Standalone frontend only
RUNTIME_MODE=local-workspace-enabled  # Full API + local workspace daemon
```

### Trust Tier

```bash
TRUST_TIER=safe               # Read-only, no execution
TRUST_TIER=trusted-local      # Local operations only (default)
TRUST_TIER=trusted-remote     # Local + verified remote plugins
TRUST_TIER=experimental       # All features enabled
```

### Feature Flags

```bash
localWorkspace=true            # Enable local workspace daemon
browserOnlyProviders=true     # Restrict to browser-only providers
vision=false                  # Disable vision/multimodal input
shellExec=true                # Enable shell command execution
remotePlugins=true            # Allow remote MCP plugins
experimentalMcp=true          # Enable experimental MCP features
```

---

## 6. Validation at Startup

On application startup, configuration is validated:

```python
# apps/api/main.py
from packages.config import Settings, FeatureFlags

def validate_config():
    settings = Settings()
    flags = FeatureFlags()
    
    # Runtime mode validation
    if flags.local_workspace and settings.runtime_mode != "local-workspace-enabled":
        raise ValueError("localWorkspace=true requires RUNTIME_MODE=local-workspace-enabled")
    
    # Trust tier + feature flag validation
    errors = flags.validate_flags()
    if errors:
        raise ValueError(f"Feature flag validation failed: {errors}")
    
    # Provider availability check
    if settings.runtime_mode == "browser-only" and not flags.browser_only_providers:
        # Warn but don't fail; browser will handle provider filtering
        pass
```

Startup fails fast on invalid configuration combinations.

---

## 7. Gate Mapping

Feature flags and trust tiers map to implementation gates:

| Gate | Relevant Flags | Relevant Tiers |
|------|----------------|----------------|
| G1 (Architecture) | — | all |
| G2 (Repo Bootstrap) | — | all |
| G3 (Contracts) | — | all |
| G4 (Provider) | `vision` | all |
| G5 (Foundation API) | `shellExec` | `trusted-local`+ |
| G6 (Initial UI) | — | all |
| M6+ (Workspace) | `localWorkspace` | `trusted-local`+ |
| M9+ (Tools/Commands) | `shellExec` | `trusted-local`+ |
| M10+ (MCP) | `remotePlugins`, `experimentalMcp` | `trusted-remote`+ |
| M11+ (Plugin System) | `remotePlugins` | `experimental` |
| M14+ (Security) | all | all |
