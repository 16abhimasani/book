# iOS — building on Sui from Swift

Notes on what's actually feasible for a mobile-Sui app in 2026, what we
chose, and what we're deferring.

## SDK choice: SuiKit (community)

**Why not Mysten official:** As of writing, Mysten doesn't ship an
official Swift SDK. The closest official artifact is the GraphQL schema
(`docs.sui.io/references/sui-api/sui-graphql`), which a Swift client can
consume directly via apollo-ios, but that's a "build it yourself" path.

**Why SuiKit over alternatives:**
- Native Swift, native BCS encoding (no JS bridge, no FFI shim)
- Supports zkLogin natively (`Utils/zkLogin/` in their source) — this is
  the same primitive Enoki uses under the hood, so we don't lose
  Sign-in-with-Google as an option
- Uses `apollo-ios` for GraphQL, so we get both REST-style RPC (via
  `SuiProvider`) and GraphQL (via `GraphQLSuiProvider`)
- iOS 17+ / macOS 14+ minimum platforms — modern Swift only
- v1.4.0 (December 2025), under active maintenance by OpenDive

**Alternatives we passed on:**
- **Roll our own RPC client.** Not impossible (Sui RPC is JSON-RPC over
  HTTP) but BCS encoding for transaction payloads is non-trivial and
  zkLogin signature construction even more so. SuiKit gives us all of
  this for free.
- **JavaScriptCore bridge to `@mysten/sui`.** Theoretically possible
  (run the TS SDK in `JSContext`) but adds runtime weight and breaks
  Swift type safety. Reserved as a fallback if SuiKit hits a gap we
  can't patch.
- **WKWebView wrapping Enoki.** Reasonable for the OAuth callback step
  specifically; not a full-app strategy.

## zkLogin path on iOS (Enoki has no Swift SDK)

[Enoki](https://docs.enoki.mystenlabs.com/) is Mysten's hosted layer for
sign-in + sponsored gas, but the docs only mention a TypeScript SDK and
HTTP API. **No native iOS SDK exists.** Our options:

1. **Direct to Mysten services from Swift** *(preferred for the sandbox)*
   - iOS handles Google/Apple OAuth → JWT
   - SuiKit's `ZkLoginAuthenticator` constructs the proof request
   - POST JWT + ephemeral key to the public Mysten zkLogin prover
     - Testnet: `https://prover.testnet.sui.io/v1`
     - Devnet:  `https://prover-dev.mystenlabs.com/v1`
   - SuiKit assembles the resulting signature for transactions
   - Sponsored gas: hit a public gas station endpoint (TBD which one)
     or skip and use user-funded gas on testnet
   - **Pros:** Pure Swift, no extra moving parts.
   - **Cons:** We own the OAuth callback wiring; rate-limited prover.
2. **Tiny TypeScript backend wrapping Enoki**
   - iOS POSTs JWT → backend's `/zklogin` → backend uses Enoki SDK to
     mint proof + return signature
   - Same pattern for sponsored transactions: iOS sends serialized PTB,
     backend sponsors via Enoki, returns sponsored bytes
   - **Pros:** Production-ready; Enoki handles proving + sponsoring.
   - **Cons:** Backend to operate; per-request cost; deployment surface.
3. **WKWebView for the OAuth dance only**
   - Useful for completing Google's OAuth flow if direct ASWebAuthenticationSession
     proves awkward. Niche; not a primary architecture.

We're taking **path 1** for the learning sandbox; **path 2** is the
production upgrade once we ship.

## Xcode prerequisite

`Xcode.app` is installed at `/Applications/Xcode.app` but `xcode-select`
points at the Command Line Tools. To unlock `xcodebuild`, the iOS
Simulator (`simctl`), and iOS-target builds, run **once**:

```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Until that's done, the CLT Swift toolchain (Swift 6.3.1) still compiles
this Swift package for **macOS** — that's enough to validate SuiKit
against the live network. iOS-targeted builds and Simulator work require
the switch.

## Layout

```
ios/
├── Package.swift             # SwiftPM manifest, SuiKit dep
├── Sources/
│   ├── BookCore/             # iOS+macOS portable library
│   │   └── SuiClient.swift   # Sui network client wrapper
│   └── BookCLI/              # macOS executable (smoke test)
│       └── Book.swift        # @main entry
└── (later) App/              # iOS App target — added once Xcode is wired
```

## Build + run

```sh
cd ios

# Build everything (BookCore + BookCLI)
swift build

# Run the smoke test against Sui testnet (default)
swift run book-cli

# Override network
SUI_NETWORK=devnet swift run book-cli

# Once xcode-select is switched, iOS Simulator builds become available:
# DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
#   xcodebuild -scheme book-cli -destination "platform=iOS Simulator,name=iPhone 15"
```

## Open questions for the iOS App phase

- **Sign-in primitive** — Sign in with Apple (cleanest UX, App Store
  preferred) vs Google (broader audience, Audric uses it). zkLogin
  supports both as OIDC providers.
- **Key storage** — derive the ephemeral zkLogin key per session (no
  persistence) vs store a long-lived seed in Keychain / Secure Enclave
  for pure-key wallets.
- **Tx confirmation UX** — every write tap-to-confirm with Face ID
  (Audric's pattern) vs a single session unlock + auto-sign for low-value
  reads. For prediction-market positions, per-tx confirm is right.
- **Push notifications** — market settlement / liquidation alerts. APNs
  + a small backend. Defer until there's a reason.
- **App Clips** — could ship a "preview a market without installing"
  experience. Differentiator but adds review surface.
- **Deep linking** — handle `sui://` and OAuth callback URIs.
- **Sponsored gas at scale** — testnet works user-funded; mainnet UX
  requires sponsorship infra (path 2 above).

## App Store reality check

Apple historically gates anything resembling gambling, derivatives, or
unregulated financial trading. Polymarket's iOS app was pulled in 2024.
Kalshi navigates this by being CFTC-regulated. For DeepBook Predict on
mainnet, the relevant gauntlets are:
- App Store Review Guidelines §1.4.6 (high-risk financial trading)
- §5.3 (gaming, gambling)
- §3.1.5 (digital currency / cryptocurrency)

For a learning sandbox on testnet, none of this binds — there's no
public release. For a future TestFlight, we'd need a clear story:
"educational simulator with testnet assets" sidesteps gambling
guidelines; mainnet may not.
