# Generated migration for api.GetStartedEvent

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='GetStartedEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(choices=[('modal_opened', 'Modal opened'), ('register_clicked', 'Register clicked'), ('login_clicked', 'Login clicked')], max_length=30)),
                ('role', models.CharField(default='', max_length=20)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'api_getstartedevent',
                'ordering': ['-created_at'],
            },
        ),
    ]
