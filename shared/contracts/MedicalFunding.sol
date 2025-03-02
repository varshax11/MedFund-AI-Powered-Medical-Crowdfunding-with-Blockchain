// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MedicalFunding {
    struct Patient {
        address hospitalWallet;
        uint256 fundingGoalINR;
        uint256 amountRaisedINR;
        bool isActive;
        uint256 lastWithdrawal;
        uint256 ethPriceInINR;
    }

    mapping(uint256 => Patient) public patients;

    event DonationMade(uint256 patientId, uint256 amountINR, address donor);
    event PatientRegistered(uint256 patientId, address hospitalWallet, uint256 fundingGoalINR);

    function registerPatient(
        uint256 _patientId,
        address payable _hospitalWallet,
        uint256 _fundingGoalINR,
        uint256 _initialEthPriceInINR
    ) external {
        require(_hospitalWallet != address(0), "Invalid hospital wallet");
        require(_fundingGoalINR > 0, "Invalid funding goal");
        require(!patients[_patientId].isActive, "Patient already registered");

        patients[_patientId] = Patient({
            hospitalWallet: _hospitalWallet,
            fundingGoalINR: _fundingGoalINR,
            amountRaisedINR: 0,
            isActive: true,
            lastWithdrawal: block.timestamp,
            ethPriceInINR: _initialEthPriceInINR
        });

        emit PatientRegistered(_patientId, _hospitalWallet, _fundingGoalINR);
    }

    function donateWithRupeeValue(uint256 _patientId, uint256 _amountINR) external payable {
        Patient storage patient = patients[_patientId];
        require(patient.isActive, "Patient fundraising not active");
        
        // Verify the ETH amount sent matches the INR value
        uint256 expectedWeiAmount = (_amountINR * 1e18) / patient.ethPriceInINR;
        require(msg.value >= expectedWeiAmount, "Insufficient ETH sent");

        // Transfer ETH to hospital wallet
        payable(patient.hospitalWallet).transfer(msg.value);
        
        // Update raised amount
        patient.amountRaisedINR += _amountINR;
        
        emit DonationMade(_patientId, _amountINR, msg.sender);
    }

    function getPatientDetails(uint256 _patientId) external view returns (
        address hospitalWallet,
        uint256 fundingGoalINR,
        uint256 amountRaisedINR,
        bool isActive,
        uint256 lastWithdrawal,
        uint256 ethPriceInINR
    ) {
        Patient storage patient = patients[_patientId];
        return (
            patient.hospitalWallet,
            patient.fundingGoalINR,
            patient.amountRaisedINR,
            patient.isActive,
            patient.lastWithdrawal,
            patient.ethPriceInINR
        );
    }
}
