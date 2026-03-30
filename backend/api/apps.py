from django.apps import AppConfig
import logging


logger = logging.getLogger(__name__)


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        try:
            from api.model_health import warmup_model_artifacts
            warmup_model_artifacts()
        except Exception as exc:
            # Never block startup on observability checks.
            logger.warning("Model warmup skipped due to startup exception: %s", exc)
