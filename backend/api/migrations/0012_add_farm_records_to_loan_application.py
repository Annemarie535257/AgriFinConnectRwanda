# Generated migration for adding farm records fields to LoanApplication

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_farmerregistrationotp'),
    ]

    operations = [
        migrations.AddField(
            model_name='loanapplication',
            name='farm_employees_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='loanapplication',
            name='farm_employees_summary',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='loanapplication',
            name='production_records_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='loanapplication',
            name='production_records_summary',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='loanapplication',
            name='seed_stock_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='loanapplication',
            name='fertilizer_records_count',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
