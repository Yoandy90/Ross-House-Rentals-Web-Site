"""
Encryption Service for Payment Data
Secure encryption/decryption using AES-256
"""
import os
import base64
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

class EncryptionService:
    def __init__(self):
        # Get encryption key from environment or generate new one
        encryption_key = os.getenv('ENCRYPTION_KEY')
        
        if not encryption_key:
            # Generate a new key if not exists (for first time setup)
            encryption_key = Fernet.generate_key().decode()
            print(f"⚠️  NUEVA CLAVE DE ENCRIPTACIÓN GENERADA:")
            print(f"⚠️  Agrega esta línea a tu archivo .env:")
            print(f"ENCRYPTION_KEY={encryption_key}")
            print(f"⚠️  IMPORTANTE: Guarda esta clave de forma segura!")
        
        self.cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
    
    def encrypt(self, data: str) -> str:
        """
        Encrypt sensitive data
        Args:
            data: Plain text data to encrypt
        Returns:
            Base64 encoded encrypted data
        """
        if not data:
            return ""
        
        try:
            encrypted_bytes = self.cipher.encrypt(data.encode())
            return base64.b64encode(encrypted_bytes).decode()
        except Exception as e:
            print(f"❌ Error al encriptar: {e}")
            raise
    
    def decrypt(self, encrypted_data: str) -> str:
        """
        Decrypt sensitive data
        Args:
            encrypted_data: Base64 encoded encrypted data
        Returns:
            Decrypted plain text
        """
        if not encrypted_data:
            return ""
        
        try:
            encrypted_bytes = base64.b64decode(encrypted_data.encode())
            decrypted_bytes = self.cipher.decrypt(encrypted_bytes)
            return decrypted_bytes.decode()
        except Exception as e:
            print(f"❌ Error al desencriptar: {e}")
            raise
    
    def encrypt_card_data(self, card_number: str, cvv: str) -> dict:
        """
        Encrypt complete card data
        Args:
            card_number: Full card number
            cvv: Card CVV
        Returns:
            Dictionary with encrypted data and last4 digits
        """
        return {
            'encrypted_card_number': self.encrypt(card_number),
            'encrypted_cvv': self.encrypt(cvv),
            'last4': card_number[-4:] if len(card_number) >= 4 else '****'
        }
    
    def decrypt_card_data(self, encrypted_card_number: str, encrypted_cvv: str) -> dict:
        """
        Decrypt complete card data
        Args:
            encrypted_card_number: Encrypted card number
            encrypted_cvv: Encrypted CVV
        Returns:
            Dictionary with decrypted card number and CVV
        """
        return {
            'card_number': self.decrypt(encrypted_card_number),
            'cvv': self.decrypt(encrypted_cvv)
        }

# Singleton instance
_encryption_service = None

def get_encryption_service() -> EncryptionService:
    """Get or create encryption service singleton"""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service
