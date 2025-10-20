import { createOpenRouter, openrouter } from "@openrouter/ai-sdk-provider";
import { getEnabledModels, getDefaultModelId } from "@/config/models.loader";
import type { ModelConfig } from "@/config/models.types";

export interface ModelInfo {
  provider: string;
  name: string;
  description: string;
  apiVersion: string;
  capabilities: string[];
}

// Helper to get API keys from environment variables first, then localStorage
const getApiKey = (key: string): string | undefined => {
  // Check for environment variables first
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] || undefined;
  }

  // Fall back to localStorage if available
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(key) || undefined;
  }

  return undefined;
};

export const openrouterClient = createOpenRouter({
  apiKey: getApiKey('OPENROUTER_API_KEY'),
});

// Export the default openrouter instance as well
export { openrouter };

// Load models from configuration at build time
const enabledModels = getEnabledModels();

// Build openRouterModels registry
export const openRouterModels: Record<string, string> = {};
enabledModels.forEach((model: ModelConfig) => {
  openRouterModels[model.id] = model.modelId;
});

// Build modelDetails registry
export const modelDetails: Record<string, ModelInfo> = {};
enabledModels.forEach((model: ModelConfig) => {
  modelDetails[model.id] = {
    provider: model.provider,
    name: model.name,
    description: model.description,
    apiVersion: model.modelId,
    capabilities: model.capabilities,
  };
});

// Update API keys when localStorage changes (for runtime updates)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'OPENROUTER_API_KEY') {
      // Recreate the client with new API key
      location.reload();
    }
  });
}

export type modelID = string;

// Get list of model IDs
export const MODELS = Object.keys(openRouterModels);

// Get default model from config
export const defaultModel: modelID = getDefaultModelId();
