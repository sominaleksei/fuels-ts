import { safeExec } from '@fuel-ts/errors/test-utils';

import { getProjectResources, ForcProjectsEnum } from '../../../test/fixtures/forc-projects/index';
import factoryTemplate from '../../../test/fixtures/templates/script/factory.hbs';
import factoryTemplateWithConfigurables from '../../../test/fixtures/templates/script-with-configurable/factory.hbs';
import { updateVersions } from '../../../test/utils/updateVersions';
import { Abi } from '../../abi/Abi';
import { ProgramTypeEnum } from '../../types/enums/ProgramTypeEnum';

import { renderFactoryTemplate } from './factory';

/**
 * @group node
 */
describe('factory.ts', () => {
  test('should render factory template', () => {
    const project = getProjectResources(ForcProjectsEnum.SCRIPT);
    const rawContents = project.abiContents;

    const abi = new Abi({
      filepath: './my-script-abi.json',
      hexlifiedBinContents: '0x000',
      outputDir: 'stdout',
      rawContents,
      programType: ProgramTypeEnum.SCRIPT,
    });

    const rendered = renderFactoryTemplate({ abi });

    expect(rendered).toEqual(updateVersions(factoryTemplate));
  });

  test('should render factory template with configurables', () => {
    const project = getProjectResources(ForcProjectsEnum.SCRIPT_WITH_CONFIGURABLE);
    const rawContents = project.abiContents;

    const abi = new Abi({
      filepath: './my-script-abi.json',
      hexlifiedBinContents: '0x000',
      outputDir: 'stdout',
      rawContents,
      programType: ProgramTypeEnum.SCRIPT,
    });

    const rendered = renderFactoryTemplate({ abi });

    expect(rendered).toEqual(updateVersions(factoryTemplateWithConfigurables));
  });

  test('should throw for invalid Script ABI', async () => {
    const project = getProjectResources(ForcProjectsEnum.SCRIPT);
    const rawContents = project.abiContents;

    // friction here (deletes 'main' function by emptying the functions array)
    rawContents.functions = [];

    const abi = new Abi({
      filepath: './my-script-abi.json',
      hexlifiedBinContents: '0x000',
      outputDir: 'stdout',
      rawContents,
      programType: ProgramTypeEnum.SCRIPT,
    });

    const { error } = await safeExec(() => {
      renderFactoryTemplate({ abi });
    });

    expect(error?.message).toMatch(/ABI doesn't have a 'main\(\)' method/);
  });
});
