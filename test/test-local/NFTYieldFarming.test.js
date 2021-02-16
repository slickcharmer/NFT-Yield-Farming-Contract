/// Using local network
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));

/// Openzeppelin test-helper
const { time } = require('@openzeppelin/test-helpers');

/// Artifact of smart contracts 
const NFTYieldFarming = artifacts.require("NFTYieldFarming");
const NFTToken = artifacts.require("MockNFTToken");  /// As a NFT token (ERC1155)
const LPToken = artifacts.require("MockLPToken");    /// As a LP token
const GovernanceToken = artifacts.require("GovernanceToken");  /// As a reward token and a governance token

/***
 * @dev - Execution COMMAND: $ truffle test ./test/test-local/NFTYieldFarming.test.js
 **/
contract("NFTYieldFarming", function(accounts) {
    /// Acccounts
    let deployer = accounts[0];
    let admin = accounts[1];
    let user1 = accounts[2];
    let user2 = accounts[3];

    /// Global contract instance
    let nftYieldFarming;
    let nftToken;
    let lpToken;
    let governanceToken;

    /// Global variable for each contract addresses
    let NFT_YIELD_FARMING;
    let NFT_TOKEN;
    let LP_TOKEN;
    let GOVERNANCE_TOKEN;

    describe("Check state in advance", () => {
        it("Check all accounts", async () => {
            console.log('\n=== accounts ===\n', accounts, '\n========================\n');
        }); 
    }); 

    describe("Setup smart-contracts", () => {
        it("Deploy the NFT token (ERC721) contract instance", async () => {
            nftToken = await NFTToken.new({ from: deployer });
            NFT_TOKEN = nftToken.address;
        });

        it("Deploy the LP token (ERC20) contract instance", async () => {
            lpToken = await LPToken.new({ from: deployer });
            LP_TOKEN = lpToken.address;
        });

        it("Deploy the Governance token (ERC20) contract instance", async () => {
            governanceToken = await GovernanceToken.new({ from: deployer });
            GOVERNANCE_TOKEN = governanceToken.address;
        });

        it("Deploy the NFTYieldFarming contract instance", async () => {
            /// [Note]: 100 per block farming rate starting at block 300 with bonus until block 1000
            const _devaddr = admin;  /// Admin address
            const _governanceTokenPerBlock = "100";
            const _startBlock = "300";
            const _bonusEndBlock = "1000";

            nftYieldFarming = await NFTYieldFarming.new(GOVERNANCE_TOKEN, _devaddr, _governanceTokenPerBlock, _startBlock, _bonusEndBlock, { from: deployer });
            NFT_YIELD_FARMING = nftYieldFarming.address;
        });

        it("Transfer ownership of the Governance token (ERC20) contract to the NFTYieldFarming contract", async () => {
            /// [Test]: Mint
            // const _mintAmount = web3.utils.toWei('100', 'ether');
            // await governanceToken.mint(user1, _mintAmount, { from: deployer});

            const newOwner = NFT_YIELD_FARMING;
            const txReceipt = await governanceToken.transferOwnership(newOwner, { from: deployer });
        });        
    });

    describe("Preparation for tests in advance", () => {
        it("Mint the NFT token (ERC721) to user1", async () => {
            const tokenURI = "https://testnft.example/token-id-8u5h2m.json";
            let txReceipt = await nftToken.mintTo(user1, tokenURI, { from: deployer });
        });

        it("Transfer the LP token (ERC20) from deployer to user1", async () => {
            const amount = web3.utils.toWei('1000', 'ether');
            let txReceipt1 = await lpToken.transfer(user1, amount, { from: deployer });
            let txReceipt2 = await lpToken.transfer(user2, amount, { from: deployer });
        });
    });

    describe("Process of the NFT yield farming (in case all staked-LP tokens are not withdrawn)", () => {
        it("Add a new NFT Pool as a target", async () => {
            const _nftToken = NFT_TOKEN;  /// NFT token as a target to stake
            const _lpToken = LP_TOKEN;    /// LP token to be staked
            const _allocPoint = "100";
            const _withUpdate = true;    
            let txReceipt = await nftYieldFarming.addNFTPool(_nftToken, _lpToken, _allocPoint, _withUpdate, { from: deployer });
        });

        it("User1 stake 10 LP tokens at block 310", async () => {
            /// [Note]: Block to mint the GovernanceToken start from block 300.
            /// User1 stake (deposit) 10 LP tokens at block 310.
            await time.advanceBlockTo("309");

            const _nftPoolId = 0;
            const _stakeAmount = web3.utils.toWei('10', 'ether');  /// 10 LP Token

            let txReceipt1 = await lpToken.approve(NFT_YIELD_FARMING, _stakeAmount, { from: user1 });
            let txReceipt2 = await nftYieldFarming.deposit(_nftPoolId, _stakeAmount, { from: user1 });
        });

        it("User2 stake 10 LP tokens at block 314", async () => {
            /// [Note]: Block to mint the GovernanceToken start from block 300.
            /// User2 stake (deposit) 20 LP tokens at block 314.
            await time.advanceBlockTo("313");

            const _nftPoolId = 0;
            const _stakeAmount = web3.utils.toWei('20', 'ether');  /// 20 LP Token

            let txReceipt1 = await lpToken.approve(NFT_YIELD_FARMING, _stakeAmount, { from: user2 });
            let txReceipt2 = await nftYieldFarming.deposit(_nftPoolId, _stakeAmount, { from: user2 });
        });

        it("User1 stake more 10 LP tokens at block 320", async () => {
            /// [Note]: Block to mint the GovernanceToken start from block 300.
            /// User1 stake (deposit) 10 LP tokens at block 320.
            await time.advanceBlockTo("319");

            const _nftPoolId = 0;
            const _stakeAmount = web3.utils.toWei('10', 'ether');  /// 10 LP Token

            let txReceipt1 = await lpToken.approve(NFT_YIELD_FARMING, _stakeAmount, { from: user1 });
            let txReceipt2 = await nftYieldFarming.deposit(_nftPoolId, _stakeAmount, { from: user1 });
        });


        it("Current block should be at block 321", async () => {
            let currentBlock = await time.latestBlock();
            console.log('=== currentBlock ===', String(currentBlock));

            assert.equal(
                currentBlock,
                "321",
                "Current block should be 321"
            );
        });

        it("Total Supply of the GovernanceToken should be 11000 (at block 321)", async () => {
            ///  At this point (At block 321): 
            ///      TotalSupply of GovernanceToken: 1000 * (321 - 310) = 11000
            ///      User1 should have: 4*1000 + 4*1/3*1000 + 2*1/6*1000 = 5666
            ///      NFTYieldFarming contract should have the remaining: 10000 - 5666 = 4334
            let totalSupplyOfGovernanceToken = await governanceToken.totalSupply();
            console.log('=== totalSupplyOfGovernanceToken ===', String(totalSupplyOfGovernanceToken));

            assert.equal(
                totalSupplyOfGovernanceToken,
                "11000",
                "Total supply of the Governance tokens (at block 321) should be 11000"
            );
        });

        it("GovernanceToken balance of user1 should be 5666 (at block 321)", async () => {
            let governanceTokenBalanceOfUser1 = await governanceToken.balanceOf(user1, { from: user1 });
            console.log('=== GovernanceToken balance of user1 ===', String(governanceTokenBalanceOfUser1));
        });

        it("Un-stake and withdraw specified amount of LP tokens and receive reward tokens", async () => {
            const _nftPoolId = 0;
            const _unStakeAmount = web3.utils.toWei('50', 'ether');  /// 50 LP Token
            let txReceipt = await nftYieldFarming.withdraw(_nftPoolId, _unStakeAmount, { from: user1 });
        
            let governanceTokenBalanceOfUser1 = await governanceToken.balanceOf(user1, { from: user1 });
            console.log('=== GovernanceToken balance of user1 ===', String(governanceTokenBalanceOfUser1));
        });
    });

});
