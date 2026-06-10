# Flying Bird Wallpaper — Privacy Policy

> **Applies to**: version 2.0.0 and later  
> **Last updated**: 2026-06-10  
> **Contact**: zmn2007.hi@163.com

Flying Bird Wallpaper (“the App”) is developed by OXOYO. This policy explains how the App handles information related to your use.

---

## 1. Overview

- The App has **no user account system** and **does not upload** your wallpaper library, browsing history, or AI results to the developer’s servers by default.
- Most data stays **on your device** (app data directory and local database).
- Network access occurs only when **you enable or trigger** specific features, as described below.

---

## 2. Data Stored Locally

The App may store locally (including but not limited to):

| Type | Description |
|------|-------------|
| Wallpaper metadata | Paths, titles, tags, scores from local scan, download, or plugins |
| Usage records | Favorites, history, privacy space, collections, statistics |
| Settings | Theme, wallpaper modes, rhythm/dynamic options, AI configuration |
| AI outputs | Tags, descriptions, NSFW levels, embeddings (generated or fetched then stored locally) |
| Privacy space password | Stored as a salted hash in the local database; **plaintext is not uploaded** |
| API keys and credentials | Entered in settings, kept on device, sent only to providers you configure |

---

## 3. Network Activity

### 3.1 Update checks

In **packaged releases**, the App may check for updates automatically after launch or when you check manually, contacting **GitHub Releases** (or similar). **Your personal files are not included.** Dev (unpackaged) builds may behave differently.

### 3.2 Plugins and remote sources

Installing plugins, browsing the plugin marketplace, or downloading from remote sources contacts **URLs you choose or configure** (e.g. plugin indexes and packages on GitHub). Third-party operators govern those services.

### 3.3 Web wallpaper (optional)

If you set a **web wallpaper** URL, the App loads that page on the desktop layer; the site’s own policies apply to that traffic.

### 3.4 AI features (optional)

If you enable AI with a **non-local** provider (e.g. OpenAI, DeepSeek, OpenRouter):

- Compressed local images or video frames may be sent to **your chosen provider**;
- API keys and endpoints are stored on your device; requests go directly to that provider; some providers may also receive Referer, app title, or similar metadata if you configure them;
- **Local Ollama / localhost-compatible endpoints** typically keep data on your machine;
- **Built-in visual embedding** (e.g. MobileCLIP) runs on device; model files ship with the app or build scripts and do not upload your library for inference.

Review the provider’s privacy policy before use.

### 3.5 H5 LAN server (optional)

When the H5 server is running, devices on the **same local network** may access a web UI and some APIs (search, favorites, settings sync, etc.) via QR code or URL. There is **no separate account login by default** (privacy-space actions may still require the privacy password set on this device). **Do not enable on untrusted networks.**

---

## 4. What We Do Not Do by Default

- No registration or phone/email collection for accounts;
- No default third-party ads or behavioral analytics SDKs (in the official open-source build);
- No default upload of your library to developer servers.

Custom builds may differ.

---

## 5. Privacy Space

- **Privacy space**: local password protection for selected items; logic and data stay on your device.

This feature is **not** a substitute for managing your own files.

---

## 6. Deletion

Use in-app actions such as clearing the resource library; uninstalling usually removes app data. **No dedicated full export** is provided—back up important files yourself.

---

## 7. Minors

The App is not designed to collect minors’ personal information. Guardians should disable cloud AI or LAN features if minors misuse them.

---

## 8. Changes & Contact

We may update this policy in `docs/legal/`. Questions: **zmn2007.hi@163.com** or GitHub Issues.
