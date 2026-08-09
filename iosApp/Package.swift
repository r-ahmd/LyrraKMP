// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "LyrraIOS",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .executable(
            name: "Lyrra",
            targets: ["Lyrra"]
        )
    ],
    targets: [
        .target(
            name: "Lyrra",
            path: "iosApp"
        )
    ]
)
