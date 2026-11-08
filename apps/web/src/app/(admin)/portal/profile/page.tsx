"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { lookup, nextCounter, nowIso, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Student } from "@/lib/demo/types";
import { InfoGrid, Tabs, Textarea } from "@/components/demo";
import { IdCard } from "@/components/id-card";
import { PortalPage, StudentBanner } from "@/components/portal";
import { statusLabel } from "@/components/students";
import { Avatar, Button, Card, ErrorNote, Field, FormActions, formatDate, Modal, Select, useToast } from "@/components/ui";

type Tab = "personal" | "academic" | "guardians" | "card";

export default function PortalProfile() {
  return (
    <PortalPage title="My profile" description="Your record as the university holds it. Official fields can't be edited here: ask for a correction and the Registrar's office will check it.">
      {({ db, student }) => <Profile db={db} student={student} />}
    </PortalPage>
  );
}

function Profile({ db, student }: { db: DemoDb; student: Student }) {
  const { tenant } = useAuth();
  const [tab, setTab] = useState<Tab>("personal");
  const [correcting, setCorrecting] = useState(false);
  const program = lookup(db.programs, student.programId);
  const dept = program && lookup(db.departments, program.departmentId);
  const faculty = dept && lookup(db.faculties, dept.facultyId);
  const section = lookup(db.sections, student.sectionId);
  const guardians = student.guardianIds.map((id) => lookup(db.guardians, id)).filter((g) => !!g);
  const validTill = `${Number(student.admissionDate.slice(0, 4)) + Math.ceil((program?.durationSemesters ?? 12) / 3)}-12-31`;

  return (
    <>
      <StudentBanner db={db} student={student} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "personal", label: "Personal" },
            { key: "academic", label: "Academic" },
            { key: "guardians", label: "Guardians", count: guardians.length },
            { key: "card", label: "ID card" },
          ]}
        />
        <Button variant="secondary" icon="pencil" onClick={() => setCorrecting(true)}>
          Request a correction
        </Button>
      </div>
      <Card>
        <div className="p-5">
          {tab === "personal" && (
            <InfoGrid
              items={[
                ["Full name", student.name],
                ["Gender", statusLabel(student.gender)],
                ["Date of birth", formatDate(student.dateOfBirth)],
                ["Blood group", student.bloodGroup],
                ["Mobile", student.phone],
                ["Official email", student.officialEmail ?? "Not issued yet"],
                ["Personal email", student.email],
                ["Address", [student.address, student.district, student.division].filter(Boolean).join(", ")],
              ]}
            />
          )}
          {tab === "academic" && (
            <InfoGrid
              items={[
                ["Student ID", <span key="id" className="font-mono">{student.studentId}</span>],
                ["Faculty", faculty?.name],
                ["Department", dept ? `Department of ${dept.name}` : null],
                ["Program", program?.name],
                ["Batch", student.batch],
                ["Section", section?.name],
                ["Current semester", section ? lookup(db.semesters, section.semesterId)?.name : null],
                ["Admitted", formatDate(student.admissionDate)],
                ["Campus", student.campus],
                ["Academic status", statusLabel(student.status)],
              ]}
            />
          )}
          {tab === "guardians" && (
            <ul className="space-y-4">
              {guardians.map((g) => (
                <li key={g!.id} className="flex items-center gap-3">
                  <Avatar name={g!.name} />
                  <div className="text-sm">
                    <p className="font-medium">{g!.name}</p>
                    <p className="text-muted">
                      {g!.relation} · {g!.phone}
                      {g!.email ? ` · ${g!.email}` : ""}
                    </p>
                  </div>
                </li>
              ))}
              {!guardians.length && <p className="text-sm text-muted">No guardian on record.</p>}
            </ul>
          )}
          {tab === "card" && (
            <div className="max-w-sm">
              <IdCard
                institution={tenant?.name ?? ""}
                title="Student ID card"
                name={student.name}
                code={student.studentId}
                lines={[program?.name ?? "", `Batch ${student.batch} · ${section?.name ?? ""}`]}
                footer={[`Blood ${student.bloodGroup ?? "—"}`, `Valid till ${formatDate(validTill)}`]}
                emergency={guardians[0]?.phone ?? student.phone}
              />
              <p className="mt-3 text-xs text-muted">A digital copy. Collect the printed card from the Registrar&apos;s office.</p>
            </div>
          )}
        </div>
      </Card>
      <Modal open={correcting} onClose={() => setCorrecting(false)} title="Request a correction" description="Goes to Student Affairs, who route it to the Registrar's office. Attach proof in person if asked.">
        {correcting && <CorrectionForm student={student} onDone={() => setCorrecting(false)} />}
      </Modal>
    </>
  );
}

function CorrectionForm({ student, onDone }: { student: Student; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const [field, setField] = useState("Name spelling");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-4">
      <Field label="What needs correcting">
        <Select value={field} onChange={(e) => setField(e.target.value)}>
          {["Name spelling", "Date of birth", "Guardian information", "Address", "Mobile number", "Program or batch", "Other"].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </Select>
      </Field>
      <Field label="Correct information and proof" hint="e.g. As on my SSC certificate: …">
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} />
      </Field>
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (details.trim().length < 10) return setError("Describe the correct information.");
            let no = "";
            update((d) => {
              no = `TKT-${todayDhaka().slice(0, 4)}-${String(nextCounter(d, "ticket")).padStart(4, "0")}`;
              d.tickets.push({ id: crypto.randomUUID(), ticketNo: no, studentId: student.id, category: "Record correction", subject: `Correction: ${field}`, body: details.trim(), confidential: false, status: "SUBMITTED", assignee: null, createdAt: nowIso(), history: [{ at: nowIso(), by: student.name, text: "Submitted from the student portal" }] });
            });
            toast(`Correction request ${no} sent`);
            onDone();
          }}
        >
          Send request
        </Button>
      </FormActions>
    </div>
  );
}
