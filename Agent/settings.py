import os
import sys
import yaml
from dotenv import load_dotenv

# Load environment variables from .env file
# def load_env_variables():
#     """Load environment variables from .env file in the project directory and count fields."""
#     try:
#         # Get the directory of the current file (settings.py)
#         project_dir = os.path.dirname(os.path.abspath(__file__))
#         # Construct path to .env file in the project directory
#         env_file = os.path.join(project_dir, '.env')
        
#         # Count valid key-value pairs in .env file
#         count = 0
#         with open(env_file, 'r') as f:
#             lines = [line.strip() for line in f if line.strip() and '=' in line and not line.startswith('#')]
#             count = len(lines)
        
#         # Load variables from the specified .env file
#         load_dotenv(env_file)
        
#         print(f"Loaded {count} environment variables from {env_file}")
#         return count
#     except FileNotFoundError:
#         print(f"Error: {env_file} file not found")
#         return 0
#     except Exception as e:
#         print(f"Error loading environment variables: {e}")
#         return 0

# # Call the function in settings.py
# load_env_variables()

load_dotenv()

# Load configurations from config.yaml
try:
    # Use an absolute path or a path relative to this script's location if needed
    config_path = os.path.join(os.path.dirname(__file__),'config.yaml')
    with open(config_path, 'r') as stream:
        config = yaml.safe_load(stream)
except yaml.YAMLError as exc:
    print(f"Error loading config.yaml: {exc}")
    sys.exit(1)
except FileNotFoundError:
    print(f"Error: config.yaml not found at expected path: {config_path}")
    sys.exit(1)

# --- Environment Variables ---
# GROQ_API_KEY = os.getenv('GROQ_API_KEY')
# os.environ['GROQ_API_KEY'] = GROQ_API_KEY

# os.environ['AWS_ACCESS_KEY_ID'] = os.getenv('AWS_ACCESS_KEY_ID')
# os.environ['AWS_SECRET_ACCESS_KEY'] = os.getenv('AWS_SECRET_ACCESS_KEY')
# os.environ['AWS_REGION_NAME'] = os.getenv('AWS_REGION_NAME')

FRONTEND_URL = os.getenv("FRONTEND_URL")

# Set TOKENIZERS_PARALLELISM to false
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# --- Model Configurations ---
MODELS = config.get('models', {})
GENERIC_MODEL = MODELS.get("GENERIC_MODEL") # Changed default
QUERY_AGENT_MODEL = MODELS.get("QUERY_AGENT_MODEL")
POLICY_GENERATOR_MODEL = MODELS.get("POLICY_GENERATOR_MODEL")
VALIDATOR_AGENT_MODEL = MODELS.get("VALIDATOR_AGENT_MODEL") # Changed default
EMBEDDING_MODEL_NAME = MODELS.get("embedding_model_name")

# --- Collection Names ---
COLLECTIONS = config.get('collections', {})
GENERIC_COLLECTION_NAME = COLLECTIONS.get("generic_collection_name")
POLICY_COLLECTION_NAME = COLLECTIONS.get("policy_collection_name")

# --- Paths and File Names ---
PATHS = config.get('paths', {})
# Construct absolute paths based on the project root (assuming config.py is in a subdirectory like 'src')
PROJECT_ROOT = os.path.abspath(".")
CHROMA_DB_PATH = os.path.join(PROJECT_ROOT, PATHS.get("chroma_db_path"))
POLICY_JSON_FILE = os.path.join(PROJECT_ROOT, PATHS.get("policy_json_file"))
GENERIC_JSON_FILE = os.path.join(PROJECT_ROOT, PATHS.get("generic_json_file"))
TEMPLATE_FILE = os.path.join(PROJECT_ROOT, PATHS.get("template_file"))

# --- System Prompts ---
SYSTEM_PROMPTS = config.get('system_prompts', {})
GENERIC_SYSTEM_PROMPT = SYSTEM_PROMPTS.get("GENERIC_SYSTEM_PROMPT")
POLICY_SYSTEM_PROMPT = SYSTEM_PROMPTS.get("POLICY_SYSTEM_PROMPT")
VALIDATOR_SYSTEM_PROMPT = SYSTEM_PROMPTS.get("VALIDATOR_SYSTEM_PROMPT")

# # --- Logging ---
# LOGGING_CONFIG = config.get('logging', {})
# LOG_LEVEL = LOGGING_CONFIG.get('level', 'INFO').upper()
# LOG_FILE = LOGGING_CONFIG.get('file', 'app.log')
# # Construct absolute path for log file
# LOG_FILE_PATH = os.path.join(PROJECT_ROOT, LOG_FILE)
