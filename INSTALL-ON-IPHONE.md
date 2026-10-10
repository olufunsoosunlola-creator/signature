# Signature: putting it on your iPhone

## What's in this folder

- `project/` is the design exactly as Claude Design handed it over. It's kept for reference and isn't used by the app.
- `app/` is the real app, the part that gets published. It's the same design with these additions:
  - `index.html` is the design's main file, plus the settings that let iPhone install it.
  - `vendor/` and `fonts/` hold local copies of React (the code library the app runs on) and the four fonts, so nothing has to come from the internet.
  - `storage.js` saves your progress.
  - `sw.js` is the "service worker", a small helper that keeps a copy of the app on your phone so it opens offline.
  - `manifest.webmanifest` and `icons/` give the app its name, colours and home-screen icon.
- `.github/workflows/pages.yml` republishes the app on the web automatically whenever it changes.

## Step 1: Put it on the web (one time only)

An iPhone can only install a web app from a secure (https) web address. GitHub Pages hosts one for free.

1. Sign in at github.com, or create a free account.
2. Click **+** (top right), then **New repository**. Name it `signature`, choose **Public**, and leave every other option unticked. Click **Create repository**.
3. Tell Claude the repository's name (for example `yourname/signature`). Claude will upload the app to it.
4. In the repository, open **Settings**, then **Pages**. Under **Source**, choose **GitHub Actions**.
5. Open the **Actions** tab and wait for the green tick (about a minute). Your app's address is then `https://yourname.github.io/signature/`.

## Step 2: Install it on your iPhone

1. Open the address in **Safari**. Other browsers on iPhone can't install apps.
2. Wait a few seconds, so the app can save its files onto your phone.
3. Tap the **Share** button (the square with an arrow pointing up), then **Add to Home Screen**, then **Add**.
4. From now on, always open Signature from its **home-screen icon**. It opens full screen and works with no internet.

> Important: the home-screen app keeps its own progress, separate from Safari. Do your practice in the home-screen app, not in a Safari tab.

## How your progress is kept safe

- Every attempt, your mastery for each tool and your mistake patterns are saved on the phone straight away. Nothing is sent anywhere.
- Your progress is saved in two places on the phone. If one is ever lost, the app rebuilds it from the other.
- The app asks iPhone to treat its storage as permanent. Apps on the home screen are also protected from Safari's rule that deletes website data after 7 days without use.
- **Backups:** at the bottom of **Progress**, tap **Save a backup**, then **Save to Files**, and pick iCloud Drive. If you ever get a new phone or delete the app, tap **Restore a backup** and choose that file.
- Progress is only lost if you delete the app from your home screen, or clear website data in Settings → Safari. Saving a backup now and then guards against both.

## When the app is updated

Changes are published automatically. Your phone picks up the new version in the background, and you'll see it the next time you fully close Signature and open it again. Your progress is not affected.
