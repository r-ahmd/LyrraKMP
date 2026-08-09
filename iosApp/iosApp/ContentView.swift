import SwiftUI
import SharedFramework

struct ContentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "music.note.house.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 80, height: 80)
                .foregroundColor(.purple)
            
            Text("Lyrra v1.0.3")
                .font(.largeTitle)
                .bold()
            
            Text("Listen Together & Music Player")
                .font(.headline)
                .foregroundColor(.secondary)
            
            Spacer()
        }
        .padding()
    }
}
