# Generated migration for api.PasswordResetToken

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone
from datetime import timedelta


def default_expiry():
    return timezone.now() + timedelta(hours=1)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_getstartedevent'),
    ]

    operations = [
        migrations.CreateModel(
            name='PasswordResetToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(db_index=True, max_length=64, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(default=default_expiry)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='password_reset_tokens', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'api_passwordresettoken',
                'ordering': ['-created_at'],
            },
        ),
    ]
