# Generated migration for api.UserProfile

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('farmer', 'Farmer'), ('microfinance', 'Microfinance'), ('admin', 'Admin')], max_length=20)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='agrifin_profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'api_userprofile',
            },
        ),
    ]
