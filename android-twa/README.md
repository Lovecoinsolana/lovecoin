# Lovecoin Android TWA

Publish Lovecoin to Google Play Store as a Trusted Web Activity (TWA).

## What is TWA?

TWA wraps your PWA website into an Android app. Users download it from Play Store, and it opens your website fullscreen without browser UI.

## Prerequisites

- **Node.js 14.15+**
- **Java JDK 11+** (for signing)
- **Google Play Developer Account** ($25 one-time)

## Build Steps

### 1. Install Bubblewrap CLI

```bash
npm install -g @bubblewrap/cli
```

### 2. Initialize Project

```bash
cd android-twa
bubblewrap init --manifest https://lovecoin.fun/manifest.json
```

Follow the prompts:
- Package ID: `fun.lovecoin.app`
- App name: `Lovecoin`
- Create new signing key when prompted

### 3. Build APK

```bash
bubblewrap build
```

This creates:
- `app-release-signed.apk` - For direct install
- `app-release-bundle.aab` - For Play Store (recommended)

### 4. Get Your SHA-256 Fingerprint

After building, Bubblewrap displays your signing key fingerprint. Copy it.

### 5. Update assetlinks.json

Edit `apps/web/public/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "fun.lovecoin.app",
      "sha256_cert_fingerprints": [
        "YOUR_SHA256_FINGERPRINT_HERE"
      ]
    }
  }
]
```

### 6. Deploy to Website

Push the updated assetlinks.json to production:
```
https://lovecoin.fun/.well-known/assetlinks.json
```

Google verifies this file to confirm you own the website.

### 7. Upload to Play Store

1. Go to https://play.google.com/console
2. Create new app → Enter details
3. Release → Production → Create new release
4. Upload `app-release-bundle.aab`
5. Complete store listing
6. Submit for review (1-3 days)

## Store Listing Requirements

| Asset | Size | Required |
|-------|------|----------|
| App icon | 512x512 PNG | Yes |
| Feature graphic | 1024x500 PNG | Yes |
| Phone screenshots | Min 2 | Yes |
| Short description | Max 80 chars | Yes |
| Full description | Max 4000 chars | Yes |
| Privacy policy URL | URL | Yes |

## Signing Key - IMPORTANT!

**Back up your keystore file!** If lost, you can never update your app.

View fingerprint:
```bash
keytool -list -v -keystore lovecoin-keystore.jks
```

## Troubleshooting

### Browser bar showing (not fullscreen)
- assetlinks.json verification failed
- Check fingerprint matches exactly
- Check package name matches
- Verify file is accessible at `/.well-known/assetlinks.json`

### Validate assetlinks.json
```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://lovecoin.fun&relation=delegate_permission/common.handle_all_urls
```

## Links

- [Bubblewrap CLI (npm)](https://www.npmjs.com/package/@bubblewrap/cli)
- [Bubblewrap (GitHub)](https://github.com/GoogleChromeLabs/bubblewrap)
- [Google Play Console](https://play.google.com/console)
- [PWA to Play Store Guide](https://developers.google.com/codelabs/pwa-in-play)
