"""
Unified Configuration Manager
Reads from MongoDB first, falls back to environment variables.
All services should use this instead of os.getenv() for API keys.
"""
import os
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Mapping of setting keys to environment variable names
ENV_KEY_MAP = {
    # Twilio
    'twilio_account_sid': 'TWILIO_ACCOUNT_SID',
    'twilio_auth_token': 'TWILIO_AUTH_TOKEN',
    'twilio_phone_number': 'TWILIO_PHONE_NUMBER',
    # SendGrid
    'sendgrid_api_key': 'SENDGRID_API_KEY',
    'sendgrid_from_email': 'SENDGRID_FROM_EMAIL',
    'sendgrid_from_name': 'SENDGRID_FROM_NAME',
    # WhatsApp
    'whatsapp_phone_number_id': 'WHATSAPP_PHONE_NUMBER_ID',
    'whatsapp_access_token': 'WHATSAPP_ACCESS_TOKEN',
    'whatsapp_business_account_id': 'WHATSAPP_BUSINESS_ACCOUNT_ID',
    # Stripe
    'stripe_publishable_key': 'STRIPE_PUBLISHABLE_KEY',
    'stripe_secret_key': 'STRIPE_SECRET_KEY',
    'stripe_webhook_secret': 'STRIPE_WEBHOOK_SECRET',
    # Google
    'google_client_id': 'GOOGLE_CLIENT_ID',
    'google_client_secret': 'GOOGLE_CLIENT_SECRET',
    'google_maps_api_key': 'GOOGLE_MAPS_API_KEY',
    'gemini_api_key': 'GEMINI_API_KEY',
    # VAPI
    'vapi_api_key': 'VAPI_PRIVATE_KEY',
    'vapi_phone_number': 'VAPI_PHONE_NUMBER',
    'vapi_phone_number_id': 'VAPI_PHONE_NUMBER_ID',
    # NMI / Merchant One
    'nmi_security_key': 'NMI_SECURITY_KEY',
    'merchant_one_api_url': 'MERCHANT_ONE_API_URL',
    # Plaid
    'plaid_client_id': 'PLAID_CLIENT_ID',
    'plaid_secret': 'PLAID_SECRET',
    'plaid_environment': 'PLAID_ENVIRONMENT',
    # OpenAI
    'openai_api_key': 'OPENAI_API_KEY',
    # Sentry
    'sentry_dsn': 'SENTRY_DSN',
    # Square
    'square_access_token': 'SQUARE_ACCESS_TOKEN',
    'square_location_id': 'SQUARE_LOCATION_ID',
    'square_environment': 'SQUARE_ENVIRONMENT',
    # SMTP / Email
    'smtp_host': 'SMTP_HOST',
    'smtp_port': 'SMTP_PORT',
    'smtp_username': 'SMTP_USERNAME',
    'smtp_password': 'SMTP_PASSWORD',
    'smtp_encryption': 'SMTP_ENCRYPTION',
    'imap_host': 'IMAP_HOST',
    'imap_port': 'IMAP_PORT',
    'imap_username': 'IMAP_USERNAME',
    'imap_password': 'IMAP_PASSWORD',
    'email_from_address': 'EMAIL_FROM_ADDRESS',
    'email_from_name': 'EMAIL_FROM_NAME',
    # Business Contact Info
    'business_name': 'BUSINESS_NAME',
    'business_phone': 'BUSINESS_PHONE',
    'business_email': 'BUSINESS_EMAIL',
    'business_address': 'BUSINESS_ADDRESS',
    'business_city': 'BUSINESS_CITY',
    'business_state': 'BUSINESS_STATE',
    'business_zip': 'BUSINESS_ZIP',
    'business_hours': 'BUSINESS_HOURS',
    'business_website': 'BUSINESS_WEBSITE',
    'business_license': 'BUSINESS_LICENSE',
}

# Reverse mapping: env var name -> setting key
REVERSE_MAP = {v: k for k, v in ENV_KEY_MAP.items()}

# Sensitive keys that should be masked in responses
SENSITIVE_KEYS = {
    'twilio_auth_token', 'sendgrid_api_key', 'whatsapp_access_token',
    'stripe_secret_key', 'stripe_webhook_secret', 'google_client_secret',
    'vapi_api_key', 'google_maps_api_key', 'gemini_api_key', 'openai_api_key',
    'nmi_security_key', 'plaid_secret', 'sentry_dsn', 'square_access_token',
    'smtp_password', 'imap_password',
}


class ConfigManager:
    """Unified configuration manager that reads from MongoDB first, env vars as fallback."""

    def __init__(self):
        self._cache = {}
        self._db = None
        self._last_refresh = None
        self._cache_ttl = 300  # 5 minutes
        self._initialized = False

    def set_db(self, db):
        """Set the MongoDB database reference."""
        self._db = db
        self._initialized = True

    async def _refresh_cache(self):
        """Load all settings from MongoDB into cache."""
        if self._db is None:
            return

        try:
            # Read from system_settings
            doc = await self._db.system_settings.find_one({'_id': 'main'})
            if doc and doc.get('settings'):
                self._cache = dict(doc['settings'])

            # Also check api_config for backward compat
            api_doc = await self._db.api_config.find_one({'_id': 'main'})
            if api_doc:
                for setting_key, env_key in ENV_KEY_MAP.items():
                    config_key = setting_key
                    if config_key not in self._cache and api_doc.get(config_key):
                        self._cache[config_key] = api_doc[config_key]

            self._last_refresh = datetime.now(timezone.utc)
        except Exception as e:
            logger.error(f"Config refresh error: {e}")

    def _needs_refresh(self) -> bool:
        """Check if cache needs refreshing."""
        if not self._last_refresh:
            return True
        elapsed = (datetime.now(timezone.utc) - self._last_refresh).total_seconds()
        return elapsed > self._cache_ttl

    async def get(self, key: str, default: str = '') -> str:
        """
        Get a config value. Priority:
        1. MongoDB cache (system_settings)
        2. Environment variable
        3. Default value
        """
        if self._needs_refresh() and self._db is not None:
            await self._refresh_cache()

        # Check MongoDB cache first
        value = self._cache.get(key)
        if value and not str(value).startswith('****'):
            return str(value)

        # Fallback to environment variable
        env_key = ENV_KEY_MAP.get(key, key.upper())
        env_value = os.getenv(env_key, '')
        if env_value:
            return env_value

        return default

    async def get_env(self, env_var_name: str, default: str = '') -> str:
        """
        Get a config value by environment variable name.
        Maps to the setting key internally.
        """
        setting_key = REVERSE_MAP.get(env_var_name)
        if setting_key:
            return await self.get(setting_key, default)
        return os.getenv(env_var_name, default)

    async def set(self, key: str, value: str):
        """Set a config value in MongoDB."""
        if self._db is None:
            return

        self._cache[key] = value

        try:
            await self._db.system_settings.update_one(
                {'_id': 'main'},
                {
                    '$set': {
                        f'settings.{key}': value,
                        'updated_at': datetime.now(timezone.utc)
                    }
                },
                upsert=True
            )

            # Also sync to api_config
            await self._db.api_config.update_one(
                {'_id': 'main'},
                {'$set': {key: value}},
                upsert=True
            )
        except Exception as e:
            logger.error(f"Config set error for {key}: {e}")

    async def get_all(self) -> dict:
        """Get all settings (for admin panel)."""
        if self._needs_refresh() and self._db is not None:
            await self._refresh_cache()

        result = dict(self._cache)

        # Fill in any env vars not in MongoDB
        for setting_key, env_key in ENV_KEY_MAP.items():
            if setting_key not in result or not result[setting_key]:
                env_val = os.getenv(env_key, '')
                if env_val:
                    result[setting_key] = env_val

        return result

    async def get_all_masked(self) -> dict:
        """Get all settings with sensitive values masked."""
        all_settings = await self.get_all()
        masked = {}
        for key, value in all_settings.items():
            if key in SENSITIVE_KEYS and value and len(str(value)) > 6:
                masked[key] = '****' + str(value)[-4:]
            else:
                masked[key] = value
        return masked

    async def get_status(self) -> dict:
        """Get configuration status for each service."""
        all_settings = await self.get_all()
        
        services = {
            'twilio': {
                'name': 'Twilio (SMS)',
                'icon': '📲',
                'keys': ['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number'],
                'required': ['twilio_account_sid', 'twilio_auth_token'],
            },
            'sendgrid': {
                'name': 'SendGrid (Email)',
                'icon': '📧',
                'keys': ['sendgrid_api_key', 'sendgrid_from_email'],
                'required': ['sendgrid_api_key'],
            },
            'whatsapp': {
                'name': 'WhatsApp Business',
                'icon': '💬',
                'keys': ['whatsapp_phone_number_id', 'whatsapp_access_token'],
                'required': ['whatsapp_phone_number_id', 'whatsapp_access_token'],
            },
            'stripe': {
                'name': 'Stripe (Pagos)',
                'icon': '💳',
                'keys': ['stripe_publishable_key', 'stripe_secret_key'],
                'required': ['stripe_secret_key'],
            },
            'vapi': {
                'name': 'VAPI (Teléfono AI)',
                'icon': '📞',
                'keys': ['vapi_api_key', 'vapi_phone_number'],
                'required': ['vapi_api_key'],
            },
            'google_maps': {
                'name': 'Google Maps / Places',
                'icon': '🗺️',
                'keys': ['google_maps_api_key'],
                'required': ['google_maps_api_key'],
            },
            'nmi': {
                'name': 'NMI / Merchant One',
                'icon': '🏦',
                'keys': ['nmi_security_key'],
                'required': ['nmi_security_key'],
            },
            'plaid': {
                'name': 'Plaid (Banca)',
                'icon': '🔗',
                'keys': ['plaid_client_id', 'plaid_secret'],
                'required': ['plaid_client_id', 'plaid_secret'],
            },
            'sentry': {
                'name': 'Sentry (Monitoreo)',
                'icon': '🛡️',
                'keys': ['sentry_dsn'],
                'required': ['sentry_dsn'],
            },
            'gemini': {
                'name': 'Gemini AI',
                'icon': '✨',
                'keys': ['gemini_api_key'],
                'required': ['gemini_api_key'],
            },
            'openai': {
                'name': 'OpenAI',
                'icon': '🤖',
                'keys': ['openai_api_key'],
                'required': ['openai_api_key'],
            },
            'google_calendar': {
                'name': 'Google Calendar',
                'icon': '📅',
                'keys': ['google_client_id', 'google_client_secret'],
                'required': ['google_client_id', 'google_client_secret'],
            },
        }

        result = {}
        for svc_id, svc in services.items():
            configured_count = sum(1 for k in svc['required'] if all_settings.get(k))
            total_required = len(svc['required'])
            result[svc_id] = {
                **svc,
                'configured': configured_count == total_required,
                'partial': 0 < configured_count < total_required,
                'configured_count': configured_count,
                'total_required': total_required,
            }

        return result

    async def seed_from_env(self):
        """Seed MongoDB with current environment variables (one-time migration)."""
        if self._db is None:
            return

        existing = await self._db.system_settings.find_one({'_id': 'main'})
        existing_settings = existing.get('settings', {}) if existing else {}

        updates = {}
        for setting_key, env_key in ENV_KEY_MAP.items():
            env_val = os.getenv(env_key, '')
            if env_val and not existing_settings.get(setting_key):
                updates[setting_key] = env_val

        if updates:
            merged = {**existing_settings, **updates}
            await self._db.system_settings.update_one(
                {'_id': 'main'},
                {
                    '$set': {
                        'settings': merged,
                        'updated_at': datetime.now(timezone.utc),
                        'seeded_from_env': True,
                    }
                },
                upsert=True
            )
            logger.info(f"✅ Config seeded {len(updates)} keys from environment variables")

    def invalidate_cache(self):
        """Force cache refresh on next read."""
        self._last_refresh = None


# Global singleton
config_manager = ConfigManager()
