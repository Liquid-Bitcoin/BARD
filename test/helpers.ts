import { config, ethers, upgrades } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { BaseContract } from 'ethers';

export type Signer = HardhatEthersSigner & {
  publicKey: string;
  privateKey: string;
};

export const encode = (types: string[], values: any[]) => ethers.AbiCoder.defaultAbiCoder().encode(types, values);

export const CHAIN_ID: string = encode(['uint256'], [31337]);

export async function getSignersWithPrivateKeys(phrase?: string): Promise<Signer[]> {
  return (await ethers.getSigners()).map((signer, i) => {
    const mnemonic = ethers.Mnemonic.fromPhrase(phrase || config.networks.hardhat.accounts.mnemonic);
    const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
    return Object.assign(signer, {
      privateKey: wallet.privateKey,
      publicKey: `0x04${ethers.SigningKey.computePublicKey(wallet.publicKey, false).slice(4)}`
    });
  });
}

export async function deployContract<T extends BaseContract>(
  contractName: string,
  args: any[],
  isProxy: boolean = true
): Promise<T> {
  const factory = await ethers.getContractFactory(contractName);
  const contract = await (isProxy ? upgrades.deployProxy(factory, args) : factory.deploy(...args));
  await contract.waitForDeployment();

  return factory.attach(contract.target) as T;
}
