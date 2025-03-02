import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Patient } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

const donationSchema = z.object({
  amount: z.number().min(100, "Minimum donation amount is ₹100"),
});

export default function DonatePage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: patient, isLoading } = useQuery<Patient>({
    queryKey: [`/api/patients/${id}`],
  });

  // Get Razorpay key
  const { data: razorpayData } = useQuery({
    queryKey: ["/api/razorpay-key"],
  });

  const form = useForm<z.infer<typeof donationSchema>>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      amount: 500,
    },
  });

  const handlePayment = async (data: z.infer<typeof donationSchema>) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to make a donation",
        variant: "destructive",
      });
      setLocation("/auth");
      return;
    }

    if (!razorpayData?.key) {
      toast({
        title: "Payment Error",
        description: "Payment system is not configured properly",
        variant: "destructive",
      });
      return;
    }

    try {
      const orderRes = await apiRequest(
        "POST",
        `/api/donations/${id}/order`,
        { amount: data.amount }
      );

      if (!orderRes.ok) {
        const error = await orderRes.json();
        throw new Error(error.message || "Failed to create order");
      }

      const order = await orderRes.json();

      const options = {
        key: razorpayData.key,
        amount: order.amount,
        currency: "INR",
        name: "MedFund",
        description: `Donation for ${patient?.condition}`,
        order_id: order.id,
        handler: async (response: any) => {
          try {
            const verifyRes = await apiRequest(
              "POST", 
              `/api/donations/${id}/verify`,
              {
                ...response,
                amount: data.amount,
              }
            );

            if (!verifyRes.ok) {
              throw new Error("Payment verification failed");
            }

            toast({
              title: "Thank you for your donation!",
              description: "Your payment has been processed successfully.",
            });

            // Refresh both the individual patient and the list
            queryClient.invalidateQueries({ queryKey: [`/api/patients/${id}`] });
            queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
            setLocation("/");
          } catch (error) {
            console.error("Verification error:", error);
            toast({
              title: "Verification Failed",
              description: "Please contact support if your payment was deducted",
              variant: "destructive",
            });
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: {
          color: "#0284c7",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !patient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = (patient.amountRaised / patient.fundingGoal) * 100;

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              Donate to Support {patient.condition} Treatment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>
                  ₹{patient.amountRaised.toLocaleString()} of ₹{patient.fundingGoal.toLocaleString()}
                </span>
              </div>
              <Progress value={progress} />
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handlePayment)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Donation Amount (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="100"
                          step="100"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  Donate Now
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}