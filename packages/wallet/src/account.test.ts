import { Address } from '@fuel-ts/address';
import { BaseAssetId } from '@fuel-ts/address/configs';
import type { BN } from '@fuel-ts/math';
import { bn } from '@fuel-ts/math';
import type {
  CallResult,
  Coin,
  CoinQuantity,
  Message,
  Resource,
  TransactionRequest,
  TransactionRequestLike,
  TransactionResponse,
} from '@fuel-ts/providers';
import { ScriptTransactionRequest, Provider } from '@fuel-ts/providers';
import * as providersMod from '@fuel-ts/providers';

import { Account } from './account';
import { FUEL_NETWORK_URL } from './configs';
import { generateTestWallet } from './test-utils';
import { Wallet } from './wallet';

jest.mock('@fuel-ts/providers', () => ({
  __esModule: true,
  ...jest.requireActual('@fuel-ts/providers'),
}));

describe('Account', () => {
  afterEach(jest.restoreAllMocks);

  let provider: Provider;
  let testWallet: Account;
  const assetIdA = '0x0101010101010101010101010101010101010101010101010101010101010101';

  beforeAll(async () => {
    provider = await Provider.create(FUEL_NETWORK_URL);

    testWallet = await generateTestWallet(provider, [
      [5_000, BaseAssetId],
      [5_000, assetIdA],
    ]);
  });
  const assets = [
    '0x0101010101010101010101010101010101010101010101010101010101010101',
    '0x0202020202020202020202020202020202020202020202020202020202020202',
    '0x0000000000000000000000000000000000000000000000000000000000000000',
  ];

  it('Create wallet using a address', () => {
    const account = new Account(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db',
      provider
    );
    expect(account.address.toB256()).toEqual(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db'
    );
  });

  it('should get coins just fine', async () => {
    const account = new Account(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db',
      provider
    );
    const coins = await account.getCoins();
    const assetA = coins.find((c) => c.assetId === assets[0]);
    expect(assetA?.amount.gt(1)).toBeTruthy();
    const assetB = coins.find((c) => c.assetId === assets[1]);
    expect(assetB?.amount.gt(1)).toBeTruthy();
    const assetC = coins.find((c) => c.assetId === assets[2]);
    expect(assetC?.amount.gt(1)).toBeTruthy();
  });

  it('should throw if coins length is higher than 9999', async () => {
    const dummyCoins: Coin[] = new Array(10000);

    const getCoins = async () => Promise.resolve(dummyCoins);

    jest.spyOn(providersMod.Provider.prototype, 'getCoins').mockImplementation(getCoins);

    const account = new Account(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db',
      provider
    );

    let result;
    let error;

    try {
      result = await account.getCoins();
    } catch (err) {
      error = err;
    }

    expect(result).toBeUndefined();
    expect((<Error>error).message).toEqual(
      'Wallets containing more than 9999 coins exceed the current supported limit.'
    );
  });

  it('should execute getResourcesToSpend just fine', async () => {
    // #region Message-getResourcesToSpend
    const account = new Account(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db',
      provider
    );
    const resourcesToSpend = await account.getResourcesToSpend([
      {
        amount: bn(2),
        assetId: '0x0101010101010101010101010101010101010101010101010101010101010101',
      },
    ]);
    expect(resourcesToSpend[0].amount.gt(2)).toBeTruthy();
    // #endregion Message-getResourcesToSpend
  });

  it('should get messages just fine', async () => {
    const account = new Account(
      '0x69a2b736b60159b43bb8a4f98c0589f6da5fa3a3d101e8e269c499eb942753ba',
      provider
    );
    const messages = await account.getMessages();
    expect(messages.length).toEqual(1);
  });

  it('should throw if messages length is higher than 9999', async () => {
    // mocking
    const messages: Message[] = new Array(10000);
    const mockedGetMessages = async () => Promise.resolve(messages);
    jest
      .spyOn(providersMod.Provider.prototype, 'getMessages')
      .mockImplementationOnce(mockedGetMessages);

    const account = new Account(
      '0x69a2b736b60159b43bb8a4f98c0589f6da5fa3a3d101e8e269c499eb942753ba',
      provider
    );

    let result;
    let error;

    try {
      result = await account.getMessages();
    } catch (err) {
      error = err;
    }

    expect(result).toBeUndefined();
    expect((<Error>error).message).toEqual(
      'Wallets containing more than 9999 messages exceed the current supported limit.'
    );
  });

  it('should get single asset balance just fine', async () => {
    const account = new Account(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db',
      provider
    );
    const balanceA = await account.getBalance(); // native asset
    const balanceB = await account.getBalance(assets[1]);
    expect(balanceA.gte(1)).toBeTruthy();
    expect(balanceB.gte(1)).toBeTruthy();
  });

  it('should get multiple balances just fine', async () => {
    const account = new Account(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db',
      provider
    );
    const balances = await account.getBalances();
    expect(balances.length).toBeGreaterThanOrEqual(1);
  });

  it('should throw if balances length is higher than 9999', async () => {
    const dummyBalace: CoinQuantity[] = new Array(10000);

    const mockedGetBalances = async () => Promise.resolve(dummyBalace);

    jest
      .spyOn(providersMod.Provider.prototype, 'getBalances')
      .mockImplementation(mockedGetBalances);

    const account = new Account(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db',
      provider
    );

    let result;
    let error;
    try {
      result = await account.getBalances();
    } catch (err) {
      error = err;
    }

    expect(result).toBeUndefined();
    expect((<Error>error).message).toEqual(
      'Wallets containing more than 9999 balances exceed the current supported limit.'
    );
  });

  it('should connect with provider just fine [INSTANCE]', async () => {
    const account = new Account(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db',
      provider
    );

    const newProviderInstance = await Provider.create(FUEL_NETWORK_URL);

    expect(account.provider).not.toBe(newProviderInstance);

    account.connect(newProviderInstance);

    expect(account.provider).toBe(newProviderInstance);
    expect(account.provider).not.toBe(provider);
  });

  it('should fund transaction request just fine [BASE ASSET]', async () => {
    const amountToTransfer = bn(1000);
    const destination = Wallet.generate({ provider });

    const transactionRequest = new ScriptTransactionRequest({
      gasLimit: 10000,
      gasPrice: 1,
    });

    transactionRequest.addCoinOutput(destination.address, amountToTransfer);

    expect(transactionRequest.inputs.length).toBe(0);

    await testWallet.fund(transactionRequest);

    const allCoinsAmounts = transactionRequest.inputs.reduce(
      (accumulator, input) => ('amount' in input ? accumulator.add(input.amount) : accumulator),
      bn(0)
    );

    expect(allCoinsAmounts.toNumber()).toBeGreaterThan(amountToTransfer.toNumber());
  });

  it('should fund transaction request just fine [NOT BASE ASSET]', async () => {
    const amountToTransfer = 1000;
    const destination = Wallet.generate({ provider });

    const transactionRequest = new ScriptTransactionRequest({
      gasLimit: 10000,
      gasPrice: 1,
    });

    transactionRequest.addCoinOutput(destination.address, amountToTransfer, assetIdA);

    expect(transactionRequest.inputs.length).toBe(0);

    await testWallet.fund(transactionRequest);

    const allCoinsAmounts = transactionRequest.inputs.reduce(
      (accumulator, input) => {
        if ('amount' in input) {
          // MessageCoin input does not have property assetId
          const key = 'assetId' in input ? input.assetId.toString() : BaseAssetId;

          return {
            ...accumulator,
            [key]: accumulator[key].add(input.amount),
          };
        }

        return accumulator;
      },
      {
        [BaseAssetId]: bn(0),
        [assetIdA]: bn(0),
      } as Record<string, BN>
    );

    expect(allCoinsAmounts[BaseAssetId].toNumber()).toBeGreaterThan(0);
    expect(allCoinsAmounts[assetIdA].toNumber()).toBeGreaterThan(amountToTransfer);
  });

  it('should execute transfer just as fine', async () => {
    const amount = 1;
    const destination = Wallet.generate({ provider });

    const originalBalance = await destination.getBalance(assetIdA);

    await testWallet.transfer(destination.address, amount, assetIdA);

    const finalBalance = await destination.getBalance(assetIdA);
    expect(finalBalance.toNumber()).toBe(originalBalance.toNumber() + amount);
  });

  it('should execute withdrawToBaseLayer just fine', async () => {
    const recipient = Address.fromRandom();
    const txParams: Pick<TransactionRequestLike, 'gasLimit' | 'gasPrice' | 'maturity'> = {};
    const amount = bn(1);

    const assetId = '0x0101010101010101010101010101010101010101010101010101010101010101';

    const fee: CoinQuantity = {
      amount,
      assetId,
    };

    const calculateFee = jest.fn(() => fee);
    const addResources = jest.fn();

    const request = {
      calculateFee,
      addResources,
    } as unknown as ScriptTransactionRequest;

    const resources: Resource[] = [];

    const transactionResponse = {} as unknown as TransactionResponse;

    const scriptTransactionRequest = jest
      .spyOn(providersMod, 'ScriptTransactionRequest')
      .mockImplementation(() => request);

    const getResourcesToSpend = jest
      .spyOn(Account.prototype, 'getResourcesToSpend')
      .mockImplementation(() => Promise.resolve(resources));

    const sendTransaction = jest
      .spyOn(Account.prototype, 'sendTransaction')
      .mockImplementation(() => Promise.resolve(transactionResponse));

    const account = new Account(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db',
      provider
    );

    let result = await account.withdrawToBaseLayer(recipient, amount, txParams);

    expect(result).toEqual(transactionResponse);

    expect(scriptTransactionRequest.mock.calls.length).toBe(1);

    expect(calculateFee.mock.calls.length).toBe(1);

    expect(addResources.mock.calls.length).toBe(1);
    expect(addResources.mock.calls[0][0]).toEqual(resources);

    expect(getResourcesToSpend.mock.calls.length).toBe(1);
    expect(getResourcesToSpend.mock.calls[0][0]).toEqual([fee]);

    expect(sendTransaction.mock.calls.length).toBe(1);
    expect(sendTransaction.mock.calls[0][0]).toEqual(request);

    // without txParams
    result = await account.withdrawToBaseLayer(recipient, amount);

    expect(result).toEqual(transactionResponse);

    expect(scriptTransactionRequest.mock.calls.length).toBe(2);

    expect(calculateFee.mock.calls.length).toBe(2);

    expect(addResources.mock.calls.length).toBe(2);
    expect(addResources.mock.calls[0][0]).toEqual(resources);

    expect(getResourcesToSpend.mock.calls.length).toBe(2);
    expect(getResourcesToSpend.mock.calls[0][0]).toEqual([fee]);

    expect(sendTransaction.mock.calls.length).toBe(2);
    expect(sendTransaction.mock.calls[0][0]).toEqual(request);
  });

  it('should execute sendTransaction just fine', async () => {
    const transactionRequestLike = 'transactionRequestLike' as unknown as TransactionRequest;
    const transactionRequest = 'transactionRequest' as unknown as TransactionRequest;
    const transactionResponse = 'transactionResponse' as unknown as TransactionResponse;

    const transactionRequestify = jest
      .spyOn(providersMod, 'transactionRequestify')
      .mockImplementation(() => transactionRequest);

    const estimateTxDependencies = jest
      .spyOn(providersMod.Provider.prototype, 'estimateTxDependencies')
      .mockImplementation(() => Promise.resolve());

    const sendTransaction = jest
      .spyOn(providersMod.Provider.prototype, 'sendTransaction')
      .mockImplementation(() => Promise.resolve(transactionResponse));

    const account = new Account(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db',
      provider
    );

    const result = await account.sendTransaction(transactionRequestLike);

    expect(result).toEqual(transactionResponse);

    expect(transactionRequestify.mock.calls.length).toEqual(1);
    expect(transactionRequestify.mock.calls[0][0]).toEqual(transactionRequestLike);

    expect(estimateTxDependencies.mock.calls.length).toEqual(1);
    expect(estimateTxDependencies.mock.calls[0][0]).toEqual(transactionRequest);

    expect(sendTransaction.mock.calls.length).toEqual(1);
    expect(sendTransaction.mock.calls[0][0]).toEqual(transactionRequest);
  });

  it('should execute simulateTransaction just fine', async () => {
    const transactionRequestLike = 'transactionRequestLike' as unknown as TransactionRequest;
    const transactionRequest = 'transactionRequest' as unknown as TransactionRequest;
    const callResult = 'callResult' as unknown as CallResult;

    const transactionRequestify = jest
      .spyOn(providersMod, 'transactionRequestify')
      .mockImplementation(() => transactionRequest);

    const estimateTxDependencies = jest
      .spyOn(providersMod.Provider.prototype, 'estimateTxDependencies')
      .mockImplementation(() => Promise.resolve());

    const simulate = jest
      .spyOn(providersMod.Provider.prototype, 'simulate')
      .mockImplementation(() => Promise.resolve(callResult));

    const account = new Account(
      '0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db',
      provider
    );

    const result = await account.simulateTransaction(transactionRequestLike);

    expect(result).toEqual(callResult);

    expect(transactionRequestify.mock.calls.length).toBe(1);
    expect(transactionRequestify.mock.calls[0][0]).toEqual(transactionRequestLike);

    expect(estimateTxDependencies.mock.calls.length).toBe(1);
    expect(estimateTxDependencies.mock.calls[0][0]).toEqual(transactionRequest);

    expect(simulate.mock.calls.length).toBe(1);
    expect(simulate.mock.calls[0][0]).toEqual(transactionRequest);
  });
});
