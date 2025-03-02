import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPatientSchema } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function CreateCampaign() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<z.infer<typeof insertPatientSchema>>({
    resolver: zodResolver(insertPatientSchema),
    defaultValues: {
      condition: "",
      description: "",
      fundingGoal: 10000,
      hospitalWallet: "",
      doctorsNote: "",
      age: 0,
      symptoms: "",
      diagnosis: "",
      treatmentPlan: "",
      medicalHistory: "",
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (data: z.infer<typeof insertPatientSchema>) => {
      console.log('Submitting form data:', data); // Debug log
      const res = await apiRequest("POST", "/api/patients", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create campaign");
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate both the list and individual patient queries
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Campaign Created",
        description: "Your fundraising campaign has been created successfully.",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      console.error('Campaign creation error:', error); // Debug log
      toast({
        title: "Failed to Create Campaign",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: z.infer<typeof insertPatientSchema>) => {
    console.log('Form submitted with data:', data); // Debug log
    try {
      await createCampaign.mutateAsync(data);
    } catch (error) {
      console.error('Form submission error:', error); // Debug log
    }
  };

  if (!user?.isPatient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only patients can create fundraising campaigns.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Create Fundraising Campaign</CardTitle>
            <CardDescription>
              Please provide detailed medical information to help us assess your case
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical Condition</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Heart Surgery" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Patient Age</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="symptoms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Main Symptoms</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="List the main symptoms you're experiencing"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="diagnosis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medical Diagnosis</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter the official medical diagnosis"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="treatmentPlan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Treatment Plan</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Describe the recommended treatment plan"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="doctorsNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doctor's Note</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter the doctor's assessment and recommendations"
                          className="h-32"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Details</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Any additional information about your condition and circumstances"
                          className="h-32"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="medicalHistory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medical History (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Any relevant medical history"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fundingGoal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Funding Goal (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1000"
                          step="1000"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hospitalWallet"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hospital Account/UPI ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter bank account or UPI ID" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createCampaign.isPending}
                >
                  {createCampaign.isPending ? "Creating..." : "Create Campaign"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}