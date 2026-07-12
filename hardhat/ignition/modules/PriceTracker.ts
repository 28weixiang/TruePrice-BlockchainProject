import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

/**
 * Hardhat Ignition deployment module for the PriceTracker contract.
 *
 * Usage (from the `hardhat` directory):
 *   npx hardhat ignition deploy ignition/modules/PriceTracker.ts --network localhost
 *
 * This will deploy the PriceTracker contract with no constructor
 * arguments (the contract has none) and print out the deployed
 * contract address, which should be copied into the frontend's
 * environment configuration.
 */
export default buildModule('PriceTrackerModule', (m) => {
  const priceTracker = m.contract('PriceTracker');

  return { priceTracker };
});
