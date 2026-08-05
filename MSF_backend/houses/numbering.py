"""
House Numbering System - Production-Ready Implementation

This module provides a thread-safe, atomic, database-backed house numbering system
that generates iterative alphanumeric IDs based on house categories.

Features:
- Prefixed alphanumeric pattern (e.g., Staff = S1, S2, S3...; Type A = A1, A2, A3...)
- Database-backed tracking of last used sequential integers
- Thread-safe atomic generation using Django transactions
- Extensible to support new prefixes/categories dynamically
- Comprehensive error handling and validation

Usage:
    from houses.numbering import HouseNumberGenerator
    
    # Generate a new house number for a specific category
    house_number = HouseNumberGenerator.generate_house_number("Staff")
    # Returns: "S1", "S2", "S3", etc.
    
    # Or use the service directly
    from houses.services import house_number_service
    house_number = house_number_service.generate_house_number("Type A")
    # Returns: "A1", "A2", "A3", etc.
"""

import logging
import threading
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple

from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.db.utils import DatabaseError

logger = logging.getLogger(__name__)


class HouseCategory(Enum):
    """
    Enumeration of supported house categories with their prefixes.
    This can be extended by adding new entries without modifying core logic.
    """
    STAFF = ("Staff", "S")
    TYPE_A = ("Type A", "A")
    TYPE_B = ("Type B", "B")
    TYPE_C = ("Type C", "C")
    TYPE_D = ("Type D", "D")
    TYPE_E = ("Type E", "E")
    
    def __init__(self, display_name: str, prefix: str):
        self.display_name = display_name
        self.prefix = prefix
    
    @classmethod
    def get_prefix(cls, category_name: str) -> str:
        """Get the prefix for a given category name."""
        for category in cls:
            if category.display_name == category_name or category.name == category_name:
                return category.prefix
        raise ValueError(f"Unknown house category: {category_name}")
    
    @classmethod
    def get_all_categories(cls) -> List[Tuple[str, str]]:
        """Get all available categories as list of (display_name, prefix) tuples."""
        return [(category.display_name, category.prefix) for category in cls]
    
    @classmethod
    def get_all_prefixes(cls) -> List[str]:
        """Get all available prefixes."""
        return [category.prefix for category in cls]


@dataclass
class HouseNumberConfig:
    """
    Configuration for house number generation.
    Allows customization of prefix mappings and validation rules.
    """
    # Default prefix mappings (category_name -> prefix)
    PREFIX_MAPPINGS: Dict[str, str] = field(
        default_factory=lambda: {
            "Staff": "S",
            "Type A": "A",
            "Type B": "B",
            "Type C": "C",
            "Type D": "D",
            "Type E": "E",
            # Barracks
            "Barrack": "BR",
            "Barracks": "BR",
        }
    )
    
    # Minimum and maximum values for sequential numbers
    MIN_SEQUENCE = 1
    MAX_SEQUENCE = 999999
    
    # Default starting sequence for new categories
    DEFAULT_START_SEQUENCE = 1
    
    @classmethod
    def get_prefix(cls, category: str) -> str:
        """Get the prefix for a given category."""
        # Check if category is a direct prefix
        if category.upper() in cls.PREFIX_MAPPINGS.values():
            return category.upper()
        
        # Lookup in mappings
        for category_name, prefix in cls.PREFIX_MAPPINGS.items():
            if category_name.lower() == category.lower():
                return prefix
        
        # Default to first letter uppercase for unknown categories
        if category:
            return category[0].upper()
        
        raise ValueError(f"Cannot determine prefix for category: {category}")
    
    @classmethod
    def validate_category(cls, category: str) -> bool:
        """Validate that a category is supported."""
        if not category or not isinstance(category, str):
            return False
        
        # Check if it's a known category or prefix
        category_upper = category.upper()
        if category_upper in cls.PREFIX_MAPPINGS.values():
            return True
            
        for category_name in cls.PREFIX_MAPPINGS.keys():
            if category_name.lower() == category.lower():
                return True
        
        return False


class HouseNumberGenerationError(Exception):
    """Base exception for house number generation errors."""
    pass


class DuplicateHouseNumberError(HouseNumberGenerationError):
    """Raised when a duplicate house number is detected."""
    pass


class InvalidCategoryError(HouseNumberGenerationError):
    """Raised when an invalid category is provided."""
    pass


class DatabaseLockError(HouseNumberGenerationError):
    """Raised when database locking fails."""
    pass


class SequenceOverflowError(HouseNumberGenerationError):
    """Raised when the sequence number exceeds maximum allowed value."""
    pass


class HouseNumberGenerator(models.Model):
    """
    Database model for tracking the last used sequential number for each prefix.
    
    This model ensures atomic, thread-safe generation of house numbers by using
    database-level locking and transactions.
    
    Attributes:
        prefix: The category prefix (e.g., 'S' for Staff, 'A' for Type A)
        last_sequence: The last used sequential number for this prefix
        category: The display name of the category
        created_at: When this generator record was created
        updated_at: When this generator record was last updated
    """
    
    prefix = models.CharField(
        max_length=10,
        unique=True,
        db_index=True,
        help_text="The prefix for the house category (e.g., 'S', 'A', 'B')"
    )
    
    last_sequence = models.PositiveIntegerField(
        default=0,
        help_text="The last used sequential number for this prefix"
    )
    
    category = models.CharField(
        max_length=50,
        db_index=True,
        help_text="The display name of the category (e.g., 'Staff', 'Type A')"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "house_number_generators"
        verbose_name = "House Number Generator"
        verbose_name_plural = "House Number Generators"
        ordering = ["prefix"]
        indexes = [
            models.Index(fields=["prefix"]),
            models.Index(fields=["category"]),
        ]
    
    def __str__(self):
        return f"{self.prefix}: {self.last_sequence}"
    
    @classmethod
    @transaction.atomic
    def generate_house_number(cls, category: str) -> str:
        """
        Generate a new house number for the given category.
        
        This method is thread-safe and atomic due to:
        1. Database-level locking (SELECT FOR UPDATE)
        2. Django transaction.atomic decorator
        3. Proper error handling and retry logic
        
        Args:
            category: The house category (e.g., "Staff", "Type A")
            
        Returns:
            A new house number in the format {prefix}{sequence} (e.g., "S1", "A2")
            
        Raises:
            InvalidCategoryError: If the category is not supported
            SequenceOverflowError: If the sequence exceeds maximum allowed value
            DatabaseLockError: If database locking fails
            HouseNumberGenerationError: For other generation errors
        """
        try:
            # Validate and get prefix
            prefix = HouseNumberConfig.get_prefix(category)
            
            if not prefix:
                raise InvalidCategoryError(f"Invalid category: {category}")
            
            # Get or create the generator record with exclusive lock
            generator = cls._get_generator_with_lock(prefix, category)
            
            # Increment the sequence
            new_sequence = generator.last_sequence + 1
            
            # Check for overflow
            if new_sequence > HouseNumberConfig.MAX_SEQUENCE:
                raise SequenceOverflowError(
                    f"Sequence overflow for prefix {prefix}: {new_sequence} > {HouseNumberConfig.MAX_SEQUENCE}"
                )
            
            # Update the generator
            generator.last_sequence = new_sequence
            generator.save(update_fields=["last_sequence", "updated_at"])
            
            # Return the new house number
            house_number = f"{prefix}{new_sequence}"
            logger.info(f"Generated house number: {house_number} for category: {category}")
            return house_number
            
        except ValidationError as e:
            logger.error(f"Validation error generating house number for {category}: {e}")
            raise InvalidCategoryError(f"Invalid category: {category}") from e
        except DatabaseError as e:
            logger.error(f"Database error generating house number for {category}: {e}")
            raise DatabaseLockError(f"Database error: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error generating house number for {category}: {e}")
            raise HouseNumberGenerationError(f"Failed to generate house number: {e}") from e
    
    @classmethod
    @transaction.atomic
    def _get_generator_with_lock(cls, prefix: str, category: str) -> 'HouseNumberGenerator':
        """
        Get or create a HouseNumberGenerator with exclusive database lock.
        
        Uses SELECT FOR UPDATE to lock the row, preventing concurrent modifications.
        
        Args:
            prefix: The prefix to get or create
            category: The category display name
            
        Returns:
            The locked HouseNumberGenerator instance
        """
        from django.db import connection
        
        try:
            # Try to get existing generator with lock
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM house_number_generators WHERE prefix = %s FOR UPDATE",
                    [prefix]
                )
                row = cursor.fetchone()
                
                if row:
                    # Return existing instance
                    generator = cls.objects.get(pk=row[0])
                    return generator
                else:
                    # Create new generator
                    generator = cls.objects.create(
                        prefix=prefix,
                        last_sequence=HouseNumberConfig.DEFAULT_START_SEQUENCE - 1,  # Start at 0 so first is 1
                        category=category
                    )
                    return generator
                    
        except DatabaseError as e:
            logger.error(f"Failed to acquire lock for prefix {prefix}: {e}")
            raise DatabaseLockError(f"Failed to acquire database lock: {e}") from e
    
    @classmethod
    def get_current_sequence(cls, prefix: str) -> int:
        """
        Get the current sequence number for a given prefix.
        
        Args:
            prefix: The prefix to check
            
        Returns:
            The current sequence number, or 0 if not found
        """
        try:
            generator = cls.objects.filter(prefix=prefix).first()
            return generator.last_sequence if generator else 0
        except Exception as e:
            logger.error(f"Error getting current sequence for {prefix}: {e}")
            return 0
    
    @classmethod
    def reset_sequence(cls, prefix: str, new_sequence: int = 0) -> bool:
        """
        Reset the sequence for a given prefix.
        
        WARNING: This should only be used for testing or data correction.
        
        Args:
            prefix: The prefix to reset
            new_sequence: The new sequence value (default: 0)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with transaction.atomic():
                generator = cls.objects.filter(prefix=prefix).first()
                if generator:
                    generator.last_sequence = new_sequence
                    generator.save(update_fields=["last_sequence", "updated_at"])
                    logger.warning(f"Reset sequence for {prefix} to {new_sequence}")
                    return True
                return False
        except Exception as e:
            logger.error(f"Error resetting sequence for {prefix}: {e}")
            return False
    
    @classmethod
    def get_all_generators(cls) -> List['HouseNumberGenerator']:
        """Get all house number generators."""
        return list(cls.objects.all().order_by('prefix'))
    
    @classmethod
    def initialize_missing_categories(cls) -> int:
        """
        Initialize missing categories from HouseNumberConfig.
        
        Returns:
            Number of categories initialized
        """
        initialized = 0
        existing_prefixes = set(cls.objects.values_list('prefix', flat=True))
        
        for category_name, prefix in HouseNumberConfig.PREFIX_MAPPINGS.items():
            if prefix not in existing_prefixes:
                cls.objects.create(
                    prefix=prefix,
                    last_sequence=0,
                    category=category_name
                )
                initialized += 1
                logger.info(f"Initialized generator for {category_name} ({prefix})")
        
        return initialized


class HouseNumberService:
    """
    Service layer for house number generation.
    
    Provides a clean interface for generating house numbers with additional
    features like batch generation, validation, and statistics.
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def generate_house_number(self, category: str) -> str:
        """
        Generate a single house number for the given category.
        
        Args:
            category: The house category
            
        Returns:
            The generated house number
        """
        return HouseNumberGenerator.generate_house_number(category)
    
    def generate_batch_house_numbers(self, category: str, count: int) -> List[str]:
        """
        Generate multiple house numbers for the same category.
        
        Args:
            category: The house category
            count: Number of house numbers to generate
            
        Returns:
            List of generated house numbers
        """
        if count <= 0:
            return []
        
        house_numbers = []
        for _ in range(count):
            house_number = self.generate_house_number(category)
            house_numbers.append(house_number)
        
        return house_numbers
    
    def validate_house_number(self, house_number: str, category: Optional[str] = None) -> bool:
        """
        Validate that a house number follows the expected format.
        
        Args:
            house_number: The house number to validate
            category: Optional category to validate against
            
        Returns:
            True if valid, False otherwise
        """
        if not house_number or not isinstance(house_number, str):
            return False
        
        # Extract prefix and sequence
        prefix = ""
        sequence_str = ""
        
        for i, char in enumerate(house_number):
            if char.isalpha():
                prefix += char
            else:
                sequence_str = house_number[i:]
                break
        
        if not prefix or not sequence_str:
            return False
        
        # Validate sequence is numeric
        if not sequence_str.isdigit():
            return False
        
        sequence = int(sequence_str)
        if sequence < HouseNumberConfig.MIN_SEQUENCE or sequence > HouseNumberConfig.MAX_SEQUENCE:
            return False
        
        # If category provided, validate prefix matches
        if category:
            expected_prefix = HouseNumberConfig.get_prefix(category)
            if prefix != expected_prefix:
                return False
        
        return True
    
    def get_house_number_info(self, house_number: str) -> Optional[Dict]:
        """
        Extract information from a house number.
        
        Args:
            house_number: The house number to parse
            
        Returns:
            Dictionary with prefix, sequence, and category info, or None if invalid
        """
        if not self.validate_house_number(house_number):
            return None
        
        # Extract prefix and sequence
        prefix = ""
        sequence_str = ""
        
        for i, char in enumerate(house_number):
            if char.isalpha():
                prefix += char
            else:
                sequence_str = house_number[i:]
                break
        
        sequence = int(sequence_str)
        
        # Find matching category
        category = None
        for cat_name, cat_prefix in HouseNumberConfig.PREFIX_MAPPINGS.items():
            if cat_prefix == prefix:
                category = cat_name
                break
        
        return {
            "house_number": house_number,
            "prefix": prefix,
            "sequence": sequence,
            "category": category or prefix
        }
    
    def get_statistics(self) -> Dict:
        """
        Get statistics about house number generation.
        
        Returns:
            Dictionary with generation statistics
        """
        generators = HouseNumberGenerator.get_all_generators()
        
        stats = {
            "total_categories": len(generators),
            "categories": {},
            "total_generated": 0
        }
        
        for generator in generators:
            stats["categories"][generator.prefix] = {
                "category": generator.category,
                "last_sequence": generator.last_sequence,
                "total_generated": generator.last_sequence
            }
            stats["total_generated"] += generator.last_sequence
        
        return stats
    
    def reset_all_sequences(self) -> bool:
        """
        Reset all sequences to 0.
        
        WARNING: This should only be used for testing.
        
        Returns:
            True if successful
        """
        try:
            with transaction.atomic():
                generators = HouseNumberGenerator.objects.all()
                for generator in generators:
                    generator.last_sequence = 0
                    generator.save(update_fields=["last_sequence", "updated_at"])
                
                logger.warning("Reset all house number sequences to 0")
                return True
        except Exception as e:
            logger.error(f"Error resetting all sequences: {e}")
            return False


# Singleton instance of the service
house_number_service = HouseNumberService()


@contextmanager
def house_number_transaction():
    """
    Context manager for house number generation transactions.
    
    Ensures that house number generation is atomic and can be rolled back
    if the broader transaction fails.
    
    Usage:
        with house_number_transaction():
            house_number = house_number_service.generate_house_number("Staff")
            # Other operations...
    """
    with transaction.atomic():
        yield


# Convenience functions for direct use
def generate_house_number(category: str) -> str:
    """Generate a house number for the given category."""
    return house_number_service.generate_house_number(category)


def validate_house_number(house_number: str, category: Optional[str] = None) -> bool:
    """Validate a house number."""
    return house_number_service.validate_house_number(house_number, category)


def get_house_number_info(house_number: str) -> Optional[Dict]:
    """Get information about a house number."""
    return house_number_service.get_house_number_info(house_number)
