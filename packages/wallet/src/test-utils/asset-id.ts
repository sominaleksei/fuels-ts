import { hexlify } from '@ethersproject/bytes';
import { BaseAssetId } from '@fuel-ts/address/configs';
import { randomBytes } from '@fuel-ts/crypto';

export class AssetId {
  public static BaseAssetId = new AssetId(BaseAssetId);

  private constructor(public value: string) {}

  public static random() {
    return new AssetId(hexlify(randomBytes(32)));
  }
}
