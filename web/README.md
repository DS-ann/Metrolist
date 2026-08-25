# Metrolist Web

A web/PWA frontend and server for Metrolist. This is a separate web implementation inside the existing repository; the Android application remains unchanged.

## Goals

- Metrolist-style music UI
- YouTube Music search, browsing and library integration
- Server-side session handling
- Browser audio playback
- Media Session API for lock-screen/background controls
- Installable PWA

## Deliberately excluded

Offline downloads, Android widgets, Android Auto, equalizer/tempo-pitch processing, listen-together, and Android-specific APIs.

## Architecture

`web/` contains the browser application. `web/server/` will contain the server-side InnerTube adapter and authentication/session boundary. Sensitive authentication state must remain server-side.

The initial implementation intentionally does not attempt to port the Android/JVM InnerTubeX library into the browser. The server adapter will reproduce only the required protocol surface and can be maintained independently as YouTube changes.
