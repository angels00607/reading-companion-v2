import SwiftUI

struct Book: Identifiable, Codable, Equatable {
    var id = UUID()
    var title: String
    var author: String
    var status: ReadingStatus = .toRead
}
enum ReadingStatus: String, Codable, CaseIterable, Identifiable {
    case toRead = "To Read", reading = "Currently Reading", finished = "Finished", dnf = "DNF"
    var id: String { rawValue }
}
@MainActor final class BookStore: ObservableObject {
    @Published var books: [Book] = [] { didSet { save() } }
    private let url: URL
    init() {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        url = folder.appendingPathComponent("books.json")
        if let data = try? Data(contentsOf: url), let saved = try? JSONDecoder().decode([Book].self, from: data) { books = saved }
    }
    private func save() {
        guard let data = try? JSONEncoder().encode(books) else { return }
        try? data.write(to: url, options: .atomic)
    }
    func add(title: String, author: String) {
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        books.append(Book(title: t, author: author.trimmingCharacters(in: .whitespacesAndNewlines)))
    }
}
struct ContentView: View {
    @StateObject private var store = BookStore()
    var body: some View {
        TabView {
            ForEach(ReadingSection.allCases) { section in
                NavigationStack {
                    Group {
                        switch section {
                        case .home: HomeScreen().environmentObject(store)
                        case .library: LibraryScreen().environmentObject(store)
                        default: PlaceholderScreen(section: section)
                        }
                    }
                    .navigationTitle(section.rawValue)
                }
                .tabItem { Label(section.rawValue, systemImage: section.symbol) }
                .tint(section.accent)
            }
        }
        .tint(ReadingTheme.orchid)
    }
}
private struct HomeScreen: View {
    @EnvironmentObject var store: BookStore
    var body: some View {
        List {
            Section("Currently Reading") {
                let current = store.books.filter { $0.status == .reading }
                if current.isEmpty { Text("No books in progress yet.").foregroundStyle(.secondary) }
                ForEach(current) { book in BookRow(book: book) }
            }
            Section("To Read") {
                ForEach(store.books.filter { $0.status == .toRead }.prefix(5)) { book in BookRow(book: book) }
            }
        }
    }
}
private struct LibraryScreen: View {
    @EnvironmentObject var store: BookStore
    @State private var showAdd = false
    @State private var search = ""
    private var filtered: [Book] {
        store.books.filter { search.isEmpty || $0.title.localizedCaseInsensitiveContains(search) || $0.author.localizedCaseInsensitiveContains(search) }
    }
    var body: some View {
        List {
            ForEach(filtered) { book in
                NavigationLink { BookDetailScreen(bookID: book.id).environmentObject(store) } label: { BookRow(book: book) }
            }
            .onDelete { offsets in
                let visible = filtered
                for index in offsets { store.books.removeAll { $0.id == visible[index].id } }
            }
        }
        .searchable(text: $search)
        .toolbar { Button("Add Book", systemImage: "plus") { showAdd = true } }
        .sheet(isPresented: $showAdd) { AddBookScreen().environmentObject(store) }
        .overlay { if store.books.isEmpty { ContentUnavailableView("Your library is empty", systemImage: "books.vertical", description: Text("Add your first book to get started.")) } }
    }
}
private struct BookRow: View {
    let book: Book
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(book.title).font(.headline)
            Text(book.author.isEmpty ? "Unknown author" : book.author).font(.subheadline).foregroundStyle(.secondary)
            Text(book.status.rawValue).font(.caption).foregroundStyle(ReadingTheme.amethyst)
        }
    }
}
private struct BookDetailScreen: View {
    @EnvironmentObject var store: BookStore
    let bookID: UUID
    var body: some View {
        if let index = store.books.firstIndex(where: { $0.id == bookID }) {
            Form {
                TextField("Title", text: $store.books[index].title)
                TextField("Author", text: $store.books[index].author)
                Picker("Reading Status", selection: $store.books[index].status) {
                    ForEach(ReadingStatus.allCases) { status in Text(status.rawValue).tag(status) }
                }
            }
            .navigationTitle("Book Details")
        } else { ContentUnavailableView("Book not found", systemImage: "book") }
    }
}
private struct AddBookScreen: View {
    @EnvironmentObject var store: BookStore
    @Environment(\.dismiss) var dismiss
    @State private var title = ""
    @State private var author = ""
    var body: some View {
        NavigationStack {
            Form {
                TextField("Title", text: $title)
                TextField("Author", text: $author)
            }
            .navigationTitle("Add Book")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { store.add(title: title, author: author); dismiss() }
                        .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .frame(minWidth: 320, minHeight: 240)
    }
}
private struct PlaceholderScreen: View {
    let section: ReadingSection
    var body: some View {
        ContentUnavailableView("\(section.rawValue) coming soon", systemImage: section.symbol, description: Text("Your reading data will appear here in a future milestone."))
    }
}
