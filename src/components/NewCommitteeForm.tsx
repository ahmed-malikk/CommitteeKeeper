"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createCommittee, type CreateState } from "@/app/(app)/committees/actions";
import {
  DEFAULT_INPUT,
  NAME_MAX,
  ORDER_HELP,
  ORDER_LABELS,
  firstStepWithProblem,
  problemsForStep,
  validateAgreement,
  type AgreementField,
  type AgreementInput,
  type AgreementProblems,
  type OrderMethod,
} from "@/lib/agreement";
import { formatDate, ordinal } from "@/lib/dates";
import { formatRupees, type DisplayGrouping, type DisplayStyle } from "@/lib/money";
import { ErrorNote } from "./states";

const STEPS = ["Basics", "Turn order", "Rules and visibility"];
const initial: CreateState = { error: null, problems: {} };

/**
 * The guided flow for a new committee. Three steps share one form, so every answer is sent together at the end.
 * "Next" checks only the step you are on; the server checks everything again before saving.
 */
export function NewCommitteeForm({ defaultStart }: { defaultStart: string }) {
  const [values, setValues] = useState<AgreementInput>({ ...DEFAULT_INPUT, startDate: defaultStart });
  const [step, setStep] = useState(0);
  const [problems, setProblems] = useState<AgreementProblems>({});
  const [state, action, pending] = useActionState(createCommittee, initial);
  const [seenState, setSeenState] = useState(state);

  // When the server sends problems back, show them and return to the first step that has one.
  if (state !== seenState) {
    setSeenState(state);
    setProblems(state.problems);
    const bad = firstStepWithProblem(state.problems);
    if (bad >= 0) setStep(bad);
  }

  const set = <K extends AgreementField>(key: K, value: AgreementInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (problems[key]) setProblems((p) => ({ ...p, [key]: undefined }));
  };
  const last = step === STEPS.length - 1;

  function next() {
    const found = problemsForStep(validateAgreement(values).problems, step);
    setProblems(found);
    if (Object.keys(found).length === 0) setStep(step + 1);
  }

  const format = { style: values.displayStyle as DisplayStyle, grouping: values.displayGrouping as DisplayGrouping };
  const amountNumber = /^\d{1,10}$/.test(values.amount.trim()) ? Number(values.amount.trim()) : null;
  const err = (f: AgreementField) => problems[f];
  const fieldProps = (f: AgreementField) => ({
    "aria-invalid": err(f) ? (true as const) : undefined,
    "aria-describedby": err(f) ? `${f}-error` : undefined,
  });
  const problem = (f: AgreementField) =>
    err(f) ? (
      <span className="hint bad" id={`${f}-error`}>
        {err(f)}
      </span>
    ) : null;

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        // Pressing Enter on an early step should go to the next step, not create the committee.
        if (!last) {
          e.preventDefault();
          next();
        }
      }}
    >
      <ol className="steps" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className={i === step ? "cur" : i < step ? "done" : ""}>
            <span className="bar" />
            <span className="lbl">
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {state.error ? (
        <div style={{ marginBottom: 16 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}

      <div className="wizbody">
        <section hidden={step !== 0} aria-label="The basics">
          <h2>The basics</h2>
          <div className="field">
            <label htmlFor="name">Committee name</label>
            <input
              className="input"
              id="name"
              name="name"
              dir="auto"
              autoComplete="off"
              maxLength={NAME_MAX * 2}
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Cousins Fund"
              {...fieldProps("name")}
            />
            {problem("name")}
          </div>
          <div className="pair">
            <div className="field">
              <label htmlFor="amount">Instalment (Rs per period)</label>
              <input
                className="input"
                id="amount"
                name="amount"
                inputMode="numeric"
                autoComplete="off"
                value={values.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="3000"
                {...fieldProps("amount")}
              />
              {err("amount") ? problem("amount") : <span className="hint">{amountNumber ? formatRupees(amountNumber, format) : "Whole rupees, digits only."}</span>}
            </div>
            <div className="field">
              <label htmlFor="periods">Number of periods (2 to 30)</label>
              <input
                className="input"
                id="periods"
                name="periods"
                inputMode="numeric"
                autoComplete="off"
                value={values.periods}
                onChange={(e) => set("periods", e.target.value)}
                placeholder="6"
                {...fieldProps("periods")}
              />
              {err("periods") ? problem("periods") : <span className="hint">One period for each turn: usually one a month.</span>}
            </div>
          </div>
          <div className="pair">
            <div className="field">
              <label htmlFor="startDate">Start date</label>
              <input className="input" id="startDate" name="startDate" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} {...fieldProps("startDate")} />
              {err("startDate") ? problem("startDate") : <span className="hint">Can be in the past, for a committee that is already running.</span>}
            </div>
            <div className="field">
              <label htmlFor="dueDay">Due day each month (1 to 28)</label>
              <input
                className="input"
                id="dueDay"
                name="dueDay"
                inputMode="numeric"
                autoComplete="off"
                value={values.dueDay}
                onChange={(e) => set("dueDay", e.target.value)}
                {...fieldProps("dueDay")}
              />
              {problem("dueDay")}
            </div>
          </div>
          <div className="pair">
            <div className="field">
              <label htmlFor="graceDays">Grace days after the due day</label>
              <input
                className="input"
                id="graceDays"
                name="graceDays"
                inputMode="numeric"
                autoComplete="off"
                value={values.graceDays}
                onChange={(e) => set("graceDays", e.target.value)}
                {...fieldProps("graceDays")}
              />
              {err("graceDays") ? problem("graceDays") : <span className="hint">A payment is late only after these days. 0 means late the day after.</span>}
            </div>
          </div>
        </section>

        <section hidden={step !== 1} aria-label="Turn order">
          <h2>How are the turns decided?</h2>
          <div className="stack" role="radiogroup" aria-label="How turns are decided">
            {(Object.keys(ORDER_LABELS) as OrderMethod[]).map((m) => (
              <label className="li choice" key={m}>
                <input type="radio" name="orderMethod" value={m} checked={values.orderMethod === m} onChange={() => set("orderMethod", m)} />
                <div className="grow">
                  <span className="t">{ORDER_LABELS[m]}</span>
                  <span className="s">{ORDER_HELP[m]}</span>
                </div>
              </label>
            ))}
          </div>
          {problem("orderMethod")}
          <p className="sm mut" style={{ marginTop: 10 }}>
            Turns already paid out are always locked.
          </p>
        </section>

        <section hidden={step !== 2} aria-label="Rules and visibility">
          <h2>Reminders</h2>
          <div className="pair">
            <div className="field">
              <label htmlFor="remindBeforeDays">Remind before the due day (days)</label>
              <input
                className="input"
                id="remindBeforeDays"
                name="remindBeforeDays"
                inputMode="numeric"
                value={values.remindBeforeDays}
                onChange={(e) => set("remindBeforeDays", e.target.value)}
                {...fieldProps("remindBeforeDays")}
              />
              {problem("remindBeforeDays")}
            </div>
            <div className="field">
              <label htmlFor="remindLateEvery">Late reminders every (days)</label>
              <input
                className="input"
                id="remindLateEvery"
                name="remindLateEvery"
                inputMode="numeric"
                value={values.remindLateEvery}
                onChange={(e) => set("remindLateEvery", e.target.value)}
                {...fieldProps("remindLateEvery")}
              />
              {problem("remindLateEvery")}
            </div>
          </div>

          <h2 style={{ marginTop: 22 }}>How amounts look</h2>
          <div className="seg" role="radiogroup" aria-label="Amount style">
            {(
              [
                ["rs", "Rs 12,000"],
                ["rs_dash", "Rs. 12,000/-"],
              ] as const
            ).map(([v, label]) => (
              <span key={v}>
                <input type="radio" name="displayStyle" id={`ds-${v}`} value={v} checked={values.displayStyle === v} onChange={() => set("displayStyle", v)} />
                <label htmlFor={`ds-${v}`}>{label}</label>
              </span>
            ))}
          </div>
          <div className="seg" role="radiogroup" aria-label="Digit grouping" style={{ marginTop: 8 }}>
            {(
              [
                ["western", "1,200,000"],
                ["lakh", "12,00,000"],
              ] as const
            ).map(([v, label]) => (
              <span key={v}>
                <input type="radio" name="displayGrouping" id={`dg-${v}`} value={v} checked={values.displayGrouping === v} onChange={() => set("displayGrouping", v)} />
                <label htmlFor={`dg-${v}`}>{label}</label>
              </span>
            ))}
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            Preview: <b>{formatRupees(1200000, format)}</b> and <b>{formatRupees(amountNumber && amountNumber > 0 ? amountNumber : 3000, format)}</b>
          </p>

          <h2 style={{ marginTop: 22 }}>What members can see</h2>
          <p className="mut" style={{ marginBottom: 8 }}>
            A member always sees their own turn, payments and receipts, and nothing about anyone else. You can allow more:
          </p>
          <div className="list" style={{ padding: "0 18px" }}>
            {(
              [
                ["membersSeePayments", "Who has paid", "Other members' payment status."],
                ["membersSeeTurns", "Whose turn it is", "The full payout order."],
                ["membersSeeHistory", "The history", "The whole chain of entries."],
              ] as const
            ).map(([key, title, help]) => (
              <label className="sw" key={key}>
                <div>
                  <div className="t">{title}</div>
                  <div className="s">{help}</div>
                </div>
                <input type="checkbox" name={key} checked={values[key]} onChange={(e) => set(key, e.target.checked)} />
              </label>
            ))}
          </div>

          <h2 style={{ marginTop: 22 }}>Your agreement</h2>
          <div className="list" style={{ padding: "0 18px" }}>
            <Row t="Instalment" v={amountNumber ? `${formatRupees(amountNumber, format)} per period` : "—"} />
            <Row t="Periods" v={values.periods ? `${values.periods}` : "—"} />
            <Row t="Starts, due day" v={`${formatDate(values.startDate)}, the ${ordinal(Number(values.dueDay) || 0)}`} />
            <Row t="Turn order" v={ORDER_LABELS[values.orderMethod as OrderMethod] ?? "—"} />
          </div>
          <p className="sm mut" style={{ marginTop: 8 }}>
            You can print this agreement and share it with members once the committee is created.
          </p>
        </section>
      </div>

      <div className="wizbar">
        {step === 0 ? (
          <Link className="btn secondary" href="/committees">
            Cancel
          </Link>
        ) : (
          <button className="btn secondary" type="button" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {last ? (
          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create committee"}
          </button>
        ) : (
          <button className="btn primary" type="submit">
            Next
          </button>
        )}
      </div>
    </form>
  );
}

function Row({ t, v }: { t: string; v: string }) {
  return (
    <div className="sw">
      <div className="t">{t}</div>
      <span dir="auto">{v}</span>
    </div>
  );
}
