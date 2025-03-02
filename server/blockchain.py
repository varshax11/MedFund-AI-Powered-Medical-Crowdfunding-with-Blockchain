import hashlib
import json
from time import time
from typing import List, Dict, Any

class Block:
    def __init__(self, index: int, timestamp: float, transaction: Dict[str, Any], previous_hash: str):
        self.index = index
        self.timestamp = timestamp
        self.transaction = transaction
        self.previous_hash = previous_hash
        self.hash = self.calculate_hash()

    def calculate_hash(self) -> str:
        block_string = json.dumps({
            "index": self.index,
            "timestamp": self.timestamp,
            "transaction": self.transaction,
            "previous_hash": self.previous_hash
        }, sort_keys=True)
        return hashlib.sha256(block_string.encode()).hexdigest()

class Blockchain:
    def __init__(self):
        self.chain: List[Block] = []
        # Create genesis block
        self.create_block({
            "message": "Genesis Block",
            "amount": 0,
            "payment_id": "genesis"
        })

    def create_block(self, transaction: Dict[str, Any]) -> Block:
        index = len(self.chain)
        previous_hash = self.chain[-1].hash if self.chain else "0"
        block = Block(index, time(), transaction, previous_hash)
        self.chain.append(block)
        return block

    def get_last_block(self) -> Block:
        return self.chain[-1] if self.chain else None

    def is_chain_valid(self) -> bool:
        for i in range(1, len(self.chain)):
            current_block = self.chain[i]
            previous_block = self.chain[i-1]

            # Verify current block's hash
            if current_block.hash != current_block.calculate_hash():
                return False

            # Verify chain continuity
            if current_block.previous_hash != previous_block.hash:
                return False

        return True

    def get_all_transactions(self) -> List[Dict[str, Any]]:
        return [
            {
                "index": block.index,
                "timestamp": block.timestamp,
                "transaction": block.transaction,
                "hash": block.hash
            }
            for block in self.chain[1:]  # Exclude genesis block
        ]

# Initialize blockchain
blockchain = Blockchain()
