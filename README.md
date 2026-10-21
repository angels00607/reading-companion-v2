# Reading Companion V2

Native SwiftUI app for iPhone and Mac.

## Principles
- One app, shared code, five sections: Home, Library, Journal, Challenges and Statistics.
- Ocean & Orchid visual identity: purple 50%, blue 30%, pink 20% of accent usage.
- Start small. No unnecessary frameworks or elaborate synchronization engine.
- No Xcode installation required for the project owner: development and build checks happen on GitHub.

## What works so far
- Local library: add, search, update reading status, and remove books.
- Data persists locally in the app support directory on each device.
- Navigation across the five sections.

## Not yet implemented
Cloud account and iPhone ↔ Mac synchronization, Journal, Challenges, Statistics, Apple-signed distribution.

## Development
The GitHub Actions workflow builds the shared SwiftUI target for macOS and iOS Simulator using the hosted macOS environment. This is a CI check, not an installable signed app.

## Next milestone
Supabase Auth with user-scoped books and RLS, then safe Sync Now and automatic refresh. Never put a Supabase service-role key in the app.
