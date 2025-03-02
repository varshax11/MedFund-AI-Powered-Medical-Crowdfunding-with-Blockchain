import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import * as csv from 'csv-parse';
import * as use from '@tensorflow-models/universal-sentence-encoder';

interface TrainingData {
  symptoms: string;
  severity: number; // 0: mild, 1: severe, 2: critical
}

export async function trainModel(datasetPath: string) {
  try {
    // Load and parse CSV
    const rawData = fs.readFileSync(datasetPath, 'utf-8');
    const records: TrainingData[] = [];
    
    // Parse CSV and prepare data
    await new Promise((resolve, reject) => {
      csv.parse(rawData, {
        columns: true,
        skip_empty_lines: true
      })
      .on('data', (row) => {
        const severityMap = { 'mild': 0, 'severe': 1, 'critical': 2 };
        if (row['Severity Level']?.toLowerCase() in severityMap) {
          records.push({
            symptoms: row['Symptoms & Clinical Features'],
            severity: severityMap[row['Severity Level'].toLowerCase()]
          });
        }
      })
      .on('end', resolve)
      .on('error', reject);
    });

    // Load Universal Sentence Encoder
    const encoder = await use.load();
    
    // Encode text data
    const encodedData = await encoder.embed(records.map(r => r.symptoms));
    
    // Prepare labels
    const labels = tf.tensor1d(records.map(r => r.severity));
    
    // Create and compile model
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 768, activation: 'relu', inputShape: [512] }),
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.dense({ units: 3, activation: 'softmax' })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'sparseCategoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Train model
    await model.fit(encodedData, labels, {
      epochs: 10,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}: loss = ${logs?.loss.toFixed(4)}, accuracy = ${logs?.acc.toFixed(4)}`);
        }
      }
    });

    // Save model
    await model.save('file://./models/severity-model');
    
    console.log('Model training completed successfully');
    return true;
  } catch (error) {
    console.error('Error training model:', error);
    return false;
  }
}
