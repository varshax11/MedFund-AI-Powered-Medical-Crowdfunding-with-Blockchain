import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Patient } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const walletSchema = z.object({
  hospitalWallet: z.string().regex(/^[A-Za-z0-9]+$/, "Invalid bank account/UPI ID"),
});

export default function PatientProfile() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: patient } = useQuery<Patient>({
    queryKey: [`/api/patients/user/${user?.id}`],
    enabled: !!user?.id,
  });

  const form = useForm<z.infer<typeof walletSchema>>({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      hospitalWallet: patient?.hospitalWallet || "",
    },
  });

  const updateWallets = useMutation({
    mutationFn: async (data: z.infer<typeof walletSchema>) => {
      const res = await apiRequest("POST", "/api/patients/wallets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Wallet Updated",
        description: "Your hospital account details have been successfully registered.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user?.isPatient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only patients can access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Hospital Account Management</CardTitle>
            <CardDescription>
              Register your hospital's bank account or UPI ID for receiving donations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => updateWallets.mutate(data))} className="space-y-6">
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
                  disabled={updateWallets.isPending}
                >
                  Update Hospital Account
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}