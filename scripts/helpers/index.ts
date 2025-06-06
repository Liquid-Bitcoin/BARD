type TAddressesWithNetwork = {
  [k: string]: TAddresses;
};

export type TAddresses = {
  LBTC?: string;
  ThresholdKey?: string;
  Owner?: string;
  Consortium?: string;
  Timelock?: string;
  BTCB?: string;
};

export function getAddresses(network: string): TAddresses {
  const addresses: TAddressesWithNetwork = require('../../mainnet.json');
  if (!addresses[network]) {
    throw Error(`network ${network} not supported`);
  }
  return addresses[network];
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function verify(run: any, address: string, options: any = {}, delay = 13_000) {
  console.log(`Going to verify...`);

  await sleep(delay);

  try {
    await run('verify:verify', {
      address,
      ...options
    });
  } catch (e) {
    console.error(`Verification failed: ${e}`);
  }

  console.log('\n');
}
