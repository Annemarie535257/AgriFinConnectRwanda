# Generated migration for loan workflow models

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0003_passwordresettoken'),
    ]

    operations = [
        migrations.CreateModel(
            name='FarmerProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('location', models.CharField(blank=True, max_length=200)),
                ('phone', models.CharField(blank=True, max_length=20)),
                ('cooperative_name', models.CharField(blank=True, max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='farmer_profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'api_farmerprofile',
            },
        ),
        migrations.CreateModel(
            name='AgriculturalRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('crop_type', models.CharField(max_length=100)),
                ('land_size_hectares', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('estimated_yield', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('season', models.CharField(blank=True, max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agricultural_records', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'api_agriculturalrecord',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='LoanApplication',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('age', models.PositiveIntegerField(default=35)),
                ('annual_income', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('credit_score', models.PositiveIntegerField(default=600)),
                ('loan_amount_requested', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('loan_duration_months', models.PositiveIntegerField(default=24)),
                ('employment_status', models.CharField(default='Self-Employed', max_length=30)),
                ('education_level', models.CharField(default='High School', max_length=30)),
                ('marital_status', models.CharField(default='Married', max_length=20)),
                ('loan_purpose', models.CharField(default='Other', max_length=50)),
                ('eligibility_approved', models.BooleanField(blank=True, null=True)),
                ('eligibility_reason', models.TextField(blank=True)),
                ('risk_score', models.FloatField(blank=True, null=True)),
                ('recommended_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('rejection_reason', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_applications', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='loan_applications', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'api_loanapplication',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Loan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('interest_rate', models.DecimalField(decimal_places=4, default=0.12, max_digits=6)),
                ('duration_months', models.PositiveIntegerField()),
                ('monthly_payment', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('disbursed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('application', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='approved_loan', to='api.loanapplication')),
            ],
            options={
                'db_table': 'api_loan',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Repayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('due_date', models.DateField()),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('loan', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='repayments', to='api.loan')),
            ],
            options={
                'db_table': 'api_repayment',
                'ordering': ['due_date'],
            },
        ),
        migrations.CreateModel(
            name='ChatInteraction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message', models.TextField()),
                ('reply', models.TextField()),
                ('language', models.CharField(default='en', max_length=5)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='chat_interactions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'api_chatinteraction',
                'ordering': ['-created_at'],
            },
        ),
    ]
