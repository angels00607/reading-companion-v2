# Reading Companion — iPhone ChatGPT connectivity probe

**Isolated feasibility experiment.** This is not Reading Companion V3 and does not touch the library or Supabase data.

## Objective
Determine whether official Sign in with ChatGPT plan usage supports a native, user-installed iPhone application. A local iOS app is **not automatically eligible**; an Electron/desktop loopback example is not evidence that native iOS works.

## What's implemented
A SwiftUI iPhone app shell that presents the three test stages, opens the official documentation, and clearly reports that authorization and inference have **not** been implemented or verified. No misleading fake login, no API keys, no tokens.

## On a Mac
1. Install Xcode and create a new iOS App project named `RCChatGPTProbe` (SwiftUI, Swift).
2. Replace the generated app entrypoint and main view with `RCChatGPTProbeApp.swift` and `ContentView.swift` in this folder.
3. Run in iPhone simulator, then on your personal iPhone with Xcode signing.
4. Check the latest official documentation for whether a native iOS redirect URI, OAuth client registration and ChatGPT plan usage permission are supported.
5. **Only if supported:** implement the real OAuth PKCE flow using `ASWebAuthenticationSession`, secure credential storage in Keychain, and an authenticated test inference request, according to the officially supported flow.
6. Mark the test successful **only after** real consent and a real response are verified on the iPhone.

## Official documentation
https://developers.openai.com/siwc/quickstart

## Safety
Never commit access tokens, refresh tokens, passwords or paid API keys. Do not send ChatGPT credentials to Supabase. Do not assume ChatGPT Plus API access without explicit eligible authorization. Keep the existing V2/V3 deployments and databases intact.
