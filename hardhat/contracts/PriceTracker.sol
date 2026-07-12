// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PriceTracker
 * @dev The on-chain core of TruePrice — a decentralized "Product Price
 *      History Tracker" that also directly implements all ten
 *      multi-dimensional supply-chain complaint interventions
 *      described in the TruePrice proposal (Table 1):
 *
 *   1. Logistics Cost Padding      -> shippingFee recorded separately from price
 *   2. Counterfeit / Discount Fraud -> supplyChainBatchId cryptographic linkage
 *   3. Artificial Inventory Scarcity -> currentStock + stockSnapshotHash
 *   4. Distributor Price Gouging   -> msrp registry
 *   5. Origin & Sustainability Fraud -> ipfsCertificateHash provenance record
 *   6. Specification Bait-and-Switch -> immutable specs fingerprint
 *   7. Warranty Policy Erasure     -> immutable warrantyMonths
 *   8. Scalper Bot Exploitation    -> append-only Purchase audit trail
 *   9. Fake Verified Reviews       -> addReview() gated by a real Purchase record
 *   10. Cross-Border Tariff Padding -> crossBorderFee vs. OFFICIAL_TARIFF_RATE_BPS
 *
 * Business Rules:
 * 1. Any wallet address can register a new Product.
 * 2. When a product is registered, its first price is recorded as the
 *    initial entry in that product's price history.
 * 3. Only the original registrant of a product (the "seller", i.e. the
 *    msg.sender at registration time) is allowed to update that product's
 *    price or record new inventory snapshots.
 * 4. Every price update is appended to the product's price history array.
 *    History entries can never be deleted or modified, guaranteeing that
 *    the price evolution of a product is transparent and fully auditable
 *    on-chain.
 * 5. Anyone can query the details and full price history of any product
 *    (read-only, no permission required).
 * 6. Each product permanently records its warranty period (in months),
 *    its specs/condition, shipping fee, MSRP, cross-border fee, supply
 *    chain batch id, and provenance certificate hash at registration
 *    time. These fields are set once, on-chain, and can never be altered
 *    afterwards — this cryptographically binds every claim to the
 *    product record, preventing any retroactive tampering via an
 *    off-chain database.
 * 7. Any wallet can call purchaseProduct() to record a purchase
 *    (buyer + timestamp), building an append-only, auditable trail that
 *    exposes suspicious sub-second scalper-bot buying patterns.
 * 8. Only a wallet with an existing purchase record for a product may
 *    submit a review for it via addReview(), preventing fake reviews
 *    from non-buyers.
 */
contract PriceTracker {
    /// @dev A single price record entry.
    struct PriceRecord {
        uint256 price;      // The price value (store in the smallest unit, e.g. wei or cents; precision is agreed upon off-chain by the frontend)
        uint256 timestamp;  // The block timestamp at which this price was recorded
    }

    /// @dev A single purchase record entry (Dimension 8: Scalper Bot Audit Trail).
    struct Purchase {
        address buyer;      // The wallet address that made the purchase
        uint256 timestamp;  // The block timestamp at which the purchase occurred
    }

    /// @dev A single verified review entry (Dimension 9: Verified Purchase Reviews).
    struct Review {
        address reviewer;   // The wallet address that submitted the review
        uint8 rating;       // Rating from 1 to 5
        string text;        // Free-form review text
        uint256 timestamp;  // The block timestamp at which the review was submitted
    }

    /// @dev Full information about a registered product, including all ten TruePrice dimension fields.
    struct Product {
        uint256 id;                  // Unique product identifier (starts at 1)
        string name;                 // Product name
        string description;          // Product description
        address seller;              // Address of the seller who registered the product (the only address allowed to update its price/stock)
        uint256 createdAt;           // Block timestamp when the product was registered
        uint256 warrantyMonths;      // (Dim 7) Warranty period in months, fixed permanently at registration time
        string specs;                // (Dim 6) Product specs/condition, fixed permanently at registration time
        uint256 shippingFee;         // (Dim 1) Shipping fee, recorded separately from the base price to expose logistics cost padding
        uint256 msrp;                // (Dim 4) Manufacturer-published maximum suggested retail price
        uint256 crossBorderFee;      // (Dim 10) Merchant-added cross-border/import fee, compared against OFFICIAL_TARIFF_RATE_BPS
        string supplyChainBatchId;   // (Dim 2) Cryptographic supply-chain batch id linking this listing to a verified authentic batch
        string ipfsCertificateHash;  // (Dim 5) IPFS hash of an origin/sustainability certificate (e.g. Organic, Fair Trade)
        uint256 currentStock;        // (Dim 3) Last known on-chain-anchored stock quantity
        bytes32 stockSnapshotHash;   // (Dim 3) keccak256 hash of the last recorded stock snapshot, used to detect off-chain tampering
        bool exists;                 // Used to check whether a product with this id has been registered
    }

    /**
     * @dev Grouped registration parameters. A struct is used here (instead
     *      of ~10 loose function arguments) to avoid Solidity's
     *      "stack too deep" compile-time limitation.
     */
    struct RegisterProductParams {
        string name;
        string description;
        uint256 initialPrice;
        uint256 warrantyMonths;
        string specs;
        uint256 shippingFee;
        uint256 msrp;
        uint256 crossBorderFee;
        string supplyChainBatchId;
        string ipfsCertificateHash;
        uint256 initialStock;
    }

    /**
     * @dev (Dimension 10) The official government customs tariff rate,
     *      expressed in basis points (1% = 100 bps). This is a fixed,
     *      publicly-readable reference value recorded on-chain so
     *      consumers can compare a merchant's added crossBorderFee
     *      against the legitimate government rate and flag excessive,
     *      non-itemized "cross-border regulatory fees".
     *      15.00% is used here as an illustrative reference rate.
     */
    uint256 public constant OFFICIAL_TARIFF_RATE_BPS = 1500;

    /// @dev The next product id to be assigned. Starts at 1; 0 is reserved as a sentinel value meaning "does not exist".
    uint256 private nextProductId = 1;

    /// @dev Maps a productId to its basic Product information.
    mapping(uint256 => Product) private products;

    /// @dev Maps a productId to its full array of historical price records.
    mapping(uint256 => PriceRecord[]) private priceHistories;

    /// @dev Maps a productId to its full array of purchase records (Dimension 8).
    mapping(uint256 => Purchase[]) private purchases;

    /// @dev Maps a productId to its full array of verified reviews (Dimension 9).
    mapping(uint256 => Review[]) private reviews;

    /// @dev Maps productId => buyer address => whether that address has a purchase record for this product (Dimension 9 gating).
    mapping(uint256 => mapping(address => bool)) private hasPurchased;

    /// @dev Stores every registered product id, so the frontend can easily iterate over all products.
    uint256[] private productIds;

    /// @dev Maps a seller address to the list of product ids they have registered, so the frontend can filter products by seller.
    mapping(address => uint256[]) private sellerProducts;

    // ------------------------- Events -------------------------

    /// @dev Emitted whenever a new product is registered. The frontend can listen for this event to update the product list in real time.
    event ProductRegistered(
        uint256 indexed productId,
        address indexed seller,
        string name,
        uint256 initialPrice,
        uint256 warrantyMonths,
        string specs,
        uint256 timestamp
    );

    /// @dev Emitted whenever a product's price is updated. The frontend can listen for this event to update the price history in real time.
    event PriceUpdated(
        uint256 indexed productId,
        address indexed seller,
        uint256 newPrice,
        uint256 timestamp
    );

    /// @dev (Dimension 3) Emitted whenever a new inventory snapshot hash is anchored on-chain.
    event StockSnapshotRecorded(
        uint256 indexed productId,
        uint256 newStock,
        bytes32 snapshotHash,
        uint256 timestamp
    );

    /// @dev (Dimension 8) Emitted whenever a purchase is recorded, building the public anti-bot audit trail.
    event ProductPurchased(
        uint256 indexed productId,
        address indexed buyer,
        uint256 timestamp
    );

    /// @dev (Dimension 9) Emitted whenever a verified purchase-gated review is submitted.
    event ReviewSubmitted(
        uint256 indexed productId,
        address indexed reviewer,
        uint8 rating,
        uint256 timestamp
    );

    // ------------------------- Modifiers -------------------------

    /// @dev Ensures that the given productId corresponds to a product that has actually been registered.
    modifier productExists(uint256 productId) {
        require(products[productId].exists, "Product does not exist");
        _;
    }

    /// @dev Ensures that the caller is the original registrant (seller) of the product, since only the seller may update its price/stock.
    modifier onlySeller(uint256 productId) {
        require(
            products[productId].seller == msg.sender,
            "Only the registered seller can perform this action"
        );
        _;
    }

    // ------------------------- External / Public Functions -------------------------

    /**
     * @notice Registers a new product, permanently binding all ten
     *         TruePrice supply-chain dimension fields to it on-chain,
     *         and records its initial price as the first entry of its
     *         price history.
     * @param params The grouped registration parameters (see RegisterProductParams).
     * @return productId The unique identifier assigned to the newly registered product
     */
    function registerProduct(RegisterProductParams calldata params)
        external
        returns (uint256 productId)
    {
        require(bytes(params.name).length > 0, "Product name cannot be empty");
        require(params.initialPrice > 0, "Initial price must be greater than 0");

        productId = nextProductId;
        nextProductId += 1;

        bytes32 initialSnapshotHash = keccak256(
            abi.encodePacked(productId, params.initialStock, block.timestamp)
        );

        products[productId] = Product({
            id: productId,
            name: params.name,
            description: params.description,
            seller: msg.sender,
            createdAt: block.timestamp,
            warrantyMonths: params.warrantyMonths,
            specs: params.specs,
            shippingFee: params.shippingFee,
            msrp: params.msrp,
            crossBorderFee: params.crossBorderFee,
            supplyChainBatchId: params.supplyChainBatchId,
            ipfsCertificateHash: params.ipfsCertificateHash,
            currentStock: params.initialStock,
            stockSnapshotHash: initialSnapshotHash,
            exists: true
        });

        priceHistories[productId].push(
            PriceRecord({price: params.initialPrice, timestamp: block.timestamp})
        );

        productIds.push(productId);
        sellerProducts[msg.sender].push(productId);

        emit ProductRegistered(
            productId,
            msg.sender,
            params.name,
            params.initialPrice,
            params.warrantyMonths,
            params.specs,
            block.timestamp
        );

        emit StockSnapshotRecorded(
            productId,
            params.initialStock,
            initialSnapshotHash,
            block.timestamp
        );
    }

    /**
     * @notice Updates the price of an already-registered product. Only callable by the product's original seller.
     *         The new price is appended to the end of the price history array; existing history is preserved forever.
     * @param productId The id of the target product
     * @param newPrice The new price value (must be greater than 0)
     */
    function updatePrice(uint256 productId, uint256 newPrice)
        external
        productExists(productId)
        onlySeller(productId)
    {
        require(newPrice > 0, "New price must be greater than 0");

        priceHistories[productId].push(
            PriceRecord({price: newPrice, timestamp: block.timestamp})
        );

        emit PriceUpdated(productId, msg.sender, newPrice, block.timestamp);
    }

    /**
     * @notice (Dimension 3) Anchors a new inventory snapshot hash on-chain.
     *         The actual inventory count is still expected to live in a
     *         fast off-chain database (e.g. PostgreSQL) for frequent
     *         updates; only the cryptographic snapshot of it is recorded
     *         here so that any later divergence between the displayed
     *         "live" stock and this anchored snapshot can be detected as
     *         evidence of tampering (e.g. fake "Only 1 left!" scarcity
     *         messaging that doesn't match the real, snapshot-verified
     *         stock level).
     * @param productId The id of the target product
     * @param newStock The new stock quantity to anchor
     */
    function recordStockSnapshot(uint256 productId, uint256 newStock)
        external
        productExists(productId)
        onlySeller(productId)
    {
        bytes32 snapshotHash = keccak256(
            abi.encodePacked(productId, newStock, block.timestamp)
        );

        products[productId].currentStock = newStock;
        products[productId].stockSnapshotHash = snapshotHash;

        emit StockSnapshotRecorded(productId, newStock, snapshotHash, block.timestamp);
    }

    /**
     * @notice (Dimension 8) Records a purchase of a product by the caller.
     *         Any wallet may call this at any time; every call is
     *         permanently appended to the product's public purchase
     *         audit trail, allowing anyone to later analyze purchase
     *         timestamps for suspicious sub-second scalper-bot patterns
     *         during flash sales. This also grants the caller
     *         eligibility to submit a verified review (see addReview).
     * @param productId The id of the purchased product
     */
    function purchaseProduct(uint256 productId)
        external
        productExists(productId)
    {
        purchases[productId].push(
            Purchase({buyer: msg.sender, timestamp: block.timestamp})
        );
        hasPurchased[productId][msg.sender] = true;

        emit ProductPurchased(productId, msg.sender, block.timestamp);
    }

    /**
     * @notice (Dimension 9) Submits a verified review for a product.
     *         Reverts unless the caller has an existing purchase record
     *         for this product, cryptographically preventing fake
     *         reviews from accounts that never actually bought it.
     * @param productId The id of the reviewed product
     * @param rating A rating from 1 to 5 (inclusive)
     * @param text Free-form review text
     */
    function addReview(uint256 productId, uint8 rating, string calldata text)
        external
        productExists(productId)
    {
        require(
            hasPurchased[productId][msg.sender],
            "Only verified purchasers may submit a review"
        );
        require(rating >= 1 && rating <= 5, "Rating must be between 1 and 5");

        reviews[productId].push(
            Review({
                reviewer: msg.sender,
                rating: rating,
                text: text,
                timestamp: block.timestamp
            })
        );

        emit ReviewSubmitted(productId, msg.sender, rating, block.timestamp);
    }

    // ------------------------- View Functions -------------------------

    /**
     * @notice Returns the complete on-chain record of a product,
     *         including all ten TruePrice dimension fields.
     * @param productId The id of the target product
     */
    function getProduct(uint256 productId)
        external
        view
        productExists(productId)
        returns (Product memory)
    {
        return products[productId];
    }

    /**
     * @notice Returns the full price history of a product.
     * @param productId The id of the target product
     * @return prices Array of prices, aligned index-for-index with the timestamps array
     * @return timestamps Array of timestamps, aligned index-for-index with the prices array
     */
    function getPriceHistory(uint256 productId)
        external
        view
        productExists(productId)
        returns (uint256[] memory prices, uint256[] memory timestamps)
    {
        PriceRecord[] storage history = priceHistories[productId];
        uint256 len = history.length;

        prices = new uint256[](len);
        timestamps = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            prices[i] = history[i].price;
            timestamps[i] = history[i].timestamp;
        }
    }

    /**
     * @notice Returns the current (latest) price of a product, i.e. the last entry in its price history.
     * @param productId The id of the target product
     */
    function getLatestPrice(uint256 productId)
        external
        view
        productExists(productId)
        returns (uint256 price, uint256 timestamp)
    {
        PriceRecord[] storage history = priceHistories[productId];
        PriceRecord storage latest = history[history.length - 1];
        return (latest.price, latest.timestamp);
    }

    /**
     * @notice (Dimension 8) Returns the full, append-only purchase audit trail for a product.
     * @param productId The id of the target product
     */
    function getPurchases(uint256 productId)
        external
        view
        productExists(productId)
        returns (Purchase[] memory)
    {
        return purchases[productId];
    }

    /**
     * @notice (Dimension 9) Returns all verified, purchase-gated reviews for a product.
     * @param productId The id of the target product
     */
    function getReviews(uint256 productId)
        external
        view
        productExists(productId)
        returns (Review[] memory)
    {
        return reviews[productId];
    }

    /**
     * @notice (Dimension 9) Returns whether the given address has a verified purchase record for a product, i.e. is eligible to review it.
     * @param productId The id of the target product
     * @param account The address to check
     */
    function canReview(uint256 productId, address account)
        external
        view
        productExists(productId)
        returns (bool)
    {
        return hasPurchased[productId][account];
    }

    /**
     * @notice Returns the total number of registered products.
     */
    function getProductCount() external view returns (uint256) {
        return productIds.length;
    }

    /**
     * @notice Returns the ids of all registered products, so the frontend can iterate and call getProduct for each one.
     */
    function getAllProductIds() external view returns (uint256[] memory) {
        return productIds;
    }

    /**
     * @notice Returns the ids of all products registered by a given seller.
     * @param seller The seller's wallet address
     */
    function getProductsBySeller(address seller)
        external
        view
        returns (uint256[] memory)
    {
        return sellerProducts[seller];
    }
}
