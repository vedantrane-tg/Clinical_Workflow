import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DOSE_COUNTS,
  DRUG_FORMS,
  DURATION_UNITS,
  TIMING_OPTIONS,
  emptyPrescriptionRow,
  namesForForm,
  strengthsFor,
  type PrescriptionRow,
} from "@/data/prescriptionCatalog";

type Props = {
  rows: PrescriptionRow[];
  onChange: (rows: PrescriptionRow[]) => void;
  disabled?: boolean;
};

export function PrescriptionEditor({ rows, onChange, disabled }: Props) {
  function update(id: string, patch: Partial<PrescriptionRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function remove(id: string) {
    onChange(rows.length <= 1 ? rows : rows.filter((row) => row.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/70 hover:bg-muted/70">
              <TableHead className="min-w-[220px]">Drug Name</TableHead>
              <TableHead className="min-w-[120px]">Strength</TableHead>
              <TableHead className="min-w-[200px]">Frequency</TableHead>
              <TableHead className="min-w-[240px]">Instructions</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const names = namesForForm(row.drug_form);
              const strengths = strengthsFor(row.drug_form, row.drug_name);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex gap-2">
                      <span className="mt-2 w-5 shrink-0 text-xs text-muted-foreground">
                        {index + 1}.
                      </span>
                      <div className="grid flex-1 gap-2">
                        <Select
                          disabled={disabled}
                          value={row.drug_form}
                          onValueChange={(form) => {
                            const nextNames = namesForForm(form);
                            const nextName = nextNames.includes(row.drug_name)
                              ? row.drug_name
                              : (nextNames[0] ?? "");
                            const nextStrengths = strengthsFor(form, nextName);
                            update(row.id, {
                              drug_form: form as PrescriptionRow["drug_form"],
                              drug_name: nextName,
                              strength: nextStrengths[0] ?? "",
                            });
                          }}
                        >
                          <SelectTrigger aria-label={`Drug form ${index + 1}`}>
                            <SelectValue placeholder="Form" />
                          </SelectTrigger>
                          <SelectContent>
                            {DRUG_FORMS.map((form) => (
                              <SelectItem key={form} value={form}>
                                {form}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          disabled={disabled || names.length === 0}
                          value={row.drug_name || undefined}
                          onValueChange={(name) => {
                            const nextStrengths = strengthsFor(row.drug_form, name);
                            update(row.id, {
                              drug_name: name,
                              strength: nextStrengths[0] ?? "",
                            });
                          }}
                        >
                          <SelectTrigger aria-label={`Drug name ${index + 1}`}>
                            <SelectValue placeholder="Select drug" />
                          </SelectTrigger>
                          <SelectContent>
                            {names.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Select
                      disabled={disabled || !row.drug_name}
                      value={row.strength || undefined}
                      onValueChange={(strength) => update(row.id, { strength })}
                    >
                      <SelectTrigger aria-label={`Strength ${index + 1}`}>
                        <SelectValue placeholder="Strength" />
                      </SelectTrigger>
                      <SelectContent>
                        {strengths.map((strength) => (
                          <SelectItem key={strength} value={strength}>
                            {strength}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ["morning", "Morning"],
                          ["afternoon", "Afternoon"],
                          ["night", "Night"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className="space-y-1">
                          <Select
                            disabled={disabled}
                            value={String(row[key])}
                            onValueChange={(v) => update(row.id, { [key]: Number(v) })}
                          >
                            <SelectTrigger aria-label={`${label} dose ${index + 1}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DOSE_COUNTS.map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-center text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="grid gap-2">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          disabled={disabled}
                          value={row.duration_value}
                          onChange={(e) =>
                            update(row.id, {
                              duration_value: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-20"
                          aria-label={`Duration value ${index + 1}`}
                        />
                        <Select
                          disabled={disabled}
                          value={row.duration_unit}
                          onValueChange={(unit) =>
                            update(row.id, {
                              duration_unit: unit as PrescriptionRow["duration_unit"],
                            })
                          }
                        >
                          <SelectTrigger aria-label={`Duration unit ${index + 1}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DURATION_UNITS.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Select
                        disabled={disabled}
                        value={row.instruction}
                        onValueChange={(instruction) => update(row.id, { instruction })}
                      >
                        <SelectTrigger aria-label={`Instruction ${index + 1}`}>
                          <SelectValue placeholder="Instruction" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMING_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled || rows.length <= 1}
                      onClick={() => remove(row.id)}
                      aria-label={`Remove drug ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onChange([...rows, emptyPrescriptionRow()])}
      >
        <Plus className="mr-1.5 size-4" />
        Add medicine
      </Button>
    </div>
  );
}
