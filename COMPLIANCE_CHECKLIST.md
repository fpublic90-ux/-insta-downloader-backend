# Play Store Compliance Checklist

Strict guidelines to avoid suspension when publishing this app.

## 1. Metadata (Store Listing)
- [ ] **App Name**: MUST NOT contain "Instagram", "IG", "Insta" as the *first* word or imply affiliation.
    - BAD: "Instagram Downloader", "InstaSave"
    - GOOD: "Video Saver for Instagram", "Downloader for Reels"
- [ ] **Icon**: MUST NOT use the Instagram camera logo or similar gradient. Use a generic download arrow or folder icon.
- [ ] **Description**:
    - [ ] Clearly state: "This app is not affiliated with Instagram."
    - [ ] Do not use "Official" or "Premium" in a way that implies official partnership.
- [ ] **Screenshots**: Blur user faces and names in screenshots. Do not show copyrighted content.

## 2. in-App Content
- [ ] **Disclaimer**: The app includes a Splash Screen disclaimer. Do NOT remove it.
- [ ] **Login**: This app does NOT require login. Adding Instagram login increases risk of "Credential phishing" flags. Keep it public-only.
- [ ] **Copyright**:
    - [ ] Do not enable downloading of private content.
    - [ ] Do not bypass encryptions (DRM). (This app only accesses public JSON data).

## 3. Privacy Policy
- [ ] Generate a Privacy Policy URL.
- [ ] Mention usage of "Storage Permissions" for saving files.
- [ ] Explicitly state no personal data is collected.

## 4. Functionality
- [ ] **Background Services**: Do not run hidden background processes. The download service is foreground visible via progress.
- [ ] **Youtube**: Do NOT add Youtube downloading support. It is strictly banned on Play Store.

## 5. Monetization (If added later)
- [ ] If adding Ads, ensure they do not cover main UI elements (Interfering Ads policy).
