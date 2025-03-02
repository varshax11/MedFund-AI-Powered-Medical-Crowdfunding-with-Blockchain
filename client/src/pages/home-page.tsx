import { useQuery } from "@tanstack/react-query";
import { Patient } from "@shared/schema";
import PatientCard from "@/components/patient-card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { data: patients, isLoading, error } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 0, // Consider data stale immediately
    cacheTime: 0, // Don't cache the data
  });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Failed to load patients</h2>
          <p className="text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <h1 className="text-2xl font-bold text-primary cursor-pointer">MedFund</h1>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">
                  Welcome, {user.name}
                </span>
                {user.isPatient && (
                  <>
                    <Link href="/create-campaign">
                      <Button variant="default">Create Campaign</Button>
                    </Link>
                    <Link href="/profile">
                      <Button variant="outline">Manage Wallets</Button>
                    </Link>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  Logout
                </Button>
              </>
            ) : (
              <Link href="/auth">
                <Button>Login / Register</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto mb-8 text-center">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Help Save Lives Today
          </h2>
          <p className="text-lg text-muted-foreground">
            Support patients in need by contributing to their medical treatment
            funds. Every donation makes a difference.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !patients?.length ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">No Active Fundraisers</h3>
            <p className="text-muted-foreground">
              There are currently no active medical fundraising campaigns.
              {user?.isPatient && (
                <Link href="/create-campaign">
                  <Button variant="link" className="ml-2">
                    Create your campaign
                  </Button>
                </Link>
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {patients.map((patient) => (
              <PatientCard key={patient.id} patient={patient} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}