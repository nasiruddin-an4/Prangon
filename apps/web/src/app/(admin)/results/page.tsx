"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { downloadCsv, formatGpa, lookup, markTotal, nowIso, semesterResult, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Student } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, FilterSelect, InfoGrid, PrintButton, Tabs, Toolbar } from "@/components/demo";
import { Avatar, Badge, Button, Card, cx, EmptyState, FormActions, formatDate, Modal, PageHeader, SearchInput, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

export default function ResultsPage() {
  const { db } = useDemo();
  const [tab, setTab] = useState<"sections" | "transcript">("sections");
  return (
    <>
      <PageHeader eyebrow="Academic" title="Results & transcripts" description="Semester GPA on the UGC scale, merit position, publishing (which locks marks), and printable mark sheets." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <Overview db={db} />
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "sections", label: "Section results" },
              { key: "transcript", label: "Student mark sheet" },
            ]}
          />
          {tab === "sections" ? <Results db={db} /> : <StudentLookup db={db} />}
        </>
      )}
    </>
  );
}

function Overview({ db }: { db: DemoDb }) {
  const sections = db.sections.filter((s) => lookup(db.semesters, s.semesterId)?.status === "ONGOING");
  const all = sections.flatMap((sec) => db.students.filter((s) => s.sectionId === sec.id && s.status !== "DROPPED").map((s) => semesterResult(db, sec.id, s.id)!));
  const complete = all.filter((r) => r.complete);
  const ready = sections.filter((sec) => {
    const rs = db.students.filter((s) => s.sectionId === sec.id && s.status !== "DROPPED").map((s) => semesterResult(db, sec.id, s.id)!);
    return rs.length > 0 && rs.every((r) => r.complete) && !db.publications.some((p) => p.sectionId === sec.id);
  });
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Published" value={db.publications.length} sub={`of ${sections.length} sections`} icon="check" />
      <StatCard label="Ready to publish" value={ready.length} sub="sections" icon="clock" />
      <StatCard label="Average GPA" value={formatGpa(complete.length ? complete.reduce((a, r) => a + (r.gpa ?? 0), 0) / complete.length : null)} sub="complete results" icon="chart" />
      <StatCard label="Pass rate" value={complete.length ? `${Math.round((complete.filter((r) => !r.failed).length / complete.length) * 100)}%` : "—"} icon="graduation" />
    </div>
  );
}

/** Find any student and open their mark sheet. */
function StudentLookup({ db }: { db: DemoDb }) {
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const q = query.trim().toLowerCase();
  const matches = q.length < 2 ? [] : db.students.filter((s) => s.sectionId && (s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q))).slice(0, 12);
  return (
    <Card>
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Type a student's name or ID" />
        <span className="text-xs text-muted">Mark sheets are marked provisional until the section&apos;s result is published.</span>
      </Toolbar>
      {q.length < 2 ? (
        <EmptyState icon="search" title="Find a student" description="Search by name or student ID to view and print their mark sheet." />
      ) : matches.length === 0 ? (
        <EmptyState icon="search" title="No students match" />
      ) : (
        <ul className="divide-y divide-border">
          {matches.map((s) => {
            const r = semesterResult(db, s.sectionId!, s.id)!;
            return (
              <li key={s.id}>
                <button onClick={() => setStudent(s)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/60">
                  <Avatar name={s.name} size="sm" />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{s.name}</span>
                    <span className="block font-mono text-xs text-muted">
                      {s.studentId} · {lookup(db.sections, s.sectionId)?.name}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">{r.complete ? `GPA ${formatGpa(r.gpa)}` : <span className="text-subtle">incomplete</span>}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Modal open={!!student} onClose={() => setStudent(null)} title="Mark sheet" size="lg">
        {student?.sectionId && <MarkSheet db={db} student={student} sectionId={student.sectionId} published={db.publications.some((p) => p.sectionId === student.sectionId)} onClose={() => setStudent(null)} />}
      </Modal>
    </Card>
  );
}

// ── Results ──────────────────────────────────────────────────────────────

function Results({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update, actor } = useDemo();
  const toast = useToast();
  const sections = db.sections.filter((s) => lookup(db.semesters, s.semesterId)?.status !== "UPCOMING");
  const [sectionId, setSectionId] = useState(db.publications[0]?.sectionId ?? sections[0]?.id ?? "");
  const [sheet, setSheet] = useState<Student | null>(null);
  const section = lookup(db.sections, sectionId);
  const publication = db.publications.find((p) => p.sectionId === sectionId);
  const students = db.students.filter((s) => s.sectionId === sectionId && s.status !== "DROPPED");
  const results = students.map((s) => ({ s, r: semesterResult(db, sectionId, s.id)! })).sort((a, b) => (b.r.gpa ?? -1) - (a.r.gpa ?? -1));
  const complete = results.filter((x) => x.r.complete);
  const allComplete = results.length > 0 && complete.length === results.length;
  const passed = complete.filter((x) => !x.r.failed);
  const avg = complete.length ? complete.reduce((a, x) => a + (x.r.gpa ?? 0), 0) / complete.length : null;

  return (
    <div className="space-y-5">
      <Card>
        <Toolbar>
          <FilterSelect label="Section" value={sectionId} onChange={setSectionId}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {lookup(db.semesters, s.semesterId)?.name}
              </option>
            ))}
          </FilterSelect>
          {publication ? (
            <Badge tone="success" dot>
              Published {formatDate(publication.publishedAt)} by {publication.publishedBy}
            </Badge>
          ) : (
            <Badge tone={allComplete ? "accent" : "neutral"} dot>
              {allComplete ? "Ready to publish" : `${complete.length} of ${results.length} students complete`}
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!results.length}
              onClick={() =>
                downloadCsv(`results-${section?.name}-${todayDhaka()}.csv`, [
                  ["Position", "Student ID", "Name", ...(section?.courses.map((c) => lookup(db.courses, c.courseId)?.code ?? "") ?? []), "GPA", "Result"],
                  ...results.map((x, i) => [x.r.complete ? i + 1 : "", x.s.studentId, x.s.name, ...x.r.rows.map((row) => (row.complete ? row.letter : "")), x.r.complete ? formatGpa(x.r.gpa) : "", x.r.complete ? (x.r.failed ? "Fail" : "Pass") : "Incomplete"]),
                ])
              }
            >
              Export CSV
            </Button>
            {can("results.publish") &&
              (publication ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    update((d) => {
                      d.publications = d.publications.filter((p) => p.sectionId !== sectionId);
                    });
                    toast("Result unpublished; marks are editable again");
                  }}
                >
                  Unpublish
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!allComplete}
                  title={allComplete ? undefined : "Every student needs all four marks in every course"}
                  onClick={() => {
                    if (!window.confirm(`Publish the ${section?.name} result? Marks will be locked.`)) return;
                    update((d) => {
                      d.publications.push({ sectionId, publishedAt: nowIso(), publishedBy: actor });
                    });
                    toast(`${section?.name} result published`);
                  }}
                >
                  Publish result
                </Button>
              ))}
          </div>
        </Toolbar>
        <div className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4">
          {[
            ["Students", String(results.length)],
            ["Average GPA", formatGpa(avg)],
            ["Pass rate", complete.length ? `${Math.round((passed.length / complete.length) * 100)}%` : "—"],
            ["Highest GPA", formatGpa(complete[0]?.r.gpa ?? null)],
          ].map(([label, value]) => (
            <div key={label} className="px-5 py-3">
              <p className="text-xs text-subtle">{label}</p>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <Table head={["#", "Student", ...(section?.courses.map((c) => lookup(db.courses, c.courseId)?.code ?? "") ?? []), "GPA", "Result", ""]} empty={!results.length && <EmptyState icon="fileText" title="No students in this section" />}>
          {results.map(({ s, r }, i) => (
            <Tr key={s.id}>
              <Td className="text-xs text-subtle tabular-nums">{r.complete ? i + 1 : "—"}</Td>
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} size="sm" />
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="font-mono text-xs text-muted">{s.studentId}</p>
                  </div>
                </div>
              </Td>
              {r.rows.map((row) => (
                <Td key={row.course.id}>{row.complete ? <span className={cx("text-sm font-medium", row.letter === "F" && "text-danger")}>{row.letter}</span> : <span className="text-xs text-subtle">—</span>}</Td>
              ))}
              <Td className="font-semibold tabular-nums">{r.complete ? formatGpa(r.gpa) : "—"}</Td>
              <Td>{r.complete ? r.failed ? <Badge tone="danger">Fail</Badge> : <Badge tone="success">Pass</Badge> : <Badge>Incomplete</Badge>}</Td>
              <Td className="text-right">
                <Button size="sm" variant="ghost" onClick={() => setSheet(s)}>
                  Mark sheet
                </Button>
              </Td>
            </Tr>
          ))}
        </Table>
      </Card>
      <Modal open={!!sheet} onClose={() => setSheet(null)} title="Mark sheet" size="lg">
        {sheet && section && <MarkSheet db={db} student={sheet} sectionId={section.id} published={!!publication} onClose={() => setSheet(null)} />}
      </Modal>
    </div>
  );
}

function MarkSheet({ db, student, sectionId, published, onClose }: { db: DemoDb; student: Student; sectionId: string; published: boolean; onClose: () => void }) {
  const section = lookup(db.sections, sectionId)!;
  const result = semesterResult(db, sectionId, student.id)!;
  return (
    <div>
      <div className="print-area space-y-4">
        <div className="text-center">
          <p className="text-lg font-semibold">Semester Mark Sheet</p>
          <p className="text-sm text-muted">
            {lookup(db.semesters, section.semesterId)?.name} · {section.name} {!published && "· provisional (not yet published)"}
          </p>
        </div>
        <InfoGrid
          items={[
            ["Student", student.name],
            ["Student ID", student.studentId],
            ["Program", lookup(db.programs, student.programId)?.name],
            ["Batch", student.batch],
          ]}
        />
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-subtle">
              <th className="py-2">Course</th>
              <th className="py-2">Credits</th>
              <th className="py-2">Marks</th>
              <th className="py-2">Grade</th>
              <th className="py-2">Point</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.course.id} className="border-b border-border">
                <td className="py-2">
                  <span className="font-mono text-xs">{r.course.code}</span> {r.course.title}
                </td>
                <td className="py-2 tabular-nums">{r.course.credits}</td>
                <td className="py-2 tabular-nums">{r.mark ? markTotal(r.mark) : "—"}</td>
                <td className="py-2 font-medium">{r.complete ? r.letter : "—"}</td>
                <td className="py-2 tabular-nums">{r.complete ? r.point.toFixed(2) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end gap-8 text-sm">
          <p>
            Credits earned: <span className="font-semibold">{result.rows.filter((r) => r.complete && r.letter !== "F").reduce((s, r) => s + r.course.credits, 0)}</span>
          </p>
          <p>
            GPA: <span className="font-semibold">{result.complete ? formatGpa(result.gpa) : "—"}</span>
          </p>
        </div>
      </div>
      <FormActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <PrintButton label="Print mark sheet" />
      </FormActions>
    </div>
  );
}

