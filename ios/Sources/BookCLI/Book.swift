import Foundation
import BookCore

@main
struct BookCLI {
    static func main() async {
        let networkName = ProcessInfo.processInfo.environment["SUI_NETWORK"] ?? "testnet"
        guard let network = SuiNetwork(rawValue: networkName) else {
            let valid = SuiNetwork.allCases.map { $0.rawValue }.joined(separator: ", ")
            FileHandle.standardError.write(Data(
                "[book] Unknown SUI_NETWORK=\"\(networkName)\". Valid: \(valid)\n".utf8
            ))
            exit(1)
        }

        let client = BookSuiClient(network: network)
        do {
            let snapshot = try await client.snapshot()
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(snapshot)
            print(String(decoding: data, as: UTF8.self))
        } catch {
            FileHandle.standardError.write(Data("[book] fatal: \(error)\n".utf8))
            exit(1)
        }
    }
}
