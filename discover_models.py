#!/usr/bin/env python3
"""
OpenRouter Model Discovery Tool

This script helps you discover and filter models from OpenRouter's catalog
based on specific criteria like tool support, pricing, capabilities, etc.

Usage:
    # List all models with tool support
    python discover_models.py --tools
    
    # Find recent models (last 30 days) with tools
    python discover_models.py --tools --recent 30
    
    # Find cheap models with tools
    python discover_models.py --tools --max-price 1.0
    
    # Export to config format
    python discover_models.py --tools --export config_additions.json
"""

import json
import os
import sys
import argparse
from typing import Dict, List, Any, Optional
from pathlib import Path
from datetime import datetime, timedelta

try:
    import requests
except ImportError:
    print("Error: requests package not found. Install with: pip install requests")
    sys.exit(1)


class ModelDiscovery:
    def __init__(self, api_key: str):
        """Initialize with OpenRouter API key."""
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.models_cache = None
        
    def fetch_all_models(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """Fetch all available models from OpenRouter API."""
        if self.models_cache and not force_refresh:
            return self.models_cache
            
        print("📡 Fetching all models from OpenRouter API...")
        try:
            response = requests.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            response.raise_for_status()
            data = response.json()
            
            self.models_cache = data['data']
            print(f"✅ Retrieved {len(self.models_cache)} models\n")
            return self.models_cache
            
        except Exception as e:
            print(f"❌ Error fetching models: {e}")
            sys.exit(1)
    
    def filter_models(
        self,
        models: List[Dict[str, Any]],
        has_tools: bool = False,
        has_vision: bool = False,
        has_reasoning: bool = False,
        max_input_price: Optional[float] = None,
        min_context_window: Optional[int] = None,
        providers: Optional[List[str]] = None,
        recent_days: Optional[int] = None,
        search_term: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Filter models based on various criteria."""
        filtered = models
        
        # Filter by supported parameters (tools, vision, etc.)
        if has_tools:
            filtered = [m for m in filtered if 'tools' in m.get('supported_parameters', [])]
            
        # Filter by architecture features
        if has_vision:
            filtered = [m for m in filtered if m.get('architecture', {}).get('modality', '').find('image') >= 0]
            
        # Filter by pricing
        if max_input_price is not None:
            filtered = [
                m for m in filtered 
                if float(m.get('pricing', {}).get('prompt', '999')) * 1000000 <= max_input_price
            ]
        
        # Filter by context window
        if min_context_window:
            filtered = [
                m for m in filtered
                if m.get('context_length', 0) >= min_context_window
            ]
        
        # Filter by provider
        if providers:
            provider_lower = [p.lower() for p in providers]
            filtered = [
                m for m in filtered
                if any(prov in m.get('id', '').lower() for prov in provider_lower)
            ]
        
        # Filter by creation date (if available)
        if recent_days:
            cutoff_date = datetime.now() - timedelta(days=recent_days)
            # Note: Most models don't have creation dates in API, so this is approximate
            # We'll use this as a flag to prioritize newer model names
            filtered = sorted(
                filtered,
                key=lambda m: m.get('created', 0) or 0,
                reverse=True
            )[:50]  # Take top 50 most recent
        
        # Search term filter
        if search_term:
            search_lower = search_term.lower()
            filtered = [
                m for m in filtered
                if search_lower in m.get('id', '').lower() or 
                   search_lower in m.get('name', '').lower()
            ]
        
        return filtered
    
    def display_models(self, models: List[Dict[str, Any]], limit: int = 20):
        """Display models in a readable format."""
        print(f"\n{'='*100}")
        print(f"Found {len(models)} models matching criteria")
        print(f"{'='*100}\n")
        
        for idx, model in enumerate(models[:limit], 1):
            print(f"📦 {idx}. {model.get('name', 'Unknown')}")
            print(f"   ID: {model['id']}")
            
            # Pricing
            pricing = model.get('pricing', {})
            prompt_price = float(pricing.get('prompt', 0)) * 1000000
            completion_price = float(pricing.get('completion', 0)) * 1000000
            print(f"   💰 Price: ${prompt_price:.2f} in / ${completion_price:.2f} out (per 1M tokens)")
            
            # Context window
            context = model.get('context_length', 0)
            print(f"   📏 Context: {context:,} tokens")
            
            # Capabilities
            params = model.get('supported_parameters', [])
            caps = []
            if 'tools' in params:
                caps.append('🔧 Tools')
            if 'response_format' in params:
                caps.append('📋 Structured')
            modality = model.get('architecture', {}).get('modality', '')
            if 'image' in modality:
                caps.append('👁️ Vision')
            
            if caps:
                print(f"   ⚡ Capabilities: {', '.join(caps)}")
            
            print()
        
        if len(models) > limit:
            print(f"... and {len(models) - limit} more models")
            print(f"Use --limit {len(models)} to see all\n")
    
    def export_to_config_format(
        self,
        models: List[Dict[str, Any]],
        output_file: str
    ):
        """Export models in the config.json format."""
        config_models = []
        
        for model in models:
            # Generate a friendly ID
            model_id = model['id'].replace('/', '-')
            if not model_id.startswith('or-'):
                model_id = f"or-{model_id}"
            
            # Extract provider from model ID
            provider_map = {
                'openai': 'OpenAI',
                'anthropic': 'Anthropic',
                'google': 'Google',
                'meta-llama': 'Meta',
                'deepseek': 'DeepSeek',
                'qwen': 'Qwen',
                'mistralai': 'Mistral',
                'cohere': 'Cohere',
                'x-ai': 'xAI',
                'perplexity': 'Perplexity'
            }
            
            provider = 'Unknown'
            for key, value in provider_map.items():
                if key in model['id'].lower():
                    provider = value
                    break
            
            # Determine capabilities
            capabilities = []
            params = model.get('supported_parameters', [])
            
            if 'tools' in params or 'functions' in params:
                capabilities.append('Tools')
            
            modality = model.get('architecture', {}).get('modality', '')
            if 'image' in modality:
                capabilities.append('Vision')
            
            # Check for reasoning/thinking capability
            if ':thinking' in model['id'] or 'reasoning' in model.get('description', '').lower():
                capabilities.append('Reasoning')
            
            capabilities.append('Streaming')  # Most models support streaming
            
            config_model = {
                'id': model_id,
                'name': model.get('name', model['id']),
                'provider': provider,
                'modelId': model['id'],
                'description': model.get('description', f"{model.get('name', 'Model')} from {provider}"),
                'capabilities': capabilities,
                'enabled': False
            }
            
            config_models.append(config_model)
        
        # Save to file
        with open(output_file, 'w') as f:
            json.dump(config_models, f, indent=2)
        
        print(f"\n✅ Exported {len(config_models)} models to {output_file}")
        print(f"   You can review and add these to your models.config.json\n")


def get_api_key() -> str:
    """Get API key from environment or .env file."""
    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        env_path = Path('.env')
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    if line.strip() and not line.startswith('#'):
                        if 'OPENROUTER_API_KEY' in line:
                            api_key = line.split('=', 1)[1].strip().strip('"').strip("'")
                            break
    
    if not api_key:
        print("❌ Error: OPENROUTER_API_KEY not found!")
        print("   Set it as an environment variable or add it to .env file")
        sys.exit(1)
    
    return api_key


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(
        description='Discover and filter OpenRouter models',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Find all models with tool support
  python discover_models.py --tools
  
  # Find recent cheap models with tools and vision
  python discover_models.py --tools --vision --max-price 2.0 --recent 60
  
  # Search for specific models
  python discover_models.py --search "claude" --tools
  
  # Find models from specific providers
  python discover_models.py --tools --provider anthropic openai
  
  # Export to config format
  python discover_models.py --tools --export new_models.json
        """
    )
    
    # Filtering options
    parser.add_argument('--tools', action='store_true', 
                       help='Filter models with tool/function calling support')
    parser.add_argument('--vision', action='store_true',
                       help='Filter models with vision/image support')
    parser.add_argument('--reasoning', action='store_true',
                       help='Filter models with reasoning capabilities')
    parser.add_argument('--max-price', type=float,
                       help='Maximum input price per 1M tokens (USD)')
    parser.add_argument('--min-context', type=int,
                       help='Minimum context window size')
    parser.add_argument('--provider', nargs='+',
                       help='Filter by provider(s): anthropic, openai, google, etc.')
    parser.add_argument('--recent', type=int,
                       help='Show models from last N days (approximate)')
    parser.add_argument('--search', type=str,
                       help='Search term to filter models')
    
    # Display options
    parser.add_argument('--limit', type=int, default=20,
                       help='Maximum number of models to display (default: 20)')
    parser.add_argument('--export', type=str,
                       help='Export to config format (JSON file)')
    
    args = parser.parse_args()
    
    # Get API key
    api_key = get_api_key()
    print(f"✅ API key found: {api_key[:15]}...\n")
    
    # Initialize discovery
    discovery = ModelDiscovery(api_key)
    
    # Fetch all models
    all_models = discovery.fetch_all_models()
    
    # Apply filters
    print("🔍 Applying filters...")
    filtered_models = discovery.filter_models(
        all_models,
        has_tools=args.tools,
        has_vision=args.vision,
        has_reasoning=args.reasoning,
        max_input_price=args.max_price,
        min_context_window=args.min_context,
        providers=args.provider,
        recent_days=args.recent,
        search_term=args.search
    )
    
    # Display results
    discovery.display_models(filtered_models, limit=args.limit)
    
    # Export if requested
    if args.export:
        discovery.export_to_config_format(filtered_models, args.export)
    
    print(f"✨ Discovery complete! Found {len(filtered_models)} matching models.\n")


if __name__ == "__main__":
    main()
