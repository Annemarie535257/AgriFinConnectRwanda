"""
Create test farmer and microfinance users for dashboard demo.
Run: python manage.py createtestusers
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from api.models import UserProfile

User = get_user_model()

FARMER_EMAIL = "farmer@test.agrifinconnect.rw"
FARMER_PASSWORD = "Farmer123!"
FARMER_NAME = "Test Farmer"

MFI_EMAIL = "microfinance@test.agrifinconnect.rw"
MFI_PASSWORD = "Microfinance123!"
MFI_NAME = "Test MFI Officer"


class Command(BaseCommand):
    help = "Create test farmer and microfinance users for dashboard demo"

    def handle(self, *args, **options):
        for email, password, name, role in [
            (FARMER_EMAIL, FARMER_PASSWORD, FARMER_NAME, "farmer"),
            (MFI_EMAIL, MFI_PASSWORD, MFI_NAME, "microfinance"),
        ]:
            user, created = User.objects.get_or_create(
                username=email,
                defaults={
                    "email": email,
                    "first_name": name,
                },
            )
            if created:
                user.set_password(password)
                user.save()
                UserProfile.objects.create(user=user, role=role)
                self.stdout.write(self.style.SUCCESS(f"Created {role}: {email}"))
            else:
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.WARNING(f"Updated password for {role}: {email}"))

        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("Test credentials:")
        self.stdout.write("=" * 50)
        self.stdout.write(f"\nFARMER:\n  Email: {FARMER_EMAIL}\n  Password: {FARMER_PASSWORD}")
        self.stdout.write(f"\nMICROFINANCE:\n  Email: {MFI_EMAIL}\n  Password: {MFI_PASSWORD}")
        self.stdout.write("\n" + "=" * 50)
