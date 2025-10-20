// Simplified type definitions for model configuration
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  description: string;
  capabilities: string[];
  enabled: boolean;
}

export interface ModelsConfiguration {
  version: string;
  defaultModel: string;
  models: ModelConfig[];
}
