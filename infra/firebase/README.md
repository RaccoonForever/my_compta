Firebase setup (outline)

1. Create a Firebase project in the Firebase console (France region if you prefer).
2. Enable Firestore (native mode) and Authentication (Email provider or others).
3. Create a service account and download the JSON, save as `serviceAccount.json`.
4. Set environment variable `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of the service account file.
5. Use `firebase.json` and `firestore.rules` as starting points.

Place credentials outside the repo; .gitignore already excludes `serviceAccount*.json`.
