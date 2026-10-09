import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Parcours de bout en bout : un backend Django dédié (port 8001, emails écrits dans des fichiers,
 * Celery en mode synchrone) et Vite (port 5174). Prérequis : MySQL et Redis démarrés,
 * `python manage.py seed_demo` exécuté.
 */
export const DOSSIER_EMAILS = path.resolve('.emails-e2e');
const BACKEND = path.resolve('../backend');

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure', locale: 'fr-FR', timezoneId: 'Africa/Abidjan' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `"${BACKEND}/.venv/bin/python" "${BACKEND}/manage.py" runserver 127.0.0.1:8001 --noreload`,
      url: 'http://127.0.0.1:8001/api/sante/',
      reuseExistingServer: false,
      env: {
        EMAIL_BACKEND: 'django.core.mail.backends.filebased.EmailBackend',
        EMAIL_FILE_PATH: DOSSIER_EMAILS,
        CELERY_TASK_ALWAYS_EAGER: '1',
        JWT_COOKIE_SECURE: '0',
        DJANGO_DEBUG: '1',
        APP_PUBLIC_URL: 'http://localhost:5174',
      },
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      env: { VITE_API_PROXY: 'http://127.0.0.1:8001' },
    },
  ],
});
