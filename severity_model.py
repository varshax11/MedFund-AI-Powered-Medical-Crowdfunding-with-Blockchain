import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from typing import Dict, Any, List

class SeverityModel:
    """AI-based medical severity classification using BioBERT"""

    _instance = None  # Singleton instance to avoid multiple model loads

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SeverityModel, cls).__new__(cls)
            cls._instance._initialize_model()
        return cls._instance

    def _initialize_model(self):
        """Loads tokenizer and model only once (Singleton Pattern)"""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_name = "dmis-lab/biobert-v1.1"
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.model_name, num_labels=3
        ).to(self.device)
        self.model.eval()  # Put model in evaluation mode
        self.severity_mapping = {0: "mild", 1: "severe", 2: "critical"}

    def predict_severity(self, text: str) -> Dict[str, Any]:
        """Predicts medical severity from input text"""

        # Tokenize input
        inputs = self.tokenizer(
            text, truncation=True, padding=True, max_length=512, return_tensors="pt"
        ).to(self.device)

        # Run model inference
        with torch.no_grad():
            outputs = self.model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=1)
            prediction = torch.argmax(probabilities, dim=1).item()
            confidence = probabilities.max().item()  # Highest probability score

        # Scale severity dynamically
        severity_score = int((confidence * 10) // 3)  # Scale to 1-10

        return {
            "score": severity_score,
            "confidence": round(confidence, 2),
            "classification": self.severity_mapping[prediction],
        }

    def train(self, texts: List[str], labels: List[int], epochs: int = 5, batch_size: int = 8):
        """Fine-tunes the model on custom medical dataset"""

        self.model.train()
        optimizer = torch.optim.AdamW(self.model.parameters(), lr=2e-5)

        dataset = list(zip(texts, labels))
        for epoch in range(epochs):
            total_loss = 0

            # Mini-batch processing
            for i in range(0, len(dataset), batch_size):
                batch = dataset[i : i + batch_size]
                texts_batch, labels_batch = zip(*batch)

                # Tokenize batch
                inputs = self.tokenizer(
                    list(texts_batch),
                    truncation=True,
                    padding=True,
                    max_length=512,
                    return_tensors="pt",
                ).to(self.device)

                labels_tensor = torch.tensor(labels_batch, dtype=torch.long).to(self.device)

                # Forward pass
                outputs = self.model(**inputs, labels=labels_tensor)
                loss = outputs.loss

                # Backward pass
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

                total_loss += loss.item()

            print(f"Epoch {epoch+1}: Avg Loss = {total_loss/len(texts):.4f}")

# Singleton instance (Ensures only one model instance is loaded)
severity_model = SeverityModel()

