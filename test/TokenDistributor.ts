import { ethers } from 'hardhat';
import { expect } from 'chai';
import { takeSnapshot, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { Addressable, deployContract, encode, getSignersWithPrivateKeys, rawSign, Signer } from './helpers';
import { BARD, ERC4626Mock, TokenDistributor } from '../typechain-types';
import { SnapshotRestorer } from '@nomicfoundation/hardhat-network-helpers/src/helpers/takeSnapshot';
import { Wallet } from 'ethers';

const e18 = 10n ** 18n;
const CLAIM_PERIOD = 100;
const MERKLE_ROOT = '0xac7e6f20eefce76d6eeb96af71ae7a94caad413c6f834b92cacb3eec6c6ed1ef';
const RECIPIENT_01 = '0xd6ed4bdE64af53CeD6933E72B79df02f70877bD3';
const PRIVATE_KEY_01 = '0x9e9fbd0bd70cdd69b5cff4e077c61ec7a137ff5b9544cd7c2b30afa7d342ac37';
const AMOUNT_01 = 2551681628063220000n;
const PROOF_01 = [
  '0xf0d781a0bf90e5b4e2fcad8a74ca33904b04a214e9a457bac85e24e668c9d822',
  '0x9b6be6350b4add7360922a7f22609864ece3be2ff15b727a98d7fec03604d0ce',
  '0x4a18458bcb4e68dd3ff12a50fb1ecce174866e98741bf832f83d8ef5e0e6fb40',
  '0x020a57077e8aa1c914d4654bb1b9fbd6e8fa18efa373826b8ccf0bc0180743e4',
  '0x133215edb6e3ace58f5d837a2af7c73729728588e7188e6ed68ecdb1e6602c7a',
  '0x8e28a9831ecf8aff7317305f3c6a8611eb103b1e6fbb2e2bfe17ed9090799b94',
  '0x409b6003bd80e8c056f2d57c53396bbd04725e069d441a6c10f66c0b58aa8907'
];
const RECIPIENT_02 = '0x5d8bBCb32553c402E2AAa6dD6892BA487C55D7e1';
const PRIVATE_KEY_02 = '0xd461c77c054b62193f4f79135a637d088b2ef4f34ea9e416c18c28be9f44cb2d';
const AMOUNT_02 = 2524912688505040000n;
const PROOF_02 = [
  '0x5d5755c69121e0cf83e238d1697ccc06518336557dcede0a8be7ad97174f3859',
  '0x9b6be6350b4add7360922a7f22609864ece3be2ff15b727a98d7fec03604d0ce',
  '0x4a18458bcb4e68dd3ff12a50fb1ecce174866e98741bf832f83d8ef5e0e6fb40',
  '0x020a57077e8aa1c914d4654bb1b9fbd6e8fa18efa373826b8ccf0bc0180743e4',
  '0x133215edb6e3ace58f5d837a2af7c73729728588e7188e6ed68ecdb1e6602c7a',
  '0x8e28a9831ecf8aff7317305f3c6a8611eb103b1e6fbb2e2bfe17ed9090799b94',
  '0x409b6003bd80e8c056f2d57c53396bbd04725e069d441a6c10f66c0b58aa8907'
];
const RECIPIENT_03 = '0xfCCF270c88Fc8646DFcC8eC6Ec3f1dBbC1ed2832';
const PRIVATE_KEY_03 = '0x4cfb7f6cecaf0ebf06fd6721cddc8b085b27f242b6139d79e7879e88bd49823f';
const AMOUNT_03 = 270620421186852000n;
const PROOF_03 = [
  '0xc248db4338f729d38a2a748d84e947cde5b38bb0ad759c38e62a9bc44367b73b',
  '0x36b67301f33af73a4db50eef777d0f298d6688a383e8fef5f71a7253ed958710',
  '0x8d89c3bfe793c1b178952387f91254d21e3142b385497728ad911eec2c0e15a6',
  '0x7bee5c11ca276b3ec9bf31fb515a5124f25431a508ef7286349bc1c3b6fea2c2',
  '0x33896dd9217e724a01318892efe6cb78291aa308248407d7f5004cc84e8f5cba',
  '0xeb75bd3060d42a5def7b64908db69acdd35612c9c9c037b2a5fd79e24db40e6c',
  '0x409b6003bd80e8c056f2d57c53396bbd04725e069d441a6c10f66c0b58aa8907'
];
const RECIPIENT_SUI = '0xead4337a3c8909c6d1bc7be61993ad959158ed034a904ddab9192d7a87de3a05';
const AMOUNT_SUI = 5831691959478484n;
const PROOF_SUI = [
  '0xd0b13d50a78bf77a4e389dc6e1a5106e495b7c7b8c185fa82b1082577544f662',
  '0x550906cbc0a67a87eff47ee912a4d725041743794587c62b863e25f6f2ad28ef',
  '0xe7cb72e2e47605e9b386368ca26bb29d2d775053c196eaa80e4bd8e7c7462ed7',
  '0xca9cddefca73d6e66a56fa71cc6bbdb287332c2dec3b08195b921b66dfef1bc8'
];
const MERKLE_ROOT_WRONG = '0x7219269e7c773394d7f7c5e45d69be27bac95369d1ac44d383f46fee7c3d5731';
const WRONG_RECIPIENT = '0x973846119C50aB155b2cA776a4361634bc40F720';
const WRONG_AMOUNT = 1024n;
const WRONG_PROOF = [
  '0x8388857dacb095e04032ba88bbb2a2b78172615a5481cc141cacae658898cccb',
  '0xd7e668df550566bd80b402b54e98177c894850a3a03a0f986dd1c71ce274d5d8',
  '0xbe3bd67c39202038e405b0eb816f7f07e5a316c4d52d4bd96c9e1e35234c21cb',
  '0x1be40c2f461ecc2643a87c4fe5a527d47129fb463b7826c5d63432fd70633e73',
  '0xbd391e6f377c32e18c65b8ef697e31deab8201d1bf15b581723e8dc6e3ffa88a',
  '0x4734fb658d5adc8416e301a0c9fb3d912fbbabc0acaf6fc1aed94861b0e208e3'
];

describe('TokenDistributor', function () {
  let deployer: Signer,
    owner: Signer,
    treasury: Signer,
    signer1: Signer,
    signer2: Signer,
    recipient1: Wallet,
    recipient2: Wallet,
    recipient3: Wallet,
    pauser: Signer,
    approver: Signer,
    receiver: Signer;
  let bard: BARD & Addressable;
  let tokenDistributor: TokenDistributor & Addressable;
  let snapshot: SnapshotRestorer;
  let deployTimestamp: number;
  let claimEnd: number;
  let vault: ERC4626Mock & Addressable;

  before(async function () {
    [deployer, owner, treasury, signer1, signer2, pauser, approver, receiver] = await getSignersWithPrivateKeys();
    recipient1 = new Wallet(PRIVATE_KEY_01, ethers.provider);
    await deployer.sendTransaction({
      to: recipient1.address,
      value: 10_000_000_000_000_000n
    });
    recipient2 = new Wallet(PRIVATE_KEY_02, ethers.provider);
    await deployer.sendTransaction({
      to: recipient2.address,
      value: 10_000_000_000_000_000n
    });
    recipient3 = new Wallet(PRIVATE_KEY_03, ethers.provider);
    await deployer.sendTransaction({
      to: recipient3.address,
      value: 10_000_000_000_000_000n
    });

    claimEnd = (await time.latest()) + CLAIM_PERIOD;

    bard = await deployContract<BARD & Addressable>('BARD', [owner, treasury], false);
    bard.address = await bard.getAddress();

    vault = await deployContract<ERC4626Mock & Addressable>('ERC4626Mock', [bard.address], false);
    vault.address = await vault.getAddress();

    tokenDistributor = await deployContract<TokenDistributor & Addressable>(
      'TokenDistributor',
      [MERKLE_ROOT, bard.address, owner, claimEnd, vault, pauser, approver],
      false
    );
    tokenDistributor.address = await tokenDistributor.getAddress();

    await bard.connect(treasury).transfer(tokenDistributor.address, 1_000_000n * e18);

    snapshot = await takeSnapshot();
    deployTimestamp = await time.latest();
  });

  describe('Deployment process', function () {
    describe('Successful deployment', function () {
      it('Deploy with vault', async function () {
        await expect(
          deployContract<TokenDistributor>(
            'TokenDistributor',
            [MERKLE_ROOT, bard.address, owner, claimEnd, vault, pauser, approver],
            false
          )
        ).to.not.reverted;
      });

      it('Deploy without vault', async function () {
        await expect(
          deployContract<TokenDistributor>(
            'TokenDistributor',
            [MERKLE_ROOT, bard.address, owner, claimEnd, ethers.ZeroAddress, pauser, approver],
            false
          )
        ).to.not.reverted;
      });
    });

    describe('Failing deployment', function () {
      it('Reverts when merkle root is 0 address', async function () {
        await expect(
          deployContract<TokenDistributor>(
            'TokenDistributor',
            [
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              bard.address,
              owner,
              claimEnd,
              vault,
              pauser,
              approver
            ],
            false
          )
        ).to.revertedWithCustomError(tokenDistributor, 'InvalidMerkleRoot');
      });

      it('Reverts when token is 0 address', async function () {
        await expect(
          deployContract<TokenDistributor>(
            'TokenDistributor',
            [MERKLE_ROOT, ethers.ZeroAddress, owner, claimEnd, vault, pauser, approver],
            false
          )
        ).to.revertedWithCustomError(tokenDistributor, 'InvalidToken');
      });

      it('Reverts when owner is 0 address', async function () {
        await expect(
          deployContract<TokenDistributor>(
            'TokenDistributor',
            [MERKLE_ROOT, bard.address, ethers.ZeroAddress, claimEnd, vault, pauser, approver],
            false
          )
        ).to.revertedWithCustomError(tokenDistributor, 'OwnableInvalidOwner');
      });

      it('Reverts when claim end is now or in the past', async function () {
        const claimEndLocal = await time.latest();
        await expect(
          deployContract<TokenDistributor>(
            'TokenDistributor',
            [MERKLE_ROOT, bard.address, owner, claimEndLocal, vault, pauser, approver],
            false
          )
        ).to.revertedWithCustomError(tokenDistributor, 'WrongClaimEnd');
      });

      it('Reverts if pauser is 0 address', async function () {
        const claimEndLocal = await time.latest();
        await expect(
          deployContract<TokenDistributor>(
            'TokenDistributor',
            [MERKLE_ROOT, bard.address, owner, claimEnd, ethers.ZeroAddress, ethers.ZeroAddress, approver],
            false
          )
        ).to.revertedWithCustomError(tokenDistributor, 'WrongAddress');
      });
    });
  });

  describe('Setters and getters', function () {
    describe('Deployment values', function () {
      let claimEndAlt = 0;
      let tokenDistributorAlt: TokenDistributor & Addressable;

      before(async function () {
        claimEndAlt = (await time.latest()) + 250;
        tokenDistributorAlt = await deployContract<TokenDistributor & Addressable>(
          'TokenDistributor',
          [MERKLE_ROOT_WRONG, bard.address, signer2, claimEndAlt, signer1.address, pauser, approver],
          false
        );
      });

      it('owner', async function () {
        expect(await tokenDistributorAlt.owner()).to.be.eq(signer2.address);
      });

      it('merkle root', async function () {
        expect(await tokenDistributorAlt.MERKLE_ROOT()).to.be.eq(MERKLE_ROOT_WRONG);
      });

      it('token', async function () {
        expect(await tokenDistributorAlt.TOKEN()).to.be.eq(bard.address);
      });

      it('claim end', async function () {
        expect(await tokenDistributorAlt.CLAIM_END()).to.be.eq(claimEndAlt);
      });

      it('vault', async function () {
        expect(await tokenDistributorAlt.vault()).to.be.eq(signer1.address);
      });

      it('pauser', async function () {
        expect(await tokenDistributorAlt.pauser()).to.be.eq(pauser.address);
      });

      it('approver', async function () {
        expect(await tokenDistributorAlt.APPROVER()).to.be.eq(approver.address);
      });
    });

    describe('Vault', function () {
      before(async function () {
        await snapshot.restore();
      });

      it('changeVault() works if called by the owner', async function () {
        const oldVault = await tokenDistributor.vault();

        await expect(await tokenDistributor.connect(owner).changeVault(signer1.address))
          .to.emit(tokenDistributor, 'VaultChanged')
          .withArgs(oldVault, signer1.address);
        const newVault = await tokenDistributor.vault();
        expect(newVault).to.be.eq(signer1.address);

        await expect(await tokenDistributor.connect(owner).changeVault(ethers.ZeroAddress))
          .to.emit(tokenDistributor, 'VaultChanged')
          .withArgs(signer1.address, ethers.ZeroAddress);
        expect(await tokenDistributor.vault()).to.be.eq(ethers.ZeroAddress);
      });

      it('changeVault() reverts when called by not owner', async function () {
        await expect(tokenDistributor.connect(signer1).changeVault(signer2.address))
          .to.revertedWithCustomError(tokenDistributor, 'OwnableUnauthorizedAccount')
          .withArgs(signer1.address);
      });
    });

    describe('Pauser', function () {
      before(async function () {
        await snapshot.restore();
      });

      it('changePauser() works if called by the owner', async function () {
        const oldPauser = await tokenDistributor.pauser();

        await expect(await tokenDistributor.connect(owner).changePauser(signer1.address))
          .to.emit(tokenDistributor, 'PauserChanged')
          .withArgs(oldPauser, signer1.address);
        const newPauser = await tokenDistributor.pauser();
        expect(newPauser).to.be.eq(signer1.address);
      });

      it('changePauser() reverts if new pauser is 0 address', async function () {
        await expect(tokenDistributor.connect(owner).changePauser(ethers.ZeroAddress)).to.revertedWithCustomError(
          tokenDistributor,
          'WrongAddress'
        );
      });

      it('changeVault() reverts when called by not owner', async function () {
        await expect(tokenDistributor.connect(signer1).changePauser(signer2.address))
          .to.revertedWithCustomError(tokenDistributor, 'OwnableUnauthorizedAccount')
          .withArgs(signer1.address);
      });
    });

    describe('Approver', function () {
      before(async function () {
        await snapshot.restore();
      });

      it('changeApprover() works if called by the owner', async function () {
        const oldApprover = await tokenDistributor.APPROVER();

        await expect(await tokenDistributor.connect(owner).changeApprover(signer1.address))
          .to.emit(tokenDistributor, 'ApproverChanged')
          .withArgs(oldApprover, signer1.address);
        const newApprover = await tokenDistributor.APPROVER();
        expect(newApprover).to.be.eq(signer1.address);

        await expect(await tokenDistributor.connect(owner).changeApprover(ethers.ZeroAddress))
          .to.emit(tokenDistributor, 'ApproverChanged')
          .withArgs(signer1.address, ethers.ZeroAddress);
        expect(await tokenDistributor.APPROVER()).to.be.eq(ethers.ZeroAddress);
      });

      it('changeApprover() reverts when called by not owner', async function () {
        await expect(tokenDistributor.connect(signer1).changeApprover(signer2.address))
          .to.revertedWithCustomError(tokenDistributor, 'OwnableUnauthorizedAccount')
          .withArgs(signer1.address);
      });
    });
  });

  describe('Claim and stake', function () {
    describe('Positive cases', function () {
      beforeEach(async function () {
        await snapshot.restore();
      });

      it('Claim should work (tx sent by recipient)', async () => {
        const recepientBalanceBefore = await bard.balanceOf(RECIPIENT_01);
        const tdBalanceBefore = await bard.balanceOf(tokenDistributor.address);

        // const tx = await tokenDistributor.connect(recipient1).claim(RECIPIENT_01, AMOUNT_01, PROOF_01);
        const tx1 = await tokenDistributor.claim.populateTransaction(RECIPIENT_01, AMOUNT_01, PROOF_01);
        const tx = await recipient1.sendTransaction(tx1);
        await expect(tx).to.emit(tokenDistributor, 'Claimed').withArgs(RECIPIENT_01, AMOUNT_01);

        const recipientBalanceAfter = await bard.balanceOf(RECIPIENT_01);
        const tdBalanceAfter = await bard.balanceOf(tokenDistributor.address);

        expect(recipientBalanceAfter - recepientBalanceBefore).to.equal(AMOUNT_01);
        expect(tdBalanceAfter - tdBalanceBefore).to.equal(-AMOUNT_01);
      });

      it('Claim should work (tx sent by 3rd party)', async () => {
        const recepientBalanceBefore = await bard.balanceOf(RECIPIENT_01);
        const tdBalanceBefore = await bard.balanceOf(tokenDistributor.address);

        // const tx = await tokenDistributor.connect(recipient1).claim(RECIPIENT_01, AMOUNT_01, PROOF_01);
        const tx = await tokenDistributor.claim.populateTransaction(RECIPIENT_01, AMOUNT_01, PROOF_01);
        const txRes = await signer1.sendTransaction(tx);
        await expect(txRes).to.emit(tokenDistributor, 'Claimed').withArgs(RECIPIENT_01, AMOUNT_01);

        const recipientBalanceAfter = await bard.balanceOf(RECIPIENT_01);
        const tdBalanceAfter = await bard.balanceOf(tokenDistributor.address);

        expect(recipientBalanceAfter - recepientBalanceBefore).to.equal(AMOUNT_01);
        expect(tdBalanceAfter - tdBalanceBefore).to.equal(-AMOUNT_01);
      });

      it('ClaimAndStake should work (stake all)', async () => {
        const recepientBalanceBefore = await bard.balanceOf(RECIPIENT_02);
        const recepientSharesBalanceBefore = await vault.balanceOf(RECIPIENT_02);
        const tdBalanceBefore = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceBefore = await bard.balanceOf(vault.address);

        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[])'].populateTransaction(
          RECIPIENT_02,
          AMOUNT_02,
          PROOF_02
        );
        const txRes = await recipient2.sendTransaction(tx);
        await expect(txRes).to.emit(tokenDistributor, 'Claimed').withArgs(RECIPIENT_02, AMOUNT_02);

        const recipientBalanceAfter = await bard.balanceOf(RECIPIENT_02);
        const recepientSharesBalanceAfter = await vault.balanceOf(RECIPIENT_02);
        const tdBalanceAfter = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceAfter = await bard.balanceOf(vault.address);

        expect(recipientBalanceAfter - recepientBalanceBefore).to.equal(0n);
        expect(recepientSharesBalanceAfter - recepientSharesBalanceBefore).to.equal(AMOUNT_02);
        expect(tdBalanceAfter - tdBalanceBefore).to.equal(-AMOUNT_02);
        expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(AMOUNT_02);
      });

      it('ClaimAndStake should work (partial)', async () => {
        const recepientBalanceBefore = await bard.balanceOf(RECIPIENT_03);
        const recepientSharesBalanceBefore = await vault.balanceOf(RECIPIENT_03);
        const tdBalanceBefore = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceBefore = await bard.balanceOf(vault.address);

        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[],uint256)'].populateTransaction(
          RECIPIENT_03,
          AMOUNT_03,
          PROOF_03,
          AMOUNT_03 / 4n
        );
        const txRes = await recipient3.sendTransaction(tx);
        await expect(txRes).to.emit(tokenDistributor, 'Claimed').withArgs(RECIPIENT_03, AMOUNT_03);

        const recipientBalanceAfter = await bard.balanceOf(RECIPIENT_03);
        const recepientSharesBalanceAfter = await vault.balanceOf(RECIPIENT_03);
        const tdBalanceAfter = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceAfter = await bard.balanceOf(vault.address);

        expect(recipientBalanceAfter - recepientBalanceBefore).to.equal((AMOUNT_03 * 3n) / 4n);
        expect(recepientSharesBalanceAfter - recepientSharesBalanceBefore).to.equal(AMOUNT_03 / 4n);
        expect(tdBalanceAfter - tdBalanceBefore).to.equal(-AMOUNT_03);
        expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(AMOUNT_03 / 4n);
      });

      it('ClaimAndStake should work (partial but all)', async () => {
        const recepientBalanceBefore = await bard.balanceOf(RECIPIENT_03);
        const recepientSharesBalanceBefore = await vault.balanceOf(RECIPIENT_03);
        const tdBalanceBefore = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceBefore = await bard.balanceOf(vault.address);

        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[],uint256)'].populateTransaction(
          RECIPIENT_03,
          AMOUNT_03,
          PROOF_03,
          AMOUNT_03
        );
        const txRes = await recipient3.sendTransaction(tx);
        await expect(txRes).to.emit(tokenDistributor, 'Claimed').withArgs(RECIPIENT_03, AMOUNT_03);

        const recipientBalanceAfter = await bard.balanceOf(RECIPIENT_03);
        const recepientSharesBalanceAfter = await vault.balanceOf(RECIPIENT_03);
        const tdBalanceAfter = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceAfter = await bard.balanceOf(vault.address);

        expect(recipientBalanceAfter - recepientBalanceBefore).to.equal(0n);
        expect(recepientSharesBalanceAfter - recepientSharesBalanceBefore).to.equal(AMOUNT_03);
        expect(tdBalanceAfter - tdBalanceBefore).to.equal(-AMOUNT_03);
        expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(AMOUNT_03);
      });

      it('ClaimAndStake should work (partial but zero stake)', async () => {
        const recepientBalanceBefore = await bard.balanceOf(RECIPIENT_03);
        const recepientSharesBalanceBefore = await vault.balanceOf(RECIPIENT_03);
        const tdBalanceBefore = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceBefore = await bard.balanceOf(vault.address);

        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[],uint256)'].populateTransaction(
          RECIPIENT_03,
          AMOUNT_03,
          PROOF_03,
          0n
        );
        const txRes = await recipient3.sendTransaction(tx);
        await expect(txRes).to.emit(tokenDistributor, 'Claimed').withArgs(RECIPIENT_03, AMOUNT_03);

        const recipientBalanceAfter = await bard.balanceOf(RECIPIENT_03);
        const recepientSharesBalanceAfter = await vault.balanceOf(RECIPIENT_03);
        const tdBalanceAfter = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceAfter = await bard.balanceOf(vault.address);

        expect(recipientBalanceAfter - recepientBalanceBefore).to.equal(AMOUNT_03);
        expect(recepientSharesBalanceAfter - recepientSharesBalanceBefore).to.equal(0n);
        expect(tdBalanceAfter - tdBalanceBefore).to.equal(-AMOUNT_03);
        expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(0n);
      });

      it('ClaimWithProof should work (tx sent by recipient)', async () => {
        const recepientBalanceBefore = await bard.balanceOf(receiver.address);
        const tdBalanceBefore = await bard.balanceOf(tokenDistributor.address);
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        const tx = await tokenDistributor
          .connect(receiver)
          .claimWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, approverProof);
        await expect(tx)
          .to.emit(tokenDistributor, 'ClaimedWithProof')
          .withArgs(RECIPIENT_SUI, AMOUNT_SUI, receiver.address);

        const recipientBalanceAfter = await bard.balanceOf(receiver.address);
        const tdBalanceAfter = await bard.balanceOf(tokenDistributor.address);

        expect(recipientBalanceAfter - recepientBalanceBefore).to.equal(AMOUNT_SUI);
        expect(tdBalanceAfter - tdBalanceBefore).to.equal(-AMOUNT_SUI);
      });

      it('ClaimWithProof should work (tx sent by 3rd party)', async () => {
        const recepientBalanceBefore = await bard.balanceOf(receiver.address);
        const tdBalanceBefore = await bard.balanceOf(tokenDistributor.address);
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        const tx = await tokenDistributor
          .connect(signer1)
          .claimWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, approverProof);
        await expect(tx)
          .to.emit(tokenDistributor, 'ClaimedWithProof')
          .withArgs(RECIPIENT_SUI, AMOUNT_SUI, receiver.address);

        const recipientBalanceAfter = await bard.balanceOf(receiver.address);
        const tdBalanceAfter = await bard.balanceOf(tokenDistributor.address);

        expect(recipientBalanceAfter - recepientBalanceBefore).to.equal(AMOUNT_SUI);
        expect(tdBalanceAfter - tdBalanceBefore).to.equal(-AMOUNT_SUI);
      });

      it('claimAndStakeWithProof should work (partial)', async () => {
        const recepientBalanceBefore = await bard.balanceOf(receiver.address);
        const recepientSharesBalanceBefore = await vault.balanceOf(receiver.address);
        const tdBalanceBefore = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceBefore = await bard.balanceOf(vault.address);
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        const tx = await tokenDistributor
          .connect(receiver)
          .claimAndStakeWithProof(
            RECIPIENT_SUI,
            AMOUNT_SUI,
            receiver.address,
            PROOF_SUI,
            AMOUNT_SUI / 4n,
            approverProof
          );
        await expect(tx)
          .to.emit(tokenDistributor, 'ClaimedWithProof')
          .withArgs(RECIPIENT_SUI, AMOUNT_SUI, receiver.address);

        const recipientBalanceAfter = await bard.balanceOf(receiver.address);
        const recepientSharesBalanceAfter = await vault.balanceOf(receiver.address);
        const tdBalanceAfter = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceAfter = await bard.balanceOf(vault.address);

        expect(recipientBalanceAfter - recepientBalanceBefore).to.equal((AMOUNT_SUI * 3n) / 4n);
        expect(recepientSharesBalanceAfter - recepientSharesBalanceBefore).to.equal(AMOUNT_SUI / 4n);
        expect(tdBalanceAfter - tdBalanceBefore).to.equal(-AMOUNT_SUI);
        expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(AMOUNT_SUI / 4n);
      });

      it('claimAndStakeWithProof should work (partial but all)', async () => {
        const recepientBalanceBefore = await bard.balanceOf(receiver.address);
        const recepientSharesBalanceBefore = await vault.balanceOf(receiver.address);
        const tdBalanceBefore = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceBefore = await bard.balanceOf(vault.address);
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        const tx = await tokenDistributor
          .connect(receiver)
          .claimAndStakeWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, AMOUNT_SUI, approverProof);
        await expect(tx)
          .to.emit(tokenDistributor, 'ClaimedWithProof')
          .withArgs(RECIPIENT_SUI, AMOUNT_SUI, receiver.address);

        const recipientBalanceAfter = await bard.balanceOf(receiver.address);
        const recepientSharesBalanceAfter = await vault.balanceOf(receiver.address);
        const tdBalanceAfter = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceAfter = await bard.balanceOf(vault.address);

        expect(recipientBalanceAfter - recepientBalanceBefore).to.equal(0n);
        expect(recepientSharesBalanceAfter - recepientSharesBalanceBefore).to.equal(AMOUNT_SUI);
        expect(tdBalanceAfter - tdBalanceBefore).to.equal(-AMOUNT_SUI);
        expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(AMOUNT_SUI);
      });

      it('claimAndStakeWithProof should work (0 stake)', async () => {
        const recepientBalanceBefore = await bard.balanceOf(receiver.address);
        const recepientSharesBalanceBefore = await vault.balanceOf(receiver.address);
        const tdBalanceBefore = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceBefore = await bard.balanceOf(vault.address);
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        const tx = await tokenDistributor
          .connect(receiver)
          .claimAndStakeWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, 0n, approverProof);
        await expect(tx)
          .to.emit(tokenDistributor, 'ClaimedWithProof')
          .withArgs(RECIPIENT_SUI, AMOUNT_SUI, receiver.address);

        const recipientBalanceAfter = await bard.balanceOf(receiver.address);
        const recepientSharesBalanceAfter = await vault.balanceOf(receiver.address);
        const tdBalanceAfter = await bard.balanceOf(tokenDistributor.address);
        const vaultBalanceAfter = await bard.balanceOf(vault.address);

        expect(recipientBalanceAfter - recepientBalanceBefore).to.equal(AMOUNT_SUI);
        expect(recepientSharesBalanceAfter - recepientSharesBalanceBefore).to.equal(0n);
        expect(tdBalanceAfter - tdBalanceBefore).to.equal(-AMOUNT_SUI);
        expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(0n);
      });
    });

    describe('Negative cases', function () {
      beforeEach(async function () {
        await snapshot.restore();
      });

      it('Claim should not work after claim end', async () => {
        await time.increaseTo(claimEnd);

        const tx = await tokenDistributor.claim.populateTransaction(RECIPIENT_01, AMOUNT_01, PROOF_01);

        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'ClaimFinished');
      });

      it('ClaimAndStake should not work after claim end (stake all)', async () => {
        await time.increaseTo(claimEnd);

        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[])'].populateTransaction(
          RECIPIENT_01,
          AMOUNT_01,
          PROOF_01
        );

        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'ClaimFinished');
      });

      it('ClaimAndStake should not work after claim end (partial stake)', async () => {
        await time.increaseTo(claimEnd);

        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[],uint256)'].populateTransaction(
          RECIPIENT_01,
          AMOUNT_01,
          PROOF_01,
          AMOUNT_01 / 2n
        );

        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'ClaimFinished');
      });

      it('Claim should not work second time', async () => {
        const tx = await tokenDistributor.claim.populateTransaction(RECIPIENT_01, AMOUNT_01, PROOF_01);
        await recipient1.sendTransaction(tx);

        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'AlreadyClaimed');
      });

      it('ClaimAndStake should not work second time', async () => {
        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[])'].populateTransaction(
          RECIPIENT_01,
          AMOUNT_01,
          PROOF_01
        );
        await recipient1.sendTransaction(tx);

        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'AlreadyClaimed');
      });

      it('ClaimAndStake should not work second time', async () => {
        const tx1 = await tokenDistributor.claim.populateTransaction(RECIPIENT_01, AMOUNT_01, PROOF_01);
        await recipient1.sendTransaction(tx1);

        const tx2 = await tokenDistributor['claimAndStake(address,uint256,bytes32[],uint256)'].populateTransaction(
          RECIPIENT_01,
          AMOUNT_01,
          PROOF_01,
          AMOUNT_01
        );
        await expect(recipient1.sendTransaction(tx2)).to.revertedWithCustomError(tokenDistributor, 'AlreadyClaimed');
      });

      it('Claim should not work if proof is wrong', async () => {
        const tx = await tokenDistributor.claim.populateTransaction(RECIPIENT_01, AMOUNT_01, WRONG_PROOF);
        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'InvalidMerkleProof');
      });

      it('ClaimAndStake should not work if proof is wrong (stake all)', async () => {
        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[])'].populateTransaction(
          RECIPIENT_01,
          AMOUNT_01,
          WRONG_PROOF
        );
        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'InvalidMerkleProof');
      });

      it('ClaimAndStake should not work if proof is wrong (partial stake)', async () => {
        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[],uint256)'].populateTransaction(
          RECIPIENT_01,
          AMOUNT_01,
          WRONG_PROOF,
          AMOUNT_01 / 2n
        );
        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'InvalidMerkleProof');
      });

      it('Claim should not work if amount is 0', async () => {
        const tx = await tokenDistributor.claim.populateTransaction(RECIPIENT_01, 0n, PROOF_01);
        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'InvalidAmount');
      });

      it('ClaimAndStake should not work if amount is 0 (stake all)', async () => {
        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[])'].populateTransaction(
          RECIPIENT_01,
          0n,
          PROOF_01
        );
        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'InvalidAmount');
      });

      it('ClaimAndStake should not work if amount is 0 (partial stake)', async () => {
        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[],uint256)'].populateTransaction(
          RECIPIENT_01,
          0n,
          PROOF_01,
          0n
        );
        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'InvalidAmount');
      });

      it('ClaimAndStake should not work if amount  to stake is more than amount to claim', async () => {
        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[],uint256)'].populateTransaction(
          RECIPIENT_01,
          AMOUNT_01,
          PROOF_01,
          AMOUNT_01 + 1n
        );
        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'WrongStakeAmount');
      });

      it('Claim should not work if contract is paused', async () => {
        await tokenDistributor.connect(pauser).pause();

        const tx = await tokenDistributor.claim.populateTransaction(RECIPIENT_01, AMOUNT_01, PROOF_01);

        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'EnforcedPause');
      });

      it('ClaimAndStake should not work if contract is paused (stake all)', async () => {
        await tokenDistributor.connect(pauser).pause();

        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[])'].populateTransaction(
          RECIPIENT_01,
          AMOUNT_01,
          PROOF_01
        );

        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'EnforcedPause');
      });

      it('ClaimAndStake should not work if contract is paused (partial stake)', async () => {
        await tokenDistributor.connect(pauser).pause();

        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[],uint256)'].populateTransaction(
          RECIPIENT_01,
          AMOUNT_01,
          PROOF_01,
          AMOUNT_01 / 2n
        );

        await expect(recipient1.sendTransaction(tx)).to.revertedWithCustomError(tokenDistributor, 'EnforcedPause');
      });

      it('ClaimAndStake should not work if called by NOT recipient', async () => {
        const tx = await tokenDistributor['claimAndStake(address,uint256,bytes32[],uint256)'].populateTransaction(
          RECIPIENT_01,
          AMOUNT_01,
          PROOF_01,
          AMOUNT_01 / 2n
        );

        await expect(recipient2.sendTransaction(tx)).to.revertedWithCustomError(
          tokenDistributor,
          'OnlyRecipientCanStake'
        );
      });

      it('ClaimWithProof should not work after claim end', async () => {
        await time.increaseTo(claimEnd);

        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, approverProof)
        ).to.revertedWithCustomError(tokenDistributor, 'ClaimFinished');
      });

      it('claimAndStakeWithProof should not work after claim end (partial stake)', async () => {
        await time.increaseTo(claimEnd);

        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimAndStakeWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, AMOUNT_SUI, approverProof)
        ).to.revertedWithCustomError(tokenDistributor, 'ClaimFinished');
      });

      it('ClaimWithProof should not work second time', async () => {
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await tokenDistributor.claimWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, approverProof);

        await expect(
          tokenDistributor.claimWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, approverProof)
        ).to.revertedWithCustomError(tokenDistributor, 'AlreadyClaimed');
      });

      it('claimAndStakeWithProof should not work second time', async () => {
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await tokenDistributor
          .connect(receiver)
          .claimAndStakeWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, AMOUNT_SUI, approverProof);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimAndStakeWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, AMOUNT_SUI, approverProof)
        ).to.revertedWithCustomError(tokenDistributor, 'AlreadyClaimed');
      });

      it('ClaimWithProof should not work if proof is wrong', async () => {
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, WRONG_PROOF, approverProof)
        ).to.revertedWithCustomError(tokenDistributor, 'InvalidMerkleProof');
      });

      it('claimAndStakeWithProof should not work if proof is wrong (partial stake)', async () => {
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimAndStakeWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, WRONG_PROOF, AMOUNT_SUI, approverProof)
        ).to.revertedWithCustomError(tokenDistributor, 'InvalidMerkleProof');
      });

      it('claimAndStakeWithProof should not work if amount is 0', async () => {
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, 0n, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimWithProof(RECIPIENT_SUI, 0n, receiver.address, PROOF_SUI, approverProof)
        ).to.revertedWithCustomError(tokenDistributor, 'InvalidAmount');
      });

      it('claimAndStakeWithProof should not work if amount is 0 (partial stake)', async () => {
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, 0n, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimAndStakeWithProof(RECIPIENT_SUI, 0n, receiver.address, PROOF_SUI, 0n, approverProof)
        ).to.revertedWithCustomError(tokenDistributor, 'InvalidAmount');
      });

      it('claimAndStakeWithProof should not work if amount to stake is more than amount to claim', async () => {
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI + 1n, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimAndStakeWithProof(
              RECIPIENT_SUI,
              AMOUNT_SUI,
              receiver.address,
              PROOF_SUI,
              AMOUNT_SUI + 1n,
              approverProof
            )
        ).to.revertedWithCustomError(tokenDistributor, 'WrongStakeAmount');
      });

      it('ClaimWithProof should not work if contract is paused', async () => {
        await tokenDistributor.connect(pauser).pause();

        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, WRONG_PROOF, approverProof)
        ).to.revertedWithCustomError(tokenDistributor, 'EnforcedPause');
      });

      it('claimAndStakeWithProof should not work if contract is paused (partial stake)', async () => {
        await tokenDistributor.connect(pauser).pause();

        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimAndStakeWithProof(
              RECIPIENT_SUI,
              AMOUNT_SUI,
              receiver.address,
              PROOF_SUI,
              AMOUNT_SUI / 2n,
              approverProof
            )
        ).to.revertedWithCustomError(tokenDistributor, 'EnforcedPause');
      });

      it('ClaimWithProof should not work if approver proof is wrong', async () => {
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(signer1, approveHash);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, approverProof)
        ).to.revertedWithCustomError(tokenDistributor, 'InvalidProof');
      });

      it('claimAndStakeWithProof should not work if approver proof is wrong', async () => {
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(signer1, approveHash);

        await expect(
          tokenDistributor
            .connect(receiver)
            .claimAndStakeWithProof(
              RECIPIENT_SUI,
              AMOUNT_SUI,
              receiver.address,
              PROOF_SUI,
              AMOUNT_SUI / 2n,
              approverProof
            )
        ).to.revertedWithCustomError(tokenDistributor, 'InvalidProof');
      });

      it('claimAndStakeWithProof should not work if called not by the recipient', async () => {
        const approveHash = ethers.keccak256(
          encode(['bytes32', 'uint256', 'address'], [RECIPIENT_SUI, AMOUNT_SUI, receiver.address])
        );
        const approverProof = rawSign(approver, approveHash);

        await expect(
          tokenDistributor
            .connect(signer1)
            .claimAndStakeWithProof(RECIPIENT_SUI, AMOUNT_SUI, receiver.address, PROOF_SUI, AMOUNT_SUI, approverProof)
        ).to.revertedWithCustomError(tokenDistributor, 'OnlyRecipientCanStake');
      });
    });
  });

  describe('Withdraw', function () {
    beforeEach(async function () {
      await snapshot.restore();
    });

    it('Positive: withdraw after claim end should work', async () => {
      await time.increaseTo(claimEnd);
      const balanceBefore = await bard.balanceOf(owner.address);
      const tokenDistributorBalanceBefore = await bard.balanceOf(tokenDistributor.address);

      const tx = await tokenDistributor.connect(owner).withdraw();
      await expect(tx).to.emit(tokenDistributor, 'Withdrawn').withArgs(owner.address, tokenDistributorBalanceBefore);

      const balanceAfter = await bard.balanceOf(owner.address);
      const tokenDistributorBalanceAfter = await bard.balanceOf(tokenDistributor.address);
      expect(balanceAfter - balanceBefore).to.equal(tokenDistributorBalanceBefore);
      expect(tokenDistributorBalanceAfter).to.equal(0n);
    });

    it('Negative: withdraw before claim end should not work', async () => {
      await expect(tokenDistributor.connect(owner).withdraw()).to.revertedWithCustomError(
        tokenDistributor,
        'ClaimNotFinished'
      );
    });

    it('Negative: withdraw after claim end should not work if called not by the owner', async () => {
      await time.increaseTo(claimEnd + 1);
      await expect(tokenDistributor.connect(signer1).withdraw())
        .to.revertedWithCustomError(tokenDistributor, 'OwnableUnauthorizedAccount')
        .withArgs(signer1.address);
    });
  });
});
