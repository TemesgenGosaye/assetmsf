"""
User model with custom authentication and role-based access control.
"""
import random
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from core.models import BaseModel


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError(_("The Email field must be set"))

        email = self.normalize_email(email)

        user = self.model(
            email=email,
            **extra_fields
        )

        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, password=None, **extra_fields):

        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault(
            "role",
            User.Role.SUPER_ADMIN
        )

        if extra_fields.get("is_staff") is not True:
            raise ValueError(
                _("Superuser must have is_staff=True.")
            )

        if extra_fields.get("is_superuser") is not True:
            raise ValueError(
                _("Superuser must have is_superuser=True.")
            )

        return self.create_user(
            email,
            password,
            **extra_fields
        )


class User(AbstractUser):
    """
    Custom User model with email authentication.
    """

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        db_index=True
    )


    class Role(models.TextChoices):

        SUPER_ADMIN = "SUPER_ADMIN", _("Super Admin")
        ADMIN = "ADMIN", _("Admin")
        MANAGER = "MANAGER", _("Manager")
        FIELD_STAFF = "FIELD_STAFF", _("Field Staff")
        AUDITOR = "AUDITOR", _("Auditor")


    class Status(models.TextChoices):

        ACTIVE = "active", _("Active")
        INACTIVE = "inactive", _("Inactive")
        SUSPENDED = "suspended", _("Suspended")


    username = None


    email = models.EmailField(
        _("email address"),
        unique=True,
        db_index=True
    )


    name = models.CharField(
        _("full name"),
        max_length=255,
        null=True,
        blank=True
    )


    phone = models.CharField(
        _("phone number"),
        max_length=20,
        null=True,
        blank=True
    )


    department = models.CharField(
        _("department"),
        max_length=255,
        null=True,
        blank=True,
        db_index=True
    )


    role = models.CharField(
        _("role"),
        max_length=20,
        choices=Role.choices,
        default=Role.FIELD_STAFF,
        db_index=True
    )


    status = models.CharField(
        _("status"),
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True
    )


    profile_image = models.ImageField(
        _("profile image"),
        upload_to="profile_images/",
        null=True,
        blank=True
    )


    last_login_ip = models.GenericIPAddressField(
        _("last login IP"),
        null=True,
        blank=True
    )


    last_login_user_agent = models.TextField(
        _("last login user agent"),
        null=True,
        blank=True
    )


    email_notifications = models.BooleanField(
        _("email notifications"),
        default=True
    )


    dark_mode = models.BooleanField(
        _("dark mode"),
        default=False
    )


    objects = UserManager()


    USERNAME_FIELD = "email"

    REQUIRED_FIELDS = ["name"]


    class Meta:

        db_table = "users"

        ordering = [
            "-created_at"
        ]

        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["role"]),
            models.Index(fields=["status"]),
            models.Index(fields=["department"]),
        ]


    def __str__(self):
        return self.email


    def get_full_name(self):
        return self.name or self.email


    def get_short_name(self):
        return self.name or self.email


    def is_super_admin(self):
        return self.role == self.Role.SUPER_ADMIN


    def is_admin(self):
        return self.role in [
            self.Role.ADMIN,
            self.Role.SUPER_ADMIN
        ]


    def is_manager(self):
        return self.role == self.Role.MANAGER


    def is_field_staff(self):
        return self.role == self.Role.FIELD_STAFF


    def is_auditor(self):
        return self.role == self.Role.AUDITOR



class UserSettings(BaseModel):

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="settings"
    )

    notifications = models.BooleanField(
        default=True
    )

    email_notifications = models.BooleanField(
        default=True
    )

    notification_types = models.JSONField(
        default=dict,
        null=True,
        blank=True
    )

    dark_mode = models.BooleanField(
        default=False
    )

    dashboard_prefs = models.JSONField(
        default=dict,
        null=True,
        blank=True
    )


    class Meta:
        db_table = "user_settings"



class UserPermission(BaseModel):

    class Page(models.TextChoices):

        ASSETS = "assets", _("Assets")
        PROPERTIES = "properties", _("Properties")
        QRCODES = "qrcodes", _("QR Codes")
        USERS = "users", _("Users")
        REPORTS = "reports", _("Reports")
        SETTINGS = "settings", _("Settings")
        AUDIT = "audit", _("Audit")


    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="permissions"
    )


    page = models.CharField(
        max_length=50,
        choices=Page.choices
    )


    can_view = models.BooleanField(
        default=True
    )


    can_edit = models.BooleanField(
        default=False
    )



class UserPropertyAccess(BaseModel):

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="property_access"
    )

    property_id = models.CharField(
        max_length=50
    )



class UserDepartmentAccess(BaseModel):

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="department_access"
    )

    department = models.CharField(
        max_length=255
    )



class FinalApprover(BaseModel):

    property_id = models.CharField(
        max_length=50,
        unique=True
    )


    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="final_approver_properties"
    )


class PasswordResetOTP(BaseModel):
    """
    Model to store OTP for password reset functionality.
    """
    user = models.ForeignKey(
        'authentication.User',
        on_delete=models.CASCADE,
        related_name="password_reset_otps"
    )
    otp = models.CharField(
        max_length=6
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )
    is_used = models.BooleanField(
        default=False,
        db_index=True
    )

    class Meta:
        db_table = "password_reset_otps"
        ordering = ["-created_at"]
        verbose_name = "Password Reset OTP"
        verbose_name_plural = "Password Reset OTPs"

    @staticmethod
    def generate_otp():
        """
        Generate a random 6-digit numeric OTP.
        """
        return str(random.randint(100000, 999999))

    def is_valid(self):
        """
        Check if OTP is valid (unused and created within last 10 minutes).
        """
        if self.is_used:
            return False
        expiry_time = timezone.now() - timezone.timedelta(minutes=10)
        return self.created_at >= expiry_time

    def __str__(self):
        return f"PasswordResetOTP for {self.user.email} ({'Used' if self.is_used else 'Active'})"
