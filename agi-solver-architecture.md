# AGI Solver Mermaid Diagrams

## Why We Built This

The AGI Solver was built to bridge the gap between AI agents and blockchain interactions, enabling seamless execution of complex on-chain operations through AGI(Agent Generated Intent) processing. It empowers AI agents to interact with any on-chain protocol or smart contract reliably and efficiently, allowing them to focus on high-level decision-making and strategic reasoning while handling the technical complexities.

The solver acts as a critical middleware layer that processes and validates agent-generated intents, manages complex transaction flows across any on-chain protocol, provides retry mechanisms and error handling, and optimizes gas costs and execution strategies. This universal protocol support ensures dependable processing of agent-generated intents, enabling AI agents to concentrate on their core strengths while the solver handles all technical aspects of blockchain interactions.

## Future Improvements

Currently, we support token swaps as our core functionality. Our roadmap includes expanding to support more DeFi protocols, cross-chain operations, and more.

## System Architecture

```mermaid
graph TB
    %% Smart Contract Layer
    subgraph "Smart Contract Layer"
        Warehouse13[Warehouse13 Contract]
    end

    %% Events
    Events[AGIPublished Events]

    %% Solver Service Layer
    subgraph "Solver Service"
        EventListener[Event Listener]
        QueueManager[AGI Queue Manager]

        subgraph "Swap Engine"
            PriceFetcher[Price Fetcher]
            QuoteFetcher[Quote Fetcher]
            AllowanceManager[Allowance Manager]
            Permit2Signer[Permit2 Signer]
            TransactionSubmitter[Transaction Submitter]
            SwapExecutor[Swap Executor]
        end

        RetryLogic[Retry Logic]
    end

    %% External Services
    subgraph "External Services"
        ZeroExAPI[0x Protocol API]
        LifiAPI[LiFi API]
        FailedDB[Failed Swaps DB]
    end

    %% Order Flow
    Warehouse13 --> Events

    %% Event Processing
    Events --> EventListener
    EventListener --> QueueManager

    %% Queue Processing
    QueueManager --> SwapExecutor
    QueueManager --> RetryLogic

    %% Swap Engine Internal Flow
    SwapExecutor --> PriceFetcher
    SwapExecutor --> QuoteFetcher
    SwapExecutor --> AllowanceManager
    SwapExecutor --> Permit2Signer
    SwapExecutor --> TransactionSubmitter

    %% External API Calls
    PriceFetcher --> ZeroExAPI
    QuoteFetcher --> ZeroExAPI
    SwapExecutor --> LifiAPI
    SwapExecutor --> FailedDB

    %% Order Completion
    TransactionSubmitter --> Warehouse13

    %% Styling
    classDef contractLayer fill:#f3e5f5
    classDef serviceLayer fill:#e8f5e8
    classDef swapEngineLayer fill:#fff3e0
    classDef externalLayer fill:#ffebee

    class Warehouse13 contractLayer
    class EventListener,QueueManager,RetryLogic serviceLayer
    class PriceFetcher,QuoteFetcher,AllowanceManager,Permit2Signer,TransactionSubmitter,SwapExecutor swapEngineLayer
    class ZeroExAPI,LifiAPI,FailedDB externalLayer
```

## Order Processing Flow

```mermaid
sequenceDiagram
    participant A as AI Agent
    participant C as Contract
    participant E as Event Listener
    participant Q as Queue Manager
    participant S as Swap Engine
    participant Z as 0x API

    %% Order Publishing
    A->>C: publishAGI
    C->>E: AGIPublished Event

    %% Queue Management
    E->>Q: Add to Queue
    Q->>Q: Start Processing Loop

    %% Order Processing States
    Note over Q: State 0: PendingDispense
    Q->>C: withdrawAsset
    C->>Q: Status = 1

    Note over Q: State 1: DispensedPendingProceeds
    Q->>Q: Set Status = 3

    Note over Q: State 3: SwapInitiated
    Q->>S: Execute Swap
    S->>Z: Fetch Price Quote
    Z->>S: Return Quote
    S->>Z: Execute Swap Transaction
    Z->>S: Swap Result
    S->>Q: Set Status = 4

    Note over Q: State 4: SwapCompleted
    Q->>C: depositAsset
    C->>Q: Status = 2

    Note over Q: State 2: ProceedsReceived
    Q->>Q: Remove from Queue
    Q->>Q: Clean up State
```

## Order Status Flow

```mermaid
graph LR
    Start([*]) --> PendingDispense[PendingDispense<br/>Status 0]
    PendingDispense --> DispensedPendingProceeds[DispensedPendingProceeds<br/>Status 1]
    DispensedPendingProceeds --> SwapInitiated[SwapInitiated<br/>Status 3]
    SwapInitiated --> SwapCompleted[SwapCompleted<br/>Status 4]
    SwapInitiated --> Failed[Failed<br/>Max Retries]
    SwapCompleted --> ProceedsReceived[ProceedsReceived<br/>Status 2]
    ProceedsReceived --> Completed[Completed<br/>Order Complete]

    style Start fill:#000
    style Completed fill:#4CAF50
    style Failed fill:#f44336
```
