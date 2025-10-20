#!/usr/bin/env python3
"""
OpenRouter Model Validator

This script tests each model in the models.config.json file to verify:
1. The model exists in OpenRouter
2. The model can be successfully called
3. The model configuration is correct

Usage:
    python validate_models.py
"""

import json
import os
import sys
from typing import Dict, List, Any
from pathlib import Path

# OpenAI SDK for OpenRouter compatibility
try:
    from openai import OpenAI
except ImportError:
    print("Error: openai package not found. Install with: pip install openai")
    sys.exit(1)


class ModelValidator:
    def __init__(self, api_key: str):
        """Initialize validator with OpenRouter API key."""
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )
        self.available_models = None
        
    def fetch_available_models(self) -> Dict[str, Any]:
        """Fetch list of all available models from OpenRouter API."""
        print("📡 Fetching available models from OpenRouter...")
        try:
            # Use the models endpoint to get all available models
            import requests
            response = requests.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {self.client.api_key}"}
            )
            response.raise_for_status()
            data = response.json()
            
            # Create a lookup dictionary by model ID
            models_dict = {model['id']: model for model in data['data']}
            print(f"✅ Found {len(models_dict)} available models\n")
            return models_dict
            
        except Exception as e:
            print(f"❌ Error fetching models: {e}")
            return {}
    
    def test_model_exists(self, model_id: str) -> tuple[bool, Dict[str, Any]]:
        """Check if a model exists in OpenRouter's available models."""
        if self.available_models is None:
            self.available_models = self.fetch_available_models()
        
        if model_id in self.available_models:
            return True, self.available_models[model_id]
        
        # Try to find similar models
        similar = [m for m in self.available_models.keys() if model_id.lower() in m.lower()]
        return False, {"similar_models": similar[:5]}
    
    def test_model_call(self, model_id: str) -> tuple[bool, str]:
        """Test if a model can be successfully called."""
        try:
            response = self.client.chat.completions.create(
                model=model_id,
                messages=[
                    {"role": "user", "content": "Say 'OK' if you can read this."}
                ],
                max_tokens=10
            )
            return True, response.choices[0].message.content or "Success"
        except Exception as e:
            return False, str(e)
    
    def validate_config_model(self, model_config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate a single model from the config file."""
        model_id = model_config['id']
        model_name = model_config['name']
        openrouter_id = model_config['modelId']
        
        print(f"\n{'='*70}")
        print(f"🔍 Testing: {model_name} ({model_id})")
        print(f"   OpenRouter ID: {openrouter_id}")
        print(f"   Provider: {model_config['provider']}")
        print(f"   Enabled: {model_config['enabled']}")
        print(f"{'='*70}")
        
        result = {
            'id': model_id,
            'name': model_name,
            'modelId': openrouter_id,
            'exists': False,
            'callable': False,
            'error': None,
            'model_info': None,
            'suggestion': None
        }
        
        # Test 1: Check if model exists
        print("\n📋 Step 1: Checking if model exists in OpenRouter...")
        exists, info = self.test_model_exists(openrouter_id)
        result['exists'] = exists
        result['model_info'] = info
        
        if exists:
            print(f"   ✅ Model exists!")
            if 'pricing' in info:
                print(f"   💰 Pricing: ${info['pricing'].get('prompt', 'N/A')}/1M input tokens")
        else:
            print(f"   ❌ Model NOT found in OpenRouter!")
            if info.get('similar_models'):
                print(f"   💡 Similar models found:")
                for similar in info['similar_models']:
                    print(f"      - {similar}")
                result['suggestion'] = f"Try one of: {', '.join(info['similar_models'][:3])}"
            return result
        
        # Test 2: Try to call the model (only if it exists)
        print("\n🚀 Step 2: Testing model API call...")
        callable_result, response = self.test_model_call(openrouter_id)
        result['callable'] = callable_result
        
        if callable_result:
            print(f"   ✅ Model responded successfully!")
            print(f"   📝 Response: {response[:100]}")
        else:
            print(f"   ❌ Model call failed!")
            print(f"   ⚠️  Error: {response}")
            result['error'] = response
        
        return result


def load_config(config_path: str = "config/models.config.json") -> Dict[str, Any]:
    """Load the models configuration file."""
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Config file not found: {config_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in config file: {e}")
        sys.exit(1)


def print_summary(results: List[Dict[str, Any]]):
    """Print a summary of validation results."""
    print("\n" + "="*70)
    print("📊 VALIDATION SUMMARY")
    print("="*70)
    
    total = len(results)
    exists_count = sum(1 for r in results if r['exists'])
    callable_count = sum(1 for r in results if r['callable'])
    
    print(f"\n📈 Statistics:")
    print(f"   Total models tested: {total}")
    print(f"   Models exist in OpenRouter: {exists_count}/{total} ({exists_count/total*100:.1f}%)")
    print(f"   Models callable: {callable_count}/{total} ({callable_count/total*100:.1f}%)")
    
    # Models with issues
    failed = [r for r in results if not r['exists'] or not r['callable']]
    if failed:
        print(f"\n❌ Models with issues ({len(failed)}):")
        for r in failed:
            print(f"\n   • {r['name']} ({r['id']})")
            print(f"     OpenRouter ID: {r['modelId']}")
            if not r['exists']:
                print(f"     Status: Does not exist in OpenRouter")
                if r['suggestion']:
                    print(f"     Suggestion: {r['suggestion']}")
            elif not r['callable']:
                print(f"     Status: Exists but not callable")
                print(f"     Error: {r['error']}")
    
    # Successful models
    success = [r for r in results if r['exists'] and r['callable']]
    if success:
        print(f"\n✅ Working models ({len(success)}):")
        for r in success:
            print(f"   • {r['name']} ({r['id']})")
    
    print("\n" + "="*70)


def main():
    """Main execution function."""
    print("="*70)
    print("🔧 OpenRouter Model Validator")
    print("="*70)
    
    # Get API key from environment
    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        # Try to load from .env file
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
    
    print(f"✅ API key found: {api_key[:15]}...")
    
    # Load configuration
    config = load_config()
    print(f"\n✅ Loaded config version: {config.get('version')}")
    print(f"   Default model: {config.get('defaultModel')}")
    print(f"   Total models: {len(config.get('models', []))}")
    
    # Initialize validator
    validator = ModelValidator(api_key)
    
    # Validate each model
    results = []
    for model in config.get('models', []):
        result = validator.validate_config_model(model)
        results.append(result)
    
    # Print summary
    print_summary(results)
    
    # Generate suggestions file
    failed = [r for r in results if not r['exists'] or not r['callable']]
    if failed:
        suggestions_file = "model_validation_report.json"
        with open(suggestions_file, 'w') as f:
            json.dump({
                'timestamp': str(Path(__file__).stat().st_mtime),
                'total_tested': len(results),
                'failed_models': failed,
                'success_rate': f"{(len(results) - len(failed)) / len(results) * 100:.1f}%"
            }, f, indent=2)
        print(f"\n📄 Detailed report saved to: {suggestions_file}")
    
    # Exit code based on results
    if failed:
        sys.exit(1)
    else:
        print("\n🎉 All models validated successfully!")
        sys.exit(0)


if __name__ == "__main__":
    main()
