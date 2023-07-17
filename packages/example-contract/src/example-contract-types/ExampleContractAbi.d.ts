/* Autogenerated file. Do not edit manually. */

/* tslint:disable */
/* eslint-disable */

/*
  Fuels version: 0.47.0
  Forc version: 0.40.1
  Fuel-Core version: 0.19.0
*/

import type {
  BigNumberish,
  BN,
  BytesLike,
  Contract,
  DecodedValue,
  FunctionFragment,
  Interface,
  InvokeFunction,
} from 'fuels';

interface ExampleContractAbiInterface extends Interface {
  functions: {
    return_input: FunctionFragment;
  };

  encodeFunctionData(functionFragment: 'return_input', values: [BigNumberish]): Uint8Array;

  decodeFunctionData(functionFragment: 'return_input', data: BytesLike): DecodedValue;
}

export class ExampleContractAbi extends Contract {
  interface: ExampleContractAbiInterface;
  functions: {
    return_input: InvokeFunction<[input: BigNumberish], BN>;
  };
}
