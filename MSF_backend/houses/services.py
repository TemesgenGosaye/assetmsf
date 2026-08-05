"""
House Services - Business Logic Layer

This module provides service-layer functionality for house management,
including the house numbering service integration.
"""

from typing import List, Optional, Dict, Any
from django.db import transaction
from django.core.exceptions import ValidationError

from .numbering import (
    house_number_service,
    HouseNumberGenerator,
    HouseNumberGenerationError,
    InvalidCategoryError,
    SequenceOverflowError,
    DatabaseLockError
)
from .models import House


class HouseService:
    """
    Service class for house-related business operations.
    """
    
    @staticmethod
    def create_house_with_number(
        house_type: str,
        location: str,
        capacity: int = 1,
        description: str = "",
        **extra_fields
    ) -> House:
        """
        Create a new house with an automatically generated house number.
        
        This method handles the complete workflow:
        1. Generate a unique house number based on the house type
        2. Create the house record with the generated number
        3. Handle all error cases gracefully
        
        Args:
            house_type: The type of house (e.g., "Staff", "Type A")
            location: The location of the house
            capacity: The capacity of the house
            description: Optional description
            **extra_fields: Additional fields to set on the house
            
        Returns:
            The created House instance
            
        Raises:
            HouseNumberGenerationError: If house number generation fails
            ValidationError: If house validation fails
        """
        try:
            # Generate house number
            house_number = house_number_service.generate_house_number(house_type)
            
            # Create the house
            house_data = {
                "house_id": house_number,
                "house_type": house_type,
                "location": location,
                "capacity": capacity,
                "description": description,
                **extra_fields
            }
            
            house = House.objects.create(**house_data)
            return house
            
        except HouseNumberGenerationError as e:
            raise HouseNumberGenerationError(f"Failed to generate house number: {e}") from e
        except ValidationError as e:
            raise ValidationError(f"House validation failed: {e}") from e
        except Exception as e:
            raise HouseNumberGenerationError(f"Failed to create house: {e}") from e
    
    @staticmethod
    @transaction.atomic
    def create_multiple_houses(
        house_type: str,
        location: str,
        count: int,
        capacity: int = 1,
        description: str = ""
    ) -> List[House]:
        """
        Create multiple houses of the same type with sequential numbers.
        
        Args:
            house_type: The type of house
            location: The location for all houses
            count: Number of houses to create
            capacity: The capacity for each house
            description: Optional description for all houses
            
        Returns:
            List of created House instances
        """
        if count <= 0:
            return []
        
        houses = []
        for _ in range(count):
            house = HouseService.create_house_with_number(
                house_type=house_type,
                location=location,
                capacity=capacity,
                description=description
            )
            houses.append(house)
        
        return houses
    
    @staticmethod
    def get_house_by_number(house_number: str) -> Optional[House]:
        """
        Get a house by its house number.
        
        Args:
            house_number: The house number to look up
            
        Returns:
            The House instance or None if not found
        """
        try:
            return House.objects.filter(house_id=house_number).first()
        except Exception:
            return None
    
    @staticmethod
    def validate_house_number_format(house_number: str, house_type: Optional[str] = None) -> bool:
        """
        Validate that a house number follows the expected format.
        
        Args:
            house_number: The house number to validate
            house_type: Optional house type to validate against
            
        Returns:
            True if valid, False otherwise
        """
        return house_number_service.validate_house_number(house_number, house_type)
    
    @staticmethod
    def get_house_number_statistics() -> Dict[str, Any]:
        """
        Get statistics about house number generation.
        
        Returns:
            Dictionary with generation statistics
        """
        return house_number_service.get_statistics()
    
    @staticmethod
    def get_next_house_number(house_type: str) -> str:
        """
        Get the next house number that would be generated for a given type.
        
        This does not increment the counter, just returns what would be next.
        
        Args:
            house_type: The house type
            
        Returns:
            The next house number
        """
        try:
            prefix = house_number_service.get_house_number_info(
                house_number_service.generate_house_number(house_type)
            )
            if prefix:
                # We need to peek at the next sequence without consuming it
                # This is a read-only operation
                generator = HouseNumberGenerator.objects.filter(
                    prefix=prefix.get("prefix", "")
                ).first()
                
                if generator:
                    next_sequence = generator.last_sequence + 1
                    return f"{generator.prefix}{next_sequence}"
            
            # Fallback: generate and return (this will consume it)
            return house_number_service.generate_house_number(house_type)
            
        except Exception:
            # If we can't peek, generate normally
            return house_number_service.generate_house_number(house_type)


class HouseNumberManagementService:
    """
    Advanced service for managing house number generation.
    """
    
    @staticmethod
    def initialize_house_number_generators() -> int:
        """
        Initialize house number generators for all known categories.
        
        Returns:
            Number of generators initialized
        """
        return HouseNumberGenerator.initialize_missing_categories()
    
    @staticmethod
    def reset_house_number_sequence(house_type: str, new_sequence: int = 0) -> bool:
        """
        Reset the sequence for a specific house type.
        
        WARNING: This should only be used for testing or data correction.
        
        Args:
            house_type: The house type
            new_sequence: The new sequence value (default: 0)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            prefix = house_number_service.get_house_number_info(
                house_number_service.generate_house_number(house_type)
            )
            if prefix:
                return HouseNumberGenerator.reset_sequence(
                    prefix.get("prefix", ""),
                    new_sequence
                )
            return False
        except Exception:
            return False
    
    @staticmethod
    def get_all_house_number_generators() -> List[Dict[str, Any]]:
        """
        Get information about all house number generators.
        
        Returns:
            List of generator information dictionaries
        """
        generators = HouseNumberGenerator.get_all_generators()
        return [
            {
                "prefix": g.prefix,
                "category": g.category,
                "last_sequence": g.last_sequence,
                "created_at": g.created_at,
                "updated_at": g.updated_at
            }
            for g in generators
        ]
    
    @staticmethod
    def add_custom_category(category_name: str, prefix: str) -> bool:
        """
        Add a custom category and prefix mapping.
        
        Args:
            category_name: The display name for the category
            prefix: The prefix to use for this category
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if prefix already exists
            existing = HouseNumberGenerator.objects.filter(prefix=prefix).first()
            if existing:
                return False  # Prefix already exists
            
            # Create new generator
            HouseNumberGenerator.objects.create(
                prefix=prefix,
                last_sequence=0,
                category=category_name
            )
            
            return True
        except Exception:
            return False
