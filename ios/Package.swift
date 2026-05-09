// swift-tools-version: 6.3
// Swift package for the `book` Sui experiments.
//
// Targets:
//   - BookCore  → library, iOS+macOS portable, wraps SuiKit + DeepBook calls.
//                 The iOS App target (added later in Xcode) will link this.
//   - BookCLI   → macOS executable, smoke test: `swift run book-cli`.
//
// Note: language mode is .v5 because SuiKit 1.4.0 predates Swift 6's strict
// concurrency model. Revisit once SuiKit ships Sendable conformances.
import PackageDescription

let package = Package(
    name: "Book",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    products: [
        .library(name: "BookCore", targets: ["BookCore"]),
        .executable(name: "book-cli", targets: ["BookCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/opendive/SuiKit.git", from: "1.4.0"),
    ],
    targets: [
        .target(
            name: "BookCore",
            dependencies: [
                .product(name: "SuiKit", package: "SuiKit"),
            ]
        ),
        .executableTarget(
            name: "BookCLI",
            dependencies: ["BookCore"]
        ),
    ],
    swiftLanguageModes: [.v5]
)
