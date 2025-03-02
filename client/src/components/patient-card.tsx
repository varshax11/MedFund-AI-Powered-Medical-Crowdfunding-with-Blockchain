import { Patient } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface PatientCardProps {
  patient: Patient;
}

export default function PatientCard({ patient }: PatientCardProps) {
  const [, setLocation] = useLocation();
  const progress = (patient.amountRaised / patient.fundingGoal) * 100;

  // Function to get urgency label and color
  const getUrgencyInfo = (days: number) => {
    if (days <= 2) return { label: 'Immediate', color: 'bg-red-500' };
    if (days <= 7) return { label: 'Very Urgent', color: 'bg-orange-500' };
    if (days <= 14) return { label: 'Urgent', color: 'bg-yellow-500' };
    if (days <= 30) return { label: 'Soon', color: 'bg-blue-500' };
    return { label: 'Scheduled', color: 'bg-green-500' };
  };

  const urgencyInfo = getUrgencyInfo(patient.requiredDays);

  // Format currency in Indian Rupees
  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{patient.condition}</h3>
          <div className="flex gap-2">
            <div className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              Severity: {patient.severityScore}/10
            </div>
            <div className={`px-2 py-1 text-xs font-medium rounded-full text-white ${urgencyInfo.color}`}>
              {urgencyInfo.label}: {patient.requiredDays} days
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {patient.description}
        </p>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>
              {formatINR(patient.amountRaised)} of {formatINR(patient.fundingGoal)}
            </span>
          </div>
          <Progress value={progress} />
        </div>

        <Button
          className="w-full"
          onClick={() => setLocation(`/donate/${patient.id}`)}
        >
          Donate Now
        </Button>
      </CardContent>
    </Card>
  );
}