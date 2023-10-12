import { BN, bn, toHex, BaseAssetId, TestNodeLauncher } from 'fuels';

import { getContractPath } from './utils';

const callTestPath = getContractPath('call-test');

const U64_MAX = bn(2).pow(64).sub(1);
describe('CallTestContract', () => {
  it.each([0, 1337, U64_MAX.sub(1)])('can call a contract with u64 (%p)', async (num) => {
    await using nodeLauncherResult = await TestNodeLauncher.launch({
      deployContracts: [{ projectDir: callTestPath }],
    });

    const {
      contracts: [contract],
    } = nodeLauncherResult;

    const { value } = await contract.functions.foo(num).call<BN>();
    expect(value.toHex()).toEqual(bn(num).add(1).toHex());
  });

  it.each([
    [{ a: false, b: 0 }],
    [{ a: true, b: 0 }],
    [{ a: false, b: 1337 }],
    [{ a: true, b: 1337 }],
    [{ a: false, b: U64_MAX.sub(1) }],
    [{ a: true, b: U64_MAX.sub(1) }],
  ])('can call a contract with structs (%p)', async (struct) => {
    await using nodeLauncherResult = await TestNodeLauncher.launch({
      deployContracts: [{ projectDir: callTestPath }],
    });

    const {
      contracts: [contract],
    } = nodeLauncherResult;

    const { value } = await contract.functions.boo(struct).call();
    expect(value.a).toEqual(!struct.a);
    expect(value.b.toHex()).toEqual(bn(struct.b).add(1).toHex());
  });

  it('can call a function with empty arguments', async () => {
    await using nodeLauncherResult = await TestNodeLauncher.launch({
      deployContracts: [{ projectDir: callTestPath }],
    });

    const {
      contracts: [contract],
    } = nodeLauncherResult;

    const { value: value0 } = await contract.functions.barfoo(0).call();
    expect(value0.toHex()).toEqual(toHex(63));

    const { value: value1 } = await contract.functions.foobar().call();
    expect(value1.toHex()).toEqual(toHex(63));
  });

  it('function with empty return should resolve undefined', async () => {
    await using nodeLauncherResult = await TestNodeLauncher.launch({
      deployContracts: [{ projectDir: callTestPath }],
    });

    const {
      contracts: [contract],
    } = nodeLauncherResult;

    // Call method with no params but with no result and no value on config
    const { value } = await contract.functions.return_void().call();
    expect(value).toEqual(undefined);
  });

  it.each([
    [
      'foobar_no_params',
      {
        values: [],
        expected: bn(50),
      },
    ],
    [
      'sum',
      {
        values: [10, 20],
        expected: bn(30),
      },
    ],
    [
      'sum_test',
      {
        values: [
          10,
          {
            a: 20,
            b: 30,
          },
        ],
        expected: bn(60),
      },
    ],
    [
      'sum_single',
      {
        values: [
          {
            a: 34,
            b: 34,
          },
        ],
        expected: bn(68),
      },
    ],
    [
      'sum_multparams',
      {
        values: [10, 10, 10, 10, 40],
        expected: bn(80),
      },
    ],
    [
      'add_ten',
      {
        values: [
          {
            a: 20,
          },
        ],
        expected: bn(30),
      },
    ],
    [
      'echo_b256',
      {
        values: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
        expected: '0x0000000000000000000000000000000000000000000000000000000000000001',
      },
    ],
  ])(
    `Test call with multiple arguments and different types -> %s`,
    async (method, { values, expected }) => {
      await using nodeLauncherResult = await TestNodeLauncher.launch({
        deployContracts: [{ projectDir: callTestPath }],
      });

      const {
        contracts: [contract],
      } = nodeLauncherResult;

      const { value } = await contract.functions[method](...values).call();

      if (BN.isBN(value)) {
        expect(toHex(value)).toBe(toHex(expected));
      } else {
        expect(value).toBe(expected);
      }
    }
  );

  it('Forward amount value on contract call', async () => {
    await using nodeLauncherResult = await TestNodeLauncher.launch({
      deployContracts: [{ projectDir: callTestPath }],
    });

    const {
      contracts: [contract],
    } = nodeLauncherResult;

    const { value } = await contract.functions
      .return_context_amount()
      .callParams({
        forward: [1_000_000, BaseAssetId],
      })
      .call();
    expect(value.toHex()).toBe(bn(1_000_000).toHex());
  });

  it('Forward asset_id on contract call', async () => {
    await using nodeLauncherResult = await TestNodeLauncher.launch({
      deployContracts: [{ projectDir: callTestPath }],
    });

    const {
      contracts: [contract],
    } = nodeLauncherResult;

    const assetId = '0x0101010101010101010101010101010101010101010101010101010101010101';
    const { value } = await contract.functions
      .return_context_asset()
      .callParams({
        forward: [0, assetId],
      })
      .call();
    expect(value).toBe(assetId);
  });

  it('Forward asset_id on contract simulate call', async () => {
    await using nodeLauncherResult = await TestNodeLauncher.launch({
      deployContracts: [{ projectDir: callTestPath }],
    });

    const {
      contracts: [contract],
    } = nodeLauncherResult;

    const assetId = '0x0101010101010101010101010101010101010101010101010101010101010101';
    const { value } = await contract.functions
      .return_context_asset()
      .callParams({
        forward: [0, assetId],
      })
      .call();
    expect(value).toBe(assetId);
  });

  it('can make multiple calls', async () => {
    await using nodeLauncherResult = await TestNodeLauncher.launch({
      deployContracts: [{ projectDir: callTestPath }],
    });

    const {
      contracts: [contract],
    } = nodeLauncherResult;

    const num = 1337;
    const numC = 10;
    const struct = { a: true, b: 1337 };
    const invocationA = contract.functions.foo(0);
    const multiCallScope = contract.multiCall([invocationA, contract.functions.boo(struct)]);

    // Set arguments of the invocation
    invocationA.setArguments(num);

    // Add invocation to multi-call
    const invocationC = contract.functions.foo(numC);
    multiCallScope.addCall(invocationC);

    async function expectContractCall() {
      // Submit multi-call transaction
      const {
        value: [resultA, resultB, resultC],
      } = await multiCallScope.call();

      expect(resultA.toHex()).toEqual(bn(num).add(1).toHex());
      expect(resultB.a).toEqual(!struct.a);
      expect(resultB.b.toHex()).toEqual(bn(struct.b).add(1).toHex());
      expect(resultC.toHex(0)).toEqual(bn(numC).add(1).toHex());
    }

    // Test first time
    await expectContractCall();
    // It should be possible to re-execute the
    // tx execution context
    await expectContractCall();
  });
});
