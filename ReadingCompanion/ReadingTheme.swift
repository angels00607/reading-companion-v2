import SwiftUI

enum ReadingSection: String, CaseIterable, Identifiable {
    case home = "Home", library = "Library", journal = "Journal", challenges = "Challenges", statistics = "Statistics"
    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .home: "house"
        case .library: "books.vertical"
        case .journal: "book.closed"
        case .challenges: "flag"
        case .statistics: "chart.bar"
        }
    }
    var accent: Color {
        switch self {
        case .home: ReadingTheme.orchid
        case .library: ReadingTheme.amethyst
        case .journal: ReadingTheme.dustyRose
        case .challenges: ReadingTheme.oceanBlue
        case .statistics: ReadingTheme.marine
        }
    }
}

enum ReadingTheme {
    static let orchid = Color(hex: 0x8364AC)
    static let amethyst = Color(hex: 0x695080)
    static let dustyRose = Color(hex: 0xB76C9D)
    static let oceanBlue = Color(hex: 0x417CA5)
    static let marine = Color(hex: 0x315C87)
    static let lightBackground = Color(hex: 0xF7F9FC)
    static let darkBackground = Color(hex: 0x101A2A)
    static let darkCard = Color(hex: 0x1C2A3D)
    static let lightText = Color(hex: 0x1D2B42)
    static let darkText = Color(hex: 0xF3F5FA)
}

private extension Color {
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 255) / 255,
                  green: Double((hex >> 8) & 255) / 255,
                  blue: Double(hex & 255) / 255, opacity: 1)
    }
}
