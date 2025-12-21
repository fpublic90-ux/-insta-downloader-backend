# Instagram Public Video Downloader

A premium, production-ready system to download public Instagram Reels and videos.
Consists of a Node.js backend for safe extraction and a Flutter Android app.

## Project Structure
*   `backend/`: Node.js Express Server
*   `mobile/`: Flutter Android App

## Setup Instructions

### 1. Backend Setup
The backend handles safe parsing of Instagram pages.

1.  Open `backend` directory: `cd backend`
2.  Install dependencies: `npm install`
3.  Start server: `npm start`
    *   Server runs on `http://localhost:3000`

### 2. Mobile App Setup
The Flutter app connects to the backend.

1.  Open `mobile` directory: `cd mobile`
2.  Install dependencies: `flutter pub get`
3.  **Emulator Setup**:
    *   By default, the app points to `http://10.0.2.2:3000` (Android Emulator loopback).
    *   If running on a physical device, update `lib/core/constants/api_constants.dart` with your PC's IP address (e.g., `http://192.168.1.X:3000`).
4.  Run App: `flutter run`

## Features
*   **High Quality**: Extracts `video_versions` to find higher max bitrate/resolution.
*   **Safety**: Uses User-Agent rotation and standard HTTP requests (No headless browser overhead).
*   **Batch & History**: Tracks downloads locally.
*   **Premium UI**: Dark mode, animations, progress tracking.

## Compliance
See `COMPLIANCE_CHECKLIST.md` for Play Store safety guidelines.
