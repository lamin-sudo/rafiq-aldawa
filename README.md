# Base44 Project

Use this repository to run and edit the app locally, then publish changes back through Base44.

Any change pushed to the repo will also be reflected in the Base44 Builder.

## Prerequisites

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Install the Base44 CLI: `npm install -g base44@latest`.
5. Install [Deno](https://docs.deno.com/runtime/getting_started/installation/) — the local Base44 backend runs on it.

Run `base44 --help` (or see the [CLI reference](https://docs.base44.com/developers/references/cli/commands/introduction)) for the full command surface.

## Run Locally

Three commands, from the project root:

```bash
base44 login   # one-time per machine
base44 link    # one-time per clone
base44 dev     # local backend + frontend together
```

Open the frontend URL that `base44 dev` prints (typically `http://localhost:5173`).

Notes:

- **Every fresh clone needs `base44 link`.** It writes `base44/.app.jsonc` (the app-id pointer), which is deliberately gitignored. Your app id is in the Builder URL (`app.base44.com/apps/<id>/...`); `base44 link --help` shows the non-interactive flags.
- **`base44 dev` runs the frontend for you** (via `site.serveCommand` in this repo's `base44/config.jsonc`) — never run `npm run dev` yourself: alone it serves a UI with no backend behind it (`[base44] Proxy not enabled`, every `/api` call fails), and alongside `base44 dev` the second Vite silently takes the next port and you end up looking at the wrong one.
- **The app must be published at least once for the UI to load under `base44 dev`.** The frontend boots by fetching app settings from the hosted app; before the first publish that fails and every page redirects to login. The local API works regardless.
- Entities, functions, and auth run locally — entity data is **in-memory only**, wiped when `base44 dev` restarts. Everything else (Core integrations, OAuth login) is forwarded to your deployed app. Full breakdown: [Local development overview](https://docs.base44.com/developers/backend/overview/local-dev/local-development-overview).

## Frontend Only, Hosted Backend

To work on just the frontend against your app's live hosted backend:

```bash
base44 dev --remote
```

⚠️ In this mode writes go to your app's **production data** — plain `base44 dev` keeps everything local.

## Publish Your Changes

After pushing your changes to git, open the Base44 dashboard and publish the app:

```bash
base44 dashboard open
```

This repo syncs to Base44 through git, so publish from the dashboard rather than `base44 deploy` — a CLI deploy ships your local tree directly, bypassing the sync, and the deployed state silently diverges from the repo.

## Build Android APK

Once Capacitor is initialized, build and sync:

```bash
# 1. Build the web app
npm run build

# 2. Sync web assets to Android
npx cap sync android

# 3. Open Android project in Android Studio
npx cap open android

# 4. In Android Studio: Build → Generate Signed Bundle / APK → APK → release
#    Or run from command line:
cd android && ./gradlew assembleRelease
```

The APK will be at `android/app/build/outputs/apk/release/app-release.apk`.

### First-time Capacitor Init (already done)

```bash
npm install @capacitor/core @capacitor/cli
npx cap init RafiqAlDawa com.rafiqaldawa.app --web-dir=dist
npm install @capacitor/android
npx cap add android
```

### Android Widget Preparation

To add a home-screen medication reminder widget using `@capacitor/widgets`:

```bash
npm install @capacitor/widgets
npx cap sync android
```

Then create a widget class in `android/app/src/main/java/com/rafiqaldawa/app/`:

```java
// MedicationWidget.kt
package com.rafiqaldawa.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;
import com.getcapacitor.JourneyWidget;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorWidget
public class MedicationWidget extends JourneyWidget {

    @Override
    public void updateAppWidget(Context context, AppWidgetManager appWidgetManager,
                                int appWidgetId, JSONObject data) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.medication_widget);
        // Bind medication name, next dose time, etc. from `data`
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
```

Add the widget to `android/app/src/main/res/xml/widget_info.xml` and register it in
`AndroidManifest.xml`. See [@capacitor/widgets docs](https://capacitorjs.com/docs/widgets) for full details.

---

## Docs & Support

GitHub integration: [https://docs.base44.com/developers/app-code/local-development/github](https://docs.base44.com/developers/app-code/local-development/github)

Local development: [https://docs.base44.com/developers/backend/overview/local-dev/local-development-overview](https://docs.base44.com/developers/backend/overview/local-dev/local-development-overview)

Support: [https://app.base44.com/support](https://app.base44.com/support)
