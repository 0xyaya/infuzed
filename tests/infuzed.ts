import * as anchor from '@coral-xyz/anchor';
import {Program, utils, BN, AnchorProvider} from '@coral-xyz/anchor';
import {Keypair, PublicKey} from '@solana/web3.js';
import {Infuzed} from '../target/types/infuzed';
// import {
//     AggregatorAccount,
//     SwitchboardProgram
// } from '@switchboard-xyz/solana.js';
import {expect} from 'chai';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const requestAirdrop = async (connection, wallet, amount) => {
    console.log(`Requesting airdrop for ${wallet}`);
    const signature = await connection.requestAirdrop(
        new PublicKey(wallet),
        amount * 1000000000
    );
    const {blockhash, lastValidBlockHeight} =
        await connection.getLatestBlockhash();
    await connection.confirmTransaction(
        {
            blockhash,
            lastValidBlockHeight,
            signature
        },
        'finalized'
    );
    console.log(
        `Tx Complete: https://explorer.solana.com/tx/${signature}?cluster=devnet`
    );
};

describe('infuzed', () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const provider = AnchorProvider.local('http://localhost:8899', {
        preflightCommitment: 'confirmed'
    });
    // const provider = AnchorProvider.env();

    // Configure the client to use the local cluster.
    const program = anchor.workspace.Infuzed as Program<Infuzed>;

    const [state] = PublicKey.findProgramAddressSync(
        [utils.bytes.utf8.encode('controller-details')],
        program.programId
    );

    // const holdingAccount = new anchor.web3.Keypair();
    const holdingAccount = new PublicKey(
        '6ACx2p98pF7m58GYZViCtv4sxYED9Yj5HDcMZk6BR1FK'
    );
    // const feesAccount = new anchor.web3.Keypair();
    const feesAccount = new PublicKey(
        '735WcMTFNG3qXQat7VP2uxMpSvts969xg5vnKPiDpsp9'
    ); //735WcMTFNG3qXQat7VP2uxMpSvts969xg5vnKPiDpsp9
    const feedStalenessThreshold = new BN(10000);
    const nftMint = Keypair.generate();

    // let switchboard: SwitchboardProgram;
    // let aggregatorAccount: AggregatorAccount;
    // let aggregatorAccountNctUsd: AggregatorAccount;

    const nctUsdPriceFeed = new PublicKey(
        '4YL36VBtFkD2zfNGWdGFSc5suvskjrHnx3Asuksyek1J'
    );
    const solUsdPriceFeed = new PublicKey(
        'GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR'
    );

    // before(async () => {
    //   switchboard = await SwitchboardProgram.fromProvider(provider);
    //   aggregatorAccount = new AggregatorAccount(
    //     switchboard,
    //     solUsdPriceFeed
    //   );
    //   aggregatorAccountNctUsd = new AggregatorAccount(
    //     switchboard,
    //     nctUsdPriceFeed
    //   );
    // });

    it('Is initialized!', async () => {
        const tx = await program.methods
            .initialize()
            .accounts({
                state,
                feesAccount: feesAccount
            })
            .rpc();

        console.log('Your transaction signature', tx);
    });

    it('Register a first strategy!', async () => {
        try {
            // Add your test here.
            const tx = await program.methods
                .registerStrategy(100)
                .accounts({
                    controllerDetails: state,
                    holdingAccount: holdingAccount
                })
                .rpc();
            console.log('Your transaction signature', tx);
        } catch (e) {
            console.log(e);
        }
    });

    it('Infused an account!', async () => {
        // await requestAirdrop(
        //     provider.connection,
        //     provider.wallet.publicKey,
        //     100
        // );
        const [infusedAccount] = PublicKey.findProgramAddressSync(
            [
                utils.bytes.utf8.encode('infused-account'),
                nftMint.publicKey.toBytes()
            ],
            program.programId
        );
        const signerAccountBalanceBefore = await provider.connection.getBalance(
            provider.wallet.publicKey
        );

        try {
            const tx = await program.methods
                .infuse(new BN(1))
                .accounts({
                    controllerDetails: state,
                    nftMint: nftMint.publicKey,
                    infusedAccount,
                    feesAccount: feesAccount
                })
                .remainingAccounts([
                    {
                        pubkey: holdingAccount,
                        isWritable: true,
                        isSigner: false
                    }
                ])
                .rpc({commitment: 'confirmed'});

            const txTwo = await program.methods
                .infuse(new BN(2))
                .accounts({
                    controllerDetails: state,
                    nftMint: nftMint.publicKey,
                    infusedAccount,
                    feesAccount: feesAccount
                })
                .remainingAccounts([
                    {
                        pubkey: holdingAccount,
                        isWritable: true,
                        isSigner: false
                    }
                ])
                .rpc({commitment: 'confirmed'});

            console.log('Your transaction signature', tx);
            console.log('Your transaction signature 2', txTwo);
        } catch (e) {
            console.log(e);
        }

        const holdingAccountBalance = await provider.connection.getBalance(
            holdingAccount
        );
        const newFeesAccountBalance = await provider.connection.getBalance(
            feesAccount
        );
        const signerAccountBalance = await provider.connection.getBalance(
            provider.wallet.publicKey
        );

        // const [infusedAccountAddress] = PublicKey.findProgramAddressSync(
        //     [
        //         utils.bytes.utf8.encode('infused-account'),
        //         nftMint.publicKey.toBytes()
        //     ],
        //     program.programId
        // );
        // const infusedAccountState = await program.account.infusedAccount.fetch(
        //     infusedAccount
        // );

        expect(
            holdingAccountBalance,
            'The holding account should have more than 1 lamports'
        ).to.be.greaterThan(new BN(1).toNumber());
        expect(
            newFeesAccountBalance,
            'The fees account should have more than 1 lamports'
        ).to.be.greaterThan(new BN(1).toNumber());
        expect(
            signerAccountBalance,
            'The signer account should have less lamports'
        ).to.be.lessThan(signerAccountBalanceBefore);
    });

    it('increase the carbon score', async () => {
        const [infusedAccountAddress] = PublicKey.findProgramAddressSync(
            [
                utils.bytes.utf8.encode('infused-account'),
                nftMint.publicKey.toBytes()
            ],
            program.programId
        );
        const infusedAccount = await program.account.infusedAccount.fetch(
            infusedAccountAddress
        );

        console.log(
            'infusedAccount carbonScore: ',
            infusedAccount.carbonScore.toNumber()
        );

        expect(
            infusedAccount.carbonScore.toNumber(),
            'The infused carbon score is greater than 0'
        ).to.be.greaterThan(0);
    });

    it('emit an event when infused', async () => {
        const coder = new anchor.BorshCoder(program.idl);
        const eventParser = new anchor.EventParser(program.programId, coder);
        let transactionList = await provider.connection.getSignaturesForAddress(
            program.programId,
            {limit: 100}
        );

        const res = await Promise.all(
            transactionList.map(async (transaction, i) => {
                const tx = await provider.connection.getParsedTransaction(
                    transaction.signature,
                    {
                        commitment: 'confirmed'
                    }
                );

                const eventParser = new anchor.EventParser(
                    program.programId,
                    new anchor.BorshCoder(program.idl)
                );
                const events = eventParser
                    .parseLogs(tx.meta.logMessages)
                    .next();

                if (events.value && events.value.name === 'AccountInfused') {
                    return {
                        txSignature: transaction.signature,
                        amount: Number(events.value.data.amount),
                        date: new Date(Number(events.value.data.time) * 1000)
                    };
                } else return null;
            })
        );

        const total = res
            .filter((el) => el !== null)
            .reduce((acc, val) => acc + val.amount, 0);

        expect(
            total,
            'The total infused amount is greater than 0'
        ).to.be.greaterThan(0);
    });
});
