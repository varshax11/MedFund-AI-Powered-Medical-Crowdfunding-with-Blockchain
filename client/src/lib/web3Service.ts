import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';

const contractABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_patientId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_amountINR",
        "type": "uint256"
      }
    ],
    "name": "donateWithRupeeValue",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_patientId",
        "type": "uint256"
      },
      {
        "internalType": "address payable",
        "name": "_hospitalWallet",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_fundingGoalINR",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_initialEthPriceInINR",
        "type": "uint256"
      }
    ],
    "name": "registerPatient",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_patientId",
        "type": "uint256"
      }
    ],
    "name": "getPatientDetails",
    "outputs": [
      {
        "internalType": "address",
        "name": "hospitalWallet",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "fundingGoalINR",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amountRaisedINR",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "isActive",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "lastWithdrawal",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "ethPriceInINR",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

class Web3Service {
  private web3: Web3 | null = null;
  private contract: Contract | null = null;
  private contractAddress: string = import.meta.env.VITE_CONTRACT_ADDRESS;

  async initialize() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        this.web3 = new Web3(window.ethereum);
        this.contract = new this.web3.eth.Contract(
          contractABI as AbiItem[],
          this.contractAddress
        );

        // Verify contract connection
        const code = await this.web3.eth.getCode(this.contractAddress);
        if (code === '0x') {
          throw new Error('Invalid contract address');
        }

        return true;
      } catch (error) {
        console.error('Error initializing Web3:', error);
        return false;
      }
    } else {
      console.error('Please install MetaMask!');
      return false;
    }
  }

  async securePaymentOnBlockchain(patientId: number, amountINR: number) {
    if (!this.web3 || !this.contract) {
      throw new Error('Web3 not initialized');
    }

    const accounts = await this.web3.eth.getAccounts();
    if (!accounts.length) {
      throw new Error('No accounts available');
    }

    // Get patient details to check the conversion rate
    const patientDetails = await this.contract.methods.getPatientDetails(patientId).call();
    if (!patientDetails.isActive) {
      throw new Error('Patient fundraising is not active');
    }

    // Calculate ETH amount based on current rate
    const ethPriceInINR = patientDetails.ethPriceInINR;
    const ethAmount = (amountINR / Number(ethPriceInINR)).toString();
    const weiAmount = this.web3.utils.toWei(ethAmount, 'ether');

    // Send transaction to smart contract
    return this.contract.methods.donateWithRupeeValue(patientId, amountINR).send({
      from: accounts[0],
      value: weiAmount,
      gas: 200000,
    });
  }

  async registerPatient(
    patientId: number,
    hospitalWallet: string,
    fundingGoalINR: number,
    ethPriceInINR: number
  ) {
    if (!this.web3 || !this.contract) {
      throw new Error('Web3 not initialized');
    }

    const accounts = await this.web3.eth.getAccounts();
    if (!accounts.length) {
      throw new Error('No accounts available');
    }

    // Validate hospital wallet address
    if (!this.web3.utils.isAddress(hospitalWallet)) {
      throw new Error('Invalid hospital wallet address');
    }

    return this.contract.methods.registerPatient(
      patientId,
      hospitalWallet,
      fundingGoalINR,
      ethPriceInINR
    ).send({
      from: accounts[0],
      gas: 300000,
    });
  }

  async verifyTransaction(txHash: string) {
    if (!this.web3) {
      throw new Error('Web3 not initialized');
    }

    const receipt = await this.web3.eth.getTransactionReceipt(txHash);
    return {
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  }
}

export const web3Service = new Web3Service();