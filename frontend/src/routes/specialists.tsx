import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Stethoscope } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Pill } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { specialistsQuery } from "@/hooks/useClinicalQueries";

export const Route = createFileRoute("/specialists")({
  head: () => ({
    meta: [
      { title: "Specialist Registry — ClinicalFlow AI" },
      {
        name: "description",
        content:
          "Synthetic specialist registry with specialty, facility, availability and active referral load for the agentic clinical workflow demo.",
      },
      { property: "og:title", content: "Specialist Registry — ClinicalFlow AI" },
      {
        property: "og:description",
        content: "Browse specialists available for automated referral orchestration.",
      },
    ],
  }),
  component: SpecialistsPage,
});

function SpecialistsPage() {
  const { data: specialists, isLoading } = useQuery(specialistsQuery());
  const [term, setTerm] = useState("");
  const [specialty, setSpecialty] = useState("all");

  const rows = useMemo(() => {
    return (specialists ?? []).filter((s) => {
      const q = term.trim().toLowerCase();
      const matches =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.facility.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q);
      return matches && (specialty === "all" || s.specialty === specialty);
    });
  }, [specialists, term, specialty]);

  return (
    <>
      <PageHeader
        title="Specialist Registry"
        description="Synthetic specialist directory used by the Referral Orchestrator Agent for assignment."
      />

      <Card className="shadow-card">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-3">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search specialists, facility or location…"
              className="max-w-sm"
              aria-label="Search specialists"
            />
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger className="w-[200px]" aria-label="Filter by specialty">
                <SelectValue placeholder="Specialty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All specialties</SelectItem>
                <SelectItem value="Endocrinologist">Endocrinologist</SelectItem>
                <SelectItem value="Nephrologist">Nephrologist</SelectItem>
                <SelectItem value="Cardiologist">Cardiologist</SelectItem>
                <SelectItem value="Pulmonologist">Pulmonologist</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="No specialist matches"
              description="No specialists match the current search or specialty filter. Adjust the filters to see more results."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Specialist ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Hospital / Clinic</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead className="text-right">Active referrals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.specialist_id}>
                      <TableCell className="font-mono text-xs">{s.specialist_id}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.specialty}</TableCell>
                      <TableCell className="text-muted-foreground">{s.facility}</TableCell>
                      <TableCell className="text-muted-foreground">{s.location}</TableCell>
                      <TableCell>
                        <Pill
                          tone={
                            s.availability === "Available"
                              ? "success"
                              : s.availability === "Limited"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {s.availability}
                        </Pill>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.active_referrals}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}