# KHE Booth API — production deployment gate

This file documents the production gate for the API. A production build must pass GitHub CI, deploy the current `main` commit on Vercel, return a healthy database status, expose the Phase 2 station routes, and show no new runtime error cluster before camera capture work begins.
