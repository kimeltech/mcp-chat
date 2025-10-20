import 'server-only';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ModelsConfiguration, ModelConfig } from './models.types';

// Load configuration from JSON file (SERVER ONLY)
let config: ModelsConfiguration | null = null;

export function loadModelsConfig(): ModelsConfiguration {
  if (config) return config;
  
  try {
    const configPath = join(process.cwd(), 'config', 'models.config.json');
    const fileContent = readFileSync(configPath, 'utf-8');
    config = JSON.parse(fileContent) as ModelsConfiguration;
    return config;
  } catch (error) {
    console.error('Failed to load models configuration:', error);
    throw new Error('Models configuration not found or invalid');
  }
}

// Get all enabled models
export function getEnabledModels(): ModelConfig[] {
  const config = loadModelsConfig();
  return config.models.filter(model => model.enabled);
}

// Get model by ID
export function getModelById(id: string): ModelConfig | undefined {
  const config = loadModelsConfig();
  return config.models.find(model => model.id === id && model.enabled);
}

// Get default model
export function getDefaultModel(): ModelConfig {
  const config = loadModelsConfig();
  const defaultModel = getModelById(config.defaultModel);
  
  if (!defaultModel) {
    throw new Error(`Default model '${config.defaultModel}' not found or disabled`);
  }
  
  return defaultModel;
}

// Get models with specific capability
export function getModelsWithCapability(capability: string): ModelConfig[] {
  const config = loadModelsConfig();
  return config.models.filter(model => 
    model.enabled && model.capabilities.includes(capability)
  );
}
