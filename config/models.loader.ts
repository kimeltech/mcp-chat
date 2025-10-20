// Client-safe version - loads from static JSON import
import modelsConfigJson from './models.config.json';
import type { ModelsConfiguration, ModelConfig } from './models.types';

// Configuration loaded at build time
const config: ModelsConfiguration = modelsConfigJson as ModelsConfiguration;

// Get all enabled models
export function getEnabledModels(): ModelConfig[] {
  return config.models.filter(model => model.enabled);
}

// Get model by ID
export function getModelById(id: string): ModelConfig | undefined {
  return config.models.find(model => model.id === id && model.enabled);
}

// Get default model
export function getDefaultModel(): ModelConfig {
  const defaultModel = getModelById(config.defaultModel);
  
  if (!defaultModel) {
    throw new Error(`Default model '${config.defaultModel}' not found or disabled`);
  }
  
  return defaultModel;
}

// Get default model ID
export function getDefaultModelId(): string {
  return config.defaultModel;
}

// Get models with specific capability
export function getModelsWithCapability(capability: string): ModelConfig[] {
  return config.models.filter(model => 
    model.enabled && model.capabilities.includes(capability)
  );
}

// Get configuration
export function getModelsConfig(): ModelsConfiguration {
  return config;
}
