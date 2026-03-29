import { z } from 'zod';

const SettingsSchema = z.object({
  appMode: z.enum(['server-managed', 'browser-only', 'local-workspace-enabled']).default('server-managed'),
  trustLevel: z.enum(['safe', 'trusted-local', 'trusted-remote', 'experimental']).default('safe'),
  featureLocalWorkspace: z.boolean().default(false),
  featureBrowserOnlyProviders: z.boolean().default(false),
  featureVision: z.boolean().default(true),
  featureShellExec: z.boolean().default(false),
  featureRemotePlugins: z.boolean().default(false),
  featureExperimentalMcp: z.boolean().default(false),
  modelProvider: z.enum(['gemini', 'anthropic', 'copilot', 'bifrost']).default('gemini'),
  modelName: z.string().default(''),
  googleApiKey: z.string().default(''),
  anthropicApiKey: z.string().default(''),
  githubToken: z.string().default(''),
  bifrostUrl: z.string().default('http://localhost:8080/v1'),
  bifrostApiKey: z.string().default('sk-bifrost-default'),
  composioApiKey: z.string().default(''),
  corsAllowOrigins: z.string().default('*'),
  corsAllowCredentials: z.boolean().default(true),
  corsAllowMethods: z.string().default('*'),
  corsAllowHeaders: z.string().default('*'),
  port: z.coerce.number().default(9000),
  host: z.string().default('0.0.0.0'),
  frontendDistDir: z.string().default('apps/web/dist'),
  debug: z.boolean().default(false),
  logLevel: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR']).default('INFO'),
  databaseUrl: z.string().default(''),
  executionMode: z.enum(['server', 'browser', 'local']).default('server'),
});

const MODEL_ALIASES: Record<string, string> = {
  'gpt-4o-mini': 'gemini-2.5-flash',
  'gpt-4o': 'gemini-2.5-pro',
  'gpt-4.1-mini': 'gemini-3.0-pro',
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-3-pro': 'gemini-3.0-pro',
  'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
};

export type Settings = z.infer<typeof SettingsSchema>;

let cachedSettings: Settings | null = null;

export function getSettings(): Settings {
  if (cachedSettings) return cachedSettings;
  
  cachedSettings = SettingsSchema.parse({
    appMode: process.env.APP_MODE,
    trustLevel: process.env.TRUST_LEVEL,
    featureLocalWorkspace: process.env.FEATURE_LOCAL_WORKSPACE === 'true',
    featureBrowserOnlyProviders: process.env.FEATURE_BROWSER_ONLY_PROVIDERS === 'true',
    featureVision: process.env.FEATURE_VISION !== 'false',
    featureShellExec: process.env.FEATURE_SHELL_EXEC === 'true',
    featureRemotePlugins: process.env.FEATURE_REMOTE_PLUGINS === 'true',
    featureExperimentalMcp: process.env.FEATURE_EXPERIMENTAL_MCP === 'true',
    modelProvider: process.env.MODEL_PROVIDER,
    modelName: process.env.MODEL_NAME,
    googleApiKey: process.env.GOOGLE_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    githubToken: process.env.GITHUB_TOKEN,
    bifrostUrl: process.env.BIFROST_URL,
    bifrostApiKey: process.env.BIFROST_API_KEY,
    composioApiKey: process.env.COMPOSIO_API_KEY,
    corsAllowOrigins: process.env.CORS_ALLOW_ORIGINS,
    corsAllowCredentials: process.env.CORS_ALLOW_CREDENTIALS === 'true',
    corsAllowMethods: process.env.CORS_ALLOW_METHODS,
    corsAllowHeaders: process.env.CORS_ALLOW_HEADERS,
    port: process.env.PORT,
    host: process.env.HOST,
    frontendDistDir: process.env.FRONTEND_DIST_DIR,
    debug: process.env.DEBUG === 'true',
    logLevel: process.env.LOG_LEVEL as Settings['logLevel'],
    databaseUrl: process.env.DATABASE_URL,
    executionMode: process.env.EXECUTION_MODE as Settings['executionMode'],
  });
  
  return cachedSettings;
}

export function resolveModel(requested: string | undefined | null): string {
  const settings = getSettings();
  if (!requested) {
    return settings.modelName || 'gemini-2.5-flash';
  }
  return MODEL_ALIASES[requested] ?? requested;
}
