import { toNumber } from '@fuel-ts/math';
import { TransactionType } from '@fuel-ts/transactions';

import type { TransactionRequestLike } from './types';
import { transactionRequestify } from './utils';

/**
 * @group browser
 * @group node
 */
describe('TransactionRequest', () => {
  describe('transactionRequestify', () => {
    it('should keep data from input in transaction request created', () => {
      const script = Uint8Array.from([1, 2, 3, 4]);
      const scriptData = Uint8Array.from([5, 6]);
      const txRequestLike: TransactionRequestLike = {
        type: TransactionType.Script,
        script,
        scriptData,
        gasPrice: 1,
        gasLimit: 10000,
        maturity: 1,
        inputs: [],
        outputs: [],
        witnesses: [],
      };
      const txRequest = transactionRequestify(txRequestLike);

      if (txRequest.type === TransactionType.Script) {
        expect(txRequest.script).toEqual(txRequestLike.script);
        expect(txRequest.scriptData).toEqual(txRequestLike.scriptData);
      }

      expect(txRequest.type).toEqual(txRequestLike.type);
      expect(toNumber(txRequest.gasPrice)).toEqual(txRequestLike.gasPrice);
      expect(toNumber(txRequest.gasLimit)).toEqual(txRequestLike.gasLimit);
      expect(txRequest.maturity).toEqual(txRequestLike.maturity);
      expect(txRequest.inputs).toEqual(txRequestLike.inputs);
      expect(txRequest.outputs).toEqual(txRequestLike.outputs);
      expect(txRequest.witnesses).toEqual(txRequestLike.witnesses);
    });

    it('should throw error if invalid transaction type', () => {
      const txRequestLike = {
        type: 5,
        gasPrice: 1,
      };

      expect(() => transactionRequestify(txRequestLike)).toThrow('Invalid transaction type: 5');
    });
  });
});
