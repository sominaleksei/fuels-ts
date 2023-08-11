/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InputValue } from '@fuel-ts/abi-coder';
import type { AbstractContract, AbstractProgram } from '@fuel-ts/interfaces';
import { bn, toNumber } from '@fuel-ts/math';
import type { Provider, CoinQuantity, TransactionRequest } from '@fuel-ts/providers';
import { transactionRequestify, ScriptTransactionRequest } from '@fuel-ts/providers';
import { InputType } from '@fuel-ts/transactions';
import { MAX_GAS_PER_TX } from '@fuel-ts/transactions/configs';

import { contractCallScript } from '../contract-call-script';
import type { ContractCall, InvocationScopeLike, TransactionCostOptions, TxParams } from '../types';
import { assert } from '../utils';

import { InvocationCallResult, FunctionInvocationResult } from './invocation-results';

/**
 * Creates a contract call object based on the provided invocation scope.
 *
 * @param funcScope - The invocation scope containing the necessary information for the contract call.
 * @returns The contract call object.
 */
function createContractCall(funcScope: InvocationScopeLike): ContractCall {
  const { program, args, forward, func, callParameters, bytesOffset } = funcScope.getCallConfig();

  const data = func.encodeArguments(
    args as Array<InputValue>,
    contractCallScript.getScriptDataOffset() + bytesOffset
  );

  return {
    contractId: (program as AbstractContract).id,
    fnSelector: func.selector,
    data,
    isDataPointer: func.isInputDataPointer(),
    assetId: forward?.assetId,
    amount: forward?.amount,
    gas: callParameters?.gasLimit,
  };
}

/**
 * Base class for managing invocation scopes and preparing transactions.
 */
export class BaseInvocationScope<TReturn = any> {
  transactionRequest: ScriptTransactionRequest;
  protected program: AbstractProgram;
  protected functionInvocationScopes: Array<InvocationScopeLike> = [];
  protected txParameters?: TxParams;
  protected requiredCoins: CoinQuantity[] = [];
  protected isMultiCall: boolean = false;

  /**
   * Constructs an instance of BaseInvocationScope.
   *
   * @param program - The abstract program to be invoked.
   * @param isMultiCall - A flag indicating whether the invocation is a multi-call.
   */
  constructor(program: AbstractProgram, isMultiCall: boolean) {
    this.program = program;
    this.isMultiCall = isMultiCall;
    this.transactionRequest = new ScriptTransactionRequest({
      gasLimit: MAX_GAS_PER_TX,
    });
  }

  /**
   * Getter for the contract calls.
   *
   * @returns An array of contract calls.
   */
  protected get calls() {
    return this.functionInvocationScopes.map((funcScope) => createContractCall(funcScope));
  }

  /**
   * Updates the script request with the current contract calls.
   */
  protected updateScriptRequest() {
    const calls = this.calls;
    calls.forEach((c) => {
      this.transactionRequest.addContractInputAndOutput(c.contractId);
    });
    this.transactionRequest.setScript(contractCallScript, calls);
  }

  /**
   * Gets the required coins for the transaction.
   *
   * @returns An array of required coin quantities.
   */
  protected getRequiredCoins(): Array<CoinQuantity> {
    const assets = this.calls
      .map((call) => ({
        assetId: String(call.assetId),
        amount: bn(call.amount || 0),
      }))
      .concat(this.transactionRequest.calculateFee())
      .filter(({ assetId, amount }) => assetId && !bn(amount).isZero());
    return assets;
  }

  /**
   * Updates the required coins for the transaction.
   */
  protected updateRequiredCoins() {
    const assets = this.getRequiredCoins();
    const reduceForwardCoins = (
      requiredCoins: Map<any, CoinQuantity>,
      { assetId, amount }: CoinQuantity
    ) => {
      const currentAmount = requiredCoins.get(assetId)?.amount || bn(0);

      return requiredCoins.set(assetId, {
        assetId: String(assetId),
        amount: currentAmount.add(amount),
      });
    };
    this.requiredCoins = Array.from(
      assets.reduce(reduceForwardCoins, new Map<any, CoinQuantity>()).values()
    );
  }

  /**
   * Adds a single call to the invocation scope.
   *
   * @param funcScope - The function scope to add.
   * @returns The current instance of the class.
   */
  protected addCall(funcScope: InvocationScopeLike) {
    this.addCalls([funcScope]);
    return this;
  }

  /**
   * Adds multiple calls to the invocation scope.
   *
   * @param funcScopes - An array of function scopes to add.
   * @returns The current instance of the class.
   */
  protected addCalls(funcScopes: Array<InvocationScopeLike>) {
    this.functionInvocationScopes.push(...funcScopes);
    this.updateScriptRequest();
    this.updateRequiredCoins();
    return this;
  }

  /**
   * Prepares the transaction by updating the script request, required coins, and checking the gas limit.
   */
  protected async prepareTransaction() {
    // Update request scripts before call
    this.updateScriptRequest();

    // Update required coins before call
    this.updateRequiredCoins();

    // Check if gasLimit is less than the
    // sum of all call gasLimits
    this.checkGasLimitTotal();

    if (this.program.account) {
      await this.fundWithRequiredCoins();
    }
  }

  /**
   * Checks if the total gas limit is within the acceptable range.
   */
  protected checkGasLimitTotal() {
    const gasLimitOnCalls = this.calls.reduce((total, call) => total.add(call.gas || 0), bn(0));
    if (gasLimitOnCalls.gt(this.transactionRequest.gasLimit)) {
      throw new Error(
        "Transaction gasLimit can't be lower than the sum of the forwarded gas of each call"
      );
    }
  }

  /**
   * Gets the transaction cost ny dry running the transaction.
   *
   * @param options - Optional transaction cost options.
   * @returns The transaction cost details.
   */
  async getTransactionCost(options?: TransactionCostOptions) {
    const provider = (this.program.account?.provider || this.program.provider) as Provider;
    assert(provider, 'Wallet or Provider is required!');

    await this.prepareTransaction();
    const request = transactionRequestify(this.transactionRequest);
    request.gasPrice = bn(toNumber(request.gasPrice) || toNumber(options?.gasPrice || 0));
    const txCost = await provider.getTransactionCost(request, options?.tolerance);

    return txCost;
  }

  /**
   * Funds the transaction with the required coins.
   *
   * @returns The current instance of the class.
   */
  async fundWithRequiredCoins() {
    // Clean coin inputs before add new coins to the request
    this.transactionRequest.inputs = this.transactionRequest.inputs.filter(
      (i) => i.type !== InputType.Coin
    );
    const resources = await this.program.account?.getResourcesToSpend(this.requiredCoins);
    this.transactionRequest.addResourceInputsAndOutputs(resources || []);
    return this;
  }

  /**
   * Sets the transaction parameters.
   *
   * @param txParams - The transaction parameters to set.
   * @returns The current instance of the class.
   */
  txParams(txParams: TxParams) {
    this.txParameters = txParams;
    const request = this.transactionRequest;

    request.gasLimit = bn(txParams.gasLimit || request.gasLimit);
    request.gasPrice = bn(txParams.gasPrice || request.gasPrice);
    request.addVariableOutputs(this.txParameters?.variableOutputs || 0);

    return this;
  }

  /**
   * Adds contracts to the invocation scope.
   *
   * @param contracts - An array of contracts to add.
   * @returns The current instance of the class.
   */
  addContracts(contracts: Array<AbstractContract>) {
    contracts.forEach((contract) => {
      this.transactionRequest.addContractInputAndOutput(contract.id);
      this.program.interface.updateExternalLoggedTypes(contract.id.toB256(), contract.interface);
    });
    return this;
  }

  /**
   * Prepares and returns the transaction request object.
   *
   * @returns The prepared transaction request.
   */
  async getTransactionRequest(): Promise<TransactionRequest> {
    await this.prepareTransaction();
    return this.transactionRequest;
  }

  /**
   * Submits a transaction.
   *
   * @returns The result of the function invocation.
   */
  async call<T = TReturn>(): Promise<FunctionInvocationResult<T>> {
    assert(this.program.account, 'Wallet is required!');

    const transactionRequest = await this.getTransactionRequest();
    const response = await this.program.account.sendTransaction(transactionRequest);

    return FunctionInvocationResult.build<T>(
      this.functionInvocationScopes,
      response,
      this.isMultiCall,
      this.program as AbstractContract
    );
  }

  /**
   * Simulates a transaction.
   *
   * @returns The result of the invocation call.
   */
  async simulate<T = TReturn>(): Promise<InvocationCallResult<T>> {
    assert(this.program.account, 'Wallet is required!');

    const transactionRequest = await this.getTransactionRequest();
    const result = await this.program.account.simulateTransaction(transactionRequest);

    return InvocationCallResult.build<T>(this.functionInvocationScopes, result, this.isMultiCall);
  }

  /**
   * Executes a transaction in dry run mode.
   *
   * @returns The result of the invocation call.
   */
  async dryRun<T = TReturn>(): Promise<InvocationCallResult<T>> {
    const provider = (this.program.account?.provider || this.program.provider) as Provider;
    assert(provider, 'Wallet or Provider is required!');

    const transactionRequest = await this.getTransactionRequest();
    const request = transactionRequestify(transactionRequest);
    const response = await provider.call(request, {
      utxoValidation: false,
    });

    const result = await InvocationCallResult.build<T>(
      this.functionInvocationScopes,
      response,
      this.isMultiCall
    );

    return result;
  }

  /**
   * Executes a readonly contract method call.
   *
   * @returns The result of the invocation call.
   */
  async get<T = TReturn>(): Promise<InvocationCallResult<T>> {
    return this.dryRun<T>();
  }
}
