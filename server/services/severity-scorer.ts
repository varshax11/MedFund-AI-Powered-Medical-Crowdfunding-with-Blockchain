import { mlSeverityModel } from './ml-severity-model';

export class SeverityScorer {
  private emergencyKeywords = [
    'emergency', 'critical', 'severe', 'urgent', 'immediate',
    'life-threatening', 'terminal', 'acute', 'intensive',
    'surgery', 'transplant', 'cancer', 'cardiac', 'brain',
    'trauma', 'hemorrhage', 'failure', 'stroke'
  ];

  private urgencyKeywords = {
    'immediate': 1,
    'emergency': 2,
    'urgent': 7,
    'soon': 14,
    'scheduled': 30,
    'planned': 60,
    'routine': 90
  };

  private highRiskConditions = [
    'heart', 'brain', 'cancer', 'organ failure', 'trauma',
    'respiratory', 'kidney', 'liver', 'emergency surgery'
  ];

  async calculateSeverityScore(
    condition: string,
    description: string,
    doctorsNote: string,
    age: number,
    symptoms: string,
    diagnosis: string,
    treatmentPlan: string,
    medicalHistory?: string
  ): Promise<{
    score: number;
    requiredDays: number;
    mlPrediction?: {
      confidence: number;
      classification: string;
    };
  }> {
    // Get ML model prediction
    const mlResult = await mlSeverityModel.predictSeverity(
      condition,
      symptoms,
      diagnosis,
      doctorsNote
    );

    // Traditional rule-based scoring
    const text = `${condition}. ${description}. ${doctorsNote}. ${symptoms}. ${diagnosis}. ${treatmentPlan}. ${medicalHistory || ''}`.toLowerCase();

    const keywordCount = this.emergencyKeywords.reduce((count, keyword) => 
      text.includes(keyword) ? count + 1 : count, 0);

    const riskCount = this.highRiskConditions.reduce((count, condition) => 
      text.includes(condition) ? count + 1 : count, 0);

    const ageFactor = age < 5 || age > 60 ? 2 : 1;

    const keywordSeverity = Math.min(10, (keywordCount / this.emergencyKeywords.length) * 10);
    const riskSeverity = Math.min(10, (riskCount / this.highRiskConditions.length) * 10);

    let combinedScore = (
      keywordSeverity * 0.3 +
      riskSeverity * 0.2 +
      mlResult.severityScore * 0.5
    ) * ageFactor;

    // Calculate required days based on urgency keywords and severity
    let requiredDays = 30; // Default to 30 days
    for (const [keyword, days] of Object.entries(this.urgencyKeywords)) {
      if (text.includes(keyword)) {
        requiredDays = Math.min(requiredDays, days);
      }
    }

    // Adjust required days based on combined severity score
    if (combinedScore >= 9) requiredDays = Math.min(requiredDays, 2);
    else if (combinedScore >= 7) requiredDays = Math.min(requiredDays, 7);
    else if (combinedScore >= 5) requiredDays = Math.min(requiredDays, 14);

    return {
      score: Math.max(1, Math.min(10, Math.round(combinedScore))),
      requiredDays: Math.max(1, requiredDays),
      mlPrediction: {
        confidence: mlResult.confidence,
        classification: mlResult.classification
      }
    };
  }
}

export const severityScorer = new SeverityScorer();