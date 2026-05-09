import Foundation
import SuiKit

public enum SuiNetwork: String, Sendable, CaseIterable {
    case mainnet, testnet, devnet, localnet

    public func makeConnection() -> any ConnectionProtocol {
        switch self {
        case .mainnet:  return MainnetConnection()
        case .testnet:  return TestnetConnection()
        case .devnet:   return DevnetConnection()
        case .localnet: return LocalnetConnection()
        }
    }
}

public struct ChainSnapshot: Codable, Sendable, Equatable {
    public let network: String
    public let chainId: String
    public let latestCheckpoint: String
    public let checkpointTimestampMs: String?
    public let referenceGasPrice: String

    public init(
        network: String,
        chainId: String,
        latestCheckpoint: String,
        checkpointTimestampMs: String?,
        referenceGasPrice: String
    ) {
        self.network = network
        self.chainId = chainId
        self.latestCheckpoint = latestCheckpoint
        self.checkpointTimestampMs = checkpointTimestampMs
        self.referenceGasPrice = referenceGasPrice
    }
}

public struct BookSuiClient {
    public let network: SuiNetwork
    public let provider: SuiProvider

    public init(network: SuiNetwork = .testnet) {
        self.network = network
        self.provider = SuiProvider(connection: network.makeConnection())
    }

    public func snapshot() async throws -> ChainSnapshot {
        async let chainId = provider.getChainIdentifier()
        async let latestSeq = provider.getLatestCheckpointSequenceNumber()
        async let refGas = provider.getReferenceGasPrice()
        let (id, seq, gas) = try await (chainId, latestSeq, refGas)
        let checkpoint = try await provider.getCheckpoint(id: seq)
        return ChainSnapshot(
            network: network.rawValue,
            chainId: id,
            latestCheckpoint: seq,
            checkpointTimestampMs: checkpoint.timestampMs,
            referenceGasPrice: String(describing: gas)
        )
    }
}
