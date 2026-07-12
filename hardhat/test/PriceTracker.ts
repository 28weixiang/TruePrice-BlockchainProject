import { expect } from 'chai';
import { network } from 'hardhat';

/**
 * Test suite for the PriceTracker smart contract.
 *
 * These tests run against Hardhat's in-memory EDR network (a local
 * simulated Ethereum node) and cover:
 * - Registering a new product and its initial price history entry.
 * - Enforcing that only the original seller can update a product's price.
 * - Appending new prices to the price history without losing old entries.
 * - Input validation (empty name, zero price).
 * - Read-only helper functions (getAllProductIds, getProductsBySeller, etc).
 */
describe('PriceTracker', function () {
  async function deployFixture() {
    const { ethers } = await network.getOrCreate();

    const [seller, buyer, otherSeller] = await ethers.getSigners();

    const PriceTracker = await ethers.getContractFactory('PriceTracker');
    const priceTracker = await PriceTracker.deploy();

    return { priceTracker, seller, buyer, otherSeller };
  }

  describe('registerProduct', function () {
    it('registers a new product with an initial price history entry', async function () {
      const { priceTracker, seller } = await deployFixture();

      const tx = await priceTracker.registerProduct(
        'Organic Coffee',
        '250g bag of organic coffee beans',
        1000n,
      );
      await tx.wait();

      const productId = 1n;

      const [id, name, description, productSeller] =
        await priceTracker.getProduct(productId);

      expect(id).to.equal(productId);
      expect(name).to.equal('Organic Coffee');
      expect(description).to.equal('250g bag of organic coffee beans');
      expect(productSeller).to.equal(seller.address);

      const [prices, timestamps] = await priceTracker.getPriceHistory(
        productId,
      );
      expect(prices.length).to.equal(1);
      expect(prices[0]).to.equal(1000n);
      expect(timestamps.length).to.equal(1);
    });

    it('emits a ProductRegistered event', async function () {
      const { priceTracker, seller } = await deployFixture();

      await expect(priceTracker.registerProduct('Tea', 'Green tea', 500n))
        .to.emit(priceTracker, 'ProductRegistered')
        .withArgs(1n, seller.address, 'Tea', 500n, anyValue);
    });

    it('reverts when the product name is empty', async function () {
      const { priceTracker } = await deployFixture();

      await expect(
        priceTracker.registerProduct('', 'no name', 100n),
      ).to.be.revertedWith('Product name cannot be empty');
    });

    it('reverts when the initial price is zero', async function () {
      const { priceTracker } = await deployFixture();

      await expect(
        priceTracker.registerProduct('Water', 'Bottled water', 0n),
      ).to.be.revertedWith('Initial price must be greater than 0');
    });

    it('increments the product count and tracks all product ids', async function () {
      const { priceTracker } = await deployFixture();

      await (await priceTracker.registerProduct('A', '', 10n)).wait();
      await (await priceTracker.registerProduct('B', '', 20n)).wait();

      expect(await priceTracker.getProductCount()).to.equal(2n);

      const ids = await priceTracker.getAllProductIds();
      expect(ids.map((id) => id.toString())).to.deep.equal(['1', '2']);
    });
  });

  describe('updatePrice', function () {
    it('allows the original seller to update the price', async function () {
      const { priceTracker } = await deployFixture();

      await (await priceTracker.registerProduct('Coffee', '', 1000n)).wait();

      await (await priceTracker.updatePrice(1n, 1200n)).wait();

      const [price] = await priceTracker.getLatestPrice(1n);
      expect(price).to.equal(1200n);

      const [prices] = await priceTracker.getPriceHistory(1n);
      expect(prices.map((p) => p.toString())).to.deep.equal(['1000', '1200']);
    });

    it('emits a PriceUpdated event', async function () {
      const { priceTracker, seller } = await deployFixture();

      await (await priceTracker.registerProduct('Coffee', '', 1000n)).wait();

      await expect(priceTracker.updatePrice(1n, 1500n))
        .to.emit(priceTracker, 'PriceUpdated')
        .withArgs(1n, seller.address, 1500n, anyValue);
    });

    it('reverts when called by an address other than the original seller', async function () {
      const { priceTracker, otherSeller } = await deployFixture();

      await (await priceTracker.registerProduct('Coffee', '', 1000n)).wait();

      await expect(
        priceTracker.connect(otherSeller).updatePrice(1n, 1300n),
      ).to.be.revertedWith('Only the registered seller can update the price');
    });

    it('reverts when updating the price of a non-existent product', async function () {
      const { priceTracker } = await deployFixture();

      await expect(priceTracker.updatePrice(999n, 100n)).to.be.revertedWith(
        'Product does not exist',
      );
    });

    it('reverts when the new price is zero', async function () {
      const { priceTracker } = await deployFixture();

      await (await priceTracker.registerProduct('Coffee', '', 1000n)).wait();

      await expect(priceTracker.updatePrice(1n, 0n)).to.be.revertedWith(
        'New price must be greater than 0',
      );
    });
  });

  describe('view helpers', function () {
    it("getProductsBySeller returns only that seller's products", async function () {
      const { priceTracker, seller, otherSeller } = await deployFixture();

      await (await priceTracker.registerProduct('A', '', 10n)).wait();
      await (
        await priceTracker.connect(otherSeller).registerProduct('B', '', 20n)
      ).wait();
      await (await priceTracker.registerProduct('C', '', 30n)).wait();

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
 * the `timestamp` argument of emitted events, since the exact block
 * timestamp is not deterministic in tests.
 */
const anyValue = (value: unknown) => true;
