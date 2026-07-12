// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PriceTracker
 * @dev An on-chain "Product Price History Tracker" smart contract.
 *
 * Business Rules:
 * 1. Any wallet address can register a new Product.
 * 2. When a product is registered, its first price is recorded as the
 *    initial entry in that product's price history.
 * 3. Only the original registrant of a product (the "seller", i.e. the
 *    msg.sender at registration time) is allowed to update that product's
 *    price. This prevents other addresses from impersonating the seller
 *    and tampering with the price history.
 * 4. Every price update is appended to the product's price history array.
 *    History entries can never be deleted or modified, guaranteeing that
 *    the price evolution of a product is transparent and fully auditable
 *    on-chain.
 * 5. Anyone can query the details and full price history of any product
 *    (read-only, no permission required).
 */
contract PriceTracker {
    /// @dev A single price record entry.
    struct PriceRecord {
        uint256 price;      // The price value (store in the smallest unit, e.g. wei or cents; precision is agreed upon off-chain by the frontend)
        uint256 timestamp;  // The block timestamp at which this price was recorded
    }

    /// @dev Basic information about a registered product.
    struct Product {
        uint256 id;             // Unique product identifier (starts at 1)
        string name;            // Product name
        string description;     // Product description
        address seller;         // Address of the seller who registered the product (the only address allowed to update its price)
        uint256 createdAt;      // Block timestamp when the product was registered
        bool exists;            // Used to check whether a product with this id has been registered
    }

    /// @dev The next product id to be assigned. Starts at 1; 0 is reserved as a sentinel value meaning "does not exist".
    uint256 private nextProductId = 1;

    /// @dev Maps a productId to its basic Product information.
    mapping(uint256 => Product) private products;

    /// @dev Maps a productId to its full array of historical price records.
    mapping(uint256 => PriceRecord[]) private priceHistories;

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
        uint256 timestamp
    );

    /// @dev Emitted whenever a product's price is updated. The frontend can listen for this event to update the price history in real time.
    event PriceUpdated(
        uint256 indexed productId,
        address indexed seller,
        uint256 newPrice,
        uint256 timestamp
    );

    // ------------------------- Modifiers -------------------------

    /// @dev Ensures that the given productId corresponds to a product that has actually been registered.
    modifier productExists(uint256 productId) {
        require(products[productId].exists, "Product does not exist");
        _;
    }

    /// @dev Ensures that the caller is the original registrant (seller) of the product, since only the seller may update its price.
    modifier onlySeller(uint256 productId) {
        require(
            products[productId].seller == msg.sender,
            "Only the registered seller can update the price"
        );
        _;
    }

    // ------------------------- External / Public Functions -------------------------

    /**
     * @notice Registers a new product and records its initial price as the first entry of its price history.
     * @param name The product name (must not be empty)
     * @param description The product description (may be an empty string)
     * @param initialPrice The product's initial price (must be greater than 0)
     * @return productId The unique identifier assigned to the newly registered product
     */
    function registerProduct(
        string calldata name,
        string calldata description,
        uint256 initialPrice
    ) external returns (uint256 productId) {
        require(bytes(name).length > 0, "Product name cannot be empty");
        require(initialPrice > 0, "Initial price must be greater than 0");

        productId = nextProductId;
        nextProductId += 1;

        products[productId] = Product({
            id: productId,
            name: name,
            description: description,
            seller: msg.sender,
            createdAt: block.timestamp,
            exists: true
        });

        priceHistories[productId].push(
            PriceRecord({price: initialPrice, timestamp: block.timestamp})
        );

        productIds.push(productId);
        sellerProducts[msg.sender].push(productId);

        emit ProductRegistered(
            productId,
            msg.sender,
            name,
            initialPrice,
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

    // ------------------------- View Functions -------------------------

    /**
     * @notice Returns the basic information of a product.
     * @param productId The id of the target product
     */
    function getProduct(uint256 productId)
        external
        view
        productExists(productId)
        returns (
            uint256 id,
            string memory name,
            string memory description,
            address seller,
            uint256 createdAt
        )
    {
        Product storage p = products[productId];
        return (p.id, p.name, p.description, p.seller, p.createdAt);
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
