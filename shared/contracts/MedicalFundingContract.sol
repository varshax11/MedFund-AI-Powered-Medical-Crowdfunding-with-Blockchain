// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MedicalFundingContract {
    struct Patient {
        address payable hospitalWallet;
        uint256 fundingGoalINR;
        uint256 amountRaisedINR;
        bool isActive;
        uint256 lastWithdrawal;
        uint256 ethPriceInINR; // Current ETH to INR conversion rate
    }

    mapping(uint256 => Patient) public patients;
    mapping(address => uint256) public donations;
    address public admin;

    event DonationReceived(uint256 patientId, address donor, uint256 amountINR);
    event FundsTransferred(uint256 patientId, address hospital, uint256 amountINR);
    event PatientRegistered(uint256 patientId, address hospitalWallet);
    event ConversionRateUpdated(uint256 patientId, uint256 newRate);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier validAddress(address _address) {
        require(_address != address(0), "Invalid address");
        _;
    }

    function registerPatient(
        uint256 _patientId,
        address payable _hospitalWallet,
        uint256 _fundingGoalINR,
        uint256 _initialEthPriceInINR
    ) public onlyAdmin validAddress(_hospitalWallet) {
        require(!patients[_patientId].isActive, "Patient already registered");
        require(_fundingGoalINR > 0, "Funding goal must be greater than 0");
        require(_initialEthPriceInINR > 0, "Invalid ETH price");

        patients[_patientId] = Patient(
            _hospitalWallet,
            _fundingGoalINR,
            0,
            true,
            0,
            _initialEthPriceInINR
        );

        emit PatientRegistered(_patientId, _hospitalWallet);
    }

    function updateEthPrice(uint256 _patientId, uint256 _newEthPriceInINR) public onlyAdmin {
        require(patients[_patientId].isActive, "Patient not found");
        patients[_patientId].ethPriceInINR = _newEthPriceInINR;
        emit ConversionRateUpdated(_patientId, _newEthPriceInINR);
    }

    function donateWithRupeeValue(uint256 _patientId, uint256 _amountINR) public payable {
        require(patients[_patientId].isActive, "Patient not found");
        require(_amountINR > 0, "Amount must be greater than 0");

        Patient storage patient = patients[_patientId];

        // Calculate expected ETH based on current rate
        uint256 expectedWeiAmount = (_amountINR * 1e18) / patient.ethPriceInINR;
        require(msg.value >= expectedWeiAmount, "Insufficient ETH sent");

        patient.amountRaisedINR += _amountINR;
        donations[msg.sender] += _amountINR;

        emit DonationReceived(_patientId, msg.sender, _amountINR);

        // If funding goal is reached, transfer funds to hospital
        if (patient.amountRaisedINR >= patient.fundingGoalINR) {
            uint256 amountToTransfer = address(this).balance;
            patient.amountRaisedINR = 0;
            patient.lastWithdrawal = block.timestamp;

            (bool success, ) = patient.hospitalWallet.call{value: amountToTransfer}("");
            require(success, "Transfer to hospital failed");

            emit FundsTransferred(_patientId, patient.hospitalWallet, patient.fundingGoalINR);
        }
    }

    function getPatientDetails(uint256 _patientId) public view returns (
        address hospitalWallet,
        uint256 fundingGoalINR,
        uint256 amountRaisedINR,
        bool isActive,
        uint256 lastWithdrawal,
        uint256 ethPriceInINR
    ) {
        Patient memory patient = patients[_patientId];
        return (
            patient.hospitalWallet,
            patient.fundingGoalINR,
            patient.amountRaisedINR,
            patient.isActive,
            patient.lastWithdrawal,
            patient.ethPriceInINR
        );
    }

    function getDonorContribution(address _donor) public view returns (uint256) {
        return donations[_donor];
    }

    // Prevent direct transfers
    receive() external payable {
        revert("Direct transfers not allowed");
    }

    fallback() external payable {
        revert("Direct transfers not allowed");
    }
}