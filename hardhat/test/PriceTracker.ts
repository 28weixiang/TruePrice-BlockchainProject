import { expect } from 'chai';
import { network } from 'hardhat';

/**
 * Test suite for the PriceTracker smart contract.
 *
 * These tests run against Hardhat's in-memory EDR network (a local
 * simulated Ethereum node) and cover all ten TruePrice supply-chain
 * dimensions implemented directly on-chain:
 *
 * 1. Logistics Cost Padding    -> shippingFee stored separately from price
 * 2. Batch Linkage             -> supplyChainBatchId
 * 3. Inventory Snapshots       -> currentStock + stockSnapshotHash / recordStockSnapshot
 * 4. MSRP Registry             -> msrp
 * 5. Provenance Certificates   -> ipfsCertificateHash
 * 6. Specification Fingerprint -> specs (immutable)
 * 7. Warranty Erasure Protection -> warrantyMonths (immutable)
 * 8. Scalper Bot Audit Trail   -> purchaseProduct / getPurchases
 * 9. Verified Reviews          -> addReview gated by purchase record
 * 10. Cross-Border Tariff Cushion -> crossBorderFee vs OFFICIAL_TARIFF_RATE_BPS
 */
describe('PriceTracker', function () {
  async function deployFixture() {
    const { ethers } = await network.getOrCreate();

    const [seller, buyer, otherSeller, otherBuyer] = await ethers.getSigners();

    const PriceTracker = await ethers.getContractFactory('PriceTracker');
    const priceTracker = await PriceTracker.deploy();

    return { priceTracker, seller, buyer, otherSeller, otherBuyer };
  }

  /** Default full set of registration params, with convenient overrides. */
  function buildParams(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      name: 'Organic Coffee',
      description: '250g bag of organic coffee beans',
      initialPrice: 1000n,
      warrantyMonths: 12n,
      specs: 'New',
      shippingFee: 50n,
      msrp: 1200n,
      crossBorderFee: 100n,
      supplyChainBatchId: 'BATCH-2026-001',
      ipfsCertificateHash: 'Qm123CertificateHash',
      initialStock: 500n,
      ...overrides,
    };
  }

  describe('registerProduct', function () {
    it('registers a new product with all ten TruePrice dimension fields', async function () {
      const { priceTracker, seller } = await deployFixture();

      const tx = await priceTracker.registerProduct(buildParams());
      await tx.wait();

      const productId = 1n;
      const product = await priceTracker.getProduct(productId);

      expect(product.id).to.equal(productId);
      expect(product.name).to.equal('Organic Coffee');
      expect(product.description).to.equal('250g bag of organic coffee beans');
      expect(product.seller).to.equal(seller.address);
      expect(product.warrantyMonths).to.equal(12n);
      expect(product.specs).to.equal('New');
      expect(product.shippingFee).to.equal(50n);
      expect(product.msrp).to.equal(1200n);
      expect(product.crossBorderFee).to.equal(100n);
      expect(product.supplyChainBatchId).to.equal('BATCH-2026-001');
      expect(product.ipfsCertificateHash).to.equal('Qm123CertificateHash');
      expect(product.currentStock).to.equal(500n);
      expect(product.stockSnapshotHash).to.not.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      );

      const [prices, timestamps] = await priceTracker.getPriceHistory(
        productId,
      );
      expect(prices.length).to.equal(1);
      expect(prices[0]).to.equal(1000n);
      expect(timestamps.length).to.equal(1);
    });

    it('emits a ProductRegistered event and a StockSnapshotRecorded event', async function () {
      const { priceTracker, seller } = await deployFixture();

      await expect(
        priceTracker.registerProduct(
          buildParams({
            name: 'Tea',
            description: 'Green tea',
            initialPrice: 500n,
            warrantyMonths: 6n,
            specs: 'Refurbished',
          }),
        ),
      )
        .to.emit(priceTracker, 'ProductRegistered')
        .withArgs(1n, seller.address, 'Tea', 500n, 6n, 'Refurbished', anyValue);

      // A second product just to confirm the snapshot event args independently.
      await expect(
        priceTracker.registerProduct(buildParams({ initialStock: 42n })),
      )
        .to.emit(priceTracker, 'StockSnapshotRecorded')
        .withArgs(2n, 42n, anyValue, anyValue);
    });

    it('allows registering a product with zero warranty, empty specs, and zero fee fields', async function () {
      const { priceTracker } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({
            name: 'Basic Item',
            description: '',
            initialPrice: 100n,
            warrantyMonths: 0n,
            specs: '',
            shippingFee: 0n,
            msrp: 0n,
            crossBorderFee: 0n,
            supplyChainBatchId: '',
            ipfsCertificateHash: '',
            initialStock: 0n,
          }),
        )
      ).wait();

      const product = await priceTracker.getProduct(1n);
      expect(product.warrantyMonths).to.equal(0n);
      expect(product.specs).to.equal('');
      expect(product.shippingFee).to.equal(0n);
      expect(product.msrp).to.equal(0n);
      expect(product.crossBorderFee).to.equal(0n);
      expect(product.currentStock).to.equal(0n);
    });

    it('reverts when the product name is empty', async function () {
      const { priceTracker } = await deployFixture();

      await expect(
        priceTracker.registerProduct(
          buildParams({ name: '', description: 'no name', initialPrice: 100n }),
        ),
      ).to.be.revertedWith('Product name cannot be empty');
    });

    it('reverts when the initial price is zero', async function () {
      const { priceTracker } = await deployFixture();

      await expect(
        priceTracker.registerProduct(
          buildParams({ name: 'Water', initialPrice: 0n }),
        ),
      ).to.be.revertedWith('Initial price must be greater than 0');
    });

    it('increments the product count and tracks all product ids', async function () {
      const { priceTracker } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'A', initialPrice: 10n }),
        )
      ).wait();
      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'B', initialPrice: 20n }),
        )
      ).wait();

      expect(await priceTracker.getProductCount()).to.equal(2n);

      const ids = await priceTracker.getAllProductIds();
      expect(ids.map((id) => id.toString())).to.deep.equal(['1', '2']);
    });

    it('exposes the official cross-border tariff rate as a public constant', async function () {
      const { priceTracker } = await deployFixture();

      expect(await priceTracker.OFFICIAL_TARIFF_RATE_BPS()).to.equal(1500n);
    });
  });

  describe('updatePrice', function () {
    it('allows the original seller to update the price', async function () {
      const { priceTracker } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coffee', initialPrice: 1000n }),
        )
      ).wait();

      await (await priceTracker.updatePrice(1n, 1200n)).wait();

      const [price] = await priceTracker.getLatestPrice(1n);
      expect(price).to.equal(1200n);

      const [prices] = await priceTracker.getPriceHistory(1n);
      expect(prices.map((p) => p.toString())).to.deep.equal(['1000', '1200']);
    });

    it('does not alter warranty, specs, or other immutable fields when the price is updated', async function () {
      const { priceTracker } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({
            name: 'Coffee',
            initialPrice: 1000n,
            warrantyMonths: 24n,
            specs: 'New',
            msrp: 1500n,
          }),
        )
      ).wait();

      await (await priceTracker.updatePrice(1n, 1200n)).wait();

      const product = await priceTracker.getProduct(1n);
      expect(product.warrantyMonths).to.equal(24n);
      expect(product.specs).to.equal('New');
      expect(product.msrp).to.equal(1500n);
    });

    it('emits a PriceUpdated event', async function () {
      const { priceTracker, seller } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coffee', initialPrice: 1000n }),
        )
      ).wait();

      await expect(priceTracker.updatePrice(1n, 1500n))
        .to.emit(priceTracker, 'PriceUpdated')
        .withArgs(1n, seller.address, 1500n, anyValue);
    });

    it('reverts when called by an address other than the original seller', async function () {
      const { priceTracker, otherSeller } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coffee', initialPrice: 1000n }),
        )
      ).wait();

      await expect(
        priceTracker.connect(otherSeller).updatePrice(1n, 1300n),
      ).to.be.revertedWith(
        'Only the registered seller can perform this action',
      );
    });

    it('reverts when updating the price of a non-existent product', async function () {
      const { priceTracker } = await deployFixture();

      await expect(priceTracker.updatePrice(999n, 100n)).to.be.revertedWith(
        'Product does not exist',
      );
    });

    it('reverts when the new price is zero', async function () {
      const { priceTracker } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coffee', initialPrice: 1000n }),
        )
      ).wait();

      await expect(priceTracker.updatePrice(1n, 0n)).to.be.revertedWith(
        'New price must be greater than 0',
      );
    });
  });

  describe('recordStockSnapshot (Dimension 3: Inventory Snapshots)', function () {
    it('allows the seller to update stock and anchors a new snapshot hash', async function () {
      const { priceTracker } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coat', initialStock: 500n }),
        )
      ).wait();

      const before = await priceTracker.getProduct(1n);

      await (await priceTracker.recordStockSnapshot(1n, 1n)).wait();

      const after = await priceTracker.getProduct(1n);
      expect(after.currentStock).to.equal(1n);
      expect(after.stockSnapshotHash).to.not.equal(before.stockSnapshotHash);
    });

    it('emits a StockSnapshotRecorded event', async function () {
      const { priceTracker } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coat', initialStock: 500n }),
        )
      ).wait();

      await expect(priceTracker.recordStockSnapshot(1n, 300n))
        .to.emit(priceTracker, 'StockSnapshotRecorded')
        .withArgs(1n, 300n, anyValue, anyValue);
    });

    it('reverts when called by an address other than the original seller', async function () {
      const { priceTracker, otherSeller } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coat', initialStock: 500n }),
        )
      ).wait();

      await expect(
        priceTracker.connect(otherSeller).recordStockSnapshot(1n, 1n),
      ).to.be.revertedWith(
        'Only the registered seller can perform this action',
      );
    });
  });

  describe('purchaseProduct (Dimension 8: Scalper Bot Audit Trail)', function () {
    it('records a purchase and appends it to the audit trail', async function () {
      const { priceTracker, buyer } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Limited Toy', initialPrice: 10n }),
        )
      ).wait();

      await (await priceTracker.connect(buyer).purchaseProduct(1n)).wait();

      const purchaseList = await priceTracker.getPurchases(1n);
      expect(purchaseList.length).to.equal(1);
      expect(purchaseList[0].buyer).to.equal(buyer.address);
    });

    it('allows multiple purchases from different buyers, building a public audit trail', async function () {
      const { priceTracker, buyer, otherBuyer } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Limited Toy', initialPrice: 10n }),
        )
      ).wait();

      await (await priceTracker.connect(buyer).purchaseProduct(1n)).wait();
      await (await priceTracker.connect(otherBuyer).purchaseProduct(1n)).wait();

      const purchaseList = await priceTracker.getPurchases(1n);
      expect(purchaseList.length).to.equal(2);
      expect(purchaseList.map((p) => p.buyer)).to.deep.equal([
        buyer.address,
        otherBuyer.address,
      ]);
    });

    it('emits a ProductPurchased event', async function () {
      const { priceTracker, buyer } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Limited Toy', initialPrice: 10n }),
        )
      ).wait();

      await expect(priceTracker.connect(buyer).purchaseProduct(1n))
        .to.emit(priceTracker, 'ProductPurchased')
        .withArgs(1n, buyer.address, anyValue);
    });

    it('reverts when purchasing a non-existent product', async function () {
      const { priceTracker, buyer } = await deployFixture();

      await expect(
        priceTracker.connect(buyer).purchaseProduct(999n),
      ).to.be.revertedWith('Product does not exist');
    });
  });

  describe('addReview (Dimension 9: Verified Purchase Reviews)', function () {
    it('reverts when a non-purchaser tries to submit a review', async function () {
      const { priceTracker, buyer } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coffee', initialPrice: 1000n }),
        )
      ).wait();

      await expect(
        priceTracker.connect(buyer).addReview(1n, 5, 'Great product!'),
      ).to.be.revertedWith('Only verified purchasers may submit a review');
    });

    it('allows a verified purchaser to submit a review', async function () {
      const { priceTracker, buyer } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coffee', initialPrice: 1000n }),
        )
      ).wait();

      await (await priceTracker.connect(buyer).purchaseProduct(1n)).wait();
      await (
        await priceTracker.connect(buyer).addReview(1n, 5, 'Great product!')
      ).wait();

      const reviewList = await priceTracker.getReviews(1n);
      expect(reviewList.length).to.equal(1);
      expect(reviewList[0].reviewer).to.equal(buyer.address);
      expect(reviewList[0].rating).to.equal(5);
      expect(reviewList[0].text).to.equal('Great product!');
    });

    it('emits a ReviewSubmitted event', async function () {
      const { priceTracker, buyer } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coffee', initialPrice: 1000n }),
        )
      ).wait();

      await (await priceTracker.connect(buyer).purchaseProduct(1n)).wait();

      await expect(priceTracker.connect(buyer).addReview(1n, 4, 'Good.'))
        .to.emit(priceTracker, 'ReviewSubmitted')
        .withArgs(1n, buyer.address, 4, anyValue);
    });

    it('reverts when the rating is out of the 1-5 range', async function () {
      const { priceTracker, buyer } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coffee', initialPrice: 1000n }),
        )
      ).wait();

      await (await priceTracker.connect(buyer).purchaseProduct(1n)).wait();

      await expect(
        priceTracker.connect(buyer).addReview(1n, 0, 'Bad rating'),
      ).to.be.revertedWith('Rating must be between 1 and 5');

      await expect(
        priceTracker.connect(buyer).addReview(1n, 6, 'Bad rating'),
      ).to.be.revertedWith('Rating must be between 1 and 5');
    });

    it('canReview reflects whether an address has purchased the product', async function () {
      const { priceTracker, buyer, otherBuyer } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'Coffee', initialPrice: 1000n }),
        )
      ).wait();

      expect(await priceTracker.canReview(1n, buyer.address)).to.equal(false);

      await (await priceTracker.connect(buyer).purchaseProduct(1n)).wait();

      expect(await priceTracker.canReview(1n, buyer.address)).to.equal(true);
      expect(await priceTracker.canReview(1n, otherBuyer.address)).to.equal(
        false,
      );
    });
  });

  describe('view helpers', function () {
    it("getProductsBySeller returns only that seller's products", async function () {
      const { priceTracker, seller, otherSeller } = await deployFixture();

      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'A', initialPrice: 10n }),
        )
      ).wait();
      await (
        await priceTracker
          .connect(otherSeller)
          .registerProduct(buildParams({ name: 'B', initialPrice: 20n }))
      ).wait();
      await (
        await priceTracker.registerProduct(
          buildParams({ name: 'C', initialPrice: 30n }),
        )
      ).wait();

      const sellerProducts = await priceTracker.getProductsBySeller(
        seller.address,
      );
      expect(sellerProducts.map((id) => id.toString())).to.deep.equal([
        '1',
        '3',
      ]);

      const otherSellerProducts = await priceTracker.getProductsBySeller(
        otherSeller.address,
      );
      expect(otherSellerProducts.map((id) => id.toString())).to.deep.equal([
        '2',
      ]);
    });

    it('reverts when querying a non-existent product', async function () {
      const { priceTracker } = await deployFixture();

      await expect(priceTracker.getProduct(42n)).to.be.revertedWith(
        'Product does not exist',
      );
    });
  });
});

/**
 * Helper matcher used with chai's `.withArgs` to accept any value for
 * arguments (e.g. `timestamp`, `snapshotHash`) whose exact value is not
 * deterministic in tests.
 */
const anyValue = (value: unknown) => true;
