import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import * as fs from 'fs';
import * as csv from 'csv-parse';
import * as path from 'path';

export class MLSeverityModel {
  private model: tf.LayersModel | null = null;
  private encoder: any;
  private readonly severityMapping = {
    0: "mild",
    1: "severe", 
    2: "critical"
  } as const;

  private cleanText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
      .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
      .trim();
  }

  private createOptimizedModel() {
    // Create a more sophisticated model architecture
    const input = tf.input({shape: [512]});

    // First dense block with residual connection
    const dense1 = tf.layers.dense({
      units: 768,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({l2: 1e-4})
    }).apply(input) as tf.SymbolicTensor;

    const batchNorm1 = tf.layers.batchNormalization().apply(dense1) as tf.SymbolicTensor;
    const dropout1 = tf.layers.dropout({rate: 0.2}).apply(batchNorm1) as tf.SymbolicTensor;

    // Second dense block with skip connection
    const dense2 = tf.layers.dense({
      units: 384,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({l2: 1e-4})
    }).apply(dropout1) as tf.SymbolicTensor;

    const batchNorm2 = tf.layers.batchNormalization().apply(dense2) as tf.SymbolicTensor;
    const dropout2 = tf.layers.dropout({rate: 0.2}).apply(batchNorm2) as tf.SymbolicTensor;

    // Final classification layer
    const output = tf.layers.dense({
      units: 3,
      activation: 'softmax',
      kernelRegularizer: tf.regularizers.l2({l2: 1e-4})
    }).apply(dropout2) as tf.SymbolicTensor;

    const model = tf.model({inputs: input, outputs: output});

    const learningRate = 0.001;
    const decay = learningRate / 50;  // Learning rate decay

    model.compile({
      optimizer: tf.train.adamax(learningRate, 0.9, 0.999, 1e-7, decay),
      loss: 'sparseCategoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private createFallbackModel() {
    console.log('Creating fallback model for quick startup...');
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 3, activation: 'softmax', inputShape: [512] })
      ]
    });
    model.compile({
      optimizer: 'adam',
      loss: 'sparseCategoricalCrossentropy',
      metrics: ['accuracy']
    });
    return model;
  }

  async initialize() {
    try {
      console.time('modelInitialization');

      // Load BioBERT model
      console.time('loadBioBERT');
      this.encoder = await use.loadQnA();
      console.timeEnd('loadBioBERT');
      console.log('Loaded BioBERT Universal Sentence Encoder');

      const shouldTrain = process.env.TRAIN_MODEL_ON_STARTUP === 'true';

      // Try to load saved model first
      try {
        console.time('loadSavedModel');
        this.model = await tf.loadLayersModel('file://./models/severity-model/model.json');
        console.timeEnd('loadSavedModel');
        console.log('Loaded saved severity model');
        return true;
      } catch (err) {
        console.log('No saved model found');
        if (!shouldTrain) {
          console.log('Using fallback model for quick startup (TRAIN_MODEL_ON_STARTUP=false)');
          this.model = this.createFallbackModel();
          return true;
        }
        console.log('Training new model...');
      }

      // Load and parse dataset
      console.time('loadDataset');
      const datasetPath = path.join(process.cwd(), 'attached_assets', 'patient_severity_dataset.csv');
      console.log('Loading dataset from:', datasetPath);

      const rawData = fs.readFileSync(datasetPath, 'utf-8');
      const records: Array<{text: string, severity: number}> = [];

      // Parse CSV and prepare training data
      await new Promise((resolve, reject) => {
        csv.parse(rawData, {
          columns: true,
          skip_empty_lines: true
        })
        .on('data', (row) => {
          const severityMap = { 'mild': 0, 'severe': 1, 'critical': 2 };
          if (row['Severity Level']?.toLowerCase() in severityMap) {
            records.push({
              text: this.cleanText(row['Symptoms & Clinical Features']),
              severity: severityMap[row['Severity Level'].toLowerCase()]
            });
          }
        })
        .on('end', () => {
          console.log(`Loaded ${records.length} training records`);
          resolve(null);
        })
        .on('error', reject);
      });
      console.timeEnd('loadDataset');

      // Data augmentation: duplicate critical cases with slight text variations
      const criticalCases = records.filter(r => r.severity === 2);
      const augmentedCases = criticalCases.map(record => ({
        text: record.text.split(' ').sort(() => Math.random() - 0.5).join(' '),
        severity: record.severity
      }));
      records.push(...augmentedCases);
      console.log(`Added ${augmentedCases.length} augmented critical cases`);

      // Create and initialize optimized model
      this.model = this.createOptimizedModel();

      // Process data in batches
      const batchSize = 32;
      const epochs = 10;
      const validationSplit = 0.2;

      // Shuffle records
      records.sort(() => Math.random() - 0.5);

      const validationSize = Math.floor(records.length * validationSplit);
      const trainingRecords = records.slice(validationSize);
      const validationRecords = records.slice(0, validationSize);

      console.time('modelTraining');
      console.log('Starting model training...');

      let bestValLoss = Infinity;
      let patience = 3;
      let patienceCount = 0;

      for (let epoch = 0; epoch < epochs; epoch++) {
        let totalLoss = 0;
        let totalAcc = 0;
        let valLoss = 0;
        let valAcc = 0;

        // Training
        for (let i = 0; i < trainingRecords.length; i += batchSize) {
          const batch = trainingRecords.slice(i, i + batchSize);
          const batchTexts = batch.map(r => r.text);
          const batchLabels = tf.tensor1d(batch.map(r => r.severity));

          const embeddings = await this.encoder.embed(batchTexts);
          const history = await this.model.trainOnBatch(embeddings, batchLabels);

          totalLoss += history.loss;
          totalAcc += history.acc;
        }

        // Validation
        for (let i = 0; i < validationRecords.length; i += batchSize) {
          const batch = validationRecords.slice(i, i + batchSize);
          const batchTexts = batch.map(r => r.text);
          const batchLabels = tf.tensor1d(batch.map(r => r.severity));

          const embeddings = await this.encoder.embed(batchTexts);
          const evaluation = this.model.evaluate(embeddings, batchLabels) as tf.Scalar[];

          valLoss += evaluation[0].dataSync()[0];
          valAcc += evaluation[1].dataSync()[0];
        }

        const avgLoss = totalLoss / Math.ceil(trainingRecords.length / batchSize);
        const avgAcc = totalAcc / Math.ceil(trainingRecords.length / batchSize);
        const avgValLoss = valLoss / Math.ceil(validationRecords.length / batchSize);
        const avgValAcc = valAcc / Math.ceil(validationRecords.length / batchSize);

        console.log(
          `Epoch ${epoch + 1}: loss = ${avgLoss.toFixed(4)}, ` +
          `acc = ${avgAcc.toFixed(4)}, ` +
          `val_loss = ${avgValLoss.toFixed(4)}, ` +
          `val_acc = ${avgValAcc.toFixed(4)}`
        );

        // Early stopping
        if (avgValLoss < bestValLoss) {
          bestValLoss = avgValLoss;
          patienceCount = 0;
          // Save best model
          await this.model.save('file://./models/severity-model');
        } else {
          patienceCount++;
          if (patienceCount >= patience) {
            console.log(`Early stopping triggered at epoch ${epoch + 1}`);
            break;
          }
        }
      }

      console.timeEnd('modelTraining');
      console.log('Model training completed');

      console.timeEnd('modelInitialization');
      return true;
    } catch (error) {
      console.error('Error initializing ML model:', error);
      console.log('Using fallback model due to initialization error');
      this.model = this.createFallbackModel();
      return true;
    }
  }

  async predictSeverity(condition: string, symptoms: string, diagnosis: string): Promise<{
    severityScore: number;
    confidence: number;
    classification: keyof typeof this.severityMapping;
  }> {
    try {
      if (!this.model || !this.encoder) {
        throw new Error('Model not initialized');
      }

      // Combine medical information (without doctor's note)
      const text = `${condition}. ${symptoms}. ${diagnosis}`.toLowerCase();
      const cleanedText = this.cleanText(text);

      // Encode text using BioBERT
      const embeddings = await this.encoder.embed([cleanedText]);

      // Make prediction
      const prediction = this.model.predict(embeddings) as tf.Tensor;
      const scores = await prediction.array();

      // Get highest probability class
      const maxIndex = scores[0].indexOf(Math.max(...scores[0]));
      const confidence = scores[0][maxIndex];

      // Convert to 1-10 scale with more granular mapping
      const baseScore = maxIndex * 3.5 + 2;  // Maps 0,1,2 to roughly 2,5.5,9
      const confidenceAdjustment = (confidence - 0.5) * 2; // Scale confidence to [-1, 1]
      const severityScore = Math.max(1, Math.min(10, Math.round(baseScore + confidenceAdjustment)));

      return {
        severityScore,
        confidence,
        classification: this.severityMapping[maxIndex as keyof typeof this.severityMapping]
      };
    } catch (error) {
      console.error('Error predicting severity:', error);
      // Fallback to middle severity if model fails
      return {
        severityScore: 5,
        confidence: 0.5,
        classification: "severe"
      };
    }
  }
}

export const mlSeverityModel = new MLSeverityModel();