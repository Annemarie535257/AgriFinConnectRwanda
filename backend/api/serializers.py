"""Serializers for auth and API docs."""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import UserProfile

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    """Registration for farmers and microfinance only."""
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    role = serializers.ChoiceField(choices=[('farmer', 'Farmer'), ('microfinance', 'Microfinance')])
    name = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('name') or '',
        )
        UserProfile.objects.create(user=user, role=validated_data['role'])
        return user


class LoginSerializer(serializers.Serializer):
    """Login (all roles: farmer, microfinance, admin)."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserInfoSerializer(serializers.Serializer):
    """User info returned after login."""
    id = serializers.IntegerField()
    email = serializers.EmailField()
    username = serializers.CharField()
    role = serializers.CharField()
    token = serializers.CharField()
